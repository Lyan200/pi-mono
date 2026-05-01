import { Router as createRouter, type Router } from "express";
import type { EventStore } from "../db/store.js";

export function createEventRoutes(store: EventStore): Router {
	const router = createRouter();

	router.get("/:sessionId", (req, res) => {
		const sessionId = req.params.sessionId;
		const limit = parseInt((req.query.limit as string) ?? "100", 10);
		const offset = parseInt((req.query.offset as string) ?? "0", 10);
		const events = store.getEvents(sessionId, Math.min(limit, 500), offset);
		res.json(events);
	});

	return router;
}
