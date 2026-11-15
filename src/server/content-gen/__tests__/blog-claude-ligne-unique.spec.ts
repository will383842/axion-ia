/**
 * Intégration : VRAI `anthropicProvider` + SDK Anthropic simulé + base simulée.
 * Un appel via `genererTexteBlogClaude` produit UNE SEULE ligne `cost_ledger`
 * (jamais de `trackCost` en plus), y compris texte vide, flux coupé et erreur.
 * Variable absente : aucun appel Anthropic. Chiffres FICTIFS.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create, trackCostSpy, reg, colonne } = vi.hoisted(() => ({
  create: vi.fn(),
  // La colonne `cost_usd` est un Decimal(10,4) : la base simulée arrondit comme elle.
  colonne: (v: number) => Math.round(v * 1e4) / 1e4,
  trackCostSpy: vi.fn(),
  reg: {
    lignes: [] as Array<{ id: string; costUsd: number; provider: string }>,
    compteur: 1,
    redis: new Map<string, number>(),
  },
}));

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
    messages = { create };
  }
  return { default: Anthropic };
});

vi.mock("@/server/notifications", () => ({
  notify: vi.fn(async () => ({ ok: true, channels: {} })),
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    incr: vi.fn(async (k: string) => {
      reg.redis.set(k, (reg.redis.get(k) ?? 0) + 1);
      return reg.redis.get(k)!;
    }),
    decr: vi.fn(async (k: string) => {
      reg.redis.set(k, (reg.redis.get(k) ?? 0) - 1);
      return reg.redis.get(k)!;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
    set: vi.fn(async () => "OK"),
  },
}));
// Le suivi de coût historique : le vrai module, avec `trackCost` espionné. Toute
// écriture par ce chemin ajouterait une ligne : l'espion DOIT rester muet.
vi.mock("@/server/content-gen/lib/cost-tracker", async (orig) => {
  const real = await orig<typeof import("@/server/content-gen/lib/cost-tracker")>();
  return {
    ...real,
    trackCost: (...a: unknown[]) => trackCostSpy(...a),
    assertCostCapAvailable: vi.fn(async () => undefined),
  };
});
vi.mock("@/lib/prisma", () => {
  const configAnthropic = {
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    enabled: true,
    monthlyCapUsd: 100,
    extraConfig: {
      blog_claude_daily_cap_usd: 2,
      blog_claude_monthly_cap_usd: 10,
      blog_claude_reserve_qualiopi_usd: 5,
      blog_claude_juge_max_jour: 3,
    },
  };
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (q: { sql: string }) =>
      q.sql.includes("SELECT 1 FROM content_gen_jobs")
        ? [{ "?column?": 1 }]
        : [{ total: reg.lignes.reduce((s, l) => s + l.costUsd, 0) }],
    ),
    costLedger: {
      create: vi.fn(async ({ data }: { data: { costUsd: number; provider: string } }) => {
        const id = `L${reg.lignes.length + 1}`;
        reg.lignes.push({ id, costUsd: colonne(data.costUsd), provider: data.provider });
        return { id };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const l = reg.lignes.find((x) => x.id === where.id);
        return l ? { costUsd: l.costUsd } : null;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { costUsd: number } }) => {
          reg.lignes.find((x) => x.id === where.id)!.costUsd = colonne(data.costUsd);
        },
      ),
    },
    providerConfig: {
      findUnique: vi.fn(async () => ({ currentMonthSpentUsd: reg.compteur })),
      update: vi.fn(async ({ data }: { data: { currentMonthSpentUsd: { increment: number } } }) => {
        reg.compteur += data.currentMonthSpentUsd.increment;
      }),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      providerConfig: { findUnique: vi.fn(async () => configAnthropic) },
      contentGenConfig: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => undefined),
      },
      costLedger: {
        create: vi.fn(async ({ data }: { data: { costUsd: number; provider: string } }) => {
          // Toute écriture hors transaction de réservation serait un double comptage.
          reg.lignes.push({ id: `X${reg.lignes.length + 1}`, ...data });
        }),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { invalidateProviderConfigCache } from "@/server/content-gen/lib/config-reader";
import { anthropicProvider } from "@/server/content-gen/providers/anthropic";
import {
  assertPlafondsClaude,
  genererTexteBlogClaude,
} from "@/server/content-gen/providers/blog-claude";
import type { GenerationRequest } from "@/server/content-gen/providers/IProvider";

const REQ: GenerationRequest = {
  jobId: "job1",
  contentType: "blog_article",
  role: "text",
  systemPrompt: "système",
  userPrompt: "texte utilisateur",
  maxTokens: 1000,
};

async function* fluxComplet(texte = "article") {
  yield {
    type: "message_start",
    message: { usage: { input_tokens: 100, cache_read_input_tokens: 0 } },
  };
  yield { type: "content_block_delta", delta: { type: "text_delta", text: texte } };
  yield { type: "message_delta", usage: { output_tokens: 50 }, delta: { stop_reason: "end_turn" } };
}

beforeEach(() => {
  create.mockReset();
  trackCostSpy.mockReset();
  reg.lignes = [];
  reg.compteur = 1;
  reg.redis.clear();
  process.env["CONTENT_GEN_BLOG_CLAUDE"] = "true";
  process.env["ANTHROPIC_API_KEY"] = "cle-fictive-test";
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env["CONTENT_GEN_BLOG_CLAUDE"];
  delete process.env["ANTHROPIC_API_KEY"];
  vi.restoreAllMocks();
});

describe("une seule ligne costLedger par appel (vrai fournisseur, SDK simulé)", () => {
  it("appel réussi : une ligne, soldée au coût réel, inférieure à la réservation", async () => {
    create.mockImplementation(async () => fluxComplet());
    const r = await genererTexteBlogClaude(REQ, "ecriture");
    expect(r.output).toBe("article");
    expect(create).toHaveBeenCalledTimes(1);
    expect(trackCostSpy).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.provider).toBe("anthropic");
    expect(reg.lignes[0]!.costUsd).toBeCloseTo(r.costUsd, 6);
    expect(reg.compteur).toBeGreaterThan(1);
  });

  it("texte vide : erreur, UNE ligne facturée au coût réel (jetons non nuls)", async () => {
    create.mockImplementation(async () =>
      (async function* () {
        yield { type: "message_start", message: { usage: { input_tokens: 100 } } };
        yield {
          type: "message_delta",
          usage: { output_tokens: 1 },
          delta: { stop_reason: "end_turn" },
        };
      })(),
    );
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toThrow(/empty content/);
    expect(trackCostSpy).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBeGreaterThan(0);
  });

  it("flux coupé après message_start : UNE ligne, réservation maximale conservée", async () => {
    create.mockImplementation(async () =>
      (async function* () {
        yield { type: "message_start", message: { usage: { input_tokens: 100 } } };
        throw new Error("connexion coupée");
      })(),
    );
    const avant = reg.compteur;
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeDefined();
    expect(create).toHaveBeenCalledTimes(1);
    expect(trackCostSpy).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBeGreaterThan(0);
    expect(reg.compteur).toBeGreaterThan(avant);
  });

  it("erreur HTTP avant tout flux : UNE ligne, soldée à zéro ; un seul essai", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const APIError = Anthropic.APIError as unknown as new (s: number, m: string) => Error;
    create.mockRejectedValue(new APIError(500, "boom"));
    const avant = reg.compteur;
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeDefined();
    expect(create).toHaveBeenCalledTimes(1);
    expect(trackCostSpy).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBe(0);
    expect(reg.compteur).toBeCloseTo(avant, 6);
  });
});

describe("variable absente", () => {
  it.each([undefined, "", "TRUE", "1"])("%j : aucun appel Anthropic, aucune ligne", async (v) => {
    if (v === undefined) delete process.env["CONTENT_GEN_BLOG_CLAUDE"];
    else process.env["CONTENT_GEN_BLOG_CLAUDE"] = v;
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "eteint",
    });
    expect(create).not.toHaveBeenCalled();
    expect(trackCostSpy).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(0);
  });
});

describe("rotation de clés et coupure de flux (B1 / S-I1)", () => {
  async function erreurApi(status: number, message: string) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const APIError = Anthropic.APIError as unknown as new (s: number, m: string) => Error;
    return new APIError(status, message);
  }

  it("clé 1 : crédit refusé (400), clé 2 : flux coupé = réservation maximale conservée", async () => {
    // Clés PROPRES à ce test : l'état d'épuisement (24 h) vit dans le module.
    process.env["ANTHROPIC_API_KEY"] = "cle-rotation-b1-un";
    process.env["ANTHROPIC_API_KEY_2"] = "cle-rotation-b1-deux";
    try {
      const refus = await erreurApi(400, "Your credit balance is too low to access the API");
      let n = 0;
      create.mockImplementation(async () => {
        n += 1;
        if (n === 1) throw refus;
        return (async function* () {
          yield { type: "message_start", message: { usage: { input_tokens: 100 } } };
          throw new Error("connexion coupée");
        })();
      });
      const avant = reg.compteur;
      await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeDefined();
      expect(create).toHaveBeenCalledTimes(2);
      expect(trackCostSpy).not.toHaveBeenCalled();
      expect(reg.lignes).toHaveLength(1);
      // Pas soldée à zéro : Anthropic a pu facturer le début du flux de la clé 2.
      expect(reg.lignes[0]!.costUsd).toBeGreaterThan(0);
      expect(reg.compteur).toBeGreaterThan(avant);
    } finally {
      delete process.env["ANTHROPIC_API_KEY_2"];
    }
  });

  it("flux terminé SANS message_delta : réservation maximale conservée (pas sous le max)", async () => {
    create.mockImplementation(async () =>
      (async function* () {
        yield { type: "message_start", message: { usage: { input_tokens: 100 } } };
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "article" } };
      })(),
    );
    const r = await genererTexteBlogClaude(REQ, "ecriture");
    expect(r.output).toBe("article");
    expect(reg.lignes).toHaveLength(1);
    // Réservation = entrée estimée + max_tokens (1000) en sortie : bien au-dessus du coût d'entrée seul.
    expect(reg.lignes[0]!.costUsd).toBeGreaterThan(r.costUsd);
    expect(trackCostSpy).not.toHaveBeenCalled();
  });
});

describe("sorties avant le SDK et refus HTTP (cas 7 et 4)", () => {
  async function erreurApi(status: number, message: string) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const APIError = Anthropic.APIError as unknown as new (s: number, m: string) => Error;
    return new APIError(status, message);
  }
  const CREDIT = "Your credit balance is too low to access the API";

  it("fournisseur désactivé après la porte : UNE ligne à zéro, compteur revenu, aucun appel", async () => {
    invalidateProviderConfigCache("anthropic");
    const findUnique = vi.mocked(prisma.providerConfig.findUnique);
    const actuelle = {
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      enabled: true,
      monthlyCapUsd: 100,
      extraConfig: {
        blog_claude_daily_cap_usd: 2,
        blog_claude_monthly_cap_usd: 10,
        blog_claude_reserve_qualiopi_usd: 5,
        blog_claude_juge_max_jour: 3,
      },
    };
    // 1re lecture : la porte (activée) ; 2e : le fournisseur (désactivé en base entre-temps).
    findUnique
      .mockResolvedValueOnce(actuelle as never)
      .mockResolvedValueOnce({ ...(actuelle as object), enabled: false } as never);
    const avant = reg.compteur;
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toThrow(/disabled/i);
    invalidateProviderConfigCache("anthropic");
    expect(create).not.toHaveBeenCalled();
    expect(trackCostSpy).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBe(0);
    expect(reg.compteur).toBeCloseTo(avant, 6);
  });

  it("prix inconnu (Haiku 5.5) : UNE ligne à zéro, compteur revenu, aucun appel", async () => {
    invalidateProviderConfigCache("anthropic");
    const avant = reg.compteur;
    const { reservation } = await assertPlafondsClaude(REQ, "ecriture");
    expect(reg.compteur).toBeGreaterThan(avant);
    await expect(
      anthropicProvider.generate({
        ...REQ,
        model: "claude-haiku-5-5",
        blogClaudeRole: "ecriture",
        reservationId: reservation.id,
      }),
    ).rejects.toThrow(/prix inconnu/);
    expect(create).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBe(0);
    expect(reg.compteur).toBeCloseTo(avant, 6);
  });

  it("toutes les clés déjà épuisées : refus 400 sur deux clés, puis AUCUN appel au rappel", async () => {
    process.env["ANTHROPIC_API_KEY"] = "cle-epuisee-b1-un";
    process.env["ANTHROPIC_API_KEY_2"] = "cle-epuisee-b1-deux";
    try {
      create.mockRejectedValue(await erreurApi(400, CREDIT));
      await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeDefined();
      expect(create).toHaveBeenCalledTimes(2);
      expect(reg.lignes).toHaveLength(1);
      expect(reg.lignes[0]!.costUsd).toBe(0);

      const avant = reg.compteur;
      await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeDefined();
      // Second appel : les deux clés sont marquées épuisées, le SDK n'est pas atteint.
      expect(create).toHaveBeenCalledTimes(2);
      expect(trackCostSpy).not.toHaveBeenCalled();
      expect(reg.lignes).toHaveLength(2);
      expect(reg.lignes[1]!.costUsd).toBe(0);
      expect(reg.compteur).toBeCloseTo(avant, 6);
    } finally {
      delete process.env["ANTHROPIC_API_KEY_2"];
    }
  });

  it.each([
    ["400 crédit épuisé", 400, CREDIT],
    ["429 limite de débit", 429, "rate limited"],
  ])("refus %s avant flux : ligne à zéro, UN seul appel", async (_nom, statut, message) => {
    create.mockRejectedValue(await erreurApi(statut, message));
    const avant = reg.compteur;
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeDefined();
    expect(create).toHaveBeenCalledTimes(1);
    expect(trackCostSpy).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBe(0);
    expect(reg.compteur).toBeCloseTo(avant, 6);
  });
});

describe("coût réel à 0,03004 (cas 1)", () => {
  it("ligne stockée à 0,0300 (Decimal 10,4), compteur +0,04 net (arrondi supérieur)", async () => {
    // 2020 jetons d'entrée × 2 $/M + 2600 jetons de sortie × 10 $/M = 0,03004 $.
    create.mockImplementation(async () =>
      (async function* () {
        yield {
          type: "message_start",
          message: { usage: { input_tokens: 2020, cache_read_input_tokens: 0 } },
        };
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "article" } };
        yield {
          type: "message_delta",
          usage: { output_tokens: 2600 },
          delta: { stop_reason: "end_turn" },
        };
      })(),
    );
    const avant = reg.compteur;
    const r = await genererTexteBlogClaude({ ...REQ, maxTokens: 4000 }, "ecriture");
    expect(r.costUsd).toBeCloseTo(0.03004, 8);
    expect(trackCostSpy).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBeCloseTo(0.03, 8);
    expect(reg.compteur - avant).toBeCloseTo(0.04, 6);
  });
});
