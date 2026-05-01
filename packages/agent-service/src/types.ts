import type { AgentEvent, ThinkingLevel } from "@mariozechner/pi-agent-core";

export type SessionStatus = "idle" | "running" | "error";

export interface SessionInfo {
	id: string;
	name: string;
	modelProvider: string;
	modelId: string;
	systemPrompt: string;
	thinkingLevel: ThinkingLevel;
	skills: string[];
	status: SessionStatus;
	messageCount: number;
	totalCost: number;
	createdAt: number;
	updatedAt: number;
}

export interface StoredAgentEvent {
	id: number;
	sessionId: string;
	sequence: number;
	type: string;
	payload: string;
	toolName: string | null;
	isError: number;
	createdAt: number;
}

export interface CreateSessionRequest {
	name?: string;
	modelProvider?: string;
	modelId?: string;
	systemPrompt?: string;
	thinkingLevel?: ThinkingLevel;
	skills?: string[];
}

export interface PromptRequest {
	message: string;
}

export interface SteerRequest {
	message: string;
}

export type WsClientMessage = { type: "subscribe"; sessionId: string } | { type: "unsubscribe"; sessionId: string };

export type WsServerMessage =
	| { type: "agent_event"; sessionId: string; event: AgentEvent }
	| { type: "error"; message: string };
