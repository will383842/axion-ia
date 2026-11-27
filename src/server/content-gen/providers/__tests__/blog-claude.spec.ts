/**
 * Porte « texte du blog via Claude » : interrupteur, plafonds, modèles exacts,
 * réservation, suspension, alertes. Chiffres FICTIFS.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UnrecoverableError } from "bullmq";

const { sdk, notifyMock, reg } = vi.hoisted(() => ({
  sdk: vi.fn(),
  notifyMock: vi.fn(),
  reg: {
    config: null as null | Record<string, unknown>,
    configErreur: false,
    suspendu: null as unknown,
    lignes: [] as Array<{ id: string; costUsd: number }>,
    compteur: 0,
    totaux: [] as number[],
    upserts: [] as unknown[],
    redis: new Map<string, number>(),
    redisSet: new Set<string>(),
    suspenduErreur: false,
  },
}));

vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notifyMock(...a) }));
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
    del: vi.fn(async (k: string) => {
      reg.redisSet.delete(k);
      return 1;
    }),
    set: vi.fn(async (k: string) => {
      if (reg.redisSet.has(k)) return null;
      reg.redisSet.add(k);
      return "OK";
    }),
  },
}));
vi.mock("../anthropic", async (orig) => {
  const real = await orig<typeof import("../anthropic")>();
  return {
    ...real,
    anthropicProvider: { key: "anthropic", supportedRoles: ["text"], generate: sdk },
  };
});
vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (q: { sql: string }) =>
      q.sql.includes("FROM content_gen_jobs WHERE id")
        ? [{ "?column?": 1 }]
        : [{ total: reg.totaux.shift() ?? 0 }],
    ),
    costLedger: {
      create: vi.fn(async ({ data }: { data: { costUsd: number } }) => {
        const id = `L${reg.lignes.length + 1}`;
        reg.lignes.push({ id, costUsd: data.costUsd });
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
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        const copie = JSON.stringify({ l: reg.lignes, c: reg.compteur });
        try {
          return await fn(tx);
        } catch (e) {
          const o = JSON.parse(copie) as { l: typeof reg.lignes; c: number };
          reg.lignes = o.l;
          reg.compteur = o.c;
          throw e;
        }
      }),
      providerConfig: {
        findUnique: vi.fn(async () => {
          if (reg.configErreur) throw new Error("base KO");
          return reg.config;
        }),
      },
      contentGenConfig: {
        findUnique: vi.fn(async () => {
          if (reg.suspenduErreur) throw new Error("base KO");
          return reg.suspendu === null ? null : { value: reg.suspendu };
        }),
        upsert: vi.fn(async (a: unknown) => {
          reg.upserts.push(a);
        }),
      },
    },
  };
});

import { ProviderError, type GenerationRequest } from "../IProvider";
import {
  BlogClaudeRefusError,
  MODELES,
  assertPlafondsClaude,
  genererTexteBlogClaude,
  interrupteurBlogClaude,
} from "../blog-claude";
import { __resetAlerteBlogClaudeMemoire } from "../anthropic-credit-alert";

const REQ: GenerationRequest = {
  jobId: "job1",
  contentType: "blog_article",
  role: "text",
  systemPrompt: "système",
  userPrompt: "texte utilisateur",
  maxTokens: 1000,
  temperature: 0.7,
  preferredProvider: "openai",
};

function configOk(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    enabled: true,
    monthlyCapUsd: 100,
    extraConfig: {
      blog_claude_daily_cap_usd: 2,
      blog_claude_monthly_cap_usd: 10,
      blog_claude_reserve_qualiopi_usd: 5,
      blog_claude_juge_max_jour: 3,
      ...extra,
    },
  };
}

/** Erreur Anthropic finale « plus aucune clé utilisable » (drapeau posé par le fournisseur). */
function toutesEpuisees(
  code: "quota_exhausted" | "auth_failed",
  extra: Record<string, unknown> = {},
): ProviderError {
  return Object.assign(new ProviderError("fin", code, "anthropic", false), {
    toutesEpuisees: true,
    ...extra,
  });
}

const REPONSE = {
  provider: "anthropic",
  model: "claude-sonnet-5-5",
  output: "texte",
  tokensInput: 100,
  tokensOutput: 50,
  costUsd: 0.001,
  durationMs: 1,
};

