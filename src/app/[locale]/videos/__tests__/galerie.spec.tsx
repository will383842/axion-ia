// @vitest-environment node
// Galerie /fr/videos, pages de thème et de série (lot W3).
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uneVideo } from "./fixture";

const h = vi.hoisted(() => ({ videos: [] as unknown[] }));

vi.mock("@/server/videos/lecture", () => ({
  videosPubliees: async () => h.videos,
  videoParSlug: async (slug: string) =>
    (h.videos as Array<{ slug: string }>).find((v) => v.slug === slug) ?? null,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getLocale: async () => "fr",
  getTranslations: async () => (cle: string) => cle,
}));
vi.mock("@/server/seo/og-overrides", () => ({ surchargeOgPour: async () => null }));

import Galerie, { generateMetadata as metaGalerie } from "../page";
import PageTheme, { generateMetadata as metaTheme } from "../theme/[theme]/page";
import PageSerie, { generateMetadata as metaSerie } from "../serie/[serie]/page";
import PageBesoin, { generateMetadata as metaBesoin } from "../besoin/[besoin]/page";
import { BESOINS, besoinParSlug } from "@/content/videos/besoins";
import { THEMES } from "@/content/videos/themes";
import { groupesParBesoin, listesProches } from "@/server/videos/liees";

const fr = <T extends Record<string, string>>(extra: T = {} as T) =>
  Promise.resolve({ locale: "fr", ...extra });
const rendre = async (el: Promise<unknown>) => renderToStaticMarkup((await el) as ReactNode);

const n = (k: number, theme = "audit-ia", serie: [string, number] | null = null) =>
  uneVideo({
    slug: `video-${theme}-${k}`,
    titre: `Titre ${theme} ${k}`,
    theme,
    serie: serie ? { slug: serie[0], titre: "Ma série", rang: serie[1] } : null,
  });

beforeEach(() => {
  h.videos = [];
});

