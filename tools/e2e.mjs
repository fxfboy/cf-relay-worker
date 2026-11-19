#!/usr/bin/env node
// E2E check against a deployed relay: health, handshake, presence,
// text and binary relay, no echo. Host comes from argv or E2E_HOST.
import { randomBytes } from "node:crypto";

const HOST = process.argv[2] ?? process.env.E2E_HOST;
if (!HOST) {
  console.error("usage: node tools/e2e.mjs <host>   (or set E2E_HOST)");
  process.exit(1);
}

const RID = randomBytes(32).toString("hex");
const PROTOCOLS = ["cf-relay-v1", `rid.${RID}`];
const TIMEOUT = 15000;

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures++;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(name, fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      console.log(`  retry ${name} (${i}/${attempts - 1}): ${e.message}`);
      await sleep(1500);
    }
  }
}

const health = await fetch(`https://${HOST}/health`);
const healthBody = await health.text();
check("GET /health", health.status === 200 && healthBody === '{"ok":true}', `status=${health.status} body=${healthBody}`);

const wsUrl = `wss://${HOST}/ws`;

const connect = (name) =>
  retry(name, () =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, PROTOCOLS);
      ws.binaryType = "arraybuffer";
      const timer = setTimeout(() => {
        try { ws.close(); } catch { /* already closing */ }
        reject(new Error(`${name}: connect timeout`));
      }, TIMEOUT);
      ws.addEventListener("message", (e) => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.control === "hello" && parsed.v === 1) resolve(ws);
          else reject(new Error(`${name}: expected hello, got ${e.data}`));
        } catch {
          reject(new Error(`${name}: expected hello json, got ${e.data}`));
        }
      }, { once: true });
      ws.addEventListener("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`${name}: connect error ${e.message ?? "(reset)"}`));
      }, { once: true });
    }),
  );

const nextMessage = (ws, name, timeoutMs = TIMEOUT) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${name}: message timeout`)), timeoutMs);
    ws.addEventListener("message", (e) => {
      clearTimeout(timer);
      resolve(e.data);
    }, { once: true });
  });

const A = await connect("A");
const gotJoin = nextMessage(A, "A peer_joined");

const B = await connect("B");
const join = JSON.parse(await gotJoin);
check("peer_joined to existing peer", join.control === "peer_joined" && join.peers === 2, JSON.stringify(join));

let echoed = false;
A.addEventListener("message", () => { echoed = true; });

const gotText = nextMessage(B, "B text");
A.send("e2e-text");
check("text relay A -> B", (await gotText) === "e2e-text");

const gotBin = nextMessage(B, "B binary");
const payload = randomBytes(256);
A.send(payload.buffer);
const bin = await gotBin;
check(
  "binary relay A -> B byte-for-byte",
  bin instanceof ArrayBuffer && Buffer.from(bin).equals(payload),
  `type=${bin?.constructor?.name} bytes=${bin instanceof ArrayBuffer ? bin.byteLength : "?"}`,
);

await sleep(800);
check("no echo back to sender", !echoed);

A.close(1000);
B.close(1000);
process.exit(failures === 0 ? 0 : 1);
