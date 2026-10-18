/**
 * Vidéos liées d'une page vidéo (plan PLAN-W1-W4 §6.5) : même série d'abord (dans
 * l'ordre des épisodes), puis même thème, 3 au maximum, jamais la vidéo elle-même.
 * Pure : la liste des vidéos publiées entre en paramètre.
 */
import type { VideoPubliee } from "./lecture";

export const LIEES_MAX = 3;

export function videosLiees(
  courante: VideoPubliee,
  toutes: ReadonlyArray<VideoPubliee>,
): VideoPubliee[] {
  const autres = toutes.filter((x) => x.slug !== courante.slug);
  const serie = courante.serie
    ? autres
        .filter((x) => x.serie?.slug === courante.serie!.slug)
        .sort((a, b) => a.serie!.rang - b.serie!.rang)
    : [];
  const dejaPris = new Set(serie.map((x) => x.slug));
  const theme = autres.filter((x) => x.theme === courante.theme && !dejaPris.has(x.slug));
  return [...serie, ...theme].slice(0, LIEES_MAX);
}
