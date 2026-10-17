/**
 * 🔴 CHANTIER QNC, L09 — UNE NOTE DE 2/5 OU MOINS OUVRE UN EXAMEN.
 *
 * Indicateurs 30 et 31 : une appréciation très défavorable n'est pas une
 * statistique, c'est une DIFFICULTÉ à examiner. Jusqu'ici, un « 1/5 » entrait
 * dans le taux de satisfaction et nulle part ailleurs. Désormais, à la
 * PREMIÈRE soumission d'un questionnaire de satisfaction, chaque note ≤ 2/5
 * ouvre un incident au registre :
 *   - nature `difficulte`, origine `questionnaire`, déclarant = qui répond
 *     (stagiaire, ou entreprise pour l'enquête entreprise) ;
 *   - rattaché à la session par l'inscription du questionnaire ;
 *   - avec une note d'ouverture qui dit d'où il vient et QUI a répondu —
 *     « répondu par le destinataire du lien » : l'outil sait qu'un lien a été
 *     ouvert, pas qui le tenait. Saisi par l'organisme, il le dit aussi.
 *
 * Le verbatim n'est pas recopié : il reste dans le questionnaire.
 *
 * Interrupteur `qualiopi.reclamations.actif` : éteint, rien ne s'ouvre ; en
 * `essai`, seulement pour une inscription (ou une session) du banc d'essai.
 * Fail-soft : la soumission du questionnaire n'échoue JAMAIS à cause de lui.
 */

import { prisma } from "@/lib/prisma";
import { estActifPour } from "@/server/qualiopi/socle/interrupteurs";
import { creerIncident } from "@/server/qualiopi/registres/incidents-service";
import { AUTEUR_EXAMEN_AUTOMATIQUE } from "@/server/qualiopi/registres/auteur";
import { lireInterrupteurReclamations } from "./interrupteur";

/** Au plus cette note (sur 5) : un examen s'ouvre. */
export const SEUIL_NOTE_FAIBLE = 2;

/** Le libellé de l'origine d'une réponse recueillie par un lien. */
export const LIBELLE_REPONDU_PAR_LIEN = "répondu par le destinataire du lien";
export const LIBELLE_SAISI_PAR_ORGANISME = "saisi par l'organisme à la place du répondant";

const TYPES_SATISFACTION = ["satisfaction_chaud", "satisfaction_froid", "satisfaction_entreprise"];

const LIBELLE_TYPE: Record<string, string> = {
  satisfaction_chaud: "questionnaire de satisfaction à chaud",
  satisfaction_froid: "questionnaire de satisfaction à froid",
  satisfaction_entreprise: "enquête de satisfaction entreprise",
};

export interface NoteLue {
  /** Ce qui est noté (« note globale », ou l'intitulé d'une question). */
  readonly libelle: string;
  readonly valeur: number;
  /** L'échelle ; seules les notes sur 5 comptent. */
  readonly sur: number;
}

/** Pure : les notes qui appellent un examen. */
export function notesFaibles(notes: ReadonlyArray<NoteLue>): NoteLue[] {
  return notes.filter(
    (n) =>
      n.sur === 5 && Number.isInteger(n.valeur) && n.valeur >= 1 && n.valeur <= SEUIL_NOTE_FAIBLE,
  );
}

/** Pure : le texte de la note d'ouverture de l'examen. */
export function texteOuvertureExamen(e: {
  readonly type: string;
  readonly notes: ReadonlyArray<NoteLue>;
  readonly origine: "stagiaire" | "organisme" | null;
}): string {
  const qui =
    e.origine === "organisme"
      ? LIBELLE_SAISI_PAR_ORGANISME
      : e.origine === "stagiaire"
        ? LIBELLE_REPONDU_PAR_LIEN
        : "origine de la réponse non tracée";
  const detail = e.notes.map((n) => `${n.libelle} : ${n.valeur}/5`).join(" ; ");
  return (
    `Examen ouvert automatiquement : ${detail} au ${LIBELLE_TYPE[e.type] ?? e.type} ` +
    `(${qui}). Le verbatim est dans le questionnaire. À examiner : ce qui s'est passé, ` +
    `la réponse apportée à la personne, et l'action d'amélioration éventuelle.`
  );
}

export interface QuestionnaireSoumis {
  readonly questionnaireId: string;
  readonly type: string;
  readonly enrollmentId: string;
  readonly noteGlobale?: number | undefined;
  readonly origine?: "stagiaire" | "organisme" | undefined;
}

/**
 * Ouvre l'examen si une note est faible. Ne lève jamais : un échec est
 * journalisé bruyamment et la soumission continue.
 *
 * @returns l'identifiant de l'incident ouvert, ou `null`.
 */
export async function ouvrirExamenSiNoteFaible(q: QuestionnaireSoumis): Promise<string | null> {
  try {
    if (!TYPES_SATISFACTION.includes(q.type)) return null;
    const notes = notesFaibles(
      q.noteGlobale !== undefined
        ? [{ libelle: "note globale", valeur: q.noteGlobale, sur: 5 }]
        : [],
    );
    if (notes.length === 0) return null;

    const etat = await lireInterrupteurReclamations();
    if (etat === "eteint") return null;

    const inscription = await prisma.enrollment.findUnique({
      where: { id: q.enrollmentId },
      select: {
        estTestInterne: true,
        session: { select: { id: true, estTestInterne: true } },
      },
    });
    if (inscription === null) return null;
    const deTest = inscription.estTestInterne || inscription.session.estTestInterne;
    if (!estActifPour(etat, { estTestInterne: deTest })) return null;

    const plusBasse = Math.min(...notes.map((n) => n.valeur));
    const incident = await creerIncident({
      type: "pedagogique",
      gravite: plusBasse <= 1 ? "majeur" : "mineur",
      titre: `Examen : note de ${plusBasse}/5 — ${LIBELLE_TYPE[q.type] ?? q.type}`,
      description: `Questionnaire ${q.questionnaireId}.`,
      sessionId: inscription.session.id,
      dateIncident: new Date(),
      nature: "difficulte",
      origine: "questionnaire",
      declarant: q.type === "satisfaction_entreprise" ? "entreprise" : "stagiaire",
      declareParId: null,
      noteOuverture: {
        texte: texteOuvertureExamen({ type: q.type, notes, origine: q.origine ?? null }),
        auteur: AUTEUR_EXAMEN_AUTOMATIQUE,
      },
    });
    return incident.id;
  } catch (err) {
    console.error(
      `[examen-note-faible] examen NON ouvert (questionnaire ${q.questionnaireId}) — à ouvrir à la main :`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
