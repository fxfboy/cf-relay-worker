import { describe, it, expect } from "vitest";
import { isValidRoutingId } from "../src/rid";

describe("isValidRoutingId", () => {
  const valid = "a".repeat(64);
  it("accepts 64 lowercase hex", () => {
    expect(isValidRoutingId(valid)).toBe(true);
    expect(isValidRoutingId("0123456789abcdef".repeat(4))).toBe(true);
  });
  it("rejects null / wrong length / uppercase / non-hex", () => {
    expect(isValidRoutingId(null)).toBe(false);
    expect(isValidRoutingId("")).toBe(false);
    expect(isValidRoutingId("a".repeat(63))).toBe(false);
    expect(isValidRoutingId("a".repeat(65))).toBe(false);
    expect(isValidRoutingId("A".repeat(64))).toBe(false);
    expect(isValidRoutingId("g".repeat(64))).toBe(false);
  });
});
