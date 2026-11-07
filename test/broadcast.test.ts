import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const RID = "b".repeat(64);

async function connect(rid: string): Promise<WebSocket> {
  const res = await SELF.fetch(`https://x/ws?rid=${rid}`, { headers: { Upgrade: "websocket" } });
  const ws = res.webSocket!;
  ws.accept();
  return ws;
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.addEventListener("message", (e) => resolve(e.data as string), { once: true });
  });
}

describe("room broadcast", () => {
  it("accepts a valid upgrade with 101 and a webSocket", async () => {
    const res = await SELF.fetch(`https://x/ws?rid=${RID}`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
  });

  it("delivers a message to peers but not back to sender", async () => {
    const a = await connect(RID);
    const b = await connect(RID);

    let gotBackToSender = false;
    a.addEventListener("message", () => { gotBackToSender = true; });

    const received = nextMessage(b);
    a.send("hello");
    expect(await received).toBe("hello");
    expect(gotBackToSender).toBe(false);
  });

  it("isolates different routing_ids", async () => {
    const a = await connect("c".repeat(64));
    const other = await connect("d".repeat(64));
    let leaked = false;
    other.addEventListener("message", () => { leaked = true; });
    a.send("secret");
    await new Promise((r) => setTimeout(r, 50));
    expect(leaked).toBe(false);
  });
});
