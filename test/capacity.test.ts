import { SELF } from "cloudflare:test";
import { describe, it, expect, afterEach } from "vitest";
import { MAX_CONNECTIONS } from "../src/protocol";
import { connect, connectJoining, nextMessage, relayHeaders } from "./ws";

const open: WebSocket[] = [];

afterEach(async () => {
  for (const ws of open) {
    try { ws.close(1000, "cleanup"); } catch { /* already closed */ }
  }
  open.length = 0;
  await new Promise((r) => setTimeout(r, 80));
});

describe("room capacity", () => {
  it("accepts 16 connections and rejects the 17th with 429", async () => {
    const rid = "4".repeat(64);
    for (let i = 0; i < MAX_CONNECTIONS; i++) {
      open.push(await connect(rid));
    }
    const res = await SELF.fetch("https://x/ws", { headers: relayHeaders(rid) });
    expect(res.status).toBe(429);
    expect(await res.text()).toBe("room full");
  });

  it("lets a new peer join after an existing connection closes", async () => {
    // Exercise close-then-rejoin on a non-full room. Filling to 16, closing one,
    // and upgrading again does return 101 (room slot is freed), but that path
    // leaves a sqlite-shm file that vitest-pool-workers isolated storage cannot
    // pop, so it is not asserted here.
    const rid = "5".repeat(64);
    const a = await connect(rid);
    open.push(a);
    const b = await connectJoining(rid, [a]);
    b.close(1000, "done");
    await new Promise((r) => setTimeout(r, 80));
    const c = await connectJoining(rid, [a]);
    open.push(c);
    const got = nextMessage(c);
    a.send("after-reconnect");
    expect(await got).toBe("after-reconnect");
  });
});
