/**
 * Fix 2026-08-15 (audit e2e, C6) — Tests de la garde anti-troncature de la
 * correction fact-check (`correctRefutedClaimsInPlace`, content-fact-check-worker).
 *
 * Symptôme corrigé : la correction demande une réécriture COMPLÈTE du HTML avec
 * `maxTokens: 4096` ; une sortie coupée par le budget (`finish_reason=length`)
 * n'était pas détectée, et la seule garde (« < 50 % de l'original ») laissait
 * publier des articles amputés d'un bon tiers. Garanties testées ici, sur le
 * VRAI module importé (pas une copie de la logique) :
 *  - saturation du budget tokens (± marge) → null (article original conservé)
 *  - sortie < 85 % de l'original → null (l'ancien seuil 50 % laissait passer)
 *  - sortie ≥ 85 % + tokens sous le budget → HTML corrigé retourné
 *  - échec LLM → null (fail-safe historique, non régressé)
 *  - aucune phrase réfutée → null sans appel LLM
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks des dépendances lourdes du worker (prisma/redis/bullmq/providers) ──
// Le module worker instancie Worker/prisma à l'import indirect : on neutralise
// tout ce qui touche réseau/DB pour ne tester QUE la garde de correction.

const { routerGenerateMock } = vi.hoisted(() => ({
  routerGenerateMock: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {},
  Queue: class {},
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/server/content-gen/providers/provider-router", () => ({
  generate: routerGenerateMock,
}));

vi.mock("@/server/content-gen/providers/perplexity", () => ({
  perplexityProvider: { generate: vi.fn() },
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: vi.fn(),
}));

vi.mock("@/server/content-gen/config-store", () => ({
  readKillSwitchFailSafe: vi.fn(),
}));

vi.mock("@/server/content-gen/shared/revalidate-content", () => ({
  revalidateContent: vi.fn(),
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: vi.fn(),
}));

// Sanitizer = identité : la garde travaille sur des longueurs, pas sur la
// whitelist DOMPurify (couverte par html-sanitizer.test.ts). Un sanitizer réel
// (jsdom) alourdirait le test sans rien vérifier de plus ici.
vi.mock("@/server/content-gen/shared/html-sanitizer", () => ({
  sanitizeContentGenHtml: (html: string) => html,
}));

import { correctRefutedClaimsInPlace } from "@/server/queue/workers/content-fact-check-worker";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Corps HTML original de référence (longueur contrôlée : 2 000 caractères). */
const ORIGINAL_HTML =
  `<h2>Titre</h2>${"<p>Un paragraphe de contenu factuel.</p>".repeat(48)}`.slice(0, 2000);

function llmResponse(output: string, tokensOutput: number) {
  return {
    provider: "openai" as const,
    model: "gpt-test",
    output,
    tokensInput: 100,
    tokensOutput,
    costUsd: 0.001,
    durationMs: 10,
  };
}

const BASE_ARGS = {
  jobId: "job-factcheck-1",
  bodyHtml: ORIGINAL_HTML,
  refutedSentences: ["Le marché pèse 999 milliards d'euros."],
};

beforeEach(() => {
  routerGenerateMock.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("correctRefutedClaimsInPlace — garde anti-troncature (C6)", () => {
  it("retourne le HTML corrigé quand la sortie est complète (≥ 85 %, tokens sous budget)", async () => {
    // 95 % de la longueur d'origine, très loin du budget tokens.
    const corrected = ORIGINAL_HTML.slice(0, Math.floor(ORIGINAL_HTML.length * 0.95));
    routerGenerateMock.mockResolvedValueOnce(llmResponse(corrected, 800));

    const got = await correctRefutedClaimsInPlace(BASE_ARGS);

    expect(got).toBe(corrected);
    expect(routerGenerateMock).toHaveBeenCalledOnce();
  });

  it("rejette une sortie qui SATURE le budget tokens (finish_reason=length implicite) même si la longueur passe", async () => {
    // Longueur OK (100 %) mais tokensOutput = budget exact : sortie coupée.
    routerGenerateMock.mockResolvedValueOnce(llmResponse(ORIGINAL_HTML, 4096));

    const got = await correctRefutedClaimsInPlace(BASE_ARGS);

    expect(got).toBeNull();
  });

  it("rejette aussi dans la marge de jitter (tokensOutput = budget − marge)", async () => {
    // 4096 − 64 = 4032 : borne incluse (>=), le comptage streamé peut sous-estimer.
    routerGenerateMock.mockResolvedValueOnce(llmResponse(ORIGINAL_HTML, 4032));

    const got = await correctRefutedClaimsInPlace(BASE_ARGS);

    expect(got).toBeNull();
  });

  it("accepte juste SOUS la marge de troncature (tokensOutput = budget − marge − 1)", async () => {
    routerGenerateMock.mockResolvedValueOnce(llmResponse(ORIGINAL_HTML, 4031));

    const got = await correctRefutedClaimsInPlace(BASE_ARGS);

    expect(got).toBe(ORIGINAL_HTML);
  });

  it("rejette une sortie à 60 % de l'original (l'ancien seuil 50 % l'aurait PUBLIÉE tronquée)", async () => {
    const truncated = ORIGINAL_HTML.slice(0, Math.floor(ORIGINAL_HTML.length * 0.6));
    routerGenerateMock.mockResolvedValueOnce(llmResponse(truncated, 800));

    const got = await correctRefutedClaimsInPlace(BASE_ARGS);

    expect(got).toBeNull();
  });

  it("rejette juste sous le plancher 85 %", async () => {
    const almost = ORIGINAL_HTML.slice(0, Math.floor(ORIGINAL_HTML.length * 0.85) - 1);
    routerGenerateMock.mockResolvedValueOnce(llmResponse(almost, 800));

    const got = await correctRefutedClaimsInPlace(BASE_ARGS);

    expect(got).toBeNull();
  });

  it("fail-safe historique conservé : échec LLM → null (article original inchangé)", async () => {
    routerGenerateMock.mockRejectedValueOnce(new Error("provider down"));

    const got = await correctRefutedClaimsInPlace(BASE_ARGS);

    expect(got).toBeNull();
  });

  it("aucune phrase réfutée → null SANS appel LLM (pas de dépense inutile)", async () => {
    const got = await correctRefutedClaimsInPlace({ ...BASE_ARGS, refutedSentences: [] });

    expect(got).toBeNull();
    expect(routerGenerateMock).not.toHaveBeenCalled();
  });
});
