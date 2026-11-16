/** updatePlafondsBlogClaude + listProviders (blogClaude). Chiffres FICTIFS. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn<() => Promise<unknown>>(),
  rate: vi.fn<(k: string, c: unknown) => Promise<unknown>>(),
  update: vi.fn(async (_a: unknown) => ({})),
  findUnique: vi.fn<(a: unknown) => Promise<unknown>>(),
  findMany: vi.fn<(a: unknown) => Promise<unknown>>(),
  exec: vi.fn<(...a: unknown[]) => Promise<number>>(),
  audit: vi.fn<(a: unknown) => Promise<unknown>>(),
  revalidate: vi.fn(),
  sentry: vi.fn(),
  create: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => m.auth() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (k: string, c: unknown) => m.rate(k, c) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerConfig: {
      update: (a: unknown) => m.update(a),
      findUnique: (a: unknown) => m.findUnique(a),
      findMany: (a: unknown) => m.findMany(a),
      create: (a: unknown) => m.create(a),
      upsert: (a: unknown) => m.upsert(a),
    },
    $executeRaw: (...a: unknown[]) => m.exec(...a),
    contentGenAuditLog: { create: (a: unknown) => m.audit(a) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => m.revalidate(p) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => m.sentry(...a) }));

import { listProviders, updatePlafondsBlogClaude } from "../providers";
import {
  LIBELLES_ECRAN,
  validerPlafondsBlog,
} from "@/server/content-gen/providers/blog-claude-plafonds";

const ENTREE = { jour: "1", mois: "10", reserve: "2", jugeMax: "3" };
const CLES = {
  blog_claude_daily_cap_usd: 1,
  blog_claude_monthly_cap_usd: 10,
  blog_claude_reserve_qualiopi_usd: 2,
  blog_claude_juge_max_jour: 3,
};
const AVANT = {
  blog_claude_daily_cap_usd: 5,
  blog_claude_monthly_cap_usd: 50,
  blog_claude_reserve_qualiopi_usd: 7,
  blog_claude_juge_max_jour: 9,
};

function session(role: string) {
  m.auth.mockResolvedValue({ user: { id: "u1", email: "a@b.c", role } });
}

beforeEach(() => {
  vi.clearAllMocks();
  session("admin");
  m.rate.mockResolvedValue({ allowed: true, count: 1, remaining: 9, resetAt: Date.now() + 1000 });
  m.exec.mockResolvedValue(1);
  m.audit.mockResolvedValue({});
  let n = 0;
  m.findUnique.mockImplementation(async () => {
    n += 1;
    return { extraConfig: n === 1 ? { ...AVANT, autre: 1 } : { ...CLES, autre: 1 } };
  });
});

describe("updatePlafondsBlogClaude", () => {
  it("sans session → unauthorized, aucune écriture", async () => {
    m.auth.mockResolvedValue(null);
    await expect(updatePlafondsBlogClaude(ENTREE)).rejects.toThrow("unauthorized");
    expect(m.exec).not.toHaveBeenCalled();
  });
  it("quota atteint → ok:false clair, aucune écriture", async () => {
    m.rate.mockResolvedValue({ allowed: false, count: 11, remaining: 0, resetAt: Date.now() + 1 });
    const r = await updatePlafondsBlogClaude(ENTREE);
    expect(r).toEqual({ ok: false, message: "Trop de tentatives : réessayez dans une heure." });
    expect(m.exec).not.toHaveBeenCalled();
    expect(m.findUnique).not.toHaveBeenCalled();
  });
  it("rôle editor → ok:false clair, quota non entamé", async () => {
    session("editor");
    const r = await updatePlafondsBlogClaude(ENTREE);
    expect(r).toEqual({ ok: false, message: "Réservé aux administrateurs." });
    expect(m.rate).not.toHaveBeenCalled();
    expect(m.exec).not.toHaveBeenCalled();
  });
  it("10 saisies invalides n'appellent pas le contrôle de débit", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await updatePlafondsBlogClaude({ ...ENTREE, jour: "21" });
      expect(r.ok).toBe(false);
    }
    expect(m.rate).not.toHaveBeenCalled();
  });
  it("sans session → le quota n'est pas touché", async () => {
    m.auth.mockResolvedValue(null);
    await expect(updatePlafondsBlogClaude(ENTREE)).rejects.toThrow("unauthorized");
    expect(m.rate).not.toHaveBeenCalled();
  });
  it("entrées invalides → ok:false identique au module, rien d'écrit", async () => {
    const r = await updatePlafondsBlogClaude({ ...ENTREE, jour: "21" });
    let attendu = "";
    try {
      validerPlafondsBlog({ jour: 21, mois: 10, reserve: 2, jugeMax: 3 }, LIBELLES_ECRAN);
    } catch (e) {
      attendu = (e as Error).message;
    }
    expect(r).toEqual({ ok: false, message: attendu });
    const r2 = await updatePlafondsBlogClaude({ ...ENTREE, mois: "1e3" });
    expect(r2.ok).toBe(false);
    expect(m.exec).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.sentry).not.toHaveBeenCalled();
  });
  it.each([{ monthlyCapUsd: 5 }, { provider: "openai" }, { id: "x" }])(
    "zod strict rejette %j",
    async (extra) => {
      await expect(updatePlafondsBlogClaude({ ...ENTREE, ...extra } as never)).rejects.toThrow();
      expect(m.exec).not.toHaveBeenCalled();
    },
  );
  it("ligne absente → ok:false sans création ni écriture", async () => {
    m.findUnique.mockReset();
    m.findUnique.mockResolvedValue(null);
    const r = await updatePlafondsBlogClaude(ENTREE);
    expect(r.ok).toBe(false);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.exec).not.toHaveBeenCalled();
  });
  it("succès", async () => {
    const r = await updatePlafondsBlogClaude(ENTREE);
    expect(r).toEqual({ ok: true });
    expect(m.exec).toHaveBeenCalledTimes(1);
    const args = m.exec.mock.calls[0]!;
    expect(JSON.parse(args[1] as string)).toEqual(CLES);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.findUnique.mock.calls[0]![0]).toEqual({ where: { provider: "anthropic" } });
    const a = m.audit.mock.calls[0]![0] as { data: Record<string, unknown> };
    const texte = JSON.stringify(a);
    for (const v of Object.keys(CLES)) expect(texte).toContain(v);
    expect(texte).toContain('"blog_claude_daily_cap_usd":5');
    expect(texte).toContain('"blog_claude_daily_cap_usd":1');
    expect(texte).not.toContain("autre");
    expect(m.revalidate).toHaveBeenCalled();
  });
  it("relecture divergente → ok:false + Sentry", async () => {
    m.findUnique.mockReset();
    m.findUnique.mockResolvedValue({ extraConfig: { ...AVANT } });
    const r = await updatePlafondsBlogClaude(ENTREE);
    expect(r.ok).toBe(false);
    expect(m.sentry).toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledTimes(1);
  });
  it("audit en panne → ok:true", async () => {
    m.audit.mockRejectedValue(new Error("down"));
    expect(await updatePlafondsBlogClaude(ENTREE)).toEqual({ ok: true });
  });
});

describe("listProviders", () => {
  it("blogClaude non nul seulement pour anthropic", async () => {
    const ligne = (provider: string) => ({
      id: provider,
      provider,
      role: "text",
      enabled: true,
      primary: false,
      model: "m",
      fallbackProviderId: null,
      monthlyCapUsd: { toString: () => "1" },
      currentMonthSpentUsd: { toString: () => "0" },
      rateLimitRpm: null,
      rateLimitTpm: null,
      apiKeyEnvVar: "X",
      updatedAt: new Date(),
      extraConfig: { ...CLES, secret: "z" },
    });
    m.findMany.mockResolvedValue([ligne("anthropic"), ligne("openai")]);
    const rows = await listProviders();
    expect(rows[0]!.blogClaude).toEqual({ jour: 1, mois: 10, reserve: 2, jugeMax: 3 });
    expect(rows[1]!.blogClaude).toBeNull();
    expect(JSON.stringify(rows)).not.toContain("secret");
  });
});
