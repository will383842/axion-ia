/**
 * S2-1 — le plan du site d'images suit la règle d'indexation de la page galerie.
 * Une image sans enrichissement (page `noindex`) n'est pas annoncée ; une image
 * enrichie l'est. La page et le plan du site importent le MÊME prédicat.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { imageAsset: { findMany } } }));

import { hasSubstantiveContent, isGalleryPageIndexable } from "@/server/image-bank/indexabilite";

const LONG = "x".repeat(100);

function image(slug: string, extra: { description?: string | null; aiSummary?: string | null }) {
  return {
    filePath: `/img/${slug}.jpg`,
    geoPlacename: null,
    licenseUrl: null,
    updatedAt: new Date("2026-11-01"),
    publishedAt: new Date("2026-11-01"),
    createdAt: new Date("2026-11-01"),
    translations: [
      {
        languageCode: "fr",
        slug,
        title: slug,
        alt: slug,
        caption: null,
        description: extra.description ?? null,
        aiSummary: extra.aiSummary ?? null,
      },
    ],
  };
}

describe("prédicat partagé", () => {
  it("seuil à 100 caractères, description OU résumé IA", () => {
    expect(hasSubstantiveContent({ description: "x".repeat(99) })).toBe(false);
    expect(hasSubstantiveContent({ description: LONG })).toBe(true);
    expect(hasSubstantiveContent({ aiSummary: LONG })).toBe(true);
    expect(hasSubstantiveContent({ description: `  ${"x".repeat(98)}  ` })).toBe(false);
  });
  it("seul le FR est indexable", () => {
    expect(isGalleryPageIndexable("fr", { description: LONG })).toBe(true);
    expect(isGalleryPageIndexable("en", { description: LONG })).toBe(false);
  });
});

describe("images-fr.xml", () => {
  beforeEach(() => {
    vi.resetModules();
    findMany.mockReset();
    delete process.env["DATABASE_URL"];
  });

  it("n'annonce pas une image non enrichie, annonce une image enrichie", async () => {
    findMany.mockResolvedValue([
      image("image-vide", {}),
      image("image-enrichie", { description: LONG }),
      image("image-resume-ia", { aiSummary: LONG }),
    ]);
    const { GET } = await import("@/app/sitemaps/images-fr.xml/route");
    const xml = await (await GET()).text();
    expect(xml).not.toContain("/galerie/image-vide");
    expect(xml).toContain("/galerie/image-enrichie");
    expect(xml).toContain("/galerie/image-resume-ia");
  });

  it("la requête sélectionne description et aiSummary", async () => {
    findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/sitemaps/images-fr.xml/route");
    await GET();
    const arg = findMany.mock.calls[0]?.[0];
    expect(arg.include.translations.select.description).toBe(true);
    expect(arg.include.translations.select.aiSummary).toBe(true);
  });
});

describe("la page et les plans du site importent le même prédicat", () => {
  const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
  for (const f of [
    "src/app/[locale]/galerie/[slug]/page.tsx",
    "src/app/sitemaps/images-fr.xml/route.ts",
    "src/app/sitemaps/images-en.xml/route.ts",
  ]) {
    it(f, () => {
      const s = src(f);
      expect(s).toContain('from "@/server/image-bank/indexabilite"');
      expect(s).toContain("isGalleryPageIndexable(");
      expect(s).not.toMatch(/function hasSubstantiveContent/);
    });
  }
});