beforeEach(() => {
  sdk.mockReset();
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({ ok: true, channels: {} });
  reg.config = configOk();
  reg.configErreur = false;
  reg.suspendu = null;
  reg.suspenduErreur = false;
  reg.lignes = [];
  reg.compteur = 1;
  reg.totaux = [];
  reg.upserts = [];
  reg.redis.clear();
  reg.redisSet.clear();
  __resetAlerteBlogClaudeMemoire();
  process.env["CONTENT_GEN_BLOG_CLAUDE"] = "true";
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env["CONTENT_GEN_BLOG_CLAUDE"];
  vi.restoreAllMocks();
});

describe("interrupteur", () => {
  it.each([undefined, "TRUE", "1", "yes", "", "true "])(
    "%j = éteint, SDK jamais appelé",
    async (v) => {
      if (v === undefined) delete process.env["CONTENT_GEN_BLOG_CLAUDE"];
      else process.env["CONTENT_GEN_BLOG_CLAUDE"] = v;
      expect(interrupteurBlogClaude()).toBe(false);
      const err = await genererTexteBlogClaude(REQ, "ecriture").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnrecoverableError);
      expect((err as BlogClaudeRefusError).code).toBe("eteint");
      expect(sdk).not.toHaveBeenCalled();
      expect(reg.lignes).toHaveLength(0);
    },
  );
  it('"true" exactement = allumé, relu à chaque appel', async () => {
    expect(interrupteurBlogClaude()).toBe(true);
    process.env["CONTENT_GEN_BLOG_CLAUDE"] = "false";
    expect(interrupteurBlogClaude()).toBe(false);
  });
});

describe("plafonds invalides = refus avant tout appel", () => {
  it.each([
    ['chaîne "5"', "5"],
    ['"abc"', "abc"],
    ["null", null],
    ["Infinity", Infinity],
    ["-1", -1],
    ["0", 0],
    ["absent", undefined],
    ["au-dessus de la borne dure (21)", 21],
  ])("plafond du jour %s", async (_n, v) => {
    reg.config = configOk({ blog_claude_daily_cap_usd: v });
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(sdk).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(0);
  });
  it.each(["5", "abc", null, Infinity, -1, 0, 301])("plafond du mois blog %j", async (v) => {
    reg.config = configOk({ blog_claude_monthly_cap_usd: v });
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(sdk).not.toHaveBeenCalled();
  });
  it("ligne absente, fournisseur désactivé, plafond global ≤ 0", async () => {
    reg.config = null;
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "config_invalide",
    });
    reg.config = { ...configOk(), enabled: false };
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "config_invalide",
    });
    reg.config = { ...configOk(), monthlyCapUsd: 0 };
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(sdk).not.toHaveBeenCalled();
  });
  it("réserve Qualiopi invalide = refus", async () => {
    for (const v of [-1, "5", null, undefined, Infinity]) {
      reg.config = configOk({ blog_claude_reserve_qualiopi_usd: v });
      await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
        code: "config_invalide",
      });
    }
    expect(sdk).not.toHaveBeenCalled();
  });
  it.each([2.5, "3", 0, -1, null])("blog_claude_juge_max_jour %j non entier = refus", async (v) => {
    reg.config = configOk({ blog_claude_juge_max_jour: v });
    await expect(genererTexteBlogClaude(REQ, "relecture")).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(sdk).not.toHaveBeenCalled();
  });
  it.each([0, -5, 1.5, NaN, Infinity])("maxTokens %j = refus avant écriture", async (v) => {
    await expect(
      genererTexteBlogClaude({ ...REQ, maxTokens: v }, "ecriture"),
    ).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(reg.lignes).toHaveLength(0);
    expect(sdk).not.toHaveBeenCalled();
  });
  it("assertPlafondsClaude : interrupteur éteint = refus avant toute écriture", async () => {
    delete process.env["CONTENT_GEN_BLOG_CLAUDE"];
    await expect(assertPlafondsClaude(REQ, "ecriture")).rejects.toMatchObject({ code: "eteint" });
    expect(reg.lignes).toHaveLength(0);
  });
  it("assertPlafondsClaude : les frais fixes (recherches web) s'ajoutent au coût RÉSERVÉ", async () => {
    await assertPlafondsClaude(REQ, "court", new Date(), 0);
    await assertPlafondsClaude(REQ, "court", new Date(), 0.5);
    expect(reg.lignes).toHaveLength(2);
    expect(reg.lignes[1]!.costUsd - reg.lignes[0]!.costUsd).toBeGreaterThanOrEqual(0.49);
  });
  it("assertPlafondsClaude : frais fixes négatifs ou non finis = refus avant écriture", async () => {
    for (const f of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(assertPlafondsClaude(REQ, "court", new Date(), f)).rejects.toMatchObject({
        code: "config_invalide",
      });
    }
    expect(reg.lignes).toHaveLength(0);
  });
  it("alerte non envoyée : la clé Redis est libérée pour un nouvel essai", async () => {
    notifyMock.mockResolvedValue({ ok: false });
    const { alerterBlogClaude } = await import("../anthropic-credit-alert");
    await alerterBlogClaude("credit_refuse");
    expect(reg.redisSet.has("blog-claude:alerte:credit_refuse")).toBe(false);
  });
  it("base en erreur = refus", async () => {
    reg.configErreur = true;
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "base_indisponible",
    });
    expect(sdk).not.toHaveBeenCalled();
  });
  it("limite de relectures absente = refus (relecture seulement)", async () => {
    reg.config = configOk({ blog_claude_juge_max_jour: undefined });
    await expect(genererTexteBlogClaude(REQ, "relecture")).rejects.toMatchObject({
      code: "config_invalide",
    });
    sdk.mockResolvedValue(REPONSE);
    await expect(genererTexteBlogClaude(REQ, "ecriture")).resolves.toBeDefined();
  });
});

