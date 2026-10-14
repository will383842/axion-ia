/**
 * Peut-on confier CETTE session à CE formateur, aujourd'hui ? (lots L11b et
 * L11h ; T3, T15).
 *
 * UNE seule évaluation, lue par les trois endroits qui en dépendent :
 *   - les cartes de choix (une carte grisée l'est par elle, avec ses raisons) ;
 *   - l'action qui enregistre le choix (elle relit la même évaluation) ;
 *   - le moteur du rang suivant (un rang devenu inéligible est sauté).
 *
 * Dans l'ordre : fiche active et habilitée sur la formation (`isTrainerHabilite`,
 * la garde de l'affectation), garde de mission (`controlerGardeMission` : son
 * interrupteur décide du mode, coupée elle ne refuse rien), puis le double
 * emploi (`constaterDoubleEmploi`, comme l'affectation : une lecture du planning
 * en échec ne bloque pas).
 *
 * Module NEUTRE (Prisma seulement) : le worker le charge.
 */

import { prisma } from "@/lib/prisma";
import type { PlanningStatut } from "@/features/admin-planning/types";
import { constaterDoubleEmploi } from "@/server/qualiopi/trainers/double-emploi";
import { isTrainerHabilite } from "@/server/qualiopi/trainers/trainers";

import { raison, raisonGarde, type Raison } from "./choix-formateur";
import { controlerGardeMission } from "./garde-mission-portes";

export interface SessionAEvaluer {
  readonly id: string;
  readonly formationId: string;
  readonly dateDebut: Date;
  readonly dateFin: Date | null;
  readonly statut: string;
}

export interface EvaluationAffectation {
  /** Vide : l'affectation est permise. */
  readonly refus: ReadonlyArray<Raison>;
  readonly avertissements: ReadonlyArray<string>;
}

function codeHabilitation(texte: string): "inactif" | "non_verifie" | "non_habilite" {
  if (/inactif/i.test(texte)) return "inactif";
  if (/non vérifié/i.test(texte)) return "non_verifie";
  return "non_habilite";
}

/** Ne lève jamais : une lecture impossible refuse (`erreur`). */
export async function evaluerAffectation(
  trainerId: string,
  session: SessionAEvaluer,
  maintenant: Date,
): Promise<EvaluationAffectation> {
  try {
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        actif: true,
        statut: true,
        sousTraitantVerifieAt: true,
        finCollaborationAt: true, // lot C4 : collaboration terminée = non affectable
        habilitations: { where: { retireAt: null }, select: { formationId: true } },
      },
    });
    if (trainer === null) {
      return { refus: [raison("erreur", "Formateur introuvable.")], avertissements: [] };
    }
    const habilitation = isTrainerHabilite(
      { ...trainer, formationIdsHabilites: trainer.habilitations.map((h) => h.formationId) },
      session.formationId,
    );
    if (!habilitation.ok) {
      const texte = habilitation.raison ?? "Formateur non habilité sur cette formation.";
      return { refus: [raison(codeHabilitation(texte), texte)], avertissements: [] };
    }
    const garde = await controlerGardeMission(trainerId, maintenant);
    if (garde.refus.length > 0) {
      return { refus: garde.refus.map(raisonGarde), avertissements: [] };
    }
    let conflit: string | null = null;
    try {
      conflit = await constaterDoubleEmploi(trainerId, {
        key: `formation:${session.id}`,
        debut: session.dateDebut,
        fin: session.dateFin,
        statut: session.statut as PlanningStatut,
      });
    } catch {
      // Même règle que l'affectation : un planning illisible ne bloque pas.
      conflit = null;
    }
    if (conflit !== null) {
      const texte = conflit.charAt(0).toUpperCase() + conflit.slice(1);
      return { refus: [raison("double_emploi", texte)], avertissements: garde.avertissements };
    }
    return { refus: [], avertissements: garde.avertissements };
  } catch {
    return {
      refus: [raison("erreur", "Le contrôle du formateur n'a pas pu aboutir.")],
      avertissements: [],
    };
  }
}
