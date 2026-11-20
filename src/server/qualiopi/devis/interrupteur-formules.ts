/**
 * Interrupteur du devis à formules : `qualiopi.devis_formules.actif`.
 * Lu À L'APPEL (jamais au chargement du module). Clé absente = éteint.
 *
 * 🔴 La CIBLE est OBLIGATOIRE. Avant, l'appel sans argument ne portait aucune cible, et
 * `estActifPour("essai", null)` vaut faux : en mode « Essai », les formules étaient coupées
 * même pour une fiche d'essai (`ClientTestInterne`). Une cible oblige chaque appelant à dire
 * POUR QUI il pose la question :
 *   · `{ clientId }`        : le client du devis (nul = pas de client connu → faux en essai) ;
 *   · `{ estTestInterne }`  : le booléen est déjà connu de l'appelant ;
 *   · `{ console: true }`   : écran sans client (bibliothèque) → vrai dès que l'état n'est pas éteint.
 * La fiche d'essai n'est lue QUE si l'état est « essai » ; une erreur de lecture vaut faux.
 */
import { prisma } from "@/lib/prisma";

import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "../socle/interrupteurs";

export const LOT_DEVIS_FORMULES = "devis_formules";

type ClientLecture = Parameters<typeof lireInterrupteurQualiopi>[1];

/** Un client (ou une transaction) capable de dire si un client est une fiche d'essai. */
export type ClientEssai = {
  clientTestInterne: Pick<typeof prisma.clientTestInterne, "findUnique">;
};

export type CibleFormules =
  | { readonly estTestInterne: boolean }
  | { readonly clientId: string | null; readonly tx?: ClientEssai }
  | { readonly console: true };

/** Pure : l'état de l'interrupteur + « fiche d'essai ? » → les formules agissent-elles ? */
export function formulesActivesPourEtat(etat: EtatInterrupteur, ficheEssai: boolean): boolean {
  return estActifPour(etat, { estTestInterne: ficheEssai });
}

async function ficheEssai(clientId: string | null, tx?: ClientEssai): Promise<boolean> {
  if (clientId === null) return false;
  try {
    const db: ClientEssai = tx ?? prisma;
    const l = await db.clientTestInterne.findUnique({
      where: { clientId },
      select: { clientId: true },
    });
    return l !== null && l !== undefined;
  } catch {
    return false;
  }
}

/** Les formules agissent-elles pour cette cible ? Ne lève jamais. */
export async function formulesActives(
  client: ClientLecture | undefined,
  cible: CibleFormules,
): Promise<boolean> {
  const etat = await lireInterrupteurQualiopi(LOT_DEVIS_FORMULES, client);
  if (etat === "eteint") return false;
  if ("console" in cible) return true;
  if ("estTestInterne" in cible) return formulesActivesPourEtat(etat, cible.estTestInterne);
  if (etat === "actif") return true;
  return formulesActivesPourEtat(etat, await ficheEssai(cible.clientId, cible.tx));
}
