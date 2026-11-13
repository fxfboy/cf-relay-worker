import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { connect, connectJoining, nextMessage, relayHeaders } from "./ws";

const RID = "b".repeat(64);

describe("room broadcast", () => {
  it("accepts a valid upgrade with 101 and a webSocket", async () => {
    const res = await SELF.fetch("https://x/ws", { headers: relayHeaders(RID) });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
  });

  it("sends hello to the new connection with v=1", async () => {
    const res = await SELF.fetch("https://x/ws", { headers: relayHeaders(RID) });
    const ws = res.webSocket!;
    ws.accept();
    expect(JSON.parse(await nextMessage(ws))).toEqual({ control: "hello", v: 1 });
  });

  it("notifies existing peers with peer_joined, but not the joiner", async () => {
    const a = await connect(RID);

    let joinerSawPeerJoined = false;
    const aGot = nextMessage(a);
    const bRes = await SELF.fetch("https://x/ws", { headers: relayHeaders(RID) });
    const b = bRes.webSocket!;
    b.accept();
    b.addEventListener("message", (e) => {
      const d = JSON.parse(e.data as string);
      if (d.control === "peer_joined") joinerSawPeerJoined = true;
    });

    expect(JSON.parse(await nextMessage(b))).toEqual({ control: "hello", v: 1 });
    const joined = JSON.parse(await aGot);
    expect(joined.control).toBe("peer_joined");
    expect(joined.peers).toBe(2);
    await new Promise((r) => setTimeout(r, 50));
    expect(joinerSawPeerJoined).toBe(false);
  });

  it("delivers a message to peers but not back to sender", async () => {
    const a = await connect(RID);
    const b = await connectJoining(RID, [a]);

    let gotBackToSender = false;
    a.addEventListener("message", () => { gotBackToSender = true; });

    const received = nextMessage(b);
    a.send("hello");
    expect(await received).toBe("hello");
    expect(gotBackToSender).toBe(false);
  });

  it("isolates different routing_ids", async () => {
    const a = await connect("c".repeat(64));
    const other = await connect("d".repeat(64));
    let leaked = false;
    other.addEventListener("message", () => { leaked = true; });
    a.send("secret");
    await new Promise((r) => setTimeout(r, 50));
    expect(leaked).toBe(false);
  });
});
