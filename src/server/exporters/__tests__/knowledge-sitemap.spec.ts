/**
 * Tests data-layer KB sitemap (`knowledge-sitemap.ts`) — anti-fuite + EN-no-index.
 *
 * Le test du Route Handler (`app/sitemap-knowledge.xml/__tests__/route.spec.ts`)
 * MOCKE `listKnowledgeSitemapEntries`, donc il ne couvre PAS la logique métier de
 * confidentialité ni la porte EN au niveau données. Ce fichier verrouille :
 *
 *   1. La clause WHERE anti-fuite : SEULES les entrées `audience='public'` +
 *      `confidentiality='public'` + `status ∈ {published,deprecated}` +
 *      `deletedAt=null` + fenêtres publishedAt/embargo passées sont émises.
 *      (régression ici = fuite sitemap d'un brouillon / contenu confidentiel /
 *      sous embargo → indexation Google d'un contenu non-public.)
 *   2. Une entrée sans translation FR est ignorée (KB factory = FR-only).
 *   3. Build stub.invalid → [] (ADR 0026, pas d'appel DB au build).
 *   4. `buildKnowledgeSitemapChunk` : EN désactivé → AUCUNE URL /en/ ni hreflang
 *      `en` ; EN activé → paire FR+EN. (anti-régression du 301 EN→FR.)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyMock, isEnDisabledMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  isEnDisabledMock: vi.fn<() => boolean>(() => true),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { knowledgeEntry: { findMany: findManyMock, count: vi.fn() } },
}));
vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));
vi.mock("@/content/knowledge/routes", () => ({
  buildKbPublicUrl: (_type: string, locale: string, slug: string) => `/${locale}/r/${slug}`,
}));
vi.mock("@/lib/i18n/en-to-fr-redirect", () => ({
  isEnLocaleDisabled: () => isEnDisabledMock(),
}));

import {
  listKnowledgeSitemapEntries,
  buildKnowledgeSitemapChunk,
  __resetKnowledgeSitemapCache,
} from "../knowledge-sitemap";

const FR_TR = { locale: "fr", slug: "cadrage-ia", updatedAt: new Date("2026-06-10T00:00:00Z") };
const EN_TR = { locale: "en", slug: "ai-scoping", updatedAt: new Date("2026-06-10T00:00:00Z") };

function entry(over: Record<string, unknown> = {}) {
  return {
    id: "e1",
    type: "article",
    status: "published",
    publishedAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-10T00:00:00Z"),
    translations: [FR_TR, EN_TR],
    ...over,
  };
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://app:app@db:5432/app"); // PAS stub.invalid
  findManyMock.mockReset();
  isEnDisabledMock.mockReturnValue(true);
  __resetKnowledgeSitemapCache();
});

describe("listKnowledgeSitemapEntries · clause WHERE anti-fuite", () => {
  it("ne demande QUE le public/published/non-supprimé/non-embargo", async () => {
    findManyMock.mockResolvedValue([]);
    await listKnowledgeSitemapEntries();
    const where = findManyMock.mock.calls[0]?.[0]?.where;
    expect(where.audience).toBe("public");
    expect(where.confidentiality).toBe("public");
    expect(where.status).toEqual({ in: ["published", "deprecated"] });
    expect(where.deletedAt).toBeNull();
    // Fenêtres temporelles : publishedAt <= now ET embargoUntil <= now (ou null).
    expect(Array.isArray(where.AND)).toBe(true);
    const json = JSON.stringify(where.AND);
    expect(json).toContain("publishedAt");
    expect(json).toContain("embargoUntil");
  });

  it("émet une entrée publique avec son URL FR canonique", async () => {
    findManyMock.mockResolvedValue([entry()]);
    const out = await listKnowledgeSitemapEntries();
    expect(out).toHaveLength(1);
    expect(out[0]?.url).toBe("https://axion-ia.com/fr/r/cadrage-ia");
    expect(out[0]?.status).toBe("published");
  });

  it("ignore une entrée sans translation FR (KB factory = FR-only)", async () => {
    findManyMock.mockResolvedValue([entry({ translations: [EN_TR] })]);
    const out = await listKnowledgeSitemapEntries();
    expect(out).toHaveLength(0);
  });

  it("build stub.invalid → [] (aucun appel DB)", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    const out = await listKnowledgeSitemapEntries();
    expect(out).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("buildKnowledgeSitemapChunk · EN-no-index", () => {
  it("EN désactivé : aucune URL /en/ ni hreflang en", async () => {
    isEnDisabledMock.mockReturnValue(true);
    findManyMock.mockResolvedValue([entry()]);
    const chunk = await buildKnowledgeSitemapChunk(1, 1000);
    const urls = chunk.map((c) => c.url);
    expect(urls).toContain("https://axion-ia.com/fr/r/cadrage-ia");
    expect(urls.some((u) => u.includes("/en/"))).toBe(false);
    const langs = chunk[0]?.alternates?.languages ?? {};
    expect(langs).not.toHaveProperty("en");
    expect(langs).toHaveProperty("fr");
    expect(langs).toHaveProperty("x-default");
  });

  it("EN activé : paire FR + EN avec hreflang en", async () => {
    isEnDisabledMock.mockReturnValue(false);
    findManyMock.mockResolvedValue([entry()]);
    const chunk = await buildKnowledgeSitemapChunk(1, 1000);
    const urls = chunk.map((c) => c.url);
    expect(urls).toContain("https://axion-ia.com/fr/r/cadrage-ia");
    expect(urls).toContain("https://axion-ia.com/en/r/ai-scoping");
    const langs = chunk[0]?.alternates?.languages ?? {};
    expect(langs).toHaveProperty("en");
  });
});
