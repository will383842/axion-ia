import { describe, it, expect, beforeAll } from "vitest";
import {
  signFormateurSession,
  verifyFormateurSession,
  FORMATEUR_SESSION_MAX_AGE_SECONDS,
} from "./formateur-session";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-formateur-session-0123456789abcdef";
});

describe("formateur-session", () => {
  it("signe puis vérifie un jeton valide (round-trip)", async () => {
    const token = await signFormateurSession("trainer-123");
    const result = await verifyFormateurSession(token);
    expect(result).toEqual({ ok: true, trainerId: "trainer-123" });
  });

  it("rejette un jeton mal formé", async () => {
    const result = await verifyFormateurSession("pas-un-jeton");
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejette une signature falsifiée (payload modifié)", async () => {
    const token = await signFormateurSession("trainer-123");
    const [, sig] = token.split(".");
    // Forge un payload différent avec l'ancienne signature.
    const forgedPayload = btoa(JSON.stringify({ sub: "attacker", exp: Date.now() + 100000 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const result = await verifyFormateurSession(`${forgedPayload}.${sig}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_signature");
  });

  it("rejette un jeton expiré", async () => {
    const token = await signFormateurSession("trainer-123", -10); // expiré il y a 10 s
    const result = await verifyFormateurSession(token);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejette un jeton signé avec un autre secret", async () => {
    const token = await signFormateurSession("trainer-123");
    process.env.AUTH_SECRET = "un-secret-completement-different-987654321";
    const result = await verifyFormateurSession(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_signature");
    process.env.AUTH_SECRET = "test-secret-formateur-session-0123456789abcdef";
  });

  it("expose une durée de vie de 30 jours", () => {
    expect(FORMATEUR_SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
