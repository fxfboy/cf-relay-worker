import { SELF } from "cloudflare:test";
import { SUBPROTOCOL, RID_PROTOCOL_PREFIX } from "../src/protocol";

export function relayHeaders(rid: string): Headers {
  const h = new Headers();
  h.set("Upgrade", "websocket");
  h.set("Sec-WebSocket-Protocol", `${SUBPROTOCOL}, ${RID_PROTOCOL_PREFIX}${rid}`);
  return h;
}

export function nextMessage(ws: WebSocket, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for message")), timeoutMs);
    ws.addEventListener("message", (e) => {
      clearTimeout(timer);
      resolve(e.data as string);
    }, { once: true });
  });
}

export function nextClose(ws: WebSocket, timeoutMs = 2000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for close")), timeoutMs);
    ws.addEventListener("close", (e) => {
      clearTimeout(timer);
      resolve({ code: e.code, reason: e.reason });
    }, { once: true });
  });
}

/** Upgrade, accept, and drain the hello control frame. */
export async function connect(rid: string): Promise<WebSocket> {
  const res = await SELF.fetch("https://x/ws", { headers: relayHeaders(rid) });
  if (res.status !== 101 || !res.webSocket) {
    throw new Error(`upgrade failed: ${res.status}`);
  }
  const ws = res.webSocket;
  ws.accept();
  const first = JSON.parse(await nextMessage(ws));
  if (first.control !== "hello" || first.v !== 1) {
    throw new Error(`expected hello, got ${JSON.stringify(first)}`);
  }
  return ws;
}

/**
 * Connect a new peer and drain `peer_joined` on sockets that were already in the room,
 * so later assertions are not confused by control frames.
 */
export async function connectJoining(rid: string, existing: WebSocket[]): Promise<WebSocket> {
  const pending = existing.map((p) => nextMessage(p));
  const ws = await connect(rid);
  for (const raw of await Promise.all(pending)) {
    const parsed = JSON.parse(raw);
    if (parsed.control !== "peer_joined") {
      throw new Error(`expected peer_joined on existing peer, got ${raw}`);
    }
  }
  return ws;
}
