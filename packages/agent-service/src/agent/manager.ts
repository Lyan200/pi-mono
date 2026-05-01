import { randomUUID } from "node:crypto";
import type { AgentEvent, ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import type { ServiceConfig } from "../config.js";
import type { EventStore } from "../db/store.js";
import { AgentController } from "./controller.js";

export type SessionEventCallback = (sessionId: string, event: AgentEvent) => void;

export class AgentManager {
	private sessions = new Map<string, AgentController>();
	private eventListeners = new Set<SessionEventCallback>();

	constructor(
		private config: ServiceConfig,
		private store: EventStore,
	) {}

	onEvent(cb: SessionEventCallback): () => void {
		this.eventListeners.add(cb);
		return () => this.eventListeners.delete(cb);
	}

	async createSession(opts: {
		name?: string;
		model?: Model<any>;
		systemPrompt?: string;
		thinkingLevel?: ThinkingLevel;
		skills?: string[];
	}): Promise<AgentController> {
		const id = randomUUID();
		const name = opts.name ?? `Session ${id.slice(0, 8)}`;

		const controller = new AgentController({
			id,
			name,
			systemPrompt: opts.systemPrompt,
			model: opts.model,
			thinkingLevel: opts.thinkingLevel,
			skills: opts.skills,
			config: this.config,
			onEvent: (sessionId, event) => {
				for (const listener of this.eventListeners) {
					listener(sessionId, event);
				}
			},
			onStatusChange: (sessionId, status) => {
				const ctrl = this.sessions.get(sessionId);
				if (!ctrl) return;
				this.store.updateSessionStatus(sessionId, status, ctrl.getInfo().messageCount, ctrl.getInfo().totalCost);
			},
			onBufferFlush: (events) => {
				this.store.insertEvents(events);
			},
		});

		this.sessions.set(id, controller);
		this.store.upsertSession(controller.getInfo());

		return controller;
	}

	getSession(id: string): AgentController | undefined {
		return this.sessions.get(id);
	}

	listSessions(): AgentController[] {
		return Array.from(this.sessions.values());
	}

	async deleteSession(id: string): Promise<void> {
		const controller = this.sessions.get(id);
		if (controller) {
			await controller.dispose();
			this.sessions.delete(id);
			this.store.deleteSession(id);
		}
	}

	async dispose(): Promise<void> {
		for (const [, controller] of this.sessions) {
			await controller.dispose();
		}
		this.sessions.clear();
		this.eventListeners.clear();
	}

	async restoreSessions(): Promise<void> {
		const stored = this.store.listSessions();
		for (const info of stored) {
			const controller = new AgentController({
				id: info.id,
				name: info.name,
				systemPrompt: info.systemPrompt,
				thinkingLevel: info.thinkingLevel,
				skills: info.skills,
				config: this.config,
				onEvent: (sessionId, event) => {
					for (const listener of this.eventListeners) {
						listener(sessionId, event);
					}
				},
				onStatusChange: (sessionId, status) => {
					const ctrl = this.sessions.get(sessionId);
					if (!ctrl) return;
					this.store.updateSessionStatus(sessionId, status, ctrl.getInfo().messageCount, ctrl.getInfo().totalCost);
				},
				onBufferFlush: (events) => {
					this.store.insertEvents(events);
				},
			});
			this.sessions.set(info.id, controller);
		}
	}
}
