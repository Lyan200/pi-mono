import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { appState, type Session } from "../state.js";

@customElement("session-list")
export class SessionList extends LitElement {
  static styles = css`
    :host { display: block; }
    .session-item { cursor: pointer; padding: 8px 12px; border-bottom: 1px solid #1f2937; }
    .session-item:hover { background: #1f2937; }
    .session-item.selected { background: #374151; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
    .status-idle { background: #6b7280; }
    .status-running { background: #22c55e; }
    .status-error { background: #ef4444; }
  `;

  @property({ type: Array }) sessions: Session[] = [];
  @property({ type: String }) selectedId: string | null = null;

  private unsub?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsub = appState.subscribe(() => {
      this.sessions = appState.sessions;
      this.selectedId = appState.selectedSessionId;
    });
    this.loadSessions();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.();
  }

  async loadSessions(): Promise<void> {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    appState.setSessions(data);
  }

  async createSession(): Promise<void> {
    const name = prompt("Session name (optional):") || undefined;
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await this.loadSessions();
  }

  async deleteSession(id: string, e: Event): Promise<void> {
    e.stopPropagation();
    if (!confirm("Delete this session?")) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (appState.selectedSessionId === id) {
      appState.selectSession(null);
    }
    await this.loadSessions();
  }

  render() {
    return html`
      <div class="p-4 border-r border-gray-800 h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold">Sessions</h2>
          <button @click=${this.createSession} class="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700">+ New</button>
        </div>
        <div class="flex-1 overflow-y-auto">
          ${this.sessions.map((s) => html`
            <div class="session-item ${this.selectedId === s.id ? "selected" : ""}"
                 @click=${() => appState.selectSession(s.id)}>
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <span class="status-dot status-${s.status}"></span>
                  <span class="text-sm">${s.name}</span>
                </div>
                <button @click=${(e: Event) => this.deleteSession(s.id, e)} class="text-red-400 hover:text-red-300 text-xs">x</button>
              </div>
              <div class="text-xs text-gray-500 mt-1">${s.modelProvider}/${s.modelId}</div>
              <div class="text-xs text-gray-500">${s.messageCount} msgs | cost $${s.totalCost.toFixed(4)}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
