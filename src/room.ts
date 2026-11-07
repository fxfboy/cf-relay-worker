import { DurableObject } from "cloudflare:workers";
import { MAX_MESSAGE_BYTES, MAX_MSG_PER_SEC, atCapacity, byteLength, controlError } from "./protocol";

export class Room extends DurableObject {
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
    // 启用 Hibernation:由运行时保管连接,空闲时休眠不计费
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") {
      ws.send(controlError("bad_request", "text frames only"));
      return;
    }
    if (byteLength(message) > MAX_MESSAGE_BYTES) {
      ws.send(controlError("too_large"));
      return;
    }
    if (!this.allow(ws)) {
      ws.send(controlError("rate_limited"));
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
    const raw = ws.deserializeAttachment() as { windowStart: number; count: number } | null;
    let state = raw ?? { windowStart: now, count: 0 };
    if (now - state.windowStart >= 1000) {
      state = { windowStart: now, count: 0 };
    }
    state.count += 1;
    ws.serializeAttachment(state);
    return state.count <= MAX_MSG_PER_SEC;
  }

  webSocketClose(ws: WebSocket, code: number): void {
    try { ws.close(code); } catch { /* already closing */ }
  }

  webSocketError(_ws: WebSocket, _error: unknown): void {
    // 运行时会清理该连接;无需额外状态
  }
}