describe("galerie /fr/videos", () => {
  it("aucune vidéo publiée (ou drapeau éteint côté lecture) → notFound", async () => {
    await expect(Galerie({ params: fr() })).rejects.toThrow(/404/);
    expect(await metaGalerie({ params: fr() })).toEqual({});
  });

  it("locale autre que fr → notFound", async () => {
    h.videos = [n(1)];
    await expect(Galerie({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow(/404/);
  });

  it("affiche les cartes ; le lien de thème est ABSENT à 2 vidéos", async () => {
    h.videos = [n(1), n(2)];
    const html = await rendre(Galerie({ params: fr() }));
    expect(html).toContain("Titre audit-ia 1");
    expect(html).toContain("Titre audit-ia 2");
    expect(html).not.toContain("/fr/videos/theme/audit-ia");
  });

  it("…et PRÉSENT à 3 vidéos", async () => {
    h.videos = [n(1), n(2), n(3)];
    expect(await rendre(Galerie({ params: fr() }))).toContain('href="/fr/videos/theme/audit-ia"');
  });

  it("série à 2 épisodes : pas de lien ; à 3 : lien vers la page de série", async () => {
    h.videos = [n(1, "audit-ia", ["ma-serie", 1]), n(2, "audit-ia", ["ma-serie", 2])];
    expect(await rendre(Galerie({ params: fr() }))).not.toContain("/fr/videos/serie/ma-serie");
    h.videos = [...h.videos, n(3, "audit-ia", ["ma-serie", 3])];
    expect(await rendre(Galerie({ params: fr() }))).toContain('href="/fr/videos/serie/ma-serie"');
  });

  it("zéro lecteur dans la galerie : aucun <video>", async () => {
    h.videos = [n(1)];
    expect(await rendre(Galerie({ params: fr() }))).not.toContain("<video");
  });

  it("canonique /fr/videos", async () => {
    h.videos = [n(1)];
    expect((await metaGalerie({ params: fr() })).alternates?.canonical).toBe("/fr/videos");
  });
});

describe("page de thème", () => {
  it("2 vidéos du thème → 404 (jamais de page mince)", async () => {
    h.videos = [n(1), n(2)];
    await expect(PageTheme({ params: fr({ theme: "audit-ia" }) })).rejects.toThrow(/404/);
    expect(await metaTheme({ params: fr({ theme: "audit-ia" }) })).toEqual({});
  });

  it("3 vidéos → 200 : intro, cartes, pages liées", async () => {
    h.videos = [n(1), n(2), n(3)];
    const html = await rendre(PageTheme({ params: fr({ theme: "audit-ia" }) }));
    expect(html).toContain("Titre audit-ia 3");
    expect(html).toContain("Découvrir l&#x27;audit IA");
    expect(html).toContain('href="/fr/audit"');
    expect((await metaTheme({ params: fr({ theme: "audit-ia" }) })).alternates?.canonical).toBe(
      "/fr/videos/theme/audit-ia",
    );
  });

  it("thème inconnu → 404 même avec des vidéos", async () => {
    h.videos = [n(1, "cuisine"), n(2, "cuisine"), n(3, "cuisine")];
    await expect(PageTheme({ params: fr({ theme: "cuisine" }) })).rejects.toThrow(/404/);
  });
});

describe("page de série", () => {
  it("2 épisodes → 404 ; 3 → 200 dans l'ordre des épisodes", async () => {
    h.videos = [n(1, "audit-ia", ["s", 2]), n(2, "audit-ia", ["s", 1])];
    await expect(PageSerie({ params: fr({ serie: "s" }) })).rejects.toThrow(/404/);
    h.videos = [n(3, "audit-ia", ["s", 3]), n(1, "audit-ia", ["s", 2]), n(2, "audit-ia", ["s", 1])];
    const html = await rendre(PageSerie({ params: fr({ serie: "s" }) }));
    expect(html.indexOf("Titre audit-ia 2")).toBeLessThan(html.indexOf("Titre audit-ia 1"));
    expect(html.indexOf("Titre audit-ia 1")).toBeLessThan(html.indexOf("Titre audit-ia 3"));
    expect((await metaSerie({ params: fr({ serie: "s" }) })).alternates?.canonical).toBe(
      "/fr/videos/serie/s",
    );
  });

  it("série inconnue → 404", async () => {
    h.videos = [n(1)];
    await expect(PageSerie({ params: fr({ serie: "x" }) })).rejects.toThrow(/404/);
  });
});

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
const compte = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("liste fermée des besoins (SEO-06)", () => {
  it("quatre besoins, slugs uniques en minuscules et tirets, thèmes existants", () => {
    expect(BESOINS).toHaveLength(4);
    expect(new Set(BESOINS.map((b) => b.slug)).size).toBe(4);
    const themes = THEMES.map((t) => t.slug);
    for (const b of BESOINS) {
      expect(b.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(b.themes.length).toBeGreaterThan(0);
      for (const t of b.themes) expect(themes).toContain(t);
      expect(b.intro.trim().split(/\s+/).length).toBeGreaterThanOrEqual(120);
      const txt = `${b.libelle} ${b.description} ${b.intro}`;
      expect(txt).not.toMatch(/certifi|qualiopi|grenoble|aucun\s+gain\s+garanti|€|euros?\b/i);
    }
    expect(besoinParSlug("inconnu")).toBeNull();
  });
});

describe("hub : classement par type et par besoin", () => {
  it("un seul H1, deux entrées, fil d'Ariane visible, JSON-LD de liste", async () => {
    h.videos = [n(1, "automatisation")];
    const html = await rendre(Galerie({ params: fr() }));
    expect(compte(html, /<h1[ >]/g)).toBe(1);
    expect(html).toContain("Par type d&#x27;automatisation");
    expect(html).toContain("Par besoin d&#x27;entreprise");
    expect(html).toContain('aria-label="Fil d&#x27;Ariane"');
    expect(html).toContain("CollectionPage");
    expect(html).toContain("BreadcrumbList");
  });

  it("zéro vidéo : liste vide propre, 404, aucune entrée fantôme", async () => {
    await expect(Galerie({ params: fr() })).rejects.toThrow(/404/);
  });

  it("sous le seuil : le besoin est affiché sans lien (pas de page fantôme)", async () => {
    h.videos = [n(1, "automatisation"), n(2, "automatisation")];
    const html = await rendre(Galerie({ params: fr() }));
    expect(html).toContain("Gagner du temps");
    expect(html).not.toContain("/fr/videos/besoin/");
  });

  it("au seuil : le besoin a son lien, l'entrée par type aussi", async () => {
    h.videos = [n(1, "automatisation"), n(2, "automatisation"), n(3, "automatisation")];
    const l = hrefs(await rendre(Galerie({ params: fr() })));
    expect(l).toContain("/fr/videos/besoin/gagner-du-temps");
    expect(l).toContain("/fr/videos/theme/automatisation");
  });

  it("chaque page vidéo est atteignable en deux clics au plus depuis le hub", async () => {
    h.videos = [
      ...[1, 2, 3].map((k) => n(k, "automatisation")),
      ...[1, 2].map((k) => n(k, "sites-web-ia")),
    ];
    const toutes = (h.videos as Array<{ slug: string }>).map((v) => `/fr/videos/${v.slug}`);
    const hub = hrefs(await rendre(Galerie({ params: fr() })));
    const niveau1 = new Set(hub);
    const niveau2 = new Set<string>();
    for (const l of hub) {
      const m = /^\/fr\/videos\/(theme|besoin)\/([^/]+)$/.exec(l);
      if (!m) continue;
      const page =
        m[1] === "theme"
          ? PageTheme({ params: fr({ theme: m[2]! }) })
          : PageBesoin({ params: fr({ besoin: m[2]! }) });
      for (const x of hrefs(await rendre(page))) niveau2.add(x);
    }
    for (const v of toutes) expect(niveau1.has(v) || niveau2.has(v), v).toBe(true);
  });
});

describe("page de besoin", () => {
  it("sous 3 vidéos : 404 et métadonnées vides (non indexable)", async () => {
    h.videos = [n(1, "automatisation"), n(2, "automatisation")];
    await expect(PageBesoin({ params: fr({ besoin: "gagner-du-temps" }) })).rejects.toThrow(/404/);
    expect(await metaBesoin({ params: fr({ besoin: "gagner-du-temps" }) })).toEqual({});
  });

  it("besoin inconnu → 404 ; locale autre que fr → 404", async () => {
    h.videos = [1, 2, 3].map((k) => n(k, "automatisation"));
    await expect(PageBesoin({ params: fr({ besoin: "x" }) })).rejects.toThrow(/404/);
    await expect(
      PageBesoin({ params: Promise.resolve({ locale: "en", besoin: "gagner-du-temps" }) }),
    ).rejects.toThrow(/404/);
  });

  it("3 vidéos → 200 : H1 unique, cartes, fil d'Ariane, pages proches, canonique", async () => {
    h.videos = [1, 2, 3].map((k) => n(k, "automatisation"));
    const html = await rendre(PageBesoin({ params: fr({ besoin: "gagner-du-temps" }) }));
    expect(compte(html, /<h1[ >]/g)).toBe(1);
    expect(html).toContain("Titre automatisation 3");
    expect(html).toContain('aria-label="Fil d&#x27;Ariane"');
    expect(html).toContain('href="/fr/videos/theme/automatisation"');
    expect(html).toContain("BreadcrumbList");
    expect(
      (await metaBesoin({ params: fr({ besoin: "gagner-du-temps" }) })).alternates?.canonical,
    ).toBe("/fr/videos/besoin/gagner-du-temps");
  });

  it("ne contient que les vidéos de ses thèmes", async () => {
    h.videos = [...[1, 2, 3].map((k) => n(k, "automatisation")), n(9, "audit-ia")];
    const html = await rendre(PageBesoin({ params: fr({ besoin: "ne-rien-oublier" }) }));
    expect(html).not.toContain("Titre audit-ia 9");
  });
});

describe("groupes par besoin et pages proches", () => {
  it("une vidéo peut compter dans plusieurs besoins ; vide = aucun groupe", () => {
    expect(groupesParBesoin([])).toEqual([]);
    const g = groupesParBesoin(h.videos as never);
    expect(g).toEqual([]);
    const v = [1, 2, 3].map((k) => n(k, "automatisation"));
    const slugs = groupesParBesoin(v).map((x) => x.besoin.slug);
    expect(slugs).toEqual(expect.arrayContaining(["gagner-du-temps", "ne-rien-oublier"]));
    expect(groupesParBesoin(v).every((x) => x.aPage)).toBe(true);
  });

  it("listesProches : uniquement des pages qui existent, jamais la page courante", () => {
    const v = [1, 2, 3].map((k) => n(k, "automatisation"));
    const p = listesProches({ type: "theme", slug: "automatisation" }, v);
    expect(p.length).toBeGreaterThan(0);
    for (const x of p) {
      expect(x.href).toMatch(/^\/fr\/videos\/(theme|besoin)\//);
      expect(x.href).not.toBe("/fr/videos/theme/automatisation");
    }
    expect(listesProches({ type: "theme", slug: "automatisation" }, [])).toEqual([]);
  });
});

describe("aucun JS client dans les listes", () => {
  const fichiers = [
    "src/app/[locale]/videos/besoin/[besoin]/page.tsx",
    "src/app/[locale]/videos/page.tsx",
    "src/app/[locale]/videos/theme/[theme]/page.tsx",
    "src/app/[locale]/videos/serie/[serie]/page.tsx",
    "src/components/videos/CarteVideo.tsx",
    "src/components/videos/ListesVideos.tsx",
  ];
  it.each(fichiers)("%s : ni « use client » ni lecteur", (f) => {
    const src = readFileSync(f, "utf8");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
    expect(src).not.toMatch(/VslVideo|PageVideo/);
  });
});
