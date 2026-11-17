// SEO-06b : les pages de liste par besoin entrent dans le plan du site (comme les pages thème).
import { describe, expect, it } from "vitest";
import { construireSitemapVideos } from "../sitemap";
import type { VideoPubliee } from "../lecture";

const SITE = "https://axion-ia.com";

const v = (slug: string, theme: string): VideoPubliee =>
  ({
    slug,
    theme,
    titre: slug,
    description: slug,
    serie: null,
    dureeSecondes: 60,
    publieeLe: new Date("2026-11-01T00:00:00Z"),
    modifieeLe: new Date("2026-11-02T00:00:00Z"),
    fichiers: {
      video: { chemin: `/medias/videos/${slug}/video.mp4` },
      affiche169: { chemin: `/medias/videos/${slug}/affiche.avif` },
    },
  }) as unknown as VideoPubliee;

describe("construireSitemapVideos : pages besoin", () => {
  it("déclare une page besoin non vide (≥ 3 vidéos, liste distincte d'un thème)", () => {
    // 2 + 1 vidéos : aucun thème n'atteint 3, mais « gagner du temps » (automatisation + coaching) si.
    const xml = construireSitemapVideos(
      [v("a", "automatisation"), v("b", "automatisation"), v("c", "coaching-ia")],
      SITE,
    )!;
    expect(xml).toContain(`<loc>${SITE}/fr/videos/besoin/gagner-du-temps</loc>`);
    expect(xml).not.toContain("/fr/videos/theme/");
  });

  it("n'y met pas une page besoin vide ou sous le seuil", () => {
    const xml = construireSitemapVideos(
      [v("a", "automatisation"), v("b", "automatisation"), v("c", "coaching-ia")],
      SITE,
    )!;
    // sites-web-ia : aucune vidéo ; ne-rien-oublier : 2 vidéos seulement (automatisation + audit-ia).
    expect(xml).not.toContain("/fr/videos/besoin/mieux-se-faire-connaitre");
    expect(xml).not.toContain("/fr/videos/besoin/repondre-plus-vite");
    expect(xml).not.toContain("/fr/videos/besoin/ne-rien-oublier");
  });

  it("aucune page besoin quand la liste est identique à celle d'un thème", () => {
    const xml = construireSitemapVideos(
      [v("a", "automatisation"), v("b", "automatisation"), v("c", "automatisation")],
      SITE,
    )!;
    expect(xml).toContain("/fr/videos/theme/automatisation");
    expect(xml).not.toContain("/fr/videos/besoin/");
  });
});
