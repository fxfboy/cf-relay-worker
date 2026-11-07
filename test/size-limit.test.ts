import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const RID = "e".repeat(64);

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
    a.send("x".repeat(921601)); // 900KB + 1 byte (ascii => 1 byte each)
    expect(JSON.parse(await reply)).toEqual({ control: "error", code: "too_large" });
    await new Promise((r) => setTimeout(r, 50));
    expect(peerGot).toBe(false);
  });

  it("allows a message exactly at the limit", async () => {
    const a = await connect("f".repeat(64));
    const b = await connect("f".repeat(64));
    const got = nextMessage(b);
    a.send("y".repeat(921600));
    expect((await got).length).toBe(921600);
  });
});
