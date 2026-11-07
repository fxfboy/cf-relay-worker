import { createHash, createHmac, createCipheriv } from "node:crypto";
import { argon2id } from "hash-wasm";
import { writeFileSync, mkdirSync } from "node:fs";

const KDF_SALT = "e2e-sync-kdf-v1-salt";              // 17 字节
const ROUTE_INFO = "e2e-sync-route-v1";
const KEY_INFO = "e2e-sync-key-v1";
const ARGON = { parallelism: 1, memoryKiB: 65536, iterations: 3, hashLength: 32 };

function normalize(code) {
  return code.trim().toLowerCase().split(/-+/).filter(Boolean).join("-");
}

// 唯一一次慢哈希:Argon2id → 32B master(PRK)。hash-wasm 实现即 Argon2 v1.3 (0x13)。
async function deriveMaster(norm) {
  const bin = await argon2id({
    password: norm,
    salt: new TextEncoder().encode(KDF_SALT),
    parallelism: ARGON.parallelism,
    iterations: ARGON.iterations,
    memorySize: ARGON.memoryKiB,
    hashLength: ARGON.hashLength,
    outputType: "binary",
  });
  return Buffer.from(bin);
}

// 手写 HKDF-Expand-only(SHA-256)。L<=32 单块即可:T(1)=HMAC(master, info||0x01)。
// 【关键】不用 crypto.hkdfSync —— 那是 full(Extract+Expand),输出与 Expand-only 不同。
function hkdfExpand(prk, infoStr, length) {
  const info = Buffer.from(infoStr, "utf8");
  const t1 = createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([0x01])])).digest();
  if (length > t1.length) throw new Error("length>32 需多块,当前用例不需要");
  return t1.subarray(0, length);
}

function sha256hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function encrypt(key, nonceHex, aad, plaintext) {
  const nonce = Buffer.from(nonceHex, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([enc, tag]).toString("base64");   // 标准带 padding
}

async function buildCase(codeInput, sender, nonceHex, dataText, ts) {
  const norm = normalize(codeInput);
  const master = await deriveMaster(norm);
  const routingId = hkdfExpand(master, ROUTE_INFO, 32).toString("hex");   // 64 hex
  const encKey = hkdfExpand(master, KEY_INFO, 32);                        // 32B raw
  const hash = sha256hex(Buffer.from(dataText, "utf8"));
  const payload = { type: "text", ts, mime: "text/plain; charset=utf-8", data: dataText, hash };
  const aad = `1|${routingId}|${sender}`;
  const ciphertextBase64 = encrypt(encKey, nonceHex, aad, JSON.stringify(payload));
  return {
    codeInput, codeNormalized: norm,
    masterHex: master.toString("hex"),
    routingId, encKeyHex: encKey.toString("hex"),
    sender, nonceHex, payload, aad, ciphertextBase64,
  };
}

const out = {
  algorithm: {
    kdf: { alg: "Argon2id", version: "0x13", salt: KDF_SALT, parallelism: ARGON.parallelism, memoryKiB: ARGON.memoryKiB, iterations: ARGON.iterations, hashLength: ARGON.hashLength },
    hkdf: { mode: "expand-only", hash: "SHA-256", routeInfo: ROUTE_INFO, keyInfo: KEY_INFO, length: 32 },
    aead: "AES-256-GCM", nonceBytes: 12, tagBytes: 16, base64: "standard-padded",
  },
  cases: [
    await buildCase("River-Tiger-42-Cloud ", "dev-fixed-uuid", "000102030405060708090a0b", "hello 峰哥", 1736400000),
    await buildCase("apple-stone-07-moon", "dev-two-uuid", "0f0e0d0c0b0a090807060504", "second case", 1736400001),
  ],
};

mkdirSync("test-vectors", { recursive: true });
writeFileSync("test-vectors/vectors.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote test-vectors/vectors.json");
