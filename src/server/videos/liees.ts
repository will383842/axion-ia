/**
 * Vidéos liées d'une page vidéo (plan PLAN-W1-W4 §6.5) : même série d'abord (dans
 * l'ordre des épisodes), puis même thème, 3 au maximum, jamais la vidéo elle-même.
 * Pure : la liste des vidéos publiées entre en paramètre.
 *
 * SEO-06 : classement par besoin d'entreprise et pages de liste proches (maillage du hub).
 * Seules des pages qui existent réellement sont proposées (seuil `SEUIL_PAGE_GROUPE`).
 */
import { BESOINS, type BesoinEntreprise } from "@/content/videos/besoins";
import { THEMES } from "@/content/videos/themes";
import { SEUIL_PAGE_GROUPE } from "./groupes";
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

export interface GroupeBesoin {
  readonly besoin: BesoinEntreprise;
  readonly videos: ReadonlyArray<VideoPubliee>;
  readonly aPage: boolean;
}

/**
 * Une page de besoin existe si elle atteint le seuil ET si sa liste n'est pas identique à
 * celle d'une page de thème (sinon : deux adresses indexables pour un même contenu).
 */
export function besoinAPage(
  besoin: BesoinEntreprise,
  videos: ReadonlyArray<VideoPubliee>,
): boolean {
  const siennes = videos.filter((v) => besoin.themes.includes(v.theme));
  if (siennes.length < SEUIL_PAGE_GROUPE) return false;
  const cle = (l: ReadonlyArray<VideoPubliee>) =>
    l
      .map((v) => v.slug)
      .sort()
      .join("|");
  return !THEMES.some((t) => {
    const duTheme = videos.filter((v) => v.theme === t.slug);
    return duTheme.length >= SEUIL_PAGE_GROUPE && cle(duTheme) === cle(siennes);
  });
}

/** Besoins ayant au moins une vidéo ; une vidéo peut compter dans plusieurs besoins. */
export function groupesParBesoin(videos: ReadonlyArray<VideoPubliee>): GroupeBesoin[] {
  return BESOINS.map((besoin) => {
    const doBesoin = videos.filter((v) => besoin.themes.includes(v.theme));
    return { besoin, videos: doBesoin, aPage: besoinAPage(besoin, videos) };
  }).filter((g) => g.videos.length > 0);
}

export interface ListeProche {
  readonly href: string;
  readonly libelle: string;
}

export interface ListeCourante {
  readonly type: "theme" | "besoin";
  readonly slug: string;
}

/**
 * Pages de liste voisines de la page courante (un thème renvoie vers les besoins qui le
 * couvrent, un besoin vers ses thèmes, et chacun vers ses pairs partageant un thème).
 * Uniquement des pages existantes, jamais la page courante.
 */
export function listesProches(
  courante: ListeCourante,
  videos: ReadonlyArray<VideoPubliee>,
): ListeProche[] {
  const themesDuCourant =
    courante.type === "theme"
      ? [courante.slug]
      : (BESOINS.find((b) => b.slug === courante.slug)?.themes ?? []);
  const sortie: ListeProche[] = [];
  const nb = (themes: ReadonlyArray<string>) =>
    videos.filter((v) => themes.includes(v.theme)).length;
  for (const t of THEMES) {
    if (courante.type === "theme" && t.slug === courante.slug) continue;
    if (courante.type === "besoin" && !themesDuCourant.includes(t.slug)) continue;
    if (nb([t.slug]) >= SEUIL_PAGE_GROUPE) {
      sortie.push({ href: `/fr/videos/theme/${t.slug}`, libelle: `Vidéos ${t.libelle}` });
    }
  }
  for (const b of BESOINS) {
    if (courante.type === "besoin" && b.slug === courante.slug) continue;
    if (!b.themes.some((t) => themesDuCourant.includes(t))) continue;
    if (besoinAPage(b, videos)) {
      sortie.push({
        href: `/fr/videos/besoin/${b.slug}`,
        libelle: `Vidéos pour ${b.libelle.toLowerCase()}`,
      });
    }
  }
  return sortie;
}
