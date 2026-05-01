import { Router as createRouter, type Router } from "express";
import type { AgentManager } from "../agent/manager.js";
import type { EventStore } from "../db/store.js";
import type { CreateSessionRequest, PromptRequest, SteerRequest } from "../types.js";

export function createSessionRoutes(manager: AgentManager, _store: EventStore): Router {
	const router = createRouter();

	router.post("/", async (req, res) => {
		try {
			const body = req.body as CreateSessionRequest;
			const controller = await manager.createSession({
				name: body.name,
				systemPrompt: body.systemPrompt,
				thinkingLevel: body.thinkingLevel,
				skills: body.skills,
			});
			res.status(201).json(controller.getInfo());
		} catch (err: unknown) {
			res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create session" });
		}
	});

	router.get("/", (_req, res) => {
		const sessions = manager.listSessions().map((c) => c.getInfo());
		res.json(sessions);
	});

	router.get("/:id", (req, res) => {
		const controller = manager.getSession(req.params.id);
		if (!controller) {
			res.status(404).json({ error: "Session not found" });
			return;
		}
		res.json(controller.getInfo());
	});

	router.delete("/:id", async (req, res) => {
		const controller = manager.getSession(req.params.id);
		if (!controller) {
			res.status(404).json({ error: "Session not found" });
			return;
		}
		await manager.deleteSession(req.params.id);
		res.json({ success: true });
	});

	router.post("/:id/prompt", async (req, res) => {
		const controller = manager.getSession(req.params.id);
		if (!controller) {
			res.status(404).json({ error: "Session not found" });
			return;
		}
		const body = req.body as PromptRequest;
		controller.prompt(body.message).catch(() => {});
		res.json({ success: true });
	});

	router.post("/:id/steer", async (req, res) => {
		const controller = manager.getSession(req.params.id);
		if (!controller) {
			res.status(404).json({ error: "Session not found" });
			return;
		}
		const body = req.body as SteerRequest;
		await controller.steer(body.message);
		res.json({ success: true });
	});

	router.post("/:id/abort", async (req, res) => {
		const controller = manager.getSession(req.params.id);
		if (!controller) {
			res.status(404).json({ error: "Session not found" });
			return;
		}
		await controller.abort();
		res.json({ success: true });
	});

	return router;
}
