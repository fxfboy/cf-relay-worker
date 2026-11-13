import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import {
  MAX_MSG_PER_SEC,
  MAX_ROOM_BYTES_PER_SEC,
  MAX_VIOLATIONS,
  atCapacity,
  byteLength,
  controlError,
  controlHello,
  controlPeerJoined,
  resolveMaxMessageBytes,
  type ControlCode,
} from "./protocol";

type Attach = { windowStart: number; count: number; violations: number };

export class Room extends DurableObject<Env> {
  // In-memory only; resets if the DO hibernates. That is fine for a budget window.
  #budgetStart = 0;
  #budgetBytes = 0;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    if (atCapacity(this.ctx.getWebSockets().length)) {
      return new Response("room full", { status: 429 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // Hibernation: the runtime holds the socket; idle time is not billed.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ windowStart: Date.now(), count: 0, violations: 0 } satisfies Attach);

    const sockets = this.ctx.getWebSockets();
    const joined = controlPeerJoined(sockets.length);
    for (const peer of sockets) {
      if (peer !== server) {
        try {
          peer.send(joined);
        } catch {
          // peer is mid-close/errored; skip it
        }
      }
    }
    try {
      server.send(controlHello());
    } catch {
      // mid-close
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") {
      this.reject(ws, "bad_request", "text frames only");
      return;
    }
    const size = byteLength(message);
    if (size > resolveMaxMessageBytes(this.env.MAX_MESSAGE_BYTES)) {
      this.reject(ws, "too_large");
      return;
    }
    if (!this.allow(ws) || !this.allowRoomBytes(size)) {
      this.reject(ws, "rate_limited");
      return;
    }
    for (const peer of this.ctx.getWebSockets()) {
      if (peer !== ws) {
        try {
          peer.send(message);
        } catch {
          // peer is mid-close/errored; skip it, don't starve the remaining peers
        }
      }
    }
  }

  private allow(ws: WebSocket): boolean {
    const now = Date.now();
    const state = this.attachment(ws);
    if (now - state.windowStart >= 1000) {
      state.windowStart = now;
      state.count = 0;
    }
    state.count += 1;
    ws.serializeAttachment(state);
    return state.count <= MAX_MSG_PER_SEC;
  }

  private allowRoomBytes(n: number): boolean {
    const now = Date.now();
    if (now - this.#budgetStart >= 1000) {
      this.#budgetStart = now;
      this.#budgetBytes = 0;
    }
    if (this.#budgetBytes + n > MAX_ROOM_BYTES_PER_SEC) return false;
    this.#budgetBytes += n;
    return true;
  }

  private attachment(ws: WebSocket): Attach {
    const raw = ws.deserializeAttachment() as Attach | null;
    return raw ?? { windowStart: Date.now(), count: 0, violations: 0 };
  }

  private reject(ws: WebSocket, code: ControlCode, detail?: string): void {
    try {
      ws.send(controlError(code, detail));
    } catch {
      // already closing
    }
    const state = this.attachment(ws);
    state.violations += 1;
    ws.serializeAttachment(state);
    if (state.violations >= MAX_VIOLATIONS) {
      try {
        ws.close(1008, "too many violations");
      } catch {
        // already closing
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number): void {
    try { ws.close(code); } catch { /* already closing */ }
  }

  webSocketError(_ws: WebSocket, _error: unknown): void {
    // Runtime cleans up the connection; no extra state to drop.
  }
}
