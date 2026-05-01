import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { appState, type AgentEvent } from "../state.js";

@customElement("event-inspector")
export class EventInspector extends LitElement {
  static styles = css`
    :host { display: block; }
    .event { padding: 8px; margin: 4px 0; border-radius: 6px; border: 1px solid #1f2937; cursor: pointer; font-size: 13px; }
    .event:hover { background: #1f2937; }
    .event.tool_execution_start { border-left: 3px solid #3b82f6; }
    .event.tool_execution_end { border-left: 3px solid #22c55e; }
    .event.tool_execution_end.error { border-left: 3px solid #ef4444; }
    .event.message_start { border-left: 3px solid #a855f7; }
    .event.message_end { border-left: 3px solid #eab308; }
    .event-header { display: flex; justify-content: space-between; }
    .event-type { font-weight: 600; color: #9ca3af; text-transform: uppercase; font-size: 11px; }
    .event-time { color: #6b7280; font-size: 11px; }
    .event-summary { color: #d1d5db; font-size: 12px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .event-detail { margin-top: 8px; padding: 8px; background: #111827; border-radius: 4px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto; display: none; }
    .event-detail.open { display: block; }
  `;

  @property({ type: String }) sessionId = "";
  @state() private expanded = new Set<number>();
  @state() private events: AgentEvent[] = [];

  private unsub?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsub = appState.subscribe(() => {
      this.events = appState.getSessionEvents(this.sessionId);
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.();
  }

  toggleExpand(idx: number): void {
    if (this.expanded.has(idx)) {
      this.expanded.delete(idx);
    } else {
      this.expanded.add(idx);
    }
    this.requestUpdate();
  }

  getEventClass(event: AgentEvent): string {
    let cls = "event " + event.type;
    if (event.type === "tool_execution_end" && (event as any).isError) {
      cls += " error";
    }
    return cls;
  }

  getEventSummary(event: AgentEvent): string {
    if (event.type === "tool_execution_start") {
      const e = event as any;
      return `Tool: ${e.toolName} | args: ${JSON.stringify(e.args ?? {})}`;
    }
    if (event.type === "tool_execution_end") {
      const e = event as any;
      return `Result: ${e.isError ? "ERROR" : "OK"} | ${JSON.stringify(e.result ?? {}).slice(0, 80)}`;
    }
    if (event.type === "message_start" || event.type === "message_end") {
      const e = event as any;
      const role = e.message?.role ?? "unknown";
      return `Role: ${role}`;
    }
    return "";
  }

  render() {
    return html`
      <div class="space-y-1">
        <div class="text-sm text-gray-500 mb-2">Event Log (${this.events.length})</div>
        ${this.events.length === 0
          ? html`<div class="text-gray-600 text-sm">No events yet. Send a prompt to start.</div>`
          : this.events.map((event, idx) => html`
            <div class="${this.getEventClass(event)}" @click=${() => this.toggleExpand(idx)}>
              <div class="event-header">
                <span class="event-type">${event.type}</span>
                <span class="event-time">#${idx + 1}</span>
              </div>
              <div class="event-summary">${this.getEventSummary(event)}</div>
              <div class="event-detail ${this.expanded.has(idx) ? "open" : ""}">${this.formatPayload(event)}</div>
            </div>
          `)}
      </div>
    `;
  }

  private formatPayload(event: AgentEvent): string {
    return JSON.stringify(event, null, 2);
  }
}
