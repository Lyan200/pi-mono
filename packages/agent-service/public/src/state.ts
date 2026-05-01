export interface Session {
  id: string;
  name: string;
  modelProvider: string;
  modelId: string;
  systemPrompt: string;
  thinkingLevel: string;
  status: string;
  messageCount: number;
  totalCost: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentEvent {
  type: string;
  [key: string]: unknown;
}

type Listener = () => void;

class AppState {
  private listeners = new Set<Listener>();
  sessions: Session[] = [];
  selectedSessionId: string | null = null;
  events: Map<string, AgentEvent[]> = new Map();

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }

  setSessions(sessions: Session[]): void {
    this.sessions = sessions;
    this.notify();
  }

  selectSession(id: string | null): void {
    this.selectedSessionId = id;
    this.notify();
  }

  addEvent(sessionId: string, event: AgentEvent): void {
    const existing = this.events.get(sessionId) ?? [];
    existing.push(event);
    this.events.set(sessionId, existing);
    this.notify();
  }

  getSelectedSession(): Session | undefined {
    return this.sessions.find((s) => s.id === this.selectedSessionId);
  }

  getSessionEvents(sessionId: string): AgentEvent[] {
    return this.events.get(sessionId) ?? [];
  }
}

export const appState = new AppState();
