/**
 * Tests sitemap-knowledge.xml route handler (KB DB-aware, runtime).
 *
 * Contexte : le KB était émis via la convention metadata `generateSitemaps()`,
 * dont le compte de chunks se faisait AU BUILD (`countKnowledgePublicEntries()`).
 * Sous le build stub.invalid (ADR 0026) ce compte = 0 → IDs `knowledge-N` jamais
 * déclarés → `/sitemap/knowledge-N.xml` en 404 (URLs KB indécouvrables côté Google).
 * Fix : Route Handler runtime dédié (ce fichier) lisant la vraie DB via ISR.
 *
 * Couvre :
 *   1. XML valide + namespace xhtml (hreflang)
 *   2. urlset vide si aucune entrée (build stub → listKnowledge renvoie [])
 *   3. EN désactivé (prod) : FR seul, hreflang fr + x-default, AUCUN /en/ ni hreflang en
 *   4. priority 0.3 pour `deprecated`, 0.6 sinon
 *   5. EN activé : paire FR + EN avec hreflang fr/en/x-default
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { listMock } = vi.hoisted(() => ({
  listMock: vi.fn<() => Promise<unknown[]>>(async () => []),
}));

vi.mock("@/server/exporters/knowledge-sitemap", () => ({
  listKnowledgeSitemapEntries: (_exclude?: unknown) => listMock(),
}));

// Mocké pour isoler le route handler de l'arbre d'imports massif de `app/sitemap.ts`
// (content modules, prisma…). On n'a besoin que de la signature de dédup.
vi.mock("@/app/sitemap", () => ({
  buildExcludeSlugsByType: () => new Map(),
}));

import { GET } from "../route";

const FR_ENTRY = {
  url: "https://axion-ia.com/fr/ressources/methodology/cadrage-ia",
  urlEn: "https://axion-ia.com/en/resources/methodology/cadrage-ia",
  lastModified: new Date("2026-06-10T00:00:00.000Z"),
  status: "published" as const,
};

beforeEach(() => {
  listMock.mockClear();
  listMock.mockImplementation(async () => []);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap-knowledge.xml · structure", () => {
  it("retourne XML application/xml avec namespace xhtml", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Type")).toMatch(/application\/xml/);
    const body = await res.text();
    expect(body).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it("urlset vide si aucune entrée (build stub.invalid → listKnowledge [])", async () => {
    const res = await GET();
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).not.toContain("<url>");
  });
});

describe("sitemap-knowledge.xml · EN désactivé (prod)", () => {
  it("émet le FR seul, hreflang fr + x-default, AUCUN /en/ ni hreflang en", async () => {
    listMock.mockImplementation(async () => [FR_ENTRY]);
    const res = await GET();
    const body = await res.text();
    expect(body).toContain(`<loc>${FR_ENTRY.url}</loc>`);
    expect(body).toContain('<xhtml:link rel="alternate" hreflang="x-default"');
    expect(body).not.toContain("/en/resources/");
    expect(body).not.toContain('hreflang="en"');
    expect(body).toContain("<lastmod>2026-06-10T00:00:00.000Z</lastmod>");
    expect(body).toContain("<priority>0.6</priority>");
  });

  it("priority 0.3 pour une entrée deprecated", async () => {
    listMock.mockImplementation(async () => [{ ...FR_ENTRY, status: "deprecated" as const }]);
    const res = await GET();
    const body = await res.text();
    expect(body).toContain("<priority>0.3</priority>");
  });
});

describe("sitemap-knowledge.xml · EN activé", () => {
  it("émet la paire FR + EN avec hreflang fr/en/x-default", async () => {
    vi.stubEnv("EN_LOCALE_ENABLED", "true");
    vi.resetModules();
    listMock.mockImplementation(async () => [FR_ENTRY]);
    const { GET: GET_EN } = await import("../route");
    const res = await GET_EN();
    const body = await res.text();
    expect(body).toContain(`<loc>${FR_ENTRY.url}</loc>`);
    expect(body).toContain(`<loc>${FR_ENTRY.urlEn}</loc>`);
    expect(body).toContain('hreflang="en"');
    expect(body).toContain('hreflang="fr"');
    expect(body).toContain('hreflang="x-default"');
  });
});
