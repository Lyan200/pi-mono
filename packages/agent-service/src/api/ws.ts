import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { AgentManager } from "../agent/manager.js";
import type { WsClientMessage, WsServerMessage } from "../types.js";

interface ClientState {
	ws: WebSocket;
	subscribedSessions: Set<string>;
}

export class WsHandler {
	private wss: WebSocketServer;
	private clients = new Set<ClientState>();

	constructor(server: HttpServer, manager: AgentManager) {
		this.wss = new WebSocketServer({ server, path: "/ws" });

		this.wss.on("connection", (ws: WebSocket) => {
			const state: ClientState = { ws, subscribedSessions: new Set() };
			this.clients.add(state);

			ws.on("message", (data) => {
				try {
					const msg = JSON.parse(data.toString()) as WsClientMessage;
					if (msg.type === "subscribe" && msg.sessionId) {
						state.subscribedSessions.add(msg.sessionId);
					} else if (msg.type === "unsubscribe" && msg.sessionId) {
						state.subscribedSessions.delete(msg.sessionId);
					}
				} catch {
					this.send(ws, { type: "error", message: "Invalid message format" });
				}
			});

			ws.on("close", () => {
				this.clients.delete(state);
			});
		});

		manager.onEvent((sessionId, event) => {
			for (const client of this.clients) {
				if (client.subscribedSessions.has(sessionId)) {
					this.send(client.ws, { type: "agent_event", sessionId, event });
				}
			}
		});
	}

	private send(ws: WebSocket, msg: WsServerMessage): void {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(msg));
		}
	}

	dispose(): void {
		this.wss.close();
		this.clients.clear();
	}
}
