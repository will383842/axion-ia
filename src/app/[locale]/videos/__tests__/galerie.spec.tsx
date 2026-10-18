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

describe("aucun JS client dans les listes", () => {
  const fichiers = [
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
