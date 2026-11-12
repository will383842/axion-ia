/**
 * Interrupteur de l'assistant de création de devis : `qualiopi.devis_assistant.actif`.
 * Lu À L'APPEL (jamais au chargement du module). Clé absente = éteint.
 */
import { estActifPour, lireInterrupteurQualiopi } from "../socle/interrupteurs";

export const LOT_DEVIS_ASSISTANT = "devis_assistant";

type ClientLecture = Parameters<typeof lireInterrupteurQualiopi>[1];

/** L'assistant agit-il ? `cible` : la session d'essai éventuelle (état « essai »). */
export async function assistantDevisActif(
  client?: ClientLecture,
  cible: { readonly estTestInterne: boolean } | null = null,
): Promise<boolean> {
  const etat = await lireInterrupteurQualiopi(LOT_DEVIS_ASSISTANT, client);
  return estActifPour(etat, cible);
}
