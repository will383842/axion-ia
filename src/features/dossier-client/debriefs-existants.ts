/**
 * LES DÉBRIEFS DÉJÀ ÉCRITS (chantier visio, PR 4 ; correction anti-doublon A4).
 *
 * Avant le dossier client, Will écrivait déjà son débrief à deux endroits :
 *   · `CalendlyEvent.notes` — les notes libres de la page Calendly de la console ;
 *   · `RendezVousSuivi.note` — l'appréciation du point de l'onglet « Rendez-vous ».
 *
 * « Après l'appel » les AFFICHE (rien n'est ressaisi), et la reprise de
 * l'historique en fait des faits « à ranger », proposés, jamais validés à la
 * place de Will. Une seule règle pour les deux lecteurs : ce module. PUR.
 */

export type OrigineDebrief = "notes_calendly" | "point_rendez_vous";

export interface DebriefExistant {
  readonly origine: OrigineDebrief;
  readonly texte: string;
}

export const LIBELLE_ORIGINE_DEBRIEF: Readonly<Record<OrigineDebrief, string>> = {
  notes_calendly: "Notes du rendez-vous (page Calendly)",
  point_rendez_vous: "Point de l'onglet « Rendez-vous »",
};

/** Longueur maximale reprise dans un fait (même borne que la note de l'onglet). */
export const LONGUEUR_MAX_DEBRIEF = 5000;

function propre(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t === "" ? null : t.slice(0, LONGUEUR_MAX_DEBRIEF);
}

/**
 * Les débriefs non vides, dans l'ordre (notes Calendly, puis point). Deux
 * textes identiques n'en font qu'un : le même débrief recopié ne devient pas
 * deux faits.
 */
export function debriefsExistants(sources: {
  readonly notesCalendly?: string | null;
  readonly noteDuPoint?: string | null;
}): DebriefExistant[] {
  const out: DebriefExistant[] = [];
  const notes = propre(sources.notesCalendly);
  if (notes !== null) out.push({ origine: "notes_calendly", texte: notes });
  const point = propre(sources.noteDuPoint);
  if (point !== null && point !== notes) out.push({ origine: "point_rendez_vous", texte: point });
  return out;
}
