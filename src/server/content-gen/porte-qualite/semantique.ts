/**
 * Outils PURS de la comparaison sémantique (Q4, § 7.2) : cosinus, voisins les plus proches
 * dans l'index des pages hors articles, pénalité de note, calibrage du seuil. Aucune E/S :
 * les embeddings arrivent déjà calculés (fournisseur déjà configuré, côté appelant).
 */

import type { ReglagesPorte } from "./reglages";
import type { VoisinSemantique } from "./types";

/** Types de contenus hors articles que l'index d'embeddings doit couvrir (§ 7.2, § 11). */
export const TYPES_INDEX_STATIQUE: ReadonlyArray<string> = Object.freeze([
  "page_statique",
  "service",
  "offre",
  "journee_ia",
  "ville",
  "faq",
]);

export interface EntreeIndex {
  readonly id: string;
  readonly type: string;
  readonly url: string | null;
  readonly etat: "publie" | "en_file";
  readonly embedding: ReadonlyArray<number>;
}

/** Cosinus de deux vecteurs ; `null` si les vecteurs sont inutilisables (taille, nul, non fini). */
export function cosinus(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number | null {
  if (a.length === 0 || a.length !== b.length) return null;
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    ab += x * y;
    aa += x * x;
    bb += y * y;
  }
  if (aa === 0 || bb === 0) return null;
  return Math.max(-1, Math.min(1, ab / Math.sqrt(aa * bb)));
}

/**
 * Compare un brouillon à l'index et rend les `n` plus proches. Une entrée dont le vecteur est
 * inutilisable est rendue avec un cosinus NaN : B06 la tient pour « non évalué » (pas de 0 muet).
 */
export function voisinsLesPlusProches(
  brouillon: ReadonlyArray<number>,
  index: ReadonlyArray<EntreeIndex>,
  n = 5,
  /** Identifiants à écarter : le brouillon lui-même s'il est déjà en file (sinon cosinus 1, refus systématique). */
  exclure: ReadonlyArray<string> = [],
): ReadonlyArray<VoisinSemantique> {
  // Vecteur du brouillon inutilisable : on le dit (NaN → « non évalué »), même si l'index est vide.
  if (cosinus(brouillon, brouillon) === null) {
    return [
      { id: "brouillon", type: "brouillon", url: null, etat: "en_file", cosinus: Number.NaN },
    ];
  }
  const nb = Math.max(1, Math.floor(Number.isFinite(n) ? n : 5));
  return index
    .filter((e) => !exclure.includes(e.id))
    .map((e) => ({
      id: e.id,
      type: e.type,
      url: e.url,
      etat: e.etat,
      cosinus: cosinus(brouillon, e.embedding) ?? Number.NaN,
    }))
    .sort((a, b) => {
      const na = Number.isNaN(a.cosinus);
      const nbb = Number.isNaN(b.cosinus);
      if (na || nbb) return na && nbb ? 0 : na ? -1 : 1;
      return b.cosinus - a.cosinus;
    })
    .slice(0, nb);
}

/** Pénalité de proximité de la note (§ 4.3) : 0 sous `cosinusProximiteMin`, 10 à `cosinusBloque`. */
export function penaliteProximite(cosinusMax: number | null, r: ReglagesPorte): number {
  if (cosinusMax === null || !Number.isFinite(cosinusMax)) return 10;
  const { cosinusProximiteMin: bas, cosinusBloque: haut } = r;
  if (cosinusMax <= bas) return 0;
  if (cosinusMax >= haut) return 10;
  return Math.round(((cosinusMax - bas) / (haut - bas)) * 10);
}

export interface PaireCalibrage {
  readonly cosinus: number;
  /** Étiquette posée À LA MAIN : les deux textes traitent-ils la même intention ? */
  readonly doublon: boolean;
}

export interface ResultatCalibrage {
  readonly paires: number;
  readonly seuil: number | null;
  readonly precision: number | null;
  readonly rappel: number | null;
  readonly raison: string | null;
}

/** Nombre de paires étiquetées exigé avant de proposer un seuil (§ 7.2). */
export const PAIRES_CALIBRAGE_MIN = 50;

/**
 * Propose le seuil qui maximise le F1 sur les paires étiquetées. Moins de 50 paires, ou une seule
 * classe : aucun seuil proposé (le départ 0,85 reste). C'est une PROPOSITION : changer
 * `cosinusBloque` est une décision (Q9), jamais automatique.
 */
export function calibrerSeuil(paires: ReadonlyArray<PaireCalibrage>): ResultatCalibrage {
  const vides = { seuil: null, precision: null, rappel: null };
  const valides = paires.filter((p) => Number.isFinite(p.cosinus));
  if (valides.length < PAIRES_CALIBRAGE_MIN) {
    return {
      paires: valides.length,
      ...vides,
      raison: `${valides.length} paire(s) étiquetée(s), ${PAIRES_CALIBRAGE_MIN} exigées.`,
    };
  }
  const positifs = valides.filter((p) => p.doublon).length;
  if (positifs === 0 || positifs === valides.length) {
    return {
      paires: valides.length,
      ...vides,
      raison: "Une seule classe étiquetée : calibrage impossible.",
    };
  }
  let meilleur: { seuil: number; f1: number; p: number; r: number } | null = null;
  for (const candidat of [...new Set(valides.map((p) => p.cosinus))].sort((a, b) => a - b)) {
    const vp = valides.filter((p) => p.cosinus >= candidat && p.doublon).length;
    const fp = valides.filter((p) => p.cosinus >= candidat && !p.doublon).length;
    const fn = positifs - vp;
    const precision = vp + fp === 0 ? 0 : vp / (vp + fp);
    const rappel = vp / (vp + fn);
    const f1 = precision + rappel === 0 ? 0 : (2 * precision * rappel) / (precision + rappel);
    // Égalité de F1 : on garde le seuil le plus HAUT (moins de faux refus) ; `>=` en montant l'écrase.
    if (!meilleur || f1 >= meilleur.f1) meilleur = { seuil: candidat, f1, p: precision, r: rappel };
  }
  return {
    paires: valides.length,
    seuil: meilleur!.seuil,
    precision: meilleur!.p,
    rappel: meilleur!.r,
    raison: null,
  };
}
