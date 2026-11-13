import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { RID_PROTOCOL_PREFIX, SUBPROTOCOL } from "../src/protocol";
import { relayHeaders } from "./ws";

const RID = "a".repeat(64);

describe("worker upgrade routing", () => {
  it("400 when rid is missing (no query-string fallback)", async () => {
    const res = await SELF.fetch("https://x/ws", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(400);
  });

  it("400 when query-string rid is present but subprotocol/header is not (old path removed)", async () => {
    const res = await SELF.fetch(`https://x/ws?rid=${RID}`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(400);
  });

  it("400 when rid in subprotocol is invalid", async () => {
    const res = await SELF.fetch("https://x/ws", {
      headers: {
        Upgrade: "websocket",
        "Sec-WebSocket-Protocol": `${SUBPROTOCOL}, ${RID_PROTOCOL_PREFIX}nope`,
      },
    });
    expect(res.status).toBe(400);
  });

  it("400 when X-Relay-Room is invalid and no subprotocol rid is offered", async () => {
    const res = await SELF.fetch("https://x/ws", {
      headers: { Upgrade: "websocket", "X-Relay-Room": "nope" },
    });
    expect(res.status).toBe(400);
  });

  it("does not fall back to X-Relay-Room when the subprotocol rid is malformed", async () => {
    const res = await SELF.fetch("https://x/ws", {
      headers: {
        Upgrade: "websocket",
        "Sec-WebSocket-Protocol": `${SUBPROTOCOL}, ${RID_PROTOCOL_PREFIX}nope`,
        "X-Relay-Room": RID,
      },
    });
    expect(res.status).toBe(400);
  });

  it("426 when not an upgrade", async () => {
    const res = await SELF.fetch("https://x/ws", {
      headers: { "Sec-WebSocket-Protocol": `${SUBPROTOCOL}, ${RID_PROTOCOL_PREFIX}${RID}` },
    });
    expect(res.status).toBe(426);
  });

  it("101 and echoes cf-relay-v1 for a valid subprotocol offer", async () => {
    const res = await SELF.fetch("https://x/ws", { headers: relayHeaders(RID) });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
    expect(res.headers.get("Sec-WebSocket-Protocol")).toBe(SUBPROTOCOL);
  });

  it("101 via X-Relay-Room for non-browser clients (no subprotocol echo)", async () => {
    const res = await SELF.fetch("https://x/ws", {
      headers: { Upgrade: "websocket", "X-Relay-Room": RID },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
    expect(res.headers.get("Sec-WebSocket-Protocol")).toBeNull();
  });

  it("404 on other paths", async () => {
    const res = await SELF.fetch("https://x/other", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(404);
  });
});
