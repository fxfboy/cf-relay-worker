import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const RID = "1".repeat(64);
async function connect(rid: string): Promise<WebSocket> {
  const res = await SELF.fetch(`https://x/ws?rid=${rid}`, { headers: { Upgrade: "websocket" } });
  const ws = res.webSocket!;
  ws.accept();
  return ws;
}

describe("rate limit", () => {
  it("emits rate_limited after 20 msgs in one second", async () => {
    const a = await connect(RID);
    await connect(RID); // peer,避免无接收者

    const errors: string[] = [];
    a.addEventListener("message", (e) => {
      const d = JSON.parse(e.data as string);
      if (d.control === "error") errors.push(d.code);
    });

    for (let i = 0; i < 25; i++) a.send(`m${i}`);
    await new Promise((r) => setTimeout(r, 100));
    expect(errors).toContain("rate_limited");
  });
});
