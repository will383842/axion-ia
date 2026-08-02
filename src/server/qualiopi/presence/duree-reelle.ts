/**
 * Qualiopi — Durée RÉELLE d'une session collective, figée à la clôture.
 *
 * 🔴 `TrainingSession.dureeReelleHeures` n'avait AUCUN écrivain côté collectif :
 * seule la clôture AFEST 1-to-1 (`attestation-1to1.ts`) la renseignait, en se
 * décrivant elle-même comme « écrivain unique ». Pour une session collective la
 * colonne restait donc nulle indéfiniment, alors que les horaires étaient
 * déclarés dans `session_jours` depuis la création. Conséquences constatées sur
 * la première session réelle (`AXI-SESS-2026-003`, clôturée le 2026-08-01) :
 *   - la fiche session et la page d'émargement affichent « — h » ;
 *   - le certificat de réalisation (R.6313-3) sort sans durée ;
 *   - la ventilation horaire OPCO est refusée pour « durée réelle non
 *     renseignée » — sur une session dont les horaires étaient pourtant connus.
 *
 * La clôture manuelle (`sessions.ts`) et la clôture automatique J+24 h
 * (`qualiopi-formation-crons-worker.ts`) DOIVENT appeler ce module toutes les
 * deux : leurs gardes d'émargement portent déjà la consigne de rester alignées,
 * et une durée écrite d'un seul côté rouvrirait exactement le même écart.
 */

import { prisma } from "@/lib/prisma";
import { heuresReellesDepuisJournees } from "./jours-defaut";

/**
 * Durée à écrire au passage en « réalisée », ou `null` s'il n'y a rien à écrire.
 *
 * Rend `null` dans deux cas, et la distinction compte :
 *   - une durée a DÉJÀ été saisie → on n'écrase jamais une constatation humaine ;
 *   - aucune journée n'est déclarée → on ne substitue PAS la durée prévue au
 *     catalogue. Une durée prévue n'est pas une durée constatée, et l'écrire
 *     dans une colonne nommée « réelle » la ferait passer pour telle sur une
 *     attestation.
 *
 * Ne lève jamais : une durée non calculée ne doit pas empêcher de clôturer.
 */
export async function resoudreDureeReelleACloture(sessionId: string): Promise<number | null> {
  try {
    const courante = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { dureeReelleHeures: true },
    });
    if (courante?.dureeReelleHeures != null) return null;

    const jours = await prisma.sessionJour.findMany({
      where: { sessionId },
      select: { heureDebut: true, heureFin: true },
      orderBy: { date: "asc" },
    });
    return heuresReellesDepuisJournees(jours);
  } catch {
    return null;
  }
}
