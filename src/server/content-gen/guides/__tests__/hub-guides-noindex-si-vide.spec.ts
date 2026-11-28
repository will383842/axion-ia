/**
 * V1-17 — `/fr/guides` : noindex + hors sitemap tant que le hub est vide,
 * rétabli seul dès qu'un guide est publié.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const chargerGuides = vi.fn();
vi.mock("@/server/content-gen/guides/loader", () => ({
  loadGuidesIndexForView: (...args: unknown[]) => chargerGuides(...args),
}));

import {
  hubGuidesEstIndexable,
  hubGuidesIndexable,
  ROBOTS_HUB_GUIDES_VIDE,
} from "../hub-indexable";

const UN_GUIDE = [{ slug: "guide-test" }];

beforeEach(() => chargerGuides.mockReset());

describe("hubGuidesIndexable", () => {
  it("zéro guide : pas indexable ; un guide ou plus : indexable", () => {
    expect(hubGuidesIndexable(0)).toBe(false);
    expect(hubGuidesIndexable(1)).toBe(true);
    expect(hubGuidesIndexable(12)).toBe(true);
  });

  it("la valeur robots du hub vide est « noindex, follow »", () => {
    expect(ROBOTS_HUB_GUIDES_VIDE).toEqual({ index: false, follow: true });
  });

  it("lit les guides : vide puis garni, sans drapeau à retourner", async () => {
    chargerGuides.mockResolvedValueOnce([]);
    expect(await hubGuidesEstIndexable()).toBe(false);
    chargerGuides.mockResolvedValueOnce(UN_GUIDE);
    expect(await hubGuidesEstIndexable()).toBe(true);
  });
});

describe("câblage (sources) du sitemap et de la page", () => {
  const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("pages.xml retire /guides tant que le hub est vide", () => {
    const src = lire("src/app/sitemap.ts");
    expect(src).toMatch(/key === "\/guides" && !hubGuidesIndexable\) continue/);
    expect(src).toMatch(
      /buildPagesSitemap\(\s*editorialFor\("pages"\),\s*await hubGuidesEstIndexable\(\)[,)]/,
    );
  });

  it("generateMetadata du hub applique le noindex quand il est vide", () => {
    const src = lire("src/app/[locale]/guides/page.tsx");
    expect(src).toMatch(/await hubGuidesEstIndexable\(\)/);
    expect(src).toMatch(/indexable \? meta : \{ \.\.\.meta, robots: ROBOTS_HUB_GUIDES_VIDE \}/);
  });
});
