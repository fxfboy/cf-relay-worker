import { describe, it, expect } from "vitest";
import vectors from "../test-vectors/vectors.json";

describe("test vectors integrity", () => {
  it("has expected algorithm params", () => {
    expect(vectors.algorithm.kdf).toMatchObject({
      alg: "Argon2id", version: "0x13", salt: "e2e-sync-kdf-v1-salt",
      parallelism: 1, memoryKiB: 65536, iterations: 3, hashLength: 32,
    });
    expect(vectors.algorithm.hkdf).toMatchObject({
      mode: "expand-only", hash: "SHA-256",
      routeInfo: "e2e-sync-route-v1", keyInfo: "e2e-sync-key-v1", length: 32,
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
    expect(c.masterHex).toBe("d793cc7f3ad827e16d59971f9c0e3ccd8332a92ce2fae83759273b1e52fc0cd7");
    expect(c.routingId).toBe("80b4f012aaa85d517ae71bcd3cc46acec13870871202a01a7fb48e5087616010");
    expect(c.encKeyHex).toBe("57fb8f312264ab9e9ec2c4ef515bf3e5669b57f3d952c17a51bde67f115dfa2b");
    expect(c.ciphertextBase64).toBe("GBCOm90x8XrjzZnPcLK1t48c/zinLE5rLReG81RCt1Eyo8yh7CZy5zx6K40Fwwgg68Cwf2yJJsm+PBm5+JW/odFPeMPO1ExzzrO7GYdfGpoGbqDgNANiOkEqRWR3vP6Ojm1uZS9L5Qp3s9MXohU4OfE1s4GarJ1IAFTCtqowks+mforcOJfw5LDU7MsdI4nf2ykIG5Thg+zcPrhTJmvor4h28nkcXsOuYC361yLSzXV9lg==");
  });
  it("cases[1] derivation is byte-locked", () => {
    const c = vectors.cases[1];
    expect(c.codeInput).toBe("apple-stone-07-moon");
    expect(c.masterHex).toBe("cc2752d00dcf8ec6ea42b6baf43daceebb946e777d40b365e377562d62c011a4");
    expect(c.routingId).toBe("34be71289cfc878cc997978da2877cd9eb18c665b61eed8df6c9bcda041d7ae7");
    expect(c.encKeyHex).toBe("f98c90dd6514f6f0e82b01983dd2de590f1d2caae1360ad71ecaeeebbdcde9c0");
    expect(c.ciphertextBase64).toBe("xktzdVABbVPzSmB7QJ90AQIUefMlfPORZRGIB4TwOeZfvA7FD2s6jJ5W4JriHaqg69GNevFGBIaJ4k8Ft/dr0oRGAE4x8npyctzZ7V+7+lVk7rHzZLjgV0mPqBELRIZzQ5C1uDSOyCJ+RKmmEqkAEj/LxRvNkeL/0v4NQ958kk63WPghod3sbA3bnaeB2opnsHlLISJFtXtvGbwOx8wi6cW0XrkQ7oEN4BrCdip8nfC+");
  });
});
