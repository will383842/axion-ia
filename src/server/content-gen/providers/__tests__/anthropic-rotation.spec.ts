/**
 * anthropic.ts : rotation de clés, robustesse du flux, solde de réservation,
 * consigne JSON limitée au chemin blog. Chiffres fictifs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const assertCostCapAvailable = vi.fn();
const trackCost = vi.fn();
const solderReservation = vi.fn();
const clesVues: string[] = [];
// L'état « épuisée » vit dans le module (24 h) : des clés neuves à chaque test.
let K1 = "";
let K2 = "";
let n = 0;

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  class Anthropic {
    static APIError = APIError;
    static APIConnectionError = class extends Error {};
    static APIConnectionTimeoutError = class extends Error {};
    constructor(opts: { apiKey: string }) {
      clesVues.push(opts.apiKey);
    }
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
    model: "claude-sonnet-5-5",
    enabled: true,
    monthlyCapUsd: 100,
    fromDb: true,
  }),
}));
vi.mock("../blog-claude-ledger", () => ({
  solderReservation: (...a: unknown[]) => solderReservation(...a),
}));

import Anthropic from "@anthropic-ai/sdk";
import { anthropicProvider, extraireJsonTolerant } from "../anthropic";
import { ProviderError } from "../IProvider";

const APIError = Anthropic.APIError as unknown as new (s: number, m: string) => Error;

async function* flux(texte = "ok", stop = "end_turn") {
  yield {
    type: "message_start",
    message: { usage: { input_tokens: 10, cache_read_input_tokens: 0 } },
  };
  yield { type: "content_block_delta", delta: { type: "text_delta", text: texte } };
  yield { type: "message_delta", usage: { output_tokens: 5 }, delta: { stop_reason: stop } };
}

const base = {
  jobId: "j",
  contentType: "blog_article",
  role: "text",
  systemPrompt: "S",
  userPrompt: "U",
};
const req = base as never;

beforeEach(() => {
  create.mockReset();
  assertCostCapAvailable.mockReset();
  trackCost.mockReset();
  solderReservation.mockReset();
  clesVues.length = 0;
  n += 1;
  K1 = `cle-un-${n}`;
  K2 = `cle-deux-${n}`;
  create.mockImplementation(async () => flux());
  vi.stubEnv("ANTHROPIC_API_KEY", K1);
  vi.stubEnv("ANTHROPIC_API_KEY_2", "");
  vi.stubEnv("ANTHROPIC_API_KEY_3", "");
  vi.stubEnv("ANTHROPIC_KEY_ORDER_CONTENT_GEN", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("rotation de clés", () => {
  it("clé unique : comportement identique (trackCost, pas de rotation)", async () => {
    const r = await anthropicProvider.generate(req);
    expect(r.output).toBe("ok");
    expect(clesVues).toEqual([K1]);
    expect(trackCost).toHaveBeenCalledTimes(1);
    expect(solderReservation).not.toHaveBeenCalled();
  });

  it("400 « credit balance » : passe à la clé 2, une seule dépense tracée", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create
      .mockRejectedValueOnce(new APIError(400, "Your credit balance is too low"))
      .mockImplementation(async () => flux());
    const r = await anthropicProvider.generate(req);
    expect(r.output).toBe("ok");
    expect(clesVues).toEqual([K1, K2]);
    expect(trackCost).toHaveBeenCalledTimes(1);
  });

  it("429 (même avec « billing » dans le message) ne fait PAS tourner la clé", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create.mockRejectedValue(new APIError(429, "rate limit, see Plans & Billing"));
    await expect(
      anthropicProvider.generate({ ...base, blogClaudeRole: "ecriture" } as never),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(clesVues).toEqual([K1]);
  });

  it("erreur en cours de flux : pas de rotation, pas de rejeu (chemin blog)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create.mockImplementation(async () =>
      (async function* () {
        yield { type: "message_start", message: { usage: { input_tokens: 10 } } };
        throw new APIError(400, "credit balance is too low");
      })(),
    );
    const err = await anthropicProvider
      .generate({ ...base, blogClaudeRole: "ecriture", reservationId: "r1" } as never)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(create).toHaveBeenCalledTimes(1);
    expect(clesVues).toEqual([K1]);
    // flux interrompu : réservation maximale conservée, jamais soldée à zéro
    expect(solderReservation).not.toHaveBeenCalled();
  });

  it("aucune clé n'apparaît dans les messages d'erreur", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create.mockRejectedValue(new APIError(400, `credit balance is too low ${K1} ${K2}`));
    const err = (await anthropicProvider.generate(req).catch((e: unknown) => e)) as Error;
    expect(err.message).not.toContain(K1);
    expect(err.message).not.toContain(K2);
  });

  it("remise à zéro : texte et jetons ne se cumulent pas entre deux essais", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create
      .mockRejectedValueOnce(new APIError(402, "payment required"))
      .mockImplementation(async () => flux("seul"));
    const r = await anthropicProvider.generate(req);
    expect(r.output).toBe("seul");
    expect(r.tokensInput).toBe(10);
    expect(r.tokensOutput).toBe(5);
  });
});

describe("chemin blog : réservation", () => {
  const reqBlog = { ...base, blogClaudeRole: "ecriture", reservationId: "res-1" } as never;

  it("solde la réservation, n'appelle NI trackCost NI le plafond global", async () => {
    await anthropicProvider.generate(reqBlog);
    expect(trackCost).not.toHaveBeenCalled();
    expect(assertCostCapAvailable).not.toHaveBeenCalled();
    expect(solderReservation).toHaveBeenCalledTimes(1);
    expect(solderReservation.mock.calls[0]![0]).toBe("res-1");
    expect(solderReservation.mock.calls[0]![1]).toBeGreaterThan(0);
  });

  it("texte vide : erreur ET réservation soldée au coût réel", async () => {
    create.mockImplementation(async () =>
      (async function* () {
        yield { type: "message_start", message: { usage: { input_tokens: 10 } } };
        yield {
          type: "message_delta",
          usage: { output_tokens: 1 },
          delta: { stop_reason: "end_turn" },
        };
      })(),
    );
    await expect(anthropicProvider.generate(reqBlog)).rejects.toThrow(/empty content/);
    expect(solderReservation).toHaveBeenCalledTimes(1);
    expect(solderReservation.mock.calls[0]![1]).toBeGreaterThan(0);
  });

  it("refus HTTP avant flux : soldée à 0 ; un seul essai", async () => {
    create.mockRejectedValue(new APIError(500, "boom"));
    await expect(anthropicProvider.generate(reqBlog)).rejects.toBeInstanceOf(ProviderError);
    expect(create).toHaveBeenCalledTimes(1);
    expect(solderReservation.mock.calls[0]![1]).toBe(0);
  });

  it("délai/connexion sans usage : réservation maximale conservée", async () => {
    create.mockRejectedValue(new Error("socket"));
    await expect(anthropicProvider.generate(reqBlog)).rejects.toBeInstanceOf(ProviderError);
    expect(solderReservation).not.toHaveBeenCalled();
  });
});

describe("consigne JSON et analyseur tolérant", () => {
  const systemEnvoye = () =>
    (create.mock.calls[0]![0] as { system: Array<{ text: string }> }).system[0]!.text;

  it("ajoutée seulement si blogClaudeRole ET responseFormatJson", async () => {
    await anthropicProvider.generate({ ...base, responseFormatJson: true } as never);
    expect(systemEnvoye()).toBe("S");
    create.mockClear();
    await anthropicProvider.generate({ ...base, blogClaudeRole: "ecriture" } as never);
    expect(systemEnvoye()).toBe("S");
    create.mockClear();
    create.mockImplementation(async () => flux('{"a":1}'));
    await anthropicProvider.generate({
      ...base,
      blogClaudeRole: "ecriture",
      responseFormatJson: true,
    } as never);
    expect(systemEnvoye()).toContain("objet JSON valide");
  });

  it("```json autour : nettoyé ; appelant sans rôle : sortie intacte", async () => {
    const brut = '```json\n{"a": 1}\n```';
    create.mockImplementation(async () => flux(brut));
    const blog = await anthropicProvider.generate({
      ...base,
      blogClaudeRole: "ecriture",
      responseFormatJson: true,
    } as never);
    expect(blog.output).toBe('{"a":1}');
    create.mockImplementation(async () => flux(brut));
    const autre = await anthropicProvider.generate({ ...base, responseFormatJson: true } as never);
    expect(autre.output).toBe(brut);
  });

  it("troncature max_tokens en JSON : erreur claire, soldée", async () => {
    create.mockImplementation(async () => flux('{"a": "coup', "max_tokens"));
    await expect(
      anthropicProvider.generate({
        ...base,
        blogClaudeRole: "ecriture",
        responseFormatJson: true,
        reservationId: "r2",
      } as never),
    ).rejects.toThrow(/tronquée/);
    expect(solderReservation).toHaveBeenCalledTimes(1);
  });

  it("extraireJsonTolérant", () => {
    expect(extraireJsonTolerant('Voici : {"a":[1,2]} merci')).toBe('{"a":[1,2]}');
    expect(extraireJsonTolerant("pas de json")).toBeNull();
    expect(extraireJsonTolerant("[1,2]")).toBe("[1,2]");
    expect(extraireJsonTolerant('{"a":')).toBeNull();
  });
});
