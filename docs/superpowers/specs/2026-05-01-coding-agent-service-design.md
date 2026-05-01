---
name: coding-agent-service
description: Docker-packaged coding-agent service with REST API, WebUI, and observable logging
type: design
---

# Coding Agent Service Design

## Overview

A Docker-packaged web service wrapping `@mariozechner/pi-coding-agent` SDK, providing REST API + WebSocket for managing multiple coding-agent sessions, with SQLite-backed observability and a Web Components (lit) WebUI.

## Architecture

```
Express Server
  ├── REST API (会话 CRUD、配置、控制、事件查询)
  ├── WebSocket (实时推送 Agent 事件流)
  ├── AgentManager
  │    └── Map<sessionId, AgentController>
  │         ├── AgentSession  (pi SDK)
  │         └── EventBuffer   (环形缓冲区)
  ├── EventStore  (better-sqlite3)
  └── Static SPA (lit + tailwind)
```

## Data Model (SQLite)

### sessions
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| name | TEXT | Session display name |
| model_provider | TEXT | Provider name |
| model_id | TEXT | Model identifier |
| system_prompt | TEXT | System prompt |
| thinking_level | TEXT | Reasoning level |
| skills | TEXT | JSON array of skill configs |
| status | TEXT | idle/running/error |
| created_at | INTEGER | Unix ms |
| updated_at | INTEGER | Unix ms |
| message_count | INTEGER | Total messages |
| total_cost | REAL | Accumulated cost |

### agent_events
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto |
| session_id | TEXT FK | 关联会话 |
| sequence | INTEGER | Per-session sequence |
| type | TEXT | Event type |
| payload | TEXT | JSON event body (input/output) |
| tool_name | TEXT | For tool events |
| is_error | INTEGER | 0/1 for tool errors |
| created_at | INTEGER | Unix ms |

Index: (session_id, sequence), (session_id, type, created_at)

## Core Components

### AgentManager
- Manages lifecycle of AgentController instances
- Exposes: create, get, list, delete, update config
- Maintains in-memory registry `Map<string, AgentController>`

### AgentController
- Wraps `createAgentSession()` from `@mariozechner/pi-coding-agent`
- Uses `agent.subscribe()` to capture all AgentEvent
- For each event: writes to EventBuffer (ring buffer, last 1000), batched flush to EventStore (every 500ms or 100 events)
- Provides: prompt(), steer(), abort(), getState(), getEvents()
- Event types captured (with input/output):
  - `tool_execution_start` — captures toolName + args (input)
  - `tool_execution_end` — captures result + isError (output)
  - `message_start/update/end` — captures full message content
  - `turn_start/end` — captures turn boundary + toolResults
  - `agent_start/end` — captures lifecycle boundaries

### EventStore
- better-sqlite3 with WAL mode
- Synchronous API, batch inserts (no async overhead)
- Auto-create tables on first launch
- Methods: insertEvents(), getEvents(), querySessions(), getSessionTimeline()

### REST API

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/sessions | Create new session |
| GET | /api/sessions | List sessions |
| GET | /api/sessions/:id | Get session detail |
| DELETE | /api/sessions/:id | Delete session |
| POST | /api/sessions/:id/prompt | Send prompt |
| POST | /api/sessions/:id/steer | Steering message |
| POST | /api/sessions/:id/abort | Abort current |
| GET | /api/sessions/:id/events | Query events (paginated) |
| GET | /api/sessions/:id/events/stream | SSE event stream |
| GET | /api/health | Health check |
| GET | /api/info | Service info + available models |

### WebSocket
- Path: /ws
- Subscribe to live events from specific sessions
- Messages: `{ type: "subscribe", sessionId: string }`
- Events pushed as JSON: `{ type: "agent_event", sessionId, event }`

### WebUI (lit + tailwind)
- Session list page — create, select, delete sessions
- Session detail page — chat view with event timeline
- Event inspector — expandable tree per event showing input/output
- Model config panel — select model, set system prompt, configure skills
- Observability panel — per-session stats, cost tracking, event logs

### Docker

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY packages/agent-service/dist ./dist
COPY packages/agent-service/package.json ./
COPY packages/web-ui/dist ./public
# ... workspace dependencies
EXPOSE 3000
ENV PORT=3000
ENV DB_PATH=/data/agent-service.db
VOLUME /data
CMD ["node", "dist/index.js"]
```

Env config:
- `PORT` — HTTP port (default 3000)
- `DB_PATH` — SQLite path (default /data/agent-service.db)
- `AGENT_DIR` — pi agent config directory
- `DEFAULT_PROVIDER` — default LLM provider
- `DEFAULT_MODEL` — default model ID

## YAGNI Exclusions

- No user authentication (single-user, internal network)
- No horizontal scaling (single Docker container)
- No external message queue (batched SQLite writes enough)
- No metrics dashboard (Prometheus/Grafana) — costs and event counts in WebUI
- No plugin system — existing pi extension mechanism used directly

## File Structure (within packages/agent-service)

```
packages/agent-service/
  src/
    index.ts              # Express server entry
    config.ts             # Env config loader
    db/
      schema.ts           # SQLite schema DDL
      store.ts            # EventStore implementation
    agent/
      manager.ts          # AgentManager
      controller.ts       # AgentController (wraps pi SDK)
      config.ts           # Agent config types
    api/
      routes.ts           # Express route definitions
      sessions.ts         # Session CRUD handlers
      events.ts           # Event query/stream handlers
      ws.ts               # WebSocket handler
    webui/
      index.html          # SPA entry
      src/
        components/       # lit components
        pages/            # Page-level components
        state.ts          # Simple state management
  package.json
  tsconfig.json
  Dockerfile
```
