/**
 * Chantier QNC, lot L04 — l'adaptation automatique s'applique-t-elle à CETTE
 * inscription ? Interrupteur `qualiopi.adaptation.actif`.
 *
 *   - `eteint` : non, et AUCUNE requête n'est faite sur les colonnes du socle
 *     (`est_test_interne`) — pendant l'heure où le worker précède la migration
 *     de l'app, un lot éteint ne doit rien lire de neuf ;
 *   - `essai`  : seulement si la session OU l'inscription est du banc d'essai ;
 *   - `actif`  : oui.
 *
 * ⚠️ Atteint par le WORKER : aucun import `server-only`, Next ni Server Action.
 */

import { prisma } from "@/lib/prisma";
import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";

export const LOT_ADAPTATION = "adaptation";

export async function etatAdaptation(): Promise<EtatInterrupteur> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return "eteint";
  return lireInterrupteurQualiopi(LOT_ADAPTATION);
}

/** Pure : la cible d'essai d'une inscription — la sienne ou celle de sa session. */
export function cibleEssai(
  inscription: { readonly estTestInterne: boolean },
  session: { readonly estTestInterne: boolean },
): { estTestInterne: boolean } {
  return { estTestInterne: inscription.estTestInterne || session.estTestInterne };
}

export async function adaptationAutomatiquePourInscription(
  enrollmentId: string,
  etat?: EtatInterrupteur,
): Promise<boolean> {
  const e = etat ?? (await etatAdaptation());
  if (e === "eteint") return false;
  if (e === "actif") return true;
  const ligne = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { estTestInterne: true, session: { select: { estTestInterne: true } } },
  });
  return ligne !== null && estActifPour(e, cibleEssai(ligne, ligne.session));
}
