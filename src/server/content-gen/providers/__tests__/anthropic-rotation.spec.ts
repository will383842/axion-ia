/**
 * anthropic.ts : rotation de clés, robustesse du flux, solde de réservation,
 * consigne JSON limitée au chemin blog. Chiffres fictifs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const assertCostCapAvailable = vi.fn();
const trackCost = vi.fn();
const solderReservation = vi.fn();
const alerte = vi.fn();
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

vi.mock("@/lib/redis", async () => {
  const { creerFauxRedis } = await import("./faux-redis-cles");
  return { redis: creerFauxRedis() };
});
vi.mock("../anthropic-credit-alert", () => ({
  alerterCleAnthropic: (...a: unknown[]) => alerte(...a),
}));
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
import { redis as redisImporte } from "@/lib/redis";
import {
  anthropicProvider,
  extraireJsonTolerant,
  mapAnthropicError,
  __simulerNouveauProcessusCles,
} from "../anthropic";
import type { FauxRedis } from "./faux-redis-cles";

const fauxRedis = redisImporte as unknown as FauxRedis;
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
  alerte.mockReset();
  fauxRedis.vider();
  __simulerNouveauProcessusCles();
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

describe("réservation : cas limites (constats G2)", () => {
  const reqBlog = { ...base, blogClaudeRole: "ecriture", reservationId: "res-9" } as never;

  it("B1 : clé 1 crédit refusé puis clé 2 flux coupé = réservation maximale conservée", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create
      .mockRejectedValueOnce(new APIError(400, "Your credit balance is too low"))
      .mockImplementationOnce(async () =>
        (async function* () {
          yield { type: "message_start", message: { usage: { input_tokens: 10 } } };
          throw new Error("coupé");
        })(),
      );
    await expect(anthropicProvider.generate(reqBlog)).rejects.toBeInstanceOf(ProviderError);
    expect(create).toHaveBeenCalledTimes(2);
    expect(solderReservation).not.toHaveBeenCalled();
  });

  it("M3 : toutes les clés déjà épuisées = aucun appel HTTP, soldée à zéro", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create.mockRejectedValue(new APIError(400, "Your credit balance is too low"));
    await expect(anthropicProvider.generate(reqBlog)).rejects.toMatchObject({
      code: "quota_exhausted",
    });
    create.mockClear();
    solderReservation.mockClear();
    await expect(anthropicProvider.generate(reqBlog)).rejects.toMatchObject({
      code: "quota_exhausted",
    });
    expect(create).not.toHaveBeenCalled();
    expect(solderReservation).toHaveBeenCalledTimes(1);
    expect(solderReservation.mock.calls[0]![1]).toBe(0);
  });

  it("A-M2 : clé absente = aucune requête, soldée à zéro", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(anthropicProvider.generate(reqBlog)).rejects.toBeInstanceOf(ProviderError);
    expect(create).not.toHaveBeenCalled();
    expect(solderReservation).toHaveBeenCalledTimes(1);
    expect(solderReservation.mock.calls[0]![1]).toBe(0);
  });

  it("A-M2 : modèle au prix inconnu = refus avant l'appel, soldée à zéro", async () => {
    await expect(
      anthropicProvider.generate({
        ...base,
        model: "claude-haiku-5-5",
        blogClaudeRole: "ecriture",
        reservationId: "res-9",
      } as never),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(create).not.toHaveBeenCalled();
    expect(solderReservation).toHaveBeenCalledTimes(1);
    expect(solderReservation.mock.calls[0]![1]).toBe(0);
  });

  it("M4 : JSON tronqué par max_tokens = erreur reconnaissable par les boucles de plan", async () => {
    const { estSortieJsonTronquee } = await import("../IProvider");
    create.mockImplementation(async () => flux('{"a":', "max_tokens"));
    const err = await anthropicProvider
      .generate({ ...(reqBlog as object), responseFormatJson: true } as never)
      .catch((e: unknown) => e);
    expect(estSortieJsonTronquee(err)).toBe(true);
    expect(
      estSortieJsonTronquee(new ProviderError("autre", "invalid_response", "anthropic", false)),
    ).toBe(false);
    expect(estSortieJsonTronquee(new Error("sortie JSON tronquée"))).toBe(false);
  });
});

describe("S-M1 : aucune clé dans les messages d'erreur, même avec une seule clé", () => {
  it("masque sk-ant-… et la valeur de la clé d'environnement", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "t".repeat(24));
    const e = new APIError(401, `invalid x-api-key ${"t".repeat(24)} / sk-ant-api03-ABCdef_12`);
    const m = mapAnthropicError(e);
    expect(m.message).not.toContain("t".repeat(24));
    expect(m.message).not.toMatch(/sk-ant-/);
    expect(m.message).toContain("invalid x-api-key");
  });
  it("M-stack : la pile ne recopie pas non plus la clé", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "t".repeat(24));
    const e = new APIError(401, `invalid x-api-key ${"t".repeat(24)} / sk-ant-api03-ABCdef_12`);
    const m = mapAnthropicError(e);
    expect(m.stack ?? "").not.toContain("t".repeat(24));
    expect(m.stack ?? "").not.toMatch(/sk-ant-/);
  });
  it("erreur inconnue : même masquage", () => {
    const m = mapAnthropicError(new Error("boom sk-ant-oat01-XYZ"));
    expect(m.message).not.toMatch(/sk-ant-/);
    expect(m.message).toContain("boom");
  });
});

describe("tableau de réaction (avant tout flux)", () => {
  const credit = () => new APIError(400, "Your credit balance is too low");

  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    vi.stubEnv("ANTHROPIC_API_KEY_3", `cle-trois-${n}`);
  });

  it("400 crédit : clé suivante, marque Redis 6 h, alerte « clé 1 épuisée » (index seul)", async () => {
    create.mockRejectedValueOnce(credit()).mockImplementation(async () => flux());
    await anthropicProvider.generate(req);
    expect(clesVues).toEqual([K1, K2]);
    expect(fauxRedis.ttls.get("anthropic:cle:1:epuisee")).toBe(6 * 3600);
    expect(alerte).toHaveBeenCalledWith(1, "epuisee");
  });

  it("402 : même réaction", async () => {
    create
      .mockRejectedValueOnce(new APIError(402, "payment required"))
      .mockImplementation(async () => flux());
    await anthropicProvider.generate(req);
    expect(clesVues).toEqual([K1, K2]);
    expect(fauxRedis.ttls.has("anthropic:cle:1:epuisee")).toBe(true);
  });

  it("401 : clé suivante, marque INVALIDE 1 h, alerte critique", async () => {
    create
      .mockRejectedValueOnce(new APIError(401, "invalid x-api-key"))
      .mockImplementation(async () => flux());
    await anthropicProvider.generate(req);
    expect(clesVues).toEqual([K1, K2]);
    expect(fauxRedis.ttls.get("anthropic:cle:1:invalide")).toBe(3600);
    expect(alerte).toHaveBeenCalledWith(1, "invalide");
  });

  it("403 : même réaction que 401", async () => {
    create
      .mockRejectedValueOnce(new APIError(403, "forbidden"))
      .mockImplementation(async () => flux());
    await anthropicProvider.generate(req);
    expect(clesVues).toEqual([K1, K2]);
    expect(fauxRedis.ttls.has("anthropic:cle:1:invalide")).toBe(true);
  });

  it.each([429, 500, 503, 529])(
    "%i : PAS de rotation, aucune marque, aucune alerte (chemin blog : un seul essai)",
    async (statut) => {
      create.mockRejectedValue(new APIError(statut, "surcharge"));
      await expect(
        anthropicProvider.generate({ ...base, blogClaudeRole: "ecriture" } as never),
      ).rejects.toBeInstanceOf(ProviderError);
      expect(clesVues).toEqual([K1]);
      expect(fauxRedis.ttls.size).toBe(0);
      expect(alerte).not.toHaveBeenCalled();
    },
  );

  it("429 puis succès (chemin hors blog) : nouvel essai APRÈS attente, sur la MÊME clé, sans marque", async () => {
    vi.useFakeTimers();
    try {
      create
        .mockRejectedValueOnce(new APIError(429, "rate limit"))
        .mockImplementation(async () => flux());
      const p = anthropicProvider.generate(req);
      await vi.advanceTimersByTimeAsync(0);
      expect(create).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(13_000);
      const r = await p;
      expect(r.output).toBe("ok");
      expect(clesVues).toEqual([K1, K1]);
      expect(fauxRedis.ttls.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("529 puis succès (chemin hors blog) : nouvel essai, pas de rotation", async () => {
    vi.useFakeTimers();
    try {
      create
        .mockRejectedValueOnce(new APIError(529, "overloaded"))
        .mockImplementation(async () => flux());
      const p = anthropicProvider.generate(req);
      await vi.advanceTimersByTimeAsync(13_000);
      await p;
      expect(clesVues).toEqual([K1, K1]);
      expect(fauxRedis.ttls.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("erreur en cours de flux (401 ou crédit) : ni rotation, ni nouvel essai, ni marque, drapeau faux", async () => {
    for (const e of [new APIError(401, "x"), credit()]) {
      create.mockReset();
      clesVues.length = 0;
      create.mockImplementation(async () =>
        (async function* () {
          yield { type: "message_start", message: { usage: { input_tokens: 10 } } };
          throw e;
        })(),
      );
      const err = (await anthropicProvider.generate(req).catch((x: unknown) => x)) as ProviderError;
      expect(create).toHaveBeenCalledTimes(1);
      expect(clesVues).toEqual([K1]);
      expect(fauxRedis.ttls.size).toBe(0);
      expect(alerte).not.toHaveBeenCalled();
      expect((err as { toutesEpuisees?: boolean }).toutesEpuisees).not.toBe(true);
    }
  });

  it("toutes les clés refusées pour crédit : quota_exhausted + toutesEpuisees true", async () => {
    create.mockRejectedValue(credit());
    const err = (await anthropicProvider.generate(req).catch((x: unknown) => x)) as ProviderError;
    expect(err.code).toBe("quota_exhausted");
    expect((err as { toutesEpuisees?: boolean }).toutesEpuisees).toBe(true);
    expect(create).toHaveBeenCalledTimes(3);
    expect(alerte.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });

  it("toutes les clés refusées en 401 : auth_failed, statut 401, toutesEpuisees true", async () => {
    create.mockRejectedValue(new APIError(401, "invalid x-api-key"));
    const err = (await anthropicProvider.generate(req).catch((x: unknown) => x)) as ProviderError;
    expect(err.code).toBe("auth_failed");
    expect((err as { status?: number }).status).toBe(401);
    expect((err as { toutesEpuisees?: boolean }).toutesEpuisees).toBe(true);
  });

  it("clé unique : aucune rotation, aucune marque Redis, aucune alerte ; erreur de crédit annotée vrai (comportement d'avant)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", "");
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    create.mockRejectedValue(credit());
    const err = (await anthropicProvider.generate(req).catch((x: unknown) => x)) as ProviderError;
    expect(err.code).toBe("quota_exhausted");
    expect((err as { toutesEpuisees?: boolean }).toutesEpuisees).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(fauxRedis.ttls.size).toBe(0);
    expect(alerte).not.toHaveBeenCalled();
  });

  it("clé unique placée dans ANTHROPIC_API_KEY_2 seulement : utilisée telle quelle", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    await anthropicProvider.generate(req);
    expect(clesVues).toEqual([K2]);
  });
});

describe("état partagé app/worker (même faux Redis, deux « processus »)", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY_2", K2));

  it("l'app épuise la clé 1 ; le worker (mémoire vide) démarre directement sur la clé 2", async () => {
    create
      .mockRejectedValueOnce(new APIError(400, "Your credit balance is too low"))
      .mockImplementation(async () => flux());
    await anthropicProvider.generate(req); // « app »
    __simulerNouveauProcessusCles(); // « worker » : mémoire locale vide, même Redis
    clesVues.length = 0;
    await anthropicProvider.generate(req);
    expect(clesVues).toEqual([K2]);
  });

  it("panne Redis : repli mémoire locale + avertissement, la génération réussit", async () => {
    fauxRedis.panne = true;
    create
      .mockRejectedValueOnce(new APIError(401, "invalid x-api-key"))
      .mockImplementation(async () => flux());
    const r = await anthropicProvider.generate(req);
    expect(r.output).toBe("ok");
    expect(clesVues).toEqual([K1, K2]);
    clesVues.length = 0;
    await anthropicProvider.generate(req); // la mémoire locale retient la clé 1 invalide
    expect(clesVues).toEqual([K2]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/Redis indisponible/));
  });
});

describe("secrets", () => {
  it("aucune clé ni fragment de clé dans les erreurs, les journaux, les alertes, Redis", async () => {
    const grosse1 = `sk-ant-api03-SECRETUN${n}-ZZZZ1111`;
    const grosse2 = `sk-ant-api03-SECRETDEUX${n}-ZZZZ2222`;
    vi.stubEnv("ANTHROPIC_API_KEY", grosse1);
    vi.stubEnv("ANTHROPIC_API_KEY_2", grosse2);
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    create.mockRejectedValue(new APIError(401, `invalid x-api-key ${grosse1} ${grosse2}`));
    const err = (await anthropicProvider.generate(req).catch((x: unknown) => x)) as Error;
    create.mockRejectedValue(new APIError(402, `credit ${grosse1} ${grosse2}`));
    __simulerNouveauProcessusCles();
    fauxRedis.vider();
    const err2 = (await anthropicProvider.generate(req).catch((x: unknown) => x)) as Error;
    const cause = (e: Error) => String((e as { cause?: Error }).cause?.message ?? "");
    const sortie = JSON.stringify([
      err.message,
      err.stack,
      cause(err),
      err2.message,
      err2.stack,
      cause(err2),
      spies.map((s) => s.mock.calls),
      alerte.mock.calls,
      [...fauxRedis.ttls.keys()],
    ]);
    spies.forEach((s) => s.mockRestore());
    for (const secret of [grosse1, grosse2, "SECRETUN", "SECRETDEUX", "ZZZZ1111", "ZZZZ2222"]) {
      expect(sortie).not.toContain(secret);
    }
  });
});

describe("contrôle de santé", () => {
  it("passe par la rotation : clé 1 épuisée, la clé 2 répond -> en bonne santé", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create.mockRejectedValueOnce(new APIError(402, "x")).mockImplementation(async () => flux());
    await expect(anthropicProvider.healthCheck()).resolves.toBe(true);
    expect(clesVues).toEqual([K1, K2]);
    expect(fauxRedis.ttls.has("anthropic:cle:1:epuisee")).toBe(true);
  });

  it("modèle d'écriture configuré (plus de claude-haiku-4-5 en dur), max_tokens 1", async () => {
    await anthropicProvider.healthCheck();
    const arg = create.mock.calls[0]![0] as { model: string; max_tokens: number };
    expect(arg.model).toBe("claude-sonnet-5-5");
    expect(arg.max_tokens).toBe(1);
    expect(JSON.stringify(create.mock.calls)).not.toContain("haiku");
  });

  it("toutes les clés refusées : false ; aucune clé configurée : false sans appel", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    create.mockRejectedValue(new APIError(401, "x"));
    await expect(anthropicProvider.healthCheck()).resolves.toBe(false);
    create.mockClear();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_2", "");
    await expect(anthropicProvider.healthCheck()).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("clé 1 absente mais clé 2 présente : la santé l'utilise", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_2", K2);
    await expect(anthropicProvider.healthCheck()).resolves.toBe(true);
    expect(clesVues).toEqual([K2]);
  });
});
