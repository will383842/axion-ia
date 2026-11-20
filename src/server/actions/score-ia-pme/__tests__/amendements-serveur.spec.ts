/**
 * @vitest-environment node
 *
 * Amendements D (valeurs ajoutées, Zod du Score seulement) et H (I6 : version du questionnaire).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { REPONSES_VALIDES, HASH_OK } from "./_commun";

const { createMock, rlMock } = vi.hoisted(() => ({ createMock: vi.fn(), rlMock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { barometerResponse: { create: createMock } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: rlMock }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { ajouterALObservatoire } from "../ajouter-a-l-observatoire";
import { CONSENT_VERSION, QUESTIONNAIRE_VERSION } from "@/lib/score-ia-pme/constantes";
import { SECTOR_SLUGS, REGION_SLUGS } from "@/content/observatoire/questions";

const base = () => ({
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

describe("amendement D — valeurs ajoutées", () => {
  beforeEach(() => {
    createMock.mockReset();
    rlMock.mockReset();
    rlMock.mockResolvedValue({ allowed: true });
  });

  it.each([
    ["sector", "autre"],
    ["region", "outre-mer"],
    ["region", "non-precisee"],
  ])("accepte %s = %s", async (champ, valeur) => {
    const r = await ajouterALObservatoire({ ...base(), [champ]: valeur });
    expect(r.ok).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("accepte barriers = [none] seul", async () => {
    expect((await ajouterALObservatoire({ ...base(), barriers: ["none"] })).ok).toBe(true);
  });

  it("refuse none mêlé à un autre frein, et une valeur inconnue", async () => {
    expect((await ajouterALObservatoire({ ...base(), barriers: ["none", "budget"] })).ok).toBe(
      false,
    );
    expect((await ajouterALObservatoire({ ...base(), barriers: ["autre"] })).ok).toBe(false);
    expect((await ajouterALObservatoire({ ...base(), sector: "inconnu" })).ok).toBe(false);
    expect((await ajouterALObservatoire({ ...base(), region: "mars" })).ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("I6 — version du questionnaire tracée", () => {
  beforeEach(() => {
    createMock.mockReset();
    rlMock.mockResolvedValue({ allowed: true });
  });

  it("T-4 : raw_answers = les 15 réponses + _questionnaire, rien d'autre", async () => {
    await ajouterALObservatoire(base());
    const { data } = createMock.mock.calls[0]![0] as {
      data: { rawAnswers: Record<string, unknown> };
    };
    const cles = Object.keys(data.rawAnswers).sort();
    expect(cles).toHaveLength(16);
    expect(cles).toContain("_questionnaire");
    expect(data.rawAnswers._questionnaire).toBe(QUESTIONNAIRE_VERSION);
    expect(data.rawAnswers._questionnaire).toBe("q-score-v1");
    expect(cles.filter((k) => k !== "_questionnaire")).not.toContain("satisfaction");
  });
});
