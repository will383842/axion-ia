/**
 * Tour France IA : les gestes de l'équipe sur une demande (PR-2a).
 *
 * Un geste CHANGE UN STATUT, rien d'autre : « J'ai relancé », « Écarter », « Remettre en attente ».
 * Il n'existe AUCUN geste de suppression (garde `statuts.spec.ts` : aucune suppression de ligne dans
 * ce dossier). Une demande effacée à la demande de la personne (`effacee_rgpd`) ne change plus
 * de statut. Chaque changement laisse une trace `ActivityLog`, dans la même transaction.
 *
 * Module neutre (ni session ni Next) : la garde de rôle est dans `statuts.ts`, qui l'appelle.
 */

import { prisma } from "@/lib/prisma";
import type { StatutDemande } from "./types";

export const ACTION_STATUT_DEMANDE = "tour_demande.statut_change";

/** Les statuts qu'un geste de l'équipe peut poser. */
export type StatutGeste = Exclude<StatutDemande, "effacee_rgpd">;

export type IssueGeste = "ok" | "inchange" | "introuvable" | "efface";

export async function changerStatutDemande(
  id: string,
  vers: StatutGeste,
  parId: string | null,
): Promise<IssueGeste> {
  return prisma.$transaction(async (tx): Promise<IssueGeste> => {
    const d = await tx.tourDemande.findUnique({ where: { id }, select: { statut: true } });
    if (d === null) return "introuvable";
    if (d.statut === "effacee_rgpd") return "efface";
    if (d.statut === vers) return "inchange";
    await tx.tourDemande.update({
      where: { id },
      data: { statut: vers, statutChangeLe: new Date(), statutChangeParId: parId },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: parId,
        action: ACTION_STATUT_DEMANDE,
        targetType: "TourDemande",
        targetId: id,
        changes: { de: d.statut, vers },
      },
    });
    return "ok";
  });
}
