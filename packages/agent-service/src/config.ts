import { join, resolve } from "node:path";

export interface ServiceConfig {
	port: number;
	host: string;
	dbPath: string;
	agentDir: string;
	eventBufferSize: number;
	eventFlushIntervalMs: number;
	eventFlushBatchSize: number;
	webUiDir: string;
	defaultProvider?: string;
	defaultModel?: string;
}

export function loadConfig(): ServiceConfig {
	return {
		port: parseInt(process.env.PORT ?? "3000", 10),
		host: process.env.HOST ?? "0.0.0.0",
		dbPath: process.env.DB_PATH ?? join(process.cwd(), "data", "agent-service.db"),
		agentDir: process.env.AGENT_DIR ?? join(process.cwd(), "data", "agent"),
		eventBufferSize: parseInt(process.env.EVENT_BUFFER_SIZE ?? "1000", 10),
		eventFlushIntervalMs: parseInt(process.env.EVENT_FLUSH_INTERVAL_MS ?? "500", 10),
		eventFlushBatchSize: parseInt(process.env.EVENT_FLUSH_BATCH_SIZE ?? "100", 10),
		webUiDir: process.env.WEB_UI_DIR ?? resolve(process.cwd(), "public"),
		defaultProvider: process.env.DEFAULT_PROVIDER ?? undefined,
		defaultModel: process.env.DEFAULT_MODEL ?? undefined,
	};
}
