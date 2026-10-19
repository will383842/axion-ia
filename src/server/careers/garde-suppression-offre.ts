/**
 * LOT P15 (CH4-38) — une offre qui porte des candidatures s'archive, elle ne
 * se supprime pas. Interrupteur `qualiopi.documents_organisme.actif`, lu par
 * la constante `LOT_DOCUMENTS_ORGANISME` ; seul `actif` agit (une offre ne
 * porte aucune session, donc `essai` n'agit pas). Éteint : rien n'est lu en
 * plus, la suppression se comporte comme avant.
 *
 * Module à part : `actions.ts` est un fichier « use server », qui ne peut
 * exporter que des actions.
 */

import { prisma } from "@/lib/prisma";
import { LOT_DOCUMENTS_ORGANISME } from "@/server/documents-organisme/documents-organisme-pur";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

/** Le refus affiché à la personne qui tente de supprimer. */
export function messageRefusSuppression(candidatures: number): string {
  return `Archivez l'offre : elle porte ${candidatures} candidature${candidatures > 1 ? "s" : ""}.`;
}

/** La suppression est-elle refusée ? Ne lève jamais (erreur de lecture = éteint). */
export async function suppressionRefusee(candidatures: number): Promise<boolean> {
  if (candidatures <= 0) return false;
  return estActifPour(await lireInterrupteurQualiopi(LOT_DOCUMENTS_ORGANISME), null);
}

/** Pour l'écran : « Supprimer » doit-il être masqué pour cette offre ? */
export async function masquerSupprimer(offerId: string): Promise<boolean> {
  try {
    const n = await prisma.jobApplication.count({ where: { offerId } });
    return await suppressionRefusee(n);
  } catch {
    return false;
  }
}
