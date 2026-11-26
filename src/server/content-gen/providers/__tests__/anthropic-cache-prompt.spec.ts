/**
 * Cache de prompt (PR 6) : le bloc système stable porte `cache_control`, le coût compte
 * les jetons de cache (création 1,25 × l'entrée, lecture 0,1 × l'entrée), et les requêtes
 * OpenAI ne changent pas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const openaiCreate = vi.fn();
const trackCost = vi.fn();
let configModel = "claude-sonnet-5-5";

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class Anthropic {
    static APIError = APIError;
    messages = { create };
  }
  return { default: Anthropic };
});

vi.mock("openai", () => {
  class OpenAI {
    chat = { completions: { create: openaiCreate } };
  }
  return { default: OpenAI };
});

vi.mock("../../lib/cost-tracker", () => ({
  assertCostCapAvailable: vi.fn(),
  trackCost: (...a: unknown[]) => trackCost(...a),
}));

vi.mock("../../lib/config-reader", () => ({
  readProviderConfig: async () => ({
    model: configModel,
    enabled: true,
    monthlyCapUsd: 100,
    fromDb: true,
  }),
}));

import { anthropicProvider, computeCost } from "../anthropic";
import { openaiProvider } from "../openai";

const M = 1_000_000;

function fluxAvecUsage(usage: Record<string, number>, sortie = 1000) {
  return async function* () {
    yield { type: "message_start", message: { usage } };
    yield { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } };
    yield {
      type: "message_delta",
      usage: { output_tokens: sortie },
      delta: { stop_reason: "end_turn" },
    };
  };
}

const SYSTEME = "Consignes de marque stables.\nPositionnement.\nFiche Journée IA.";
const req = {
  jobId: "j1",
  contentType: "blog_article",
  role: "text",
  systemPrompt: SYSTEME,
  userPrompt: "Sujet variable : le plan de cet article.",
} as never;

beforeEach(() => {
  create.mockReset();
  openaiCreate.mockReset();
  trackCost.mockReset();
  configModel = "claude-sonnet-5-5";
  vi.stubEnv("ANTHROPIC_API_KEY", "cle-de-test-factice");
  vi.stubEnv("OPENAI_API_KEY", "cle-de-test-factice");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cache de prompt : bloc système", () => {
  it("le bloc système porte cache_control ephemeral, texte inchangé, variable dans le message utilisateur", async () => {
    create.mockImplementation(async () => fluxAvecUsage({ input_tokens: 10 })());
    await anthropicProvider.generate(req);
    const corps = create.mock.calls[0]![0];
    expect(corps.system).toEqual([
      { type: "text", text: SYSTEME, cache_control: { type: "ephemeral" } },
    ]);
    expect(corps.messages).toEqual([
      { role: "user", content: "Sujet variable : le plan de cet article." },
    ]);
    // Le cache ne se pose que sur le système : aucun marqueur dans le message variable.
    expect(JSON.stringify(corps.messages)).not.toContain("cache_control");
  });
});

describe("cache de prompt : coût", () => {
  it("création = 1,25 × le prix d'entrée, lecture = 0,1 × (Sonnet et Opus 5.5)", () => {
    for (const modele of ["claude-sonnet-5-5", "claude-opus-5-5"]) {
      const entree = computeCost(modele, M, 0, 0, 0);
      expect(computeCost(modele, 0, 0, 0, M)).toBeCloseTo(1.25 * entree, 10);
      expect(computeCost(modele, 0, 0, M, 0)).toBeCloseTo(0.1 * entree, 10);
    }
  });

  it("l'usage renvoyé (création) est compté dans le coût de l'appel", async () => {
    create.mockImplementation(async () =>
      fluxAvecUsage(
        { input_tokens: 500, cache_creation_input_tokens: 4000, cache_read_input_tokens: 0 },
        1000,
      )(),
    );
    const r = await anthropicProvider.generate(req);
    const attendu = (500 * 2 + 4000 * 2.5 + 1000 * 10) / M;
    expect(r.costUsd).toBeCloseTo(attendu, 10);
    expect(r.cacheCreationInputTokens).toBe(4000);
  });

  it("l'usage renvoyé (lecture) est compté dans le coût de l'appel", async () => {
    create.mockImplementation(async () =>
      fluxAvecUsage(
        { input_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 4000 },
        1000,
      )(),
    );
    const r = await anthropicProvider.generate(req);
    const attendu = (500 * 2 + 4000 * 0.2 + 1000 * 10) / M;
    expect(r.costUsd).toBeCloseTo(attendu, 10);
    expect(r.cacheReadInputTokens).toBe(4000);
    // Le suivi (hors réservation) reçoit le même coût et tous les jetons d'entrée.
    expect(trackCost.mock.calls[0]![0]).toMatchObject({ tokensInput: 4500 });
    expect(trackCost.mock.calls[0]![0].costUsd).toBeCloseTo(attendu, 10);
  });
});

describe("requêtes OpenAI inchangées", () => {
  it("aucun cache_control, messages système/utilisateur tels quels", async () => {
    openaiCreate.mockImplementation(async () =>
      (async function* () {
        yield { choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] };
        yield { choices: [], usage: { prompt_tokens: 5, completion_tokens: 5 } };
      })(),
    );
    await openaiProvider.generate({
      jobId: "j2",
      contentType: "blog_article",
      role: "text",
      systemPrompt: SYSTEME,
      userPrompt: "u",
    } as never);
    const corps = openaiCreate.mock.calls[0]![0];
    expect(corps.messages).toEqual([
      { role: "system", content: SYSTEME },
      { role: "user", content: "u" },
    ]);
    expect(JSON.stringify(corps)).not.toContain("cache_control");
  });
});
