/**
 * RÉPARTITEUR DES ENCARTS VIDÉO (conception §3.3) : choisit, pour un contenu, UNE vidéo parmi
 * des candidats déjà notés. Module PUR : aucune entrée/sortie, ni horloge (l'instant est un
 * paramètre), ni aléatoire. Même entrée → même sortie.
 *
 * Règles, dans l'ordre :
 *  1. réglage `actif` faux → rien ; type de contenu non activé → rien ;
 *  2. écarte les vidéos de `videosExclues` ;
 *  3. seuil : `score ≥ seuilMin` (et `≤ seuilMax` s'il est posé) — jamais de remplissage ;
 *  4. plafond DUR : une vidéo ayant déjà `plafondParVideo` affectations actives dont la date est
 *     dans la fenêtre est exclue (l'affectation du contenu lui-même ne compte pas) ;
 *  5. voisins : si `exclureVoisins`, écarte les vidéos déjà affectées aux voisins ;
 *  6. classement : score effectif = `s − λ · (affectations / plafond)`, décroissant ; égalité
 *     départagée par `departageStable(contenuId, slug)`, puis par slug, puis par identifiant.
 */
import type { ReglagesEncarts, TypeContenuEncart } from "./reglages";

/** Poids de la pénalité de rotation (λ). Constante de l'algorithme (versionAlgo). */
export const LAMBDA_ROTATION = 0.1;

const JOUR_MS = 86_400_000;

/** Version de l'algorithme (colonne `versionAlgo` des affectations) : à relever à tout changement de règle ou de λ. */
export const VERSION_ALGO = 1;

export interface CandidatVideo {
  readonly id: string;
  readonly slug: string;
  /**
   * Proximité contenu↔vidéo, entre 0 et 1 (embedding ou repli lexical). Le CALLER ramène le
   * score dans [0 ; 1] : hors bornes ou non fini, le candidat est écarté (raison « score-invalide »).
   */
  readonly score: number;
}

export interface AffectationActive {
  readonly contenuId: string;
  readonly siteVideoId: string;
  /** Instant du choix, en millisecondes. */
  readonly choisiLe: number;
}

export interface EntreeRepartiteur {
  readonly contenuId: string;
  readonly typeContenu: TypeContenuEncart;
  readonly candidats: ReadonlyArray<CandidatVideo>;
  /** Affectations ACTIVES de toutes les vidéos (le module filtre la fenêtre). */
  readonly affectationsActives: ReadonlyArray<AffectationActive>;
  /** Identifiants des vidéos déjà affectées aux contenus voisins. */
  readonly videosVoisines: ReadonlyArray<string>;
  readonly maintenantMs: number;
  readonly reglages: ReglagesEncarts;
}

export type RaisonSansEncart =
  | "eteint"
  | "type-non-active"
  | "aucun-candidat"
  | "score-invalide"
  | "exclues"
  | "sous-seuil"
  | "au-dessus-seuil-max"
  | "plafond"
  | "voisins";

export interface VideoChoisie extends CandidatVideo {
  readonly scoreEffectif: number;
}

export type ResultatRepartiteur =
  | { readonly video: VideoChoisie; readonly raison?: undefined }
  | { readonly video: null; readonly raison: RaisonSansEncart };

/** Hachage FNV-1a 32 bits (entier non signé) : stable, sans aléa, sans dépendance. */
export function departageStable(contenuId: string, slug: string): number {
  let h = 0x811c9dc5;
  const texte = `${contenuId}\u0000${slug}`;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function scoreValide(s: number): boolean {
  return Number.isFinite(s) && s >= 0 && s <= 1;
}

export function choisirVideo(entree: EntreeRepartiteur): ResultatRepartiteur {
  const { reglages, contenuId } = entree;
  if (!reglages.actif) return { video: null, raison: "eteint" };
  if (!reglages.typesContenus.includes(entree.typeContenu)) {
    return { video: null, raison: "type-non-active" };
  }

  if (entree.candidats.length === 0) return { video: null, raison: "aucun-candidat" };
  let restants = entree.candidats.filter((c) => scoreValide(c.score));
  if (restants.length === 0) return { video: null, raison: "score-invalide" };

  const exclues = new Set(reglages.videosExclues);
  restants = restants.filter((c) => !exclues.has(c.id));
  if (restants.length === 0) return { video: null, raison: "exclues" };

  restants = restants.filter((c) => c.score >= reglages.seuilMin);
  if (restants.length === 0) return { video: null, raison: "sous-seuil" };

  if (reglages.seuilMax !== undefined) {
    const max = reglages.seuilMax;
    restants = restants.filter((c) => c.score <= max);
    if (restants.length === 0) return { video: null, raison: "au-dessus-seuil-max" };
  }

  // Plafond : affectations des AUTRES contenus, dans la fenêtre (date future incluse : prudence).
  const debutFenetre = entree.maintenantMs - reglages.fenetreJours * JOUR_MS;
  const compte = new Map<string, number>();
  for (const a of entree.affectationsActives) {
    if (a.contenuId === contenuId || a.choisiLe < debutFenetre) continue;
    compte.set(a.siteVideoId, (compte.get(a.siteVideoId) ?? 0) + 1);
  }
  restants = restants.filter((c) => (compte.get(c.id) ?? 0) < reglages.plafondParVideo);
  if (restants.length === 0) return { video: null, raison: "plafond" };

  if (reglages.exclureVoisins) {
    const voisines = new Set(entree.videosVoisines);
    restants = restants.filter((c) => !voisines.has(c.id));
    if (restants.length === 0) return { video: null, raison: "voisins" };
  }

  const notes = restants.map((c) => ({
    c,
    effectif: c.score - LAMBDA_ROTATION * ((compte.get(c.id) ?? 0) / reglages.plafondParVideo),
    de: departageStable(contenuId, c.slug),
  }));
  notes.sort((a, b) => {
    // Comparaison EXACTE : une tolérance n'est pas transitive et rendrait le tri dépendant de l'ordre.
    if (a.effectif !== b.effectif) return b.effectif - a.effectif;
    if (a.de !== b.de) return a.de - b.de;
    if (a.c.slug !== b.c.slug) return a.c.slug < b.c.slug ? -1 : 1;
    return a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0;
  });
  const gagnant = notes[0]!;
  return { video: { ...gagnant.c, scoreEffectif: gagnant.effectif } };
}
