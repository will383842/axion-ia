/**
 * G1, G1b, G2 — LA CITATION EXACTE (`compte-rendu-et-extraction.md` §4.1-4.2).
 *
 * Une preuve = des identifiants de segments du jour (`S0042`) et une citation
 * recopiée MOT POUR MOT. Le code vérifie, sans aucune correspondance
 * approchée :
 *
 *   G1  — `normaliserPourCitation(citation)` est une sous-chaîne de
 *         `normaliserPourCitation(concat(segments cités))` ;
 *   G1b — 3 à 40 mots après normalisation (un « oui » se retrouve partout,
 *         il ne prouve rien) ;
 *   G2  — chaque identifiant existe dans la transcription RETENUE du jour ;
 *         au plus 3 ; consécutifs sur la même piste ; même piste. Un
 *         identifiant de l'historique (`H…`, `C…`, `PRJ-…`) en preuve = rejet
 *         `preuve_historique`.
 *
 * La normalisation fait EXACTEMENT ceci, rien d'autre : NFKC ; minuscules ;
 * apostrophes et guillemets unifiés ; tirets unifiés ; ponctuation retirée ;
 * hésitations (euh, heu, hum, bah, ben) retirées des DEUX côtés ; espaces
 * réduits. Pas de lemmatisation, pas de synonymes : « douze » ne correspond
 * pas à « 12 ».
 *
 * Module PUR.
 */

import type { MotifRejetFait } from "../../../../prisma/generated/client";

/** Un segment du jour tel que la vérification le lit (texte DÉCHIFFRÉ en mémoire). */
export interface SegmentDuJour {
  /** `S0001`… dans l'ordre du dialogue entrelacé. */
  readonly id: string;
  readonly piste: "client" | "axion";
  readonly debutMs: number;
  readonly finMs: number;
  /** Étiquette du dialogue : `AXION`, `CLIENT_1`… */
  readonly etiquette: string;
  readonly texte: string;
}

export interface PreuveBrute {
  readonly segment_ids: readonly string[];
  readonly citation: string;
}

export type VerdictPreuve =
  | {
      readonly ok: true;
      readonly piste: "client" | "axion";
      readonly debutMs: number;
      readonly finMs: number;
      readonly etiquette: string;
      readonly segmentIds: readonly string[];
    }
  | { readonly ok: false; readonly motif: MotifRejetFait };

export const MOTS_MIN_CITATION = 3;
export const MOTS_MAX_CITATION = 40;
export const SEGMENTS_MAX_PAR_PREUVE = 3;

const HESITATIONS = /\b(?:euh+|heu+|hum+|bah|ben)\b/g;

/** La normalisation commune (§4.1). */
export function normaliserPourCitation(texte: string): string {
  return texte
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»“”"]/g, " ")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[.,;:!?…()[\]{}]/g, " ")
    .replace(HESITATIONS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compterMots(texte: string): number {
  const n = normaliserPourCitation(texte);
  return n === "" ? 0 : n.split(" ").length;
}

/** Un identifiant qui désigne l'historique, jamais l'échange du jour. */
export function estIdentifiantHistorique(id: string): boolean {
  return /^(?:H\d+|C\d+|PRJ-\d+)$/.test(id.trim());
}

/**
 * Vérifie une preuve contre les segments du jour (G1, G1b, G2).
 * `segmentsParId` : la carte des segments de la transcription RETENUE.
 */
export function verifierPreuve(
  preuve: PreuveBrute,
  segmentsParId: ReadonlyMap<string, SegmentDuJour>,
  ordreDansLaPiste: ReadonlyMap<string, number>,
): VerdictPreuve {
  const ids = preuve.segment_ids.map((s) => s.trim());
  if (ids.some(estIdentifiantHistorique)) return { ok: false, motif: "preuve_historique" };
  if (ids.length === 0 || ids.length > SEGMENTS_MAX_PAR_PREUVE) {
    return { ok: false, motif: "segment_inconnu" };
  }
  const segs = ids.map((id) => segmentsParId.get(id));
  if (segs.some((s) => s === undefined)) return { ok: false, motif: "segment_inconnu" };
  const reels = segs as SegmentDuJour[];
  const piste = reels[0]!.piste;
  if (reels.some((s) => s.piste !== piste)) return { ok: false, motif: "segment_inconnu" };
  // Consécutifs sur leur piste : pas un segment de la même piste entre eux.
  const rangs = reels.map((s) => ordreDansLaPiste.get(s.id) ?? -1);
  for (let i = 1; i < rangs.length; i++) {
    if (rangs[i] !== rangs[i - 1]! + 1) return { ok: false, motif: "segment_inconnu" };
  }

  const mots = compterMots(preuve.citation);
  if (mots < MOTS_MIN_CITATION) return { ok: false, motif: "citation_trop_courte" };
  if (mots > MOTS_MAX_CITATION) return { ok: false, motif: "citation_trop_longue" };

  const source = normaliserPourCitation(reels.map((s) => s.texte).join(" "));
  const cherche = normaliserPourCitation(preuve.citation);
  if (!` ${source} `.includes(` ${cherche} `)) return { ok: false, motif: "citation_introuvable" };

  return {
    ok: true,
    piste,
    debutMs: reels[0]!.debutMs,
    finMs: reels[reels.length - 1]!.finMs,
    etiquette: reels[0]!.etiquette,
    segmentIds: ids,
  };
}

/** Le rang de chaque segment dans SA piste (pour « consécutifs »). */
export function rangsDansLaPiste(segments: readonly SegmentDuJour[]): Map<string, number> {
  const compteurs = { client: 0, axion: 0 };
  const rangs = new Map<string, number>();
  for (const s of segments) {
    rangs.set(s.id, compteurs[s.piste]);
    compteurs[s.piste] += 1;
  }
  return rangs;
}
