import { describe, it, expect } from "vitest";
import { connect, connectJoining } from "./ws";
import { MAX_ROOM_BYTES_PER_SEC } from "../src/protocol";

const RID = "1".repeat(64);

describe("rate limit", () => {
  it("emits rate_limited after 20 msgs in one second and does not deliver the rejected ones", async () => {
    const a = await connect(RID);
    const b = await connectJoining(RID, [a]);

    const errors: string[] = [];
    a.addEventListener("message", (e) => {
      const d = JSON.parse(e.data as string);
      if (d.control === "error") errors.push(d.code);
    });

    const delivered: string[] = [];
    b.addEventListener("message", (e) => { delivered.push(e.data as string); });

    for (let i = 0; i < 25; i++) a.send(`m${i}`);
    await new Promise((r) => setTimeout(r, 150));
    expect(errors).toContain("rate_limited");
    expect(delivered).toHaveLength(20);
    expect(delivered[0]).toBe("m0");
    expect(delivered[19]).toBe("m19");
    expect(delivered).not.toContain("m20");
  });

  it("enforces a room-level byte budget and does not deliver the rejected message", async () => {
    const rid = "0".repeat(64);
    const a = await connect(rid);
    const b = await connectJoining(rid, [a]);

    const errors: string[] = [];
    a.addEventListener("message", (e) => {
      const d = JSON.parse(e.data as string);
      if (d.control === "error") errors.push(d.code);
    });
    const delivered: number[] = [];
    b.addEventListener("message", (e) => { delivered.push((e.data as string).length); });

    const chunkSize = Math.floor(MAX_ROOM_BYTES_PER_SEC / 4);
    const chunk = "z".repeat(chunkSize);
    for (let i = 0; i < 5; i++) a.send(chunk);
    await new Promise((r) => setTimeout(r, 200));
    expect(errors).toContain("rate_limited");
    expect(delivered).toHaveLength(4);
    expect(delivered.every((n) => n === chunkSize)).toBe(true);
  });
});
