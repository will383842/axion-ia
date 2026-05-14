/**
 * KB V4 — Tests HMAC ingest.
 */

import { describe, expect, it } from "vitest";
import { computeKbSignature, verifyKbSignature } from "./hmac";

const SECRET = "test-secret-with-at-least-32-chars-long";

describe("HMAC ingest signature", () => {
  it("computeKbSignature retourne hex 64 chars (sha256)", () => {
    const sig = computeKbSignature('{"foo":"bar"}', SECRET);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifyKbSignature OK avec signature correcte", () => {
    const body = '{"foo":"bar"}';
    const sig = computeKbSignature(body, SECRET);
    expect(verifyKbSignature(body, sig, SECRET)).toBe(true);
  });

  it("verifyKbSignature REJECT avec signature corrompue", () => {
    const body = '{"foo":"bar"}';
    const sig = computeKbSignature(body, SECRET);
    const corrupted = sig.slice(0, -1) + (sig[63] === "0" ? "1" : "0");
    expect(verifyKbSignature(body, corrupted, SECRET)).toBe(false);
  });

  it("verifyKbSignature REJECT si body modifié", () => {
    const sig = computeKbSignature('{"foo":"bar"}', SECRET);
    expect(verifyKbSignature('{"foo":"baz"}', sig, SECRET)).toBe(false);
  });

  it("verifyKbSignature REJECT si secret différent", () => {
    const body = '{"foo":"bar"}';
    const sig = computeKbSignature(body, SECRET);
    expect(verifyKbSignature(body, sig, "other-secret")).toBe(false);
  });

  it("verifyKbSignature REJECT si lengths différentes (anti-timing)", () => {
    expect(verifyKbSignature("body", "tooshort", SECRET)).toBe(false);
  });

  it("verifyKbSignature REJECT si signature pas hex valide", () => {
    expect(verifyKbSignature("body", "z".repeat(64), SECRET)).toBe(false);
  });
});
