import type Database from "better-sqlite3";
import type { SessionInfo, StoredAgentEvent } from "../types.js";

export class EventStore {
	private insertSessionStmt: Database.Statement<Record<string, unknown>>;
	private updateSessionStmt: Database.Statement<Record<string, unknown>>;
	private deleteSessionStmt: Database.Statement<[string]>;
	private insertEventStmt: Database.Statement<Record<string, unknown>>;
	private getSessionStmt: Database.Statement<[string]>;
	private listSessionsStmt: Database.Statement<[]>;
	private getEventsStmt: Database.Statement<[string, number, number]>;

	constructor(private db: Database.Database) {
		this.insertSessionStmt = db.prepare(`
      INSERT OR REPLACE INTO sessions (id, name, model_provider, model_id, system_prompt, thinking_level, skills, status, message_count, total_cost, created_at, updated_at)
      VALUES (@id, @name, @modelProvider, @modelId, @systemPrompt, @thinkingLevel, @skills, @status, @messageCount, @totalCost, @createdAt, @updatedAt)
    `);

		this.updateSessionStmt = db.prepare(`
      UPDATE sessions SET status = @status, message_count = @messageCount, total_cost = @totalCost, updated_at = @updatedAt WHERE id = @id
    `);

		this.deleteSessionStmt = db.prepare("DELETE FROM sessions WHERE id = ?");

		this.insertEventStmt = db.prepare(`
      INSERT INTO agent_events (session_id, sequence, type, payload, tool_name, is_error, created_at)
      VALUES (@sessionId, @sequence, @type, @payload, @toolName, @isError, @createdAt)
    `);

		this.getSessionStmt = db.prepare("SELECT * FROM sessions WHERE id = ?");

		this.listSessionsStmt = db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC");

		this.getEventsStmt = db.prepare(
			"SELECT * FROM agent_events WHERE session_id = ? ORDER BY sequence ASC LIMIT ? OFFSET ?",
		);
	}

	upsertSession(info: SessionInfo): void {
		this.insertSessionStmt.run({
			...info,
			skills: JSON.stringify(info.skills),
		});
	}

	updateSessionStatus(id: string, status: SessionInfo["status"], messageCount: number, totalCost: number): void {
		this.updateSessionStmt.run({ id, status, messageCount, totalCost, updatedAt: Date.now() });
	}

	deleteSession(id: string): void {
		this.db.transaction(() => {
			this.db.prepare("DELETE FROM agent_events WHERE session_id = ?").run(id);
			this.deleteSessionStmt.run(id);
		})();
	}

	getSession(id: string): SessionInfo | undefined {
		const row = this.getSessionStmt.get(id) as Record<string, unknown> | undefined;
		if (!row) return undefined;
		return this.rowToSessionInfo(row);
	}

	listSessions(): SessionInfo[] {
		const rows = this.listSessionsStmt.all() as Record<string, unknown>[];
		return rows.map((r) => this.rowToSessionInfo(r));
	}

	insertEvents(
		events: Array<{
			sessionId: string;
			sequence: number;
			type: string;
			payload: string;
			toolName: string | null;
			isError: number;
			createdAt: number;
		}>,
	): void {
		const insertMany = this.db.transaction((evts: Array<Record<string, unknown>>) => {
			for (const ev of evts) {
				this.insertEventStmt.run(ev);
			}
		});
		insertMany(events as unknown as Array<Record<string, unknown>>);
	}

	getEvents(sessionId: string, limit = 100, offset = 0): StoredAgentEvent[] {
		return this.getEventsStmt.all(sessionId, Math.min(limit, 500), offset) as StoredAgentEvent[];
	}

	private rowToSessionInfo(row: Record<string, unknown>): SessionInfo {
		return {
			id: row.id as string,
			name: row.name as string,
			modelProvider: row.model_provider as string,
			modelId: row.model_id as string,
			systemPrompt: row.system_prompt as string,
			thinkingLevel: row.thinking_level as SessionInfo["thinkingLevel"],
			skills: JSON.parse(row.skills as string),
			status: row.status as SessionInfo["status"],
			messageCount: row.message_count as number,
			totalCost: row.total_cost as number,
			createdAt: row.created_at as number,
			updatedAt: row.updated_at as number,
		};
	}
}
