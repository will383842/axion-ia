/**
 * Chantier QNC, lot L05 — l'interrupteur `qualiopi.convocation_v2.actif`.
 *
 *   - `eteint` : la convocation actuelle, inchangée — AUCUNE lecture des colonnes
 *     du socle (pendant l'heure où le worker précède la migration de l'app) ;
 *   - `essai`  : la v2 ne s'applique qu'aux inscriptions (ou sessions) du banc
 *     d'essai ; les autres gardent la convocation actuelle ;
 *   - `actif`  : la v2 s'applique à tous.
 *
 * Clé absente = éteint. Pas dans `QUALIOPI_CONFIG_REGISTRY`. Les bascules passent
 * par `basculerInterrupteurQualiopi` (réglage + `activity_logs` en une
 * transaction).
 *
 * Il n'y a PAS de réglage propre à la copie à l'entreprise (décision de Will,
 * 17/10 : le réglage `copie_entreprise` est supprimé) : la copie part dès que
 * ce réglage-ci s'applique à l'inscription (`actif`, ou `essai` sur le banc d'essai).
 *
 * ⚠️ Atteint par le WORKER : aucun import `server-only`, Next ni Server Action.
 */

import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";

export const LOT_CONVOCATION_V2 = "convocation_v2";

export async function etatConvocationV2(): Promise<EtatInterrupteur> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return "eteint";
  return lireInterrupteurQualiopi(LOT_CONVOCATION_V2);
}

/** Pure : la cible d'essai d'une inscription — la sienne ou celle de sa session. */
export function cibleEssaiConvocation(
  inscription: { readonly estTestInterne: boolean },
  session: { readonly estTestInterne: boolean },
): { estTestInterne: boolean } {
  return { estTestInterne: inscription.estTestInterne || session.estTestInterne };
}

/** Pure : la v2 s'applique-t-elle à cette cible, dans cet état ? */
export function convocationV2Applique(
  etat: EtatInterrupteur,
  cible: { readonly estTestInterne: boolean },
): boolean {
  return estActifPour(etat, cible);
}
