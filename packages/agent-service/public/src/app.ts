import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import "./components/session-list.js";
import "./components/session-detail.js";
import "./components/event-inspector.js";
import { appState } from "./state.js";

@customElement("pi-agent-app")
export class AgentApp extends LitElement {
  static styles = css`
    :host { display: grid; grid-template-columns: 320px 1fr; height: 100vh; overflow: hidden; }
  `;

  private ws: WebSocket | null = null;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private unsub?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.connectWs();

    // Re-subscribe when sessions change
    this.unsub = appState.subscribe(() => {
      this.subscribeToSessions();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ws?.close();
    clearTimeout(this.reconnectTimer);
    this.unsub?.();
  }

  connectWs(): void {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${protocol}//${location.host}/ws`);

    this.ws.onopen = () => {
      this.subscribeToSessions();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "agent_event") {
          appState.addEvent(data.sessionId, data.event);
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connectWs(), 2000);
    };
  }

  subscribeToSessions(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    for (const session of appState.sessions) {
      this.ws.send(JSON.stringify({ type: "subscribe", sessionId: session.id }));
    }
  }

  render() {
    return html`
      <session-list></session-list>
      <session-detail></session-detail>
    `;
  }
}
