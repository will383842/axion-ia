/**
 * Interrupteur du devis à formules : `qualiopi.devis_formules.actif`.
 * Lu À L'APPEL (jamais au chargement du module). Clé absente = éteint.
 */
import { estActifPour, lireInterrupteurQualiopi } from "../socle/interrupteurs";

export const LOT_DEVIS_FORMULES = "devis_formules";

type ClientLecture = Parameters<typeof lireInterrupteurQualiopi>[1];

/** Les formules agissent-elles ? `cible` : la session d'essai éventuelle (état « essai »). */
export async function formulesActives(
  client?: ClientLecture,
  cible: { readonly estTestInterne: boolean } | null = null,
): Promise<boolean> {
  const etat = await lireInterrupteurQualiopi(LOT_DEVIS_FORMULES, client);
  return estActifPour(etat, cible);
}
