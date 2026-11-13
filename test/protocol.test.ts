import { describe, it, expect } from "vitest";
import {
  CF_RECEIVED_WS_MESSAGE_BYTES, DEFAULT_MAX_MESSAGE_BYTES,
  MAX_MSG_PER_SEC, MAX_CONNECTIONS, MAX_ROOM_BYTES_PER_SEC,
  MAX_VIOLATIONS, PROTOCOL_VERSION, SUBPROTOCOL, RID_PROTOCOL_PREFIX, ROOM_HEADER,
  controlError, controlHello, controlPeerJoined, byteLength, atCapacity, resolveMaxMessageBytes,
} from "../src/protocol";
import { extractRoomOffer, parseProtocols } from "../src/connect";

describe("protocol constants & helpers", () => {
  it("has spec-exact constants", () => {
    expect(CF_RECEIVED_WS_MESSAGE_BYTES).toBe(33_554_432);
    expect(DEFAULT_MAX_MESSAGE_BYTES).toBe(CF_RECEIVED_WS_MESSAGE_BYTES);
    expect(MAX_MSG_PER_SEC).toBe(20);
    expect(MAX_CONNECTIONS).toBe(16);
    expect(MAX_ROOM_BYTES_PER_SEC).toBe(4 * 1024 * 1024);
    expect(MAX_VIOLATIONS).toBe(3);
    expect(PROTOCOL_VERSION).toBe(1);
    expect(SUBPROTOCOL).toBe("cf-relay-v1");
    expect(RID_PROTOCOL_PREFIX).toBe("rid.");
    expect(ROOM_HEADER).toBe("X-Relay-Room");
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
  it("builds control json", () => {
    expect(JSON.parse(controlError("too_large"))).toEqual({ control: "error", code: "too_large" });
    expect(JSON.parse(controlError("bad_request", "x"))).toEqual({ control: "error", code: "bad_request", detail: "x" });
    expect(JSON.parse(controlHello())).toEqual({ control: "hello", v: 1 });
    expect(JSON.parse(controlPeerJoined(3))).toEqual({ control: "peer_joined", peers: 3 });
  });
  it("counts utf-8 bytes", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("峰")).toBe(3);
  });
});

describe("atCapacity", () => {
  it("is false below the cap and true at or above it (MAX_CONNECTIONS=16)", () => {
    expect(atCapacity(0)).toBe(false);
    expect(atCapacity(15)).toBe(false); // 15 existing → the 16th is allowed
    expect(atCapacity(16)).toBe(true);  // 16 existing → the 17th is rejected
    expect(atCapacity(17)).toBe(true);
  });
});

describe("extractRoomOffer", () => {
  const rid = "ab".repeat(32);

  function offer(headers: Record<string, string>, url = "https://x/ws"): ReturnType<typeof extractRoomOffer> {
    return extractRoomOffer(new Request(url, { headers }));
  }

  it("parses comma-separated subprotocols with whitespace", () => {
    expect(parseProtocols(` ${SUBPROTOCOL},  ${RID_PROTOCOL_PREFIX}${rid} `)).toEqual([
      SUBPROTOCOL,
      `${RID_PROTOCOL_PREFIX}${rid}`,
    ]);
  });

  it("prefers a valid rid.* token and echoes cf-relay-v1", () => {
    const got = offer({
      "Sec-WebSocket-Protocol": `${SUBPROTOCOL}, ${RID_PROTOCOL_PREFIX}${rid}`,
    });
    expect(got).toEqual({ rid, acceptProtocol: SUBPROTOCOL });
  });

  it("echoes rid.* when that is the only offered protocol", () => {
    const got = offer({ "Sec-WebSocket-Protocol": `${RID_PROTOCOL_PREFIX}${rid}` });
    expect(got).toEqual({ rid, acceptProtocol: `${RID_PROTOCOL_PREFIX}${rid}` });
  });

  it("falls back to X-Relay-Room when no rid token is offered", () => {
    const got = offer({ [ROOM_HEADER]: rid });
    expect(got).toEqual({ rid, acceptProtocol: null });
  });

  it("ignores query-string rid", () => {
    const got = offer({}, `https://x/ws?rid=${rid}`);
    expect(got).toEqual({ rid: null, acceptProtocol: null });
  });

  it("rejects a malformed rid.* token even if the header is valid", () => {
    const got = offer({
      "Sec-WebSocket-Protocol": `${SUBPROTOCOL}, ${RID_PROTOCOL_PREFIX}NOPE`,
      [ROOM_HEADER]: rid,
    });
    expect(got.rid).toBeNull();
  });
});
