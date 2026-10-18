/**
 * Regroupements des vidéos publiées par thème et par série (lot W3, plan §7).
 * Pur : la liste entre en paramètre. Une page de thème ou de série n'existe qu'à partir
 * de 3 vidéos (décision D3, le même seuil pour les deux) : en dessous, les vidéos restent
 * visibles dans la galerie mais le groupe n'a pas de page propre (page mince interdite).
 */
import { THEMES, type ThemeVideo } from "@/content/videos/themes";
import type { VideoPubliee } from "./lecture";

export const SEUIL_PAGE_GROUPE = 3;

export interface GroupeTheme {
  readonly theme: ThemeVideo;
  readonly videos: ReadonlyArray<VideoPubliee>;
  readonly aPage: boolean;
}

export interface GroupeSerie {
  readonly slug: string;
  readonly titre: string;
  readonly videos: ReadonlyArray<VideoPubliee>;
  readonly aPage: boolean;
}

export function groupesParTheme(videos: ReadonlyArray<VideoPubliee>): GroupeTheme[] {
  return THEMES.map((theme) => {
    const doTheme = videos.filter((v) => v.theme === theme.slug);
    return { theme, videos: doTheme, aPage: doTheme.length >= SEUIL_PAGE_GROUPE };
  }).filter((g) => g.videos.length > 0);
}

export function groupesParSerie(videos: ReadonlyArray<VideoPubliee>): GroupeSerie[] {
  const parSerie = new Map<string, { titre: string; videos: VideoPubliee[] }>();
  for (const v of videos) {
    if (!v.serie) continue;
    const g = parSerie.get(v.serie.slug) ?? { titre: v.serie.titre, videos: [] };
    g.videos.push(v);
    parSerie.set(v.serie.slug, g);
  }
  return [...parSerie.entries()]
    .map(([slug, g]) => ({
      slug,
      titre: g.titre,
      videos: g.videos.sort((a, b) => a.serie!.rang - b.serie!.rang),
      aPage: g.videos.length >= SEUIL_PAGE_GROUPE,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
