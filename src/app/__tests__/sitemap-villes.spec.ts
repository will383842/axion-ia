/**
 * Sitemaps villes (18/11/2026) : l'ensemble des URL FR des ids `villes-*` vaut
 * exactement la liste `villes-indexees.ts`, aucun id n'est vide, aucun id
 * `services-villes-*` n'est déclaré.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    category: { findMany: vi.fn(async () => []) },
    knowledgeEntry: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));

import sitemap, { generateSitemaps } from "../sitemap";
import { VILLES_CORE } from "@/content/villes/core";
import { VILLES_INDEXEES_SLUGS } from "@/content/villes/villes-indexees";

describe("sitemaps villes", () => {
  it("aucun id services-villes-* n'est déclaré", async () => {
    const ids = (await generateSitemaps()).map((s) => s.id);
    expect(ids.filter((id) => id.startsWith("services-villes-"))).toEqual([]);
  });

  it("les ids villes-* émettent exactement les villes de la liste, sans id vide", async () => {
    const ids = (await generateSitemaps())
      .map((s) => s.id)
      .filter((id) => id.startsWith("villes-"));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain("villes-corse");

    const urlsFr: string[] = [];
    for (const id of ids) {
      const entries = await sitemap({ id: Promise.resolve(id) });
      expect(entries.length, `sitemap vide : ${id}`).toBeGreaterThan(0);
      for (const e of entries) {
        if (e.url.includes("/fr/implantations/")) urlsFr.push(new URL(e.url).pathname);
      }
    }
    const attendues = VILLES_INDEXEES_SLUGS.map((slug) => {
      const v = VILLES_CORE.find((x) => x.slug === slug)!;
      return `/fr/implantations/${v.region}/${v.slug}`;
    });
    expect(urlsFr.sort()).toEqual(attendues.sort());
    expect(urlsFr.filter((u) => /\/(acheres|poitiers|versailles|ajaccio)$/.test(u))).toEqual([]);
  });
});
