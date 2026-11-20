/**
 * @vitest-environment node
 *
 * T-4 : ce qui est écrit est le strict minimum, sans aucun identifiant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SECTOR_SLUGS, REGION_SLUGS } from "@/content/observatoire/questions";
import { REPONSES_VALIDES, HASH_OK } from "./_commun";

const { createMock, rlMock } = vi.hoisted(() => ({ createMock: vi.fn(), rlMock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { barometerResponse: { create: createMock } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: rlMock }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { ajouterALObservatoire } from "../ajouter-a-l-observatoire";
import { CONSENT_VERSION, SOURCE_SCORE } from "@/lib/score-ia-pme/constantes";

describe("T-4 — ajout minimal", () => {
  beforeEach(() => {
    createMock.mockReset();
    rlMock.mockReset();
    rlMock.mockResolvedValue({ allowed: true });
  });

  it("n'écrit aucun identifiant et tronque les dates au jour", async () => {
    const r = await ajouterALObservatoire({
      ...REPONSES_VALIDES,
      useCases: ["automation"],
      tools: ["chatgpt"],
      barriers: ["budget"],
      sector: SECTOR_SLUGS[0],
      region: REGION_SLUGS[0],
      consentement: true,
      consentVersion: CONSENT_VERSION,
      codeRetraitHash: HASH_OK,
      turnstileToken: "jeton",
      startedAt: Date.now() - 60_000,
    });
    expect(r.ok).toBe(true);
    const { data } = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.visitorId).toBeNull();
    expect(data.satisfaction).toBeNull();
    expect(data.source).toBe(SOURCE_SCORE);
    expect(data.source).toBe("score-ia-pme");
    expect(data.consentVersion).toBe("obs-score-v1");
    expect(data.codeRetraitHash).toBe(HASH_OK);
    for (const interdit of ["ip", "email", "userAgent", "score", "referer", "nom"]) {
      expect(Object.keys(data)).not.toContain(interdit);
    }
    const brut = JSON.stringify(data);
    expect(brut).not.toContain("203.0.113.7");
    expect(Object.keys(data.rawAnswers as object)).not.toContain("satisfaction");
    for (const k of ["submittedAt", "createdAt"] as const) {
      expect((data[k] as Date).toISOString()).toMatch(/T00:00:00\.000Z$/);
    }
  });

  it("la clé de limite de débit ne contient pas l'IP", async () => {
    await ajouterALObservatoire({
      ...REPONSES_VALIDES,
      useCases: ["automation"],
      tools: ["chatgpt"],
      barriers: ["budget"],
      sector: SECTOR_SLUGS[0],
      region: REGION_SLUGS[0],
      consentement: true,
      consentVersion: CONSENT_VERSION,
      codeRetraitHash: HASH_OK,
      turnstileToken: "jeton",
      startedAt: Date.now() - 60_000,
    });
    const cle = rlMock.mock.calls[0]![0] as string;
    expect(cle.startsWith("score-obs:")).toBe(true);
    expect(cle).not.toContain("203.0.113.7");
  });
});
