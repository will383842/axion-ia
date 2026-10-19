import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signMagicToken } from "@/lib/magic-token";
import { emettreJetonPresence, verifierJetonPresence } from "../jeton";

const INSCRIPTION = "11111111-1111-4111-8111-111111111111";
const JOUR = 24 * 60 * 60 * 1000;

describe("jeton de confirmation de présence", () => {
  beforeEach(() => {
    process.env["AUTH_SECRET"] = "secret-de-test-presence";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T08:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("un jeton valide désigne UNE inscription", async () => {
    const t = await emettreJetonPresence(INSCRIPTION, new Date("2026-10-26T07:00:00Z"));
    expect(await verifierJetonPresence(t)).toEqual({ ok: true, enrollmentId: INSCRIPTION });
  });

  it("un jeton forgé est refusé", async () => {
    const t = await emettreJetonPresence(INSCRIPTION, new Date("2026-10-26T07:00:00Z"));
    const [payload] = t.split(".");
    expect((await verifierJetonPresence(`${payload}.AAAA`)).ok).toBe(false);
    expect((await verifierJetonPresence("n-importe-quoi")).ok).toBe(false);
  });

  it("un jeton d'un autre scope (émargement) est refusé", async () => {
    const autre = await signMagicToken({ scope: "emargement", resourceId: INSCRIPTION });
    expect(await verifierJetonPresence(autre)).toEqual({ ok: false, raison: "scope_mismatch" });
  });

  it("expire au début de la première demi-journée", async () => {
    const debut = new Date("2026-10-26T07:00:00Z");
    const t = await emettreJetonPresence(INSCRIPTION, debut);
    vi.setSystemTime(new Date(debut.getTime() - 1000));
    expect((await verifierJetonPresence(t)).ok).toBe(true);
    vi.setSystemTime(new Date(debut.getTime() + 1000));
    expect(await verifierJetonPresence(t)).toEqual({ ok: false, raison: "expired" });
  });

  it("la durée est plafonnée à 30 jours", async () => {
    const t = await emettreJetonPresence(INSCRIPTION, new Date(Date.now() + 200 * JOUR));
    const emis = Date.now();
    vi.setSystemTime(new Date(emis + 29 * JOUR));
    expect((await verifierJetonPresence(t)).ok).toBe(true);
    vi.setSystemTime(new Date(emis + 31 * JOUR));
    expect((await verifierJetonPresence(t)).ok).toBe(false);
  });

  it("refuse d'émettre pour une session déjà commencée", async () => {
    await expect(emettreJetonPresence(INSCRIPTION, new Date(Date.now() - 1000))).rejects.toThrow(
      /déjà commencé/,
    );
  });
});
