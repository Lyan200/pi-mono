import { Router as createRouter, type Router } from "express";
import type { AgentManager } from "../agent/manager.js";
import type { EventStore } from "../db/store.js";
import { createEventRoutes } from "./events.js";
import { createSessionRoutes } from "./sessions.js";

export function createApiRoutes(manager: AgentManager, store: EventStore): Router {
	const router = createRouter();

	router.get("/health", (_req, res) => {
		res.json({ status: "ok", uptime: process.uptime() });
	});

	router.get("/info", (_req, res) => {
		res.json({
			name: "pi-agent-service",
			version: "0.70.2",
			sessionCount: manager.listSessions().length,
		});
	});

	router.use("/sessions", createSessionRoutes(manager, store));
	router.use("/events", createEventRoutes(store));

	return router;
}
