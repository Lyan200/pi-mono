import { createServer } from "node:http";
import { join } from "node:path";
import express from "express";
import { AgentManager } from "./agent/manager.js";
import { createApiRoutes } from "./api/routes.js";
import { WsHandler } from "./api/ws.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/schema.js";
import { EventStore } from "./db/store.js";

async function main(): Promise<void> {
	const config = loadConfig();
	const db = createDatabase(config.dbPath);
	const store = new EventStore(db);

	const manager = new AgentManager(config, store);

	// Restore persisted sessions from DB (metadata only, no active agent)
	await manager.restoreSessions();

	const app = express();
	app.use(express.json());

	// Serve WebUI static files
	app.use(express.static(config.webUiDir));

	// API routes
	app.use("/api", createApiRoutes(manager, store));

	// SPA fallback: serve index.html for all non-API, non-static routes
	app.get("*", (_req, res) => {
		res.sendFile(join(config.webUiDir, "index.html"));
	});

	const server = createServer(app);

	// WebSocket on same HTTP server
	const wsHandler = new WsHandler(server, manager);

	server.listen(config.port, config.host, () => {
		console.log(`Agent service listening on http://${config.host}:${config.port}`);
		console.log(`WebSocket at ws://${config.host}:${config.port}/ws`);
		console.log(`Database at ${config.dbPath}`);
	});

	const shutdown = async () => {
		console.log("\nShutting down...");
		wsHandler.dispose();
		await manager.dispose();
		db.close();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

main().catch((err) => {
	console.error("Failed to start:", err);
	process.exit(1);
});
