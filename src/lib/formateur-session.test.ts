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
    const token = await signFormateurSession("trainer-123", "formateur");
    const result = await verifyFormateurSession(token, "formateur");
    expect(result).toEqual({ ok: true, trainerId: "trainer-123" });
  });

  it("rejette un jeton mal formé", async () => {
    const result = await verifyFormateurSession("pas-un-jeton", "formateur");
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejette une signature falsifiée (payload modifié)", async () => {
    const token = await signFormateurSession("trainer-123", "formateur");
    const [, sig] = token.split(".");
    const forgedPayload = btoa(
      JSON.stringify({ sub: "attacker", aud: "formateur", exp: Date.now() + 100000 }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const result = await verifyFormateurSession(`${forgedPayload}.${sig}`, "formateur");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_signature");
  });

  it("rejette un jeton expiré", async () => {
    const token = await signFormateurSession("trainer-123", "formateur", -10);
    const result = await verifyFormateurSession(token, "formateur");
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejette un jeton signé avec un autre secret", async () => {
    const token = await signFormateurSession("trainer-123", "formateur");
    process.env.AUTH_SECRET = "un-secret-completement-different-987654321";
    const result = await verifyFormateurSession(token, "formateur");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_signature");
    process.env.AUTH_SECRET = "test-secret-formateur-session-0123456789abcdef";
  });

  it("rejette un jeton d'une AUTRE audience (cookie formateur présenté à ressources)", async () => {
    const token = await signFormateurSession("id-x", "formateur");
    const result = await verifyFormateurSession(token, "ressources");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong_audience");
  });

  it("expose une durée de vie de 30 jours", () => {
    expect(FORMATEUR_SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
