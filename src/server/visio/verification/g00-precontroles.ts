/**
 * G0, G0b, G0c — CONTRÔLES AVANT TOUT APPEL À L'IA (`compte-rendu-et-extraction.md` §4.2).
 *
 *   G0  — PISTE CLIENT MUETTE : moins de 40 mots, ou moins de 3 % du temps de
 *         parole côté client ⇒ AUCUNE passe n'est appelée (code `piste_muette`),
 *         une note manuelle est proposée ;
 *   G0b — ENREGISTREMENT TRÈS COURT : moins de 90 s (hors refus) ⇒ rien n'est
 *         transcrit sans une question à Will (« le client a-t-il refusé ? ») ;
 *   G0c — REFUS OU DEMANDE D'ARRÊT : un arrêt pour refus détruit tout, sans
 *         transcription ; et, en filet, une phrase de refus trouvée sur la
 *         piste client TRONQUE la transcription à ce segment AVANT tout envoi
 *         à OpenAI — les paroles qui suivent ne sont pas conservées.
 *
 * Module PUR.
 */

import { normaliserPourCitation } from "./g01-citation";

export const MOTS_CLIENT_MIN = 40;
export const PART_PAROLE_CLIENT_MIN = 0.03;
export const DUREE_MIN_ENREGISTREMENT_MS = 90_000;

export interface SegmentPrecontrole {
  readonly piste: "client" | "axion";
  readonly debutMs: number;
  readonly finMs: number;
  readonly texte: string;
}

/** G0 — vrai si la piste client est muette (aucun appel à OpenAI). */
export function pisteClientMuette(
  segments: readonly SegmentPrecontrole[],
  dureeTotaleMs: number,
): boolean {
  const client = segments.filter((s) => s.piste === "client");
  const mots = client.reduce((n, s) => {
    const t = normaliserPourCitation(s.texte);
    return n + (t === "" ? 0 : t.split(" ").length);
  }, 0);
  if (mots < MOTS_CLIENT_MIN) return true;
  const parole = client.reduce((n, s) => n + Math.max(0, s.finMs - s.debutMs), 0);
  return dureeTotaleMs > 0 && parole / dureeTotaleMs < PART_PAROLE_CLIENT_MIN;
}

/** G0b — vrai si l'enregistrement est trop court pour être traité sans question à Will. */
export function enregistrementTropCourt(dureeMs: number, motifArret: string | null): boolean {
  return motifArret !== "refus_participant" && dureeMs < DUREE_MIN_ENREGISTREMENT_MS;
}

/**
 * Les formules de refus ou de demande d'arrêt (sans accents, normalisées).
 * Liste FERMÉE : un faux positif tronque (Will le voit et relance), un faux
 * négatif est rattrapé par `demande_arret_enregistrement` de P1.
 */
const FORMULES_DE_REFUS: readonly RegExp[] = [
  /\bpas enregistr/,
  /\bne m'enregistre/,
  /\bn'enregistrez pas\b/,
  /\bcoupe(?:z|r)? l'enregistrement\b/,
  /\barrete(?:z|r)? (?:d'enregistrer|l'enregistrement)\b/,
  /\bstop(?:pez)? l'enregistrement\b/,
  /\bprefere(?:rais)? (?:pas|qu'on n'enregistre pas|ne pas etre enregistr)/,
  /\bje ne veux pas (?:etre enregistr|qu'on enregistre)/,
  /\bretire(?:r)? mon accord\b/,
];

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function estUneDemandeDArret(texte: string): boolean {
  const t = sansAccents(normaliserPourCitation(texte));
  return FORMULES_DE_REFUS.some((m) => m.test(t));
}

/**
 * G0c — l'index (dans l'ordre chronologique) du premier segment de la piste
 * CLIENT qui demande l'arrêt, ou `null`. Tout ce qui le suit (ce segment
 * compris) est écarté avant l'envoi.
 */
export function indexDeLaDemandeDArret(segments: readonly SegmentPrecontrole[]): number | null {
  const i = segments.findIndex((s) => s.piste === "client" && estUneDemandeDArret(s.texte));
  return i < 0 ? null : i;
}

/** G0c — coupe la transcription : ce qui précède la demande d'arrêt, rien d'autre. */
export function tronquerALaDemandeDArret<T extends SegmentPrecontrole>(
  segments: readonly T[],
): { readonly gardes: T[]; readonly ecartes: T[] } {
  const ordonnes = [...segments].sort((a, b) => a.debutMs - b.debutMs);
  const i = indexDeLaDemandeDArret(ordonnes);
  if (i === null) return { gardes: ordonnes, ecartes: [] };
  const coupure = ordonnes[i]!.debutMs;
  return {
    gardes: ordonnes.filter((s) => s.debutMs < coupure),
    ecartes: ordonnes.filter((s) => s.debutMs >= coupure),
  };
}
