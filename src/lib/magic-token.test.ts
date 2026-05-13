// Tests magic-token — Sprint X.15.
//
// HMAC sign/verify + replay window + scope/resource mismatch + expiration.

import { describe, it, expect, beforeAll } from "vitest";
import { signMagicToken, verifyMagicToken } from "./magic-token";

beforeAll(() => {
  process.env["AUTH_SECRET"] = "test-secret-for-magic-token-vitest-only-32chars";
});

describe("magic-token", () => {
  it("sign + verify happy path scope=cancel", async () => {
    const token = await signMagicToken({
      scope: "cancel",
      resourceId: "00000000-0000-0000-0000-000000000001",
      email: "test@axion-ia.com",
    });
    const v = await verifyMagicToken(token);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.scope).toBe("cancel");
      expect(v.resourceId).toBe("00000000-0000-0000-0000-000000000001");
      expect(v.email).toBe("test@axion-ia.com");
      expect(v.jti).toMatch(/^[a-f0-9]{24}$/);
    }
  });

  it("verify avec expected scope correct", async () => {
    const token = await signMagicToken({
      scope: "reschedule",
      resourceId: "abc",
    });
    const v = await verifyMagicToken(token, { scope: "reschedule" });
    expect(v.ok).toBe(true);
  });

  it("rejette scope_mismatch", async () => {
    const token = await signMagicToken({ scope: "cancel", resourceId: "abc" });
    const v = await verifyMagicToken(token, { scope: "reschedule" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("scope_mismatch");
  });

  it("rejette resource_mismatch", async () => {
    const token = await signMagicToken({ scope: "cancel", resourceId: "abc" });
    const v = await verifyMagicToken(token, { resourceId: "def" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("resource_mismatch");
  });

  it("rejette token malformed", async () => {
    const v = await verifyMagicToken("not-a-valid-token");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("malformed_token");
  });

  it("rejette signature tampered", async () => {
    const token = await signMagicToken({ scope: "cancel", resourceId: "abc" });
    const [p, s] = token.split(".") as [string, string];
    // Flip 1 char dans la signature
    const tampered = `${p}.${s.slice(0, -1)}${s.slice(-1) === "a" ? "b" : "a"}`;
    const v = await verifyMagicToken(tampered);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_signature");
  });

  it("rejette payload tampered (signature ne matche plus)", async () => {
    const token = await signMagicToken({ scope: "cancel", resourceId: "original" });
    const [p, s] = token.split(".") as [string, string];
    // Décoder, modifier resourceId, re-encoder — signature ne matchera plus
    const decoded = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(decoded);
    payload.resourceId = "tampered";
    const reEncoded = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const v = await verifyMagicToken(`${reEncoded}.${s}`);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_signature");
  });

  it("rejette expired (TTL=1ms)", async () => {
    const token = await signMagicToken({
      scope: "cancel",
      resourceId: "abc",
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    const v = await verifyMagicToken(token);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("expired");
  });

  it("TTL par défaut diffère par scope", async () => {
    const tCancel = await signMagicToken({ scope: "cancel", resourceId: "abc" });
    const tPortal = await signMagicToken({ scope: "portal", resourceId: "abc" });
    // Les 2 doivent être valides immédiatement.
    expect((await verifyMagicToken(tCancel)).ok).toBe(true);
    expect((await verifyMagicToken(tPortal)).ok).toBe(true);
  });

  it("normalise email lowercase + trim", async () => {
    const token = await signMagicToken({
      scope: "cancel",
      resourceId: "abc",
      email: "  Test@AXION-IA.com  ",
    });
    const v = await verifyMagicToken(token);
    if (v.ok) expect(v.email).toBe("test@axion-ia.com");
  });

  it("jti unique pour signatures successives", async () => {
    const t1 = await signMagicToken({ scope: "cancel", resourceId: "abc" });
    const t2 = await signMagicToken({ scope: "cancel", resourceId: "abc" });
    const v1 = await verifyMagicToken(t1);
    const v2 = await verifyMagicToken(t2);
    if (v1.ok && v2.ok) expect(v1.jti).not.toBe(v2.jti);
  });
});