describe("modèles exacts, jamais de temperature", () => {
  it("écriture et court = sonnet 5.5, relecture = opus 5.5", () => {
    expect(MODELES).toEqual({
      ecriture: "claude-sonnet-5-5",
      relecture: "claude-opus-5-5",
      court: "claude-sonnet-5-5",
    });
  });
  it("transmet le modèle du rôle, sans temperature ni preferredProvider, avec réservation", async () => {
    sdk.mockResolvedValue(REPONSE);
    await genererTexteBlogClaude(REQ, "relecture");
    const arg = sdk.mock.calls[0]![0] as GenerationRequest;
    expect(arg.model).toBe("claude-opus-5-5");
    expect(arg).not.toHaveProperty("temperature");
    expect(arg).not.toHaveProperty("preferredProvider");
    expect(arg.blogClaudeRole).toBe("relecture");
    expect(arg.reservationId).toBe("L1");
  });
  it.each(["claude-haiku-5-5", "claude-sonnet-4-6", "gpt-4o", "claude-opus-5-5"])(
    "modèle imposé %s ≠ celui du rôle écriture = refus",
    async (m) => {
      await expect(assertPlafondsClaude({ ...REQ, model: m }, "ecriture")).rejects.toMatchObject({
        code: "modele_interdit",
      });
      expect(reg.lignes).toHaveLength(0);
    },
  );
});

describe("réservation et flux coupé", () => {
  it("erreur Anthropic autre que le crédit : relancée telle quelle, la réservation maximale reste (une ligne)", async () => {
    sdk.mockRejectedValue(new ProviderError("coupé", "down", "anthropic", true));
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeInstanceOf(ProviderError);
    expect(sdk).toHaveBeenCalledTimes(1);
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBeGreaterThan(0);
    expect(reg.compteur).toBeGreaterThan(1);
  });
  it("quota_exhausted : refus non relançable après comptage du refus de crédit", async () => {
    sdk.mockRejectedValue(toutesEpuisees("quota_exhausted"));
    const err = await genererTexteBlogClaude(REQ, "ecriture").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BlogClaudeRefusError);
    expect((err as BlogClaudeRefusError).code).toBe("credit_refuse");
    expect(err).toBeInstanceOf(UnrecoverableError);
    expect(reg.redis.get("blog-claude:refus-credit")).toBe(1);
  });
  it("quota_exhausted d'UNE clé sur plusieurs (sans drapeau) : refus, mais ni comptage ni alerte", async () => {
    sdk.mockRejectedValue(new ProviderError("une clé", "quota_exhausted", "anthropic", false));
    for (let i = 0; i < 5; i++) {
      const err = await genererTexteBlogClaude(REQ, "ecriture").catch((e: unknown) => e);
      expect((err as BlogClaudeRefusError).code).toBe("credit_refuse");
    }
    expect(reg.redis.get("blog-claude:refus-credit")).toBeUndefined();
    expect(reg.upserts).toHaveLength(0);
  });
  it("401 de toutes les clés : compté (compteur d'authentification) ; une seule clé refusée : non", async () => {
    sdk.mockRejectedValue(toutesEpuisees("auth_failed", { status: 401 }));
    await genererTexteBlogClaude(REQ, "ecriture").catch(() => undefined);
    expect(reg.redis.get("blog-claude:refus-auth")).toBe(1);
    sdk.mockRejectedValue(
      Object.assign(new ProviderError("une", "auth_failed", "anthropic", false), { status: 403 }),
    );
    await genererTexteBlogClaude(REQ, "ecriture").catch(() => undefined);
    expect(reg.redis.get("blog-claude:refus-auth")).toBe(1);
  });
  it("la porte ne solde PAS elle-même : c'est le fournisseur qui solde (la ligne reste au maximum ici)", async () => {
    // Le fournisseur est simulé : il ne solde rien. Un second solde dans la porte
    // ramenait la ligne SOUS le maximum quand le flux finissait sans `message_delta`.
    sdk.mockResolvedValue({ ...REPONSE, output: "", costUsd: 0.0007 });
    await genererTexteBlogClaude(REQ, "ecriture");
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBeGreaterThan(0.0007);
  });
  it("succès : une seule ligne, non retouchée par la porte", async () => {
    sdk.mockResolvedValue(REPONSE);
    await genererTexteBlogClaude(REQ, "ecriture");
    expect(reg.lignes).toHaveLength(1);
    expect(reg.lignes[0]!.costUsd).toBeGreaterThan(0.001);
  });
  it("refus d'écriture de la réservation (base) = aucun appel SDK", async () => {
    reg.totaux = [];
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("base KO"));
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "base_indisponible",
    });
    expect(sdk).not.toHaveBeenCalled();
  });
});

