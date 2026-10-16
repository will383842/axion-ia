/**
 * Lot 8A — les RÉPONSES HUMAINES des formateurs, lues par le passage des campagnes (qui
 * décide) ET par le filet du départ (V2-P-2 : une réponse arrivée après l'enfilage retient
 * la relance déjà en file ou garée). Une seule lecture, donc une seule règle.
 *
 * Module neutre (ni `server-only`, ni Next, ni `queues.ts`) : il est sur le trajet du worker
 * d'e-mails.
 */

import { prisma } from "@/lib/prisma";

/**
 * Clé du payload d'une relance qui porte la date de son ENVOI DE DÉPART (ISO), posée par le
 * passage : le filet du départ y relit la réponse du formateur avec la même borne.
 */
export const CLE_DEPART_RELANCE = "departRelance";

/**
 * Lot 8A — réponses humaines rangées sur la fiche (`trainerId`) ou sur la candidature d'où
 * elle vient (`Trainer.candidatureId`). Interrupteur `formateurs.reponses_formateurs` coupé :
 * aucune réponse n'est rangée, donc rien n'est lu (carte vide, comportement d'avant).
 */
export async function reponsesFormateurs(
  trainerIds: readonly string[],
  depuis: Date,
): Promise<ReadonlyMap<string, readonly Date[]> | null> {
  const sortie = new Map<string, Date[]>();
  if (trainerIds.length === 0) return sortie;
  const { lireEtatsEntree } =
    await import("@/server/qualiopi/formateurs-independants/etats-entree");
  if (!(await lireEtatsEntree()).reponses_formateurs) return sortie;
  const ids = [...new Set(trainerIds)];
  try {
    const fiches = await prisma.trainer.findMany({
      where: { id: { in: ids }, candidatureId: { not: null } },
      select: { id: true, candidatureId: true },
    });
    const parCandidature = new Map(
      fiches.flatMap((f) => (f.candidatureId ? [[f.candidatureId, f.id] as const] : [])),
    );
    const lignes = await prisma.reponseEntranteFormateur.findMany({
      where: {
        auto: false,
        recuLe: { gte: depuis },
        OR: [{ trainerId: { in: ids } }, { candidatureId: { in: [...parCandidature.keys()] } }],
      },
      select: { trainerId: true, candidatureId: true, recuLe: true },
    });
    for (const l of lignes) {
      const fiche =
        l.trainerId ?? (l.candidatureId ? parCandidature.get(l.candidatureId) : undefined);
      if (!fiche) continue;
      sortie.set(fiche, [...(sortie.get(fiche) ?? []), l.recuLe]);
    }
    return sortie;
  } catch {
    return null;
  }
}
