/**
 * L09 — règle d'alerte : les ÉCHÉANCES d'une réclamation, en jours ouvrés.
 *
 * Trois codes, balayés à chaque passage de l'évaluateur (`resolutionAuto`) :
 *   - `reclamation_accuse_en_retard`        : pas d'accusé après 5 jours ouvrés ;
 *   - `reclamation_reponse_echeance_proche` : 3 jours ouvrés ou moins avant la
 *                                             réponse due ;
 *   - `reclamation_reponse_en_retard`       : réponse due dépassée.
 *
 * Ne lit que les réclamations du cycle L09 (interrupteur `actif`, ou `essai`
 * pour le banc d'essai). Éteint : la règle ne lit même pas la table, et seule
 * l'alerte historique `reclamation_sans_reponse_j15` (jours calendaires) parle.
 *
 * Le message ne nomme personne : le numéro suffit à ouvrir la fiche.
 *
 * Module séparé de `evaluateur.ts` pour être testé sans monter ses dépendances.
 */

import { prisma } from "@/lib/prisma";
import type { AlerteNiveau } from "../../../../prisma/generated/client";
import {
  cycleActifPour,
  lireInterrupteurReclamations,
} from "@/server/qualiopi/reclamations/interrupteur";
import { dateLisibleParis, etatEcheances } from "@/server/qualiopi/reclamations/echeances";

export const CODE_ACCUSE_EN_RETARD = "reclamation_accuse_en_retard";
export const CODE_REPONSE_PROCHE = "reclamation_reponse_echeance_proche";
export const CODE_REPONSE_EN_RETARD = "reclamation_reponse_en_retard";

export const TITRES_ECHEANCES: Readonly<Record<string, string>> = {
  [CODE_ACCUSE_EN_RETARD]: "Réclamation sans accusé de réception après 5 jours ouvrés",
  [CODE_REPONSE_PROCHE]: "Réclamation : réponse écrite due dans 3 jours ouvrés ou moins",
  [CODE_REPONSE_EN_RETARD]: "Réclamation : échéance de réponse (15 jours ouvrés) dépassée",
};

/** Même forme que `AlerteCandidate` d'`evaluateur.ts` — sans l'importer (cycle). */
export interface CandidateEcheanceReclamation {
  code: string;
  niveau: AlerteNiveau;
  titre: string;
  message: string;
  cibleType: "Reclamation";
  cibleId: string;
}

export async function regleEcheancesReclamations(
  now: Date,
): Promise<CandidateEcheanceReclamation[]> {
  const etat = await lireInterrupteurReclamations();
  if (etat === "eteint") return [];

  const reclamations = await prisma.reclamation.findMany({
    where: { statut: { in: ["nouvelle", "en_cours"] } },
    select: {
      id: true,
      numero: true,
      enrollmentId: true,
      dateReception: true,
      etapes: { select: { etape: true, creeLe: true }, orderBy: { creeLe: "asc" } },
    },
  });

  const out: CandidateEcheanceReclamation[] = [];
  for (const r of reclamations) {
    // Une réclamation antérieure au cycle n'a pas d'étapes : l'alerte J+15
    // historique la couvre déjà.
    if (r.etapes.length === 0) continue;
    if (
      !(await cycleActifPour(
        { ...r, aUneReception: r.etapes.some((x) => x.etape === "reception") },
        etat,
      ))
    )
      continue;
    const e = etatEcheances(r.dateReception, r.etapes, now);
    if (e.accuse === "depassee") {
      out.push({
        code: "reclamation_accuse_en_retard",
        niveau: "critique",
        titre: TITRES_ECHEANCES[CODE_ACCUSE_EN_RETARD] as string,
        message:
          `La réclamation ${r.numero} n'a pas d'accusé de réception consigné ; ` +
          `il était dû au plus tard le ${dateLisibleParis(e.accuseAvant)}. ` +
          `Consignez l'accusé remis (e-mail, courrier, téléphone) dans son suivi.`,
        cibleType: "Reclamation",
        cibleId: r.id,
      });
    }
    if (e.reponse === "proche" || e.reponse === "depassee") {
      const message =
        `La réponse écrite à la réclamation ${r.numero} est due au plus tard le ` +
        `${dateLisibleParis(e.reponseAvant)}` +
        (e.reponse === "depassee" ? " : l'échéance est dépassée." : ".") +
        ` Rédigez-la et signez-la dans son suivi ; elle partira après validation.`;
      out.push(
        e.reponse === "proche"
          ? {
              code: "reclamation_reponse_echeance_proche",
              niveau: "important",
              titre: TITRES_ECHEANCES[CODE_REPONSE_PROCHE] as string,
              message,
              cibleType: "Reclamation",
              cibleId: r.id,
            }
          : {
              code: "reclamation_reponse_en_retard",
              niveau: "critique",
              titre: TITRES_ECHEANCES[CODE_REPONSE_EN_RETARD] as string,
              message,
              cibleType: "Reclamation",
              cibleId: r.id,
            },
      );
    }
  }
  return out;
}
