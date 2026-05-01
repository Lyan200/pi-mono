import type { AgentEvent, AgentMessage, ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { createAgentSession } from "@mariozechner/pi-coding-agent";
import type { ServiceConfig } from "../config.js";
import type { SessionInfo, SessionStatus } from "../types.js";

export interface AgentControllerOptions {
	id: string;
	name: string;
	systemPrompt?: string;
	model?: Model<any>;
	thinkingLevel?: ThinkingLevel;
	skills?: string[];
	config: ServiceConfig;
	onEvent: (sessionId: string, event: AgentEvent) => void;
	onStatusChange: (sessionId: string, status: SessionStatus) => void;
	onBufferFlush?: (
		events: Array<{
			sessionId: string;
			sequence: number;
			type: string;
			payload: string;
			toolName: string | null;
			isError: number;
			createdAt: number;
		}>,
	) => void;
}

function isAgentEvent(event: AgentSessionEvent): event is AgentEvent {
	return (
		event.type !== "queue_update" &&
		event.type !== "compaction_start" &&
		event.type !== "compaction_end" &&
		event.type !== "auto_retry_start" &&
		event.type !== "auto_retry_end" &&
		event.type !== "session_info_changed"
	);
}

export class AgentController {
	readonly id: string;
	name: string;
	systemPrompt = "";
	thinkingLevel: ThinkingLevel = "off";
	skills: string[] = [];

	private model?: Model<any>;
	private session: Awaited<ReturnType<typeof createAgentSession>>["session"] | null = null;
	private unsubscribe: (() => void) | null = null;
	private status: SessionStatus = "idle";
	private sequence = 0;
	private messageCount = 0;
	private totalCost = 0;
	private eventBuffer: Array<{
		sessionId: string;
		sequence: number;
		type: string;
		payload: string;
		toolName: string | null;
		isError: number;
		createdAt: number;
	}> = [];
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private onEvent: (sessionId: string, event: AgentEvent) => void;
	private onStatusChange: (sessionId: string, status: SessionStatus) => void;
	private onBufferFlush: NonNullable<AgentControllerOptions["onBufferFlush"]>;
	private config: ServiceConfig;
	private createdAt: number;
	private initialized = false;

	constructor(opts: AgentControllerOptions) {
		this.id = opts.id;
		this.name = opts.name;
		this.systemPrompt = opts.systemPrompt ?? "";
		this.model = opts.model;
		this.thinkingLevel = opts.thinkingLevel ?? "off";
		this.skills = opts.skills ?? [];
		this.config = opts.config;
		this.onEvent = opts.onEvent;
		this.onStatusChange = opts.onStatusChange;
		this.onBufferFlush = opts.onBufferFlush ?? (() => {});
		this.createdAt = Date.now();
	}

	getStatus(): SessionStatus {
		return this.status;
	}

	getModel(): Model<any> | undefined {
		return this.model;
	}

	getInfo(): SessionInfo {
		return {
			id: this.id,
			name: this.name,
			modelProvider: this.model?.provider ?? "",
			modelId: this.model?.id ?? "",
			systemPrompt: this.systemPrompt,
			thinkingLevel: this.thinkingLevel,
			skills: this.skills,
			status: this.status,
			messageCount: this.messageCount,
			totalCost: this.totalCost,
			createdAt: this.createdAt,
			updatedAt: Date.now(),
		};
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		const result = await createAgentSession({
			model: this.model,
			thinkingLevel: this.thinkingLevel,
		});
		this.session = result.session;

		// Set system prompt via the underlying agent state
		if (this.systemPrompt) {
			this.session.agent.state.systemPrompt = this.systemPrompt;
		}

		this.unsubscribe = this.session.subscribe((event: AgentSessionEvent) => {
			if (isAgentEvent(event)) {
				this.handleEvent(event);
			}
		});

		this.flushTimer = setInterval(() => {
			this.flushBuffer();
		}, this.config.eventFlushIntervalMs);
	}

	async prompt(message: string): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
		this.setStatus("running");
		try {
			await this.session!.prompt(message);
		} catch (err) {
			this.handleError(err);
			throw err;
		}
	}

	async steer(message: string): Promise<void> {
		if (!this.session) return;
		await this.session.steer(message);
	}

	async abort(): Promise<void> {
		await this.session?.abort();
	}

	async dispose(): Promise<void> {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		this.unsubscribe?.();
		this.flushBuffer();
		this.session = null;
	}

	private handleEvent(event: AgentEvent): void {
		const eventType = event.type;
		const toolName =
			eventType === "tool_execution_start"
				? (event as any).toolName
				: eventType === "tool_execution_end"
					? (event as any).toolName
					: null;

		const isError = eventType === "tool_execution_end" ? ((event as any).isError ? 1 : 0) : 0;

		const seq = this.sequence++;

		const eventRecord = {
			sessionId: this.id,
			sequence: seq,
			type: eventType,
			payload: JSON.stringify(event),
			toolName: toolName ?? null,
			isError,
			createdAt: Date.now(),
		};

		if (this.eventBuffer.length >= this.config.eventBufferSize) {
			this.eventBuffer.shift();
		}
		this.eventBuffer.push(eventRecord);

		if (eventType === "message_end") {
			this.messageCount++;
		}

		// Forward to WebSocket immediately
		this.onEvent(this.id, event);

		// Track cost from agent_end events
		if (eventType === "agent_end") {
			this.setStatus("idle");

			const endEvent = event as { messages?: AgentMessage[] };
			if (endEvent.messages) {
				for (const msg of endEvent.messages) {
					const anyMsg = msg as { usage?: { cost?: { total?: number } } };
					if (anyMsg.usage?.cost?.total) {
						this.totalCost += anyMsg.usage.cost.total;
					}
				}
			}
		}

		if (this.eventBuffer.length >= this.config.eventFlushBatchSize) {
			this.flushBuffer();
		}
	}

	private handleError(_err: unknown): void {
		this.setStatus("error");
	}

	private setStatus(status: SessionStatus): void {
		this.status = status;
		this.onStatusChange(this.id, status);
	}

	flushBuffer(): void {
		if (this.eventBuffer.length === 0) return;
		const events = this.eventBuffer.splice(0, this.eventBuffer.length);
		this.onBufferFlush(events);
	}
}
