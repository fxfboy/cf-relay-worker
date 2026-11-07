import { describe, it, expect } from "vitest";
import vectors from "../test-vectors/vectors.json";

describe("test vectors integrity", () => {
  it("has expected algorithm params", () => {
    expect(vectors.algorithm.kdf).toMatchObject({
      alg: "Argon2id", version: "0x13", salt: "maccy-kdf-v1-salt",
      parallelism: 1, memoryKiB: 65536, iterations: 3, hashLength: 32,
    });
    expect(vectors.algorithm.hkdf).toMatchObject({
      mode: "expand-only", hash: "SHA-256",
      routeInfo: "maccy-route-v1", keyInfo: "maccy-key-v1", length: 32,
    });
    expect(vectors.algorithm.aead).toBe("AES-256-GCM");
  });
  it("each case locks the 3 intermediate values", () => {
    for (const c of vectors.cases) {
      expect(c.masterHex).toMatch(/^[0-9a-f]{64}$/);   // Argon2id 32B
      expect(c.routingId).toMatch(/^[0-9a-f]{64}$/);   // HKDF-Expand 32B
      expect(c.encKeyHex).toMatch(/^[0-9a-f]{64}$/);   // HKDF-Expand 32B
      expect(c.routingId).not.toBe(c.encKeyHex);       // 域分离:两子密钥必不同
      expect(c.aad).toBe(`1|${c.routingId}|${c.sender}`);
      expect(c.ciphertextBase64.length).toBeGreaterThan(0);
    }
  });
});

describe("locked vector bytes (cross-client baseline — do not edit without regenerating clients)", () => {
  it("cases[0] derivation is byte-locked", () => {
    const c = vectors.cases[0];
    expect(c.codeInput).toBe("River-Tiger-42-Cloud ");
    expect(c.masterHex).toBe("3a0bc26552b660a507ff9e601b6d2a6ae4e60a469dfbe07289d2adc54d5426a3");
    expect(c.routingId).toBe("75ed45508fd81e4e3fb1ca5e0a23e7884f6acf01b68758475562f08c4f931671");
    expect(c.encKeyHex).toBe("1f39a7580e1f20f2ce6ab243e01791e460b33b80dffde5c1ee417c705c096e40");
    expect(c.ciphertextBase64).toBe("fvP2WF8xRsuK1nN4S/tKwfZBODVZtB5OJWlt/J8/OpZMbOGQxZ42BU7IfsZYQ/v4HIEbxvMN4wMDkyBLhN8oTUCG9gyyA9sOis/zRCdl55VujW9xiLUiX+O7MAVhnUTV4I0wnjHi+mlD/tmH0Wf3Y0m/m4r3kXJw2RyH+T6CrlKGcdq1x1Qn3MXeYaeZ+k57QnGFwiYIaGLmMKwkThmr/pqZBvzNiqb5egkRQErTTJmviw==");
  });
  it("cases[1] derivation is byte-locked", () => {
    const c = vectors.cases[1];
    expect(c.codeInput).toBe("apple-stone-07-moon");
    expect(c.masterHex).toBe("503bcfd25947fc33bc8ebd60d59267e42156962184b7abe5f9da74ccca4707a2");
    expect(c.routingId).toBe("c7f7a86a6937be143b06d2fa8f32ca3ab34cbc19d324b641af1e1f6bd93e01e2");
    expect(c.encKeyHex).toBe("b31e1914a368729e1fcf6fcb30c717b97954aa215928457cbd13d15ffa6d24d7");
    expect(c.ciphertextBase64).toBe("/1lnTdFAOtbyJ6Lz6iMcE3SuIOSsBh3xbFVQzxeUJRxPmLfaUbTrx0S4eRsgAFdnX98XiyQZRY+Wc5X+yiivyqo+KeH2/mazXB44q8adyqVhXR9tfw93fqs91eFcBbnknZnht/cVOhUojCGuN9xHgWx85kqT+hKV+tv4dtmNGV8UFfqzSvUePhVLXXCfUhCbvH46i9lYFwgqjnq95U009/vV3MH0GnC5a1UbEN4yPM79");
  });
});
