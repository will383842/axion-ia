/**
 * L09 — l'interrupteur `qualiopi.reclamations.actif` et ce qu'il gouverne.
 *
 *   - `eteint` (défaut, clé absente) : le formulaire public est fermé, aucun
 *     accusé automatique, aucun examen ouvert par une note faible, et le
 *     registre des réclamations se comporte exactement comme avant ;
 *   - `essai` : le cycle ne vaut que pour les réclamations rattachées à une
 *     inscription (ou une session) du banc d'essai (ADR 0061) ;
 *   - `actif` : pour tous.
 *
 * ⚠️ Hors interrupteur, et c'est voulu : un incident ne se supprime plus et ne
 * se réécrit plus (règle « rien ne s'efface », pas une fonctionnalité).
 */

import { prisma } from "@/lib/prisma";
import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";

export const LOT_RECLAMATIONS = "reclamations" as const;

export function lireInterrupteurReclamations(): Promise<EtatInterrupteur> {
  return lireInterrupteurQualiopi(LOT_RECLAMATIONS);
}

/** L'inscription est-elle du banc d'essai (elle, ou sa session) ? Faux si introuvable. */
export async function inscriptionDeTest(enrollmentId: string | null): Promise<boolean> {
  if (enrollmentId === null) return false;
  try {
    const e = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { estTestInterne: true, session: { select: { estTestInterne: true } } },
    });
    return e !== null && (e.estTestInterne || e.session.estTestInterne);
  } catch {
    return false;
  }
}

/** Le cycle L09 s'applique-t-il à CETTE réclamation ? */
export async function cycleActifPour(
  reclamation: { readonly enrollmentId: string | null },
  etat?: EtatInterrupteur,
): Promise<boolean> {
  const e = etat ?? (await lireInterrupteurReclamations());
  if (e === "eteint") return false;
  if (e === "actif") return true;
  return estActifPour(e, { estTestInterne: await inscriptionDeTest(reclamation.enrollmentId) });
}
