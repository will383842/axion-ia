/**
 * « Ce projet appartient-il à ce client, et n'a-t-il pas été fusionné
 * ailleurs ? » — la règle UNIQUE, lue par le devis ouvert depuis un projet
 * (`server/qualiopi/crm/devis-projet.ts`, qui la réexporte) et par le
 * questionnaire de cadrage (`server/visio/gestes-suivi.ts`).
 *
 * Elle vit dans le dossier client (le projet en est une pièce), pas dans le
 * domaine Qualiopi : le circuit visio la lit sans importer ce domaine
 * (cloisonnement, `scripts/qualiopi/isolation-check.ts`).
 */

import type { PrismaClient } from "../../../prisma/generated/client";

/** Le projet existe, appartient à ce client, et n'a pas été fusionné ailleurs. */
export async function projetOuvrableDuClient(
  db: Pick<PrismaClient, "projet">,
  projetId: string,
  clientId: string,
): Promise<boolean> {
  const p = await db.projet.findUnique({
    where: { id: projetId },
    select: { clientId: true, fusionneDansId: true },
  });
  return p !== null && p.clientId === clientId && p.fusionneDansId === null;
}
