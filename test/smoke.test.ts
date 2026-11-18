import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker smoke", () => {
  it("returns 404 on root (only /ws and /health are routed)", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(404);
  });

  it("GET /health returns 200 and a tiny JSON body", async () => {
    const res = await SELF.fetch("https://example.com/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ ok: true });
  });
});
