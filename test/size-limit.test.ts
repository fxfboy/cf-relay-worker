import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { connect, connectJoining, nextMessage, nextClose } from "./ws";
import { MAX_VIOLATIONS, resolveMaxMessageBytes } from "../src/protocol";

const RID = "e".repeat(64);
// vitest.config.ts 把 MAX_MESSAGE_BYTES 覆写成 1 MiB，用来走真实 Durable Object 路径，
// 同时仍小于生产默认的 32 MiB，也能覆盖房间字节预算测试。
const LIMIT = resolveMaxMessageBytes(env.MAX_MESSAGE_BYTES);

describe("size limit", () => {
  it("rejects oversized message with too_large and does not broadcast", async () => {
    const a = await connect(RID);
    const b = await connectJoining(RID, [a]);
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
    const b = await connectJoining("f".repeat(64), [a]);
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

  it("rejects binary frames as bad_request and does not broadcast them", async () => {
    const a = await connect("2".repeat(64));
    const b = await connectJoining("2".repeat(64), [a]);
    let peerGot = false;
    b.addEventListener("message", () => { peerGot = true; });
    const reply = nextMessage(a);
    a.send(new Uint8Array([1, 2, 3]).buffer);
    expect(JSON.parse(await reply)).toEqual({
      control: "error",
      code: "bad_request",
      detail: "text frames only",
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(peerGot).toBe(false);
  });

  it("closes the connection after repeated violations", async () => {
    const a = await connect("3".repeat(64));
    const closed = nextClose(a);
    const codes: string[] = [];
    a.addEventListener("message", (e) => {
      const d = JSON.parse(e.data as string);
      if (d.control === "error") codes.push(d.code);
    });
    for (let i = 0; i < MAX_VIOLATIONS; i++) a.send("x".repeat(LIMIT + 1));
    const ev = await closed;
    expect(codes.filter((c) => c === "too_large")).toHaveLength(MAX_VIOLATIONS);
    expect(ev.code).toBe(1008);
  });
});
