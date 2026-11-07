import { describe, it, expect } from "vitest";
import {
  MAX_MESSAGE_BYTES, MAX_MSG_PER_SEC, MAX_CONNECTIONS, PROTOCOL_VERSION,
  controlError, byteLength, atCapacity,
} from "../src/protocol";

describe("protocol constants & helpers", () => {
  it("has spec-exact constants", () => {
    expect(MAX_MESSAGE_BYTES).toBe(921600);
    expect(MAX_MSG_PER_SEC).toBe(20);
    expect(MAX_CONNECTIONS).toBe(8);
    expect(PROTOCOL_VERSION).toBe(1);
  });
  it("builds control error json", () => {
    expect(JSON.parse(controlError("too_large"))).toEqual({ control: "error", code: "too_large" });
    expect(JSON.parse(controlError("bad_request", "x"))).toEqual({ control: "error", code: "bad_request", detail: "x" });
  });
  it("counts utf-8 bytes", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("峰")).toBe(3);
  });
});

describe("atCapacity", () => {
  it("is false below the cap and true at or above it (MAX_CONNECTIONS=8)", () => {
    expect(atCapacity(0)).toBe(false);
    expect(atCapacity(7)).toBe(false);  // 7 existing sockets → the 8th connection is allowed
    expect(atCapacity(8)).toBe(true);   // 8 existing sockets → the 9th connection is rejected
    expect(atCapacity(9)).toBe(true);
  });
});
