/**
 * Intégration : VRAI `anthropicProvider` + SDK Anthropic simulé + base simulée.
 * Un appel via `genererTexteBlogClaude` produit UNE SEULE ligne `cost_ledger`
 * (jamais de `trackCost` en plus), y compris texte vide, flux coupé et erreur.
 * Variable absente : aucun appel Anthropic. Chiffres FICTIFS.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create, trackCostSpy, reg } = vi.hoisted(() => ({
  create: vi.fn(),
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
        reg.lignes.push({ id, costUsd: data.costUsd, provider: data.provider });
        return { id };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const l = reg.lignes.find((x) => x.id === where.id);
        return l ? { costUsd: l.costUsd } : null;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { costUsd: number } }) => {
          reg.lignes.find((x) => x.id === where.id)!.costUsd = data.costUsd;
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

import { genererTexteBlogClaude } from "@/server/content-gen/providers/blog-claude";
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
