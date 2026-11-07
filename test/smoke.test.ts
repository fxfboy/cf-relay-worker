import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker smoke", () => {
  it("returns 404 on root (only /ws is routed)", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(404);
  });
});