describe("seuils 80 % / 100 %", () => {
  it("100 % du jour : refus + alerte, rien dépensé", async () => {
    reg.totaux = [2.7, 3];
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "plafond_jour",
    });
    expect(sdk).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(0);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0]![0]).toMatchObject({
      category: "MONITORING_ALERT",
      dedupTtlSec: 6 * 3600,
    });
  });
  it("80 % du jour : appel autorisé + alerte", async () => {
    reg.totaux = [1.7, 3];
    sdk.mockResolvedValue(REPONSE);
    await genererTexteBlogClaude(REQ, "ecriture");
    expect(sdk).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });
  it("anti-doublon : deux dépassements = une seule alerte", async () => {
    reg.totaux = [2.7, 3, 2.7, 3];
    await genererTexteBlogClaude(REQ, "ecriture").catch(() => undefined);
    await genererTexteBlogClaude(REQ, "ecriture").catch(() => undefined);
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });
});

describe("suspension et limite de relectures", () => {
  it("drapeau posé = refus sans SDK ; illisible = refus", async () => {
    reg.suspendu = { active: true };
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "suspendu",
    });
    expect(sdk).not.toHaveBeenCalled();
  });
  it("drapeau de suspension illisible = refus, aucune écriture", async () => {
    reg.suspenduErreur = true;
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
      code: "base_indisponible",
    });
    expect(sdk).not.toHaveBeenCalled();
    expect(reg.lignes).toHaveLength(0);
  });
  it.each(["", "oui", 1, 0, "false", {}, { active: "false" }, []])(
    "valeur %j = suspendu",
    async (v) => {
      reg.suspendu = v;
      await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
        code: "suspendu",
      });
      expect(sdk).not.toHaveBeenCalled();
    },
  );
  it.each([false, { active: false }])("valeur %j = levé", async (v) => {
    reg.suspendu = v;
    sdk.mockResolvedValue(REPONSE);
    await expect(genererTexteBlogClaude(REQ, "ecriture")).resolves.toBeDefined();
  });
  it("3 refus de crédit : alerte puis drapeau de suspension posé", async () => {
    sdk.mockRejectedValue(toutesEpuisees("quota_exhausted"));
    for (let i = 0; i < 3; i++) {
      await genererTexteBlogClaude(REQ, "ecriture").catch(() => undefined);
    }
    expect(reg.upserts).toHaveLength(1);
    expect(JSON.stringify(reg.upserts[0])).toContain("blog_claude_suspendu");
  });
  it("429 / panne ne comptent pas comme refus de crédit", async () => {
    sdk.mockRejectedValue(new ProviderError("limite", "rate_limited", "anthropic", true));
    for (let i = 0; i < 4; i++) {
      await genererTexteBlogClaude(REQ, "ecriture").catch(() => undefined);
    }
    expect(reg.upserts).toHaveLength(0);
  });
  it("relecture : au-delà de la limite du jour = refus", async () => {
    sdk.mockResolvedValue(REPONSE);
    for (let i = 0; i < 3; i++) await genererTexteBlogClaude(REQ, "relecture");
    await expect(genererTexteBlogClaude(REQ, "relecture")).rejects.toMatchObject({
      code: "juge_limite",
    });
    expect(sdk).toHaveBeenCalledTimes(3);
  });
});
