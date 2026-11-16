/**
 * S-M4 : seuls les VRAIS refus 401/403 comptent pour la suspension ; clé absente ou
 * fournisseur désactivé (auth_failed sans statut HTTP) ne suspendent jamais le blog.
 * Chiffres FICTIFS.
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

describe("auth_failed et suspension (S-M4)", () => {
  async function erreurApi(status: number, message: string) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const APIError = Anthropic.APIError as unknown as new (s: number, m: string) => Error;
    return new APIError(status, message);
  }
  const config = {
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    monthlyCapUsd: 100,
    extraConfig: {
      blog_claude_daily_cap_usd: 2,
      blog_claude_monthly_cap_usd: 10,
      blog_claude_reserve_qualiopi_usd: 5,
      blog_claude_juge_max_jour: 3,
    },
  };

  it("trois 401 réels : suspension posée, raison distincte du crédit", async () => {
    vi.mocked(prisma.contentGenConfig.upsert).mockClear();
    create.mockRejectedValue(await erreurApi(401, "invalid x-api-key"));
    for (let i = 0; i < 3; i++) {
      await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeDefined();
    }
    const appels = vi.mocked(prisma.contentGenConfig.upsert).mock.calls;
    expect(appels).toHaveLength(1);
    expect(JSON.stringify(appels[0]![0])).toContain("auth_refusee_repetee");
    // Compteurs séparés : les 401 ne touchent pas la clé des refus de crédit.
    expect(reg.redis.get("blog-claude:refus-auth")).toBe(3);
    expect(reg.redis.get("blog-claude:refus-credit") ?? 0).toBe(0);
  });

  it("deux refus de crédit puis un 401 : pas de suspension pour auth_refusee_repetee", async () => {
    vi.mocked(prisma.contentGenConfig.upsert).mockClear();
    reg.redis.set("blog-claude:refus-credit", 2);
    create.mockRejectedValue(await erreurApi(401, "invalid x-api-key"));
    await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toBeDefined();
    expect(vi.mocked(prisma.contentGenConfig.upsert)).not.toHaveBeenCalled();
    expect(reg.redis.get("blog-claude:refus-credit")).toBe(2);
    expect(reg.redis.get("blog-claude:refus-auth")).toBe(1);
  });

  it("clé absente (auth_failed sans statut) : jamais de suspension", async () => {
    vi.mocked(prisma.contentGenConfig.upsert).mockClear();
    delete process.env["ANTHROPIC_API_KEY"];
    for (let i = 0; i < 4; i++) {
      await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
        code: "auth_failed",
      });
    }
    expect(create).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.contentGenConfig.upsert)).not.toHaveBeenCalled();
  });

  it("fournisseur désactivé après la porte : jamais de suspension", async () => {
    vi.mocked(prisma.contentGenConfig.upsert).mockClear();
    for (let i = 0; i < 4; i++) {
      invalidateProviderConfigCache("anthropic");
      vi.mocked(prisma.providerConfig.findUnique)
        .mockResolvedValueOnce({ ...config, enabled: true } as never)
        .mockResolvedValueOnce({ ...config, enabled: false } as never);
      await expect(genererTexteBlogClaude(REQ, "ecriture")).rejects.toMatchObject({
        code: "auth_failed",
      });
    }
    invalidateProviderConfigCache("anthropic");
    expect(vi.mocked(prisma.contentGenConfig.upsert)).not.toHaveBeenCalled();
    // Aucun refus de crédit compté non plus : la raison de suspension reste distincte.
    expect(reg.redis.get("blog-claude:refus-credit") ?? 0).toBe(0);
  });
});
