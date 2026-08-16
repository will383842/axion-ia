/**
 * Règles PURES de la liste des sessions : fenêtre d'affichage, bornes de
 * pagination, arrondi de la moyenne de présence.
 *
 * ## Pourquoi un module séparé
 *
 * `queries.ts` parle à Prisma : rien de ce qu'il contient n'est testable sans
 * base. Or ce sont ces trois règles-là qui décident de ce que l'admin VOIT —
 * quelles sessions, combien par écran, et quel taux. Les isoler ici les rend
 * vérifiables une par une, et empêche qu'une deuxième version de la fenêtre
 * (ou du plafond de page) apparaisse un jour dans la page appelante.
 *
 * Aucun import Prisma ni Next : mêmes entrées → mêmes sorties, sans horloge
 * implicite (`maintenant` est toujours un paramètre).
 */

/**
 * Sessions affichées par page.
 *
 * 🔴 Défaut D1 constaté : la liste chargeait TOUTES les sessions, sans `take`.
 * À la cible (~1 200 sessions), la page ne s'affichait plus sous 30 s, et le
 * temps de rendu grandissait linéairement avec l'historique — c'est-à-dire
 * pour toujours. Aligné sur `PAGE_SIZE` du Hub Facturation : deux listes admin
 * qui pagineraient différemment n'apprendraient rien à personne.
 */
export const PAGE_SIZE_SESSIONS = 25;

/**
 * Fenêtre d'affichage par défaut, en mois glissants. Même parti pris que
 * `FENETRE_SOLDES_JOURS` (vue Dossiers) : la fenêtre sort la ligne de la VUE,
 * jamais des données — les archives restent atteignables explicitement.
 *
 * Douze mois parce que c'est la maille de tout ce qui se rapporte à cette
 * liste : exercice comptable, BPF, échantillon d'un audit Qualiopi de
 * surveillance. Une fenêtre plus courte obligerait à ouvrir les archives pour
 * un travail parfaitement ordinaire.
 */
export const FENETRE_SESSIONS_MOIS = 12;

/**
 * Borne basse de la fenêtre : les sessions dont `dateDebut` est ANTÉRIEURE en
 * sortent. Rien ne borne le futur — une session planifiée dans six mois est
 * exactement ce qu'on veut voir en haut de la liste.
 *
 * Arithmétique en UTC (la machine de prod y est ; la borne d'un an ne se joue
 * pas à deux heures près). Cas limite assumé : un 29 février recule sur le
 * 1er mars de l'année précédente, `setUTCMonth` reportant le jour manquant.
 */
export function debutFenetreSessions(maintenant: Date): Date {
  const debut = new Date(maintenant.getTime());
  debut.setUTCMonth(debut.getUTCMonth() - FENETRE_SESSIONS_MOIS);
  return debut;
}

/** Bornes de lecture d'une page — directement consommables par Prisma. */
export interface BornesPagination {
  /** Page RÉELLEMENT servie, après recadrage dans [1, totalPages]. */
  page: number;
  skip: number;
  take: number;
  totalPages: number;
}

/**
 * Recadre une page demandée sur un total connu.
 *
 * 🔴 Le recadrage porte sur les DEUX bornes, contrairement au Hub Facturation
 * qui ne défend que la borne basse : `?page=999` sur trois pages y rend un
 * tableau vide, indiscernable d'« aucune session ». On sert la dernière page
 * et on annonce laquelle, ce que le rendu peut alors afficher honnêtement.
 *
 * `totalPages` vaut 1 au minimum : une liste vide reste « page 1 / 1 », jamais
 * « page 1 / 0 ».
 */
export function bornesPagination(
  pageDemandee: number,
  total: number,
  pageSize: number = PAGE_SIZE_SESSIONS,
): BornesPagination {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const demandee = Number.isFinite(pageDemandee) ? Math.floor(pageDemandee) : 1;
  const page = Math.min(totalPages, Math.max(1, demandee));
  return { page, skip: (page - 1) * pageSize, take: pageSize, totalPages };
}

/**
 * Lit le paramètre `page` de l'URL. Tout ce qui n'est pas un entier ≥ 1
 * (absent, tableau, « abc », « 0 », « -3 ») retombe sur la première page :
 * une URL bricolée ne doit jamais rendre un écran vide.
 */
export function parsePageParam(brut: string | string[] | undefined): number {
  if (typeof brut !== "string") return 1;
  const n = Number.parseInt(brut, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Arrondit la moyenne de présence rendue par l'agrégat SQL.
 *
 * 🔴 `null` n'est PAS `0` et ne doit jamais le devenir : une session sans
 * inscrit — ou dont aucun inscrit n'a encore de taux — n'a pas une présence
 * nulle, elle n'a pas de présence MESURÉE. L'afficher « 0 % » la peindrait en
 * rouge dans la liste et ferait croire à un incident d'émargement là où il n'y
 * a rien à corriger.
 */
export function arrondirTauxMoyen(moyenne: number | null | undefined): number | null {
  if (moyenne === null || moyenne === undefined) return null;
  if (!Number.isFinite(moyenne)) return null;
  return Math.round(moyenne);
}
