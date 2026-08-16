/**
 * À quel MOMENT un questionnaire doit-il apparaître au bénéficiaire ?
 *
 * ## Le défaut que ce module ferme
 *
 * 🔴 Constaté par Will le 16/08/2026, sur l'espace d'une stagiaire réelle, la
 * nuit précédant sa formation. Son portail proposait les TROIS questionnaires à
 * la fois, dont :
 *
 *   - « **Votre retour à chaud, pendant que la formation est encore fraîche** » —
 *     pour une formation qui n'avait pas commencé ;
 *   - « **Quelques semaines après** : ce que la formation vous a réellement
 *     apporté, avec du recul » — le même soir.
 *
 * La sélection ne portait que sur `reponduAt === null` : aucune condition de
 * date, aucune condition de statut de session.
 *
 * ## Pourquoi ce n'est pas qu'une gêne d'affichage
 *
 * Une satisfaction « à chaud » recueillie AVANT l'action n'évalue pas l'action.
 * Elle produit une réponse datée, stockée, comptée dans l'indicateur 30 — et
 * l'indicateur 30 ne vaut que par la sincérité de ce qu'il agrège. Proposer à
 * quelqu'un de noter une formation qu'il n'a pas suivie, c'est fabriquer une
 * appréciation. Le système ne doit pas rendre ce geste possible.
 *
 * ⚠️ Ce module DÉCIDE de la visibilité, il ne supprime rien : le questionnaire
 * existe, il est simplement présenté quand il a un sens. Un stagiaire qui a
 * répondu garde sa réponse, et l'administration conserve la vue complète depuis
 * la console.
 */

import type { QuestionnaireType } from "../../../../prisma/generated/client";

/** Délai après lequel la satisfaction « à froid » a du sens (jalon J+30). */
export const DELAI_SATISFACTION_FROID_JOURS = 30;

/** Ce dont la décision a besoin — volontairement minimal et sérialisable. */
export interface MomentQuestionnaire {
  type: QuestionnaireType;
  reponduAt: Date | null;
  /** Début de la session rattachée. `null` si l'inscription n'en porte pas. */
  sessionDateDebut: Date | null;
  /** Fin de la session. `null` → on retombe sur `sessionDateDebut`. */
  sessionDateFin: Date | null;
  /** Statut de la session (`planifiee`, `en_cours`, `realisee`, `annulee`, `reportee`). */
  sessionStatut: string | null;
}

/** Statuts pour lesquels plus aucun questionnaire n'a d'objet. */
const STATUTS_SANS_OBJET = new Set(["annulee", "reportee"]);

/**
 * Ce questionnaire doit-il être proposé au bénéficiaire MAINTENANT ?
 *
 * Règles, une par type :
 *
 * | Type | Visible |
 * |---|---|
 * | `positionnement` | jusqu'à la FIN de la session — il sert à préparer, et se rattrape encore à l'ouverture |
 * | `satisfaction_chaud` | à partir de la fin de la session |
 * | `satisfaction_froid` | à partir de la fin + 30 jours |
 *
 * ⚠️ **Sans date de session, on AFFICHE.** C'est délibéré : le défaut de donnée
 * ne doit pas faire disparaître une action attendue du bénéficiaire. Masquer
 * « faute de savoir » transformerait un trou de données en questionnaire jamais
 * rempli — et personne ne s'en apercevrait, puisque rien ne s'afficherait.
 */
export function questionnaireEstDu(q: MomentQuestionnaire, maintenant: Date): boolean {
  if (q.reponduAt !== null) return false;
  if (q.sessionStatut !== null && STATUTS_SANS_OBJET.has(q.sessionStatut)) return false;

  const fin = q.sessionDateFin ?? q.sessionDateDebut;
  // Aucune date exploitable : on montre, plutôt que de masquer en silence.
  if (fin === null) return true;

  switch (q.type) {
    case "satisfaction_chaud":
      return maintenant.getTime() >= fin.getTime();

    case "satisfaction_froid":
      return (
        maintenant.getTime() >= fin.getTime() + DELAI_SATISFACTION_FROID_JOURS * 24 * 60 * 60 * 1000
      );

    default:
      // `positionnement` — il prépare l'action ; il n'a plus d'objet une fois
      // l'action terminée. On le laisse jusqu'à la fin pour couvrir le
      // rattrapage à l'ouverture de séance, qui est un usage réel et légitime.
      return maintenant.getTime() < fin.getTime();
  }
}

/**
 * Motif d'attente, pour l'écran d'administration.
 *
 * Un questionnaire masqué au stagiaire ne doit PAS être invisible à
 * l'organisme : sinon on ne saurait plus qu'il existe, et on croirait à un
 * oubli. La console garde la vue complète, avec cette explication.
 */
export function motifNonPropose(q: MomentQuestionnaire, maintenant: Date): string | null {
  if (questionnaireEstDu(q, maintenant)) return null;
  if (q.reponduAt !== null) return "Déjà rempli.";
  if (q.sessionStatut !== null && STATUTS_SANS_OBJET.has(q.sessionStatut)) {
    return `Session ${q.sessionStatut} : le questionnaire n'a plus d'objet.`;
  }
  const fin = q.sessionDateFin ?? q.sessionDateDebut;
  if (fin === null) return null;

  if (q.type === "satisfaction_chaud") {
    return "Proposé au stagiaire à la fin de la session — évaluer une formation non suivie n'évalue rien.";
  }
  if (q.type === "satisfaction_froid") {
    const jalon = new Date(fin.getTime() + DELAI_SATISFACTION_FROID_JOURS * 24 * 60 * 60 * 1000);
    return `Proposé au stagiaire à partir du ${jalon.toLocaleDateString("fr-FR")} (J+${DELAI_SATISFACTION_FROID_JOURS}).`;
  }
  return "La session est terminée : le positionnement n'a plus d'objet.";
}
