import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { resolveMaxMessageBytes } from "../src/protocol";

const RID = "e".repeat(64);
// vitest.config.ts 把 MAX_MESSAGE_BYTES 覆写成 1024，用来走真实 Durable Object 路径。
const LIMIT = resolveMaxMessageBytes(env.MAX_MESSAGE_BYTES);

async function connect(rid: string): Promise<WebSocket> {
  const res = await SELF.fetch(`https://x/ws?rid=${rid}`, { headers: { Upgrade: "websocket" } });
  const ws = res.webSocket!;
  ws.accept();
  return ws;
}
function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((r) => ws.addEventListener("message", (e) => r(e.data as string), { once: true }));
}

describe("size limit", () => {
  it("rejects oversized message with too_large and does not broadcast", async () => {
    const a = await connect(RID);
    const b = await connect(RID);
    let peerGot = false;
    b.addEventListener("message", () => { peerGot = true; });

    const reply = nextMessage(a);
    a.send("x".repeat(LIMIT + 1));
    expect(JSON.parse(await reply)).toEqual({ control: "error", code: "too_large" });
    await new Promise((r) => setTimeout(r, 50));
    expect(peerGot).toBe(false);
  });

  it("allows a message exactly at the limit", async () => {
    const a = await connect("f".repeat(64));
    const b = await connect("f".repeat(64));
    const got = nextMessage(b);
    a.send("y".repeat(LIMIT));
    expect((await got).length).toBe(LIMIT);
  });

  it("measures utf-8 bytes, so a shorter character string can still be too_large", async () => {
    const a = await connect("1".repeat(64));
    const b = await connect("1".repeat(64));
    let peerGot = false;
    b.addEventListener("message", () => { peerGot = true; });

    const reply = nextMessage(a);
    // 「峰」是 3 字节。字符数小于 LIMIT，UTF-8 字节数超过 LIMIT。
    const chars = Math.floor(LIMIT / 3) + 1;
    expect(chars).toBeLessThan(LIMIT + 1);
    a.send("峰".repeat(chars));
    expect(JSON.parse(await reply)).toEqual({ control: "error", code: "too_large" });
    await new Promise((r) => setTimeout(r, 50));
    expect(peerGot).toBe(false);
  });
});
