/**
 * Modèles Claude 5.5 : pas de `temperature` (400 sinon) et Haiku 5.5 (prix inconnu)
 * doit échouer AVANT tout appel payant.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const assertCostCapAvailable = vi.fn();
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

vi.mock("../../lib/cost-tracker", () => ({
  assertCostCapAvailable: (...a: unknown[]) => assertCostCapAvailable(...a),
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

import { anthropicProvider } from "../anthropic";
import { ProviderError } from "../IProvider";
import { claudeSearch } from "@/server/clients/claude-search";

async function* flux() {
  yield {
    type: "message_start",
    message: { usage: { input_tokens: 10, cache_read_input_tokens: 0 } },
  };
  yield { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } };
  yield { type: "message_delta", usage: { output_tokens: 5 }, delta: { stop_reason: "end_turn" } };
}

const req = {
  role: "text",
  systemPrompt: "s",
  userPrompt: "u",
  temperature: 0.7,
} as never;

beforeEach(() => {
  create.mockReset();
  assertCostCapAvailable.mockReset();
  trackCost.mockReset();
  create.mockImplementation(async () => flux());
  vi.stubEnv("ANTHROPIC_API_KEY", "cle-de-test-factice");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("anthropicProvider.generate : température", () => {
  it.each(["claude-sonnet-5-5", "claude-opus-5-5"])("%s : temperature NON envoyée", async (m) => {
    configModel = m;
    await anthropicProvider.generate(req);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0]).not.toHaveProperty("temperature");
  });

  it("chemin blog (écriture) : effort bas demandé pour que la réflexion ne mange pas max_tokens", async () => {
    configModel = "claude-sonnet-5-5";
    await anthropicProvider.generate({ ...(req as object), blogClaudeRole: "ecriture" } as never);
    expect(create.mock.calls[0]![0]).toHaveProperty("output_config", { effort: "low" });
  });

  it("hors chemin blog : aucun output_config ajouté", async () => {
    configModel = "claude-sonnet-5-5";
    await anthropicProvider.generate(req);
    expect(create.mock.calls[0]![0]).not.toHaveProperty("output_config");
  });

  it("claude-sonnet-4-6 : temperature toujours envoyée", async () => {
    configModel = "claude-sonnet-4-6";
    await anthropicProvider.generate(req);
    expect(create.mock.calls[0]![0]).toHaveProperty("temperature", 0.7);
  });
});

describe("anthropicProvider.generate : Haiku 5.5 sans prix", () => {
  it.each(["claude-haiku-5-5", "claude-haiku-5-5-20261115"])(
    "%s : ProviderError non retryable AVANT plafond de coût et appel réseau",
    async (m) => {
      configModel = m;
      const err = await anthropicProvider.generate(req).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).retryable).toBe(false);
      expect((err as ProviderError).message).toMatch(/prix inconnu/i);
      expect(assertCostCapAvailable).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );
});

describe("claudeSearch (claude-search.ts)", () => {
  const reponse = {
    ok: true,
    json: async () => ({
      content: [{ type: "text", text: "ok" }],
      model: "x",
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  };

  it.each(["claude-sonnet-5-5", "claude-opus-5-5"] as const)(
    "%s : temperature NON envoyée",
    async (model) => {
      const f = vi.fn().mockResolvedValue(reponse);
      vi.stubGlobal("fetch", f);
      await claudeSearch({ query: "q", model, temperature: 0.2 });
      const body = JSON.parse((f.mock.calls[0]![1] as { body: string }).body);
      expect(body).not.toHaveProperty("temperature");
    },
  );

  it("claude-sonnet-4-6 : temperature envoyée", async () => {
    const f = vi.fn().mockResolvedValue(reponse);
    vi.stubGlobal("fetch", f);
    await claudeSearch({ query: "q", model: "claude-sonnet-4-6", temperature: 0.2 });
    const body = JSON.parse((f.mock.calls[0]![1] as { body: string }).body);
    expect(body.temperature).toBe(0.2);
  });

  it.each(["claude-haiku-5-5", "claude-haiku-5-5-20261115"])(
    "%s : échec AVANT tout appel réseau",
    async (model) => {
      const f = vi.fn();
      vi.stubGlobal("fetch", f);
      await expect(
        claudeSearch({ query: "q", model: model as never, temperature: 0.2 }),
      ).rejects.toThrow(/prix inconnu/i);
      expect(f).not.toHaveBeenCalled();
    },
  );
});
