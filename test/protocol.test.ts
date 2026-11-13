import { describe, it, expect } from "vitest";
import {
  CF_RECEIVED_WS_MESSAGE_BYTES, DEFAULT_MAX_MESSAGE_BYTES,
  MAX_MSG_PER_SEC, MAX_CONNECTIONS, PROTOCOL_VERSION,
  controlError, byteLength, atCapacity, resolveMaxMessageBytes,
} from "../src/protocol";

describe("protocol constants & helpers", () => {
  it("has spec-exact constants", () => {
    expect(CF_RECEIVED_WS_MESSAGE_BYTES).toBe(33_554_432);
    expect(DEFAULT_MAX_MESSAGE_BYTES).toBe(CF_RECEIVED_WS_MESSAGE_BYTES);
    expect(MAX_MSG_PER_SEC).toBe(20);
    expect(MAX_CONNECTIONS).toBe(8);
    expect(PROTOCOL_VERSION).toBe(1);
  });
  it("resolves MAX_MESSAGE_BYTES with default, override, and platform clamp", () => {
    expect(resolveMaxMessageBytes(undefined)).toBe(33_554_432);
    expect(resolveMaxMessageBytes("")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("  ")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("0")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("-1")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("1024.5")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("1e3")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("abc")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("1024")).toBe(1024);
    expect(resolveMaxMessageBytes(" 2048 ")).toBe(2048);
    expect(resolveMaxMessageBytes("1")).toBe(1);
    expect(resolveMaxMessageBytes("33554432")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("33554433")).toBe(33_554_432);
    expect(resolveMaxMessageBytes("999999999999999999999")).toBe(33_554_432);
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
