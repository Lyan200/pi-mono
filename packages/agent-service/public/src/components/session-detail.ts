import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { appState, type Session } from "../state.js";

@customElement("session-detail")
export class SessionDetail extends LitElement {
  static styles = css`
    :host { display: flex; flex-direction: column; height: 100%; }
    .prompt-area { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #1f2937; }
    .prompt-area input { flex: 1; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 8px 12px; color: #e5e7eb; outline: none; }
    .prompt-area input:focus { border-color: #3b82f6; }
    .prompt-area button { padding: 8px 16px; background: #3b82f6; border: none; border-radius: 6px; cursor: pointer; color: white; font-size: 13px; }
    .prompt-area button:hover { background: #2563eb; }
    .prompt-area button.danger { background: #ef4444; }
    .prompt-area button.danger:hover { background: #dc2626; }
  `;

  @property({ type: Object }) session?: Session;

  private unsub?: () => void;
  private inputRef: HTMLInputElement | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsub = appState.subscribe(() => {
      this.session = appState.getSelectedSession();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.();
  }

  async sendPrompt(): Promise<void> {
    if (!this.session || !this.inputRef?.value.trim()) return;
    const msg = this.inputRef.value;
    this.inputRef.value = "";
    await fetch(`/api/sessions/${this.session.id}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
  }

  async abort(): Promise<void> {
    if (!this.session) return;
    await fetch(`/api/sessions/${this.session.id}/abort`, { method: "POST" });
  }

  render() {
    if (!this.session) {
      return html`<div class="flex items-center justify-center h-full text-gray-500">Select a session to begin</div>`;
    }
    return html`
      <div class="flex-1 overflow-y-auto p-4">
        <div class="mb-4">
          <h2 class="text-xl font-semibold">${this.session.name}</h2>
          <div class="text-sm text-gray-400 mt-1 space-x-2">
            <span>Model: ${this.session.modelProvider}/${this.session.modelId}</span>
            <span>|</span>
            <span>Status: ${this.session.status}</span>
            <span>|</span>
            <span>Messages: ${this.session.messageCount}</span>
            <span>|</span>
            <span>Cost: $${this.session.totalCost.toFixed(4)}</span>
          </div>
        </div>
        <event-inspector .sessionId=${this.session.id}></event-inspector>
      </div>
      <div class="prompt-area">
        <input placeholder="Type a prompt..." @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this.sendPrompt(); }}
               .value=${""} ${(el: HTMLInputElement | null) => { if (el) this.inputRef = el; }}>
        <button @click=${this.sendPrompt}>Send</button>
        <button class="danger" @click=${this.abort}>Abort</button>
      </div>
    `;
  }
}
