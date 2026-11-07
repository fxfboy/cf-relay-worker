import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const RID = "a".repeat(64);

describe("worker upgrade routing", () => {
  it("400 when rid missing", async () => {
    const res = await SELF.fetch("https://x/ws", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(400);
  });
  it("400 when rid invalid", async () => {
    const res = await SELF.fetch("https://x/ws?rid=nope", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(400);
  });
  it("426 when not an upgrade", async () => {
    const res = await SELF.fetch(`https://x/ws?rid=${RID}`);
    expect(res.status).toBe(426);
  });
  it("404 on other paths", async () => {
    const res = await SELF.fetch("https://x/other", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(404);
  });
});
