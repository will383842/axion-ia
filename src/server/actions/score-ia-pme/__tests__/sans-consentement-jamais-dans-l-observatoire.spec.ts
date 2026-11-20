/**
 * @vitest-environment node
 *
 * T-1 : sans consentement valide, rien n'est jamais écrit dans l'Observatoire.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SECTOR_SLUGS, REGION_SLUGS } from "@/content/observatoire/questions";
import { REPONSES_VALIDES, HASH_OK } from "./_commun";

const { createMock, rlMock, turnstileMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  rlMock: vi.fn(),
  turnstileMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { barometerResponse: { create: createMock } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: rlMock }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: turnstileMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { ajouterALObservatoire } from "../ajouter-a-l-observatoire";
import { CONSENT_VERSION } from "@/lib/score-ia-pme/constantes";

const base = () => ({
  ...REPONSES_VALIDES,
  useCases: [...REPONSES_VALIDES.useCases],
  tools: [...REPONSES_VALIDES.tools],
  barriers: [...REPONSES_VALIDES.barriers],
  sector: SECTOR_SLUGS[0],
  region: REGION_SLUGS[0],
  consentement: true,
  consentVersion: CONSENT_VERSION,
  codeRetraitHash: HASH_OK,
  turnstileToken: "jeton",
  startedAt: Date.now() - 60_000,
});

describe("T-1 — pas de consentement, pas d'écriture", () => {
  beforeEach(() => {
    createMock.mockReset();
    rlMock.mockResolvedValue({ allowed: true });
    turnstileMock.mockResolvedValue(true);
  });

  it("contrôle positif : l'entrée valide écrit une fois", async () => {
    const r = await ajouterALObservatoire(base());
    expect(r.ok).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  const cas: Array<[string, Record<string, unknown>]> = [
    [
      "consentement absent",
      (() => {
        const b: Record<string, unknown> = base();
        delete b.consentement;
        return b;
      })(),
    ],
    ["consentement false", { ...base(), consentement: false }],
    ["consentement « true » (chaîne)", { ...base(), consentement: "true" }],
    ["consentement 1", { ...base(), consentement: 1 }],
    ["consentVersion ancienne", { ...base(), consentVersion: "obs-score-v0" }],
    [
      "consentVersion absente",
      (() => {
        const b: Record<string, unknown> = base();
        delete b.consentVersion;
        return b;
      })(),
    ],
    ["champ en trop (strict)", { ...base(), email: "a@b.fr" }],
    ["empreinte invalide", { ...base(), codeRetraitHash: "XYZ" }],
  ];
  it.each(cas)("%s → refusé, create jamais appelé", async (_n, entree) => {
    const r = await ajouterALObservatoire(entree);
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("Turnstile refusé → rien d'écrit", async () => {
    turnstileMock.mockResolvedValue(false);
    const r = await ajouterALObservatoire(base());
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("« none » non exclusif côté serveur → refusé", async () => {
    const r = await ajouterALObservatoire({ ...base(), useCases: ["none", "chatbot"] });
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });
});
