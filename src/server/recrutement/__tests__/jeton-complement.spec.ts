import { beforeAll, describe, expect, it } from "vitest";

import { signerJetonComplement, verifierJetonComplement } from "../jeton-complement";
import { signVivierOppositionToken } from "@/server/vivier/token";

const APP = "11111111-1111-4111-8111-111111111111";
const OFFRE = "22222222-2222-4222-8222-222222222222";

beforeAll(() => {
  process.env.AUTH_SECRET = "secret-de-test-assez-long-pour-hmac";
});

describe("jeton « compléter ma candidature »", () => {
  it("rend la candidature ET l'offre signées", async () => {
    const j = await signerJetonComplement(APP, OFFRE);
    expect(await verifierJetonComplement(j)).toEqual({
      ok: true,
      applicationId: APP,
      offerId: OFFRE,
    });
  });

  it("refuse un jeton dont on a changé la candidature", async () => {
    const j = await signerJetonComplement(APP, OFFRE);
    const [payload, sig] = j.split(".") as [string, string];
    const autre = Buffer.from(
      Buffer.from(payload, "base64url").toString("utf8").replace(APP, OFFRE),
    ).toString("base64url");
    expect(await verifierJetonComplement(`${autre}.${sig}`)).toEqual({
      ok: false,
      reason: "invalid_signature",
    });
  });

  it("refuse un jeton d'opposition vivier, pourtant signé avec le même secret", async () => {
    const vivier = await signVivierOppositionToken(APP);
    expect(await verifierJetonComplement(vivier)).toEqual({
      ok: false,
      reason: "wrong_audience",
    });
  });

  it("expire après 60 jours", async () => {
    const t0 = Date.UTC(2026, 8, 28);
    const j = await signerJetonComplement(APP, OFFRE, t0);
    const jour = 24 * 60 * 60 * 1000;
    expect((await verifierJetonComplement(j, t0 + 59 * jour)).ok).toBe(true);
    expect(await verifierJetonComplement(j, t0 + 61 * jour)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuse l'absence de jeton et un jeton tronqué", async () => {
    expect((await verifierJetonComplement(null)).ok).toBe(false);
    const j = await signerJetonComplement(APP, OFFRE);
    expect((await verifierJetonComplement(j.slice(0, -6))).ok).toBe(false);
  });
});
