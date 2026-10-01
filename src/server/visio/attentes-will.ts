/**
 * Les QUESTIONS qu'un enregistrement pose à Will avant toute transcription
 * (RGPD-01, G0b). Module PUR : une seule règle, lue par l'étape `transcrire`
 * (qui attend) et par la vue du compte rendu (qui montre les boutons).
 *
 *   · `court` — moins de 90 s (hors refus déclaré) : le client a-t-il refusé ?
 *     Levée par le geste « court » (`court_confirme`).
 *   · `interrompue` — close d'office par le serveur (`cloture_serveur`) : la
 *     liste des fenêtres hors accord n'est jamais arrivée. Quelqu'un est-il
 *     entré sans accord ? Levée par un geste DISTINCT (`fenetres_verifiees`).
 *
 * Les deux sont indépendantes : répondre à l'une ne répond pas à l'autre.
 */

import { enregistrementTropCourt } from "./verification/g00-precontroles";

/** Posé par le geste « court » de Will. */
export const EVT_COURT_CONFIRME = "court_confirme";
/** Posé par le geste « personne sans accord » de Will. */
export const EVT_FENETRES_VERIFIEES = "fenetres_verifiees";

export type QuestionAWill = "court" | "interrompue";

export const MOTIF_COURT = "enregistrement de moins de 90 secondes : le client a-t-il refusé ?";
export const MOTIF_CLOTURE_SERVEUR =
  "session interrompue sans la liste des personnes sans accord : vérifiez que personne n'est entré sans accord avant de lancer la transcription";

const MOTIFS: Readonly<Record<QuestionAWill, string>> = {
  court: MOTIF_COURT,
  interrompue: MOTIF_CLOTURE_SERVEUR,
};

/** Les questions encore ouvertes pour un enregistrement, dans l'ordre d'affichage. */
export function questionsAWill(
  e: {
    readonly debut: Date;
    readonly fin: Date | null;
    readonly motifArret: string | null;
    readonly courtConfirme: boolean;
    readonly fenetresVerifiees: boolean;
    /**
     * V2, N4 — un battement de session a apporté la liste des fenêtres hors
     * accord : la question « interrompue » n'a plus d'objet. Absent : inconnu.
     */
    readonly fenetresRecues?: boolean;
  },
  maintenant: Date,
): QuestionAWill[] {
  const out: QuestionAWill[] = [];
  const dureeMs = (e.fin ?? maintenant).getTime() - e.debut.getTime();
  if (!e.courtConfirme && enregistrementTropCourt(dureeMs, e.motifArret)) out.push("court");
  if (!e.fenetresVerifiees && e.fenetresRecues !== true && e.motifArret === "cloture_serveur")
    out.push("interrompue");
  return out;
}

/** Le motif de l'attente : toutes les questions ouvertes, une par phrase. */
export function motifDesQuestions(questions: readonly QuestionAWill[]): string {
  return questions.map((q) => MOTIFS[q]).join(" ; ");
}
