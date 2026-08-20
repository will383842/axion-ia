/**
 * « Ce formateur intervient-il sur cette session ? »
 *
 * ## Pourquoi ce module existe
 *
 * 🔴 `D4-1-C` (2026-08-20). Cette règle vivait en DOUBLE, recopiée au caractère
 * près dans `actions/qualiopi/emargement-formateur.ts` et
 * `actions/qualiopi/releve-signature.ts`. Une troisième surface en avait besoin
 * — la saisie de l'évaluation des acquis — et le réflexe aurait été d'en faire
 * une troisième copie.
 *
 * 🔑 Un prédicat d'autorisation recopié DIVERGE. Ce dépôt l'a payé quatre fois
 * le même jour : `enAttente()` (une alerte critique par nuit sur des pièces
 * annulées), `pieceAdmissibleAuDossier()` (trois recopies), `filtreMemePiece`
 * (deux contrats originaux concurrents), `estMandataireDeLaLettre`. Et la copie
 * qui diverge est **toujours** celle qui autorise trop.
 *
 * ## Ce que la règle dit, et ce qu'elle ne dit pas
 *
 * Elle répond « intervient sur cette session » — principal OU co-formateur.
 *
 * ⚠️ Ce n'est PAS la règle de la lettre de mission. Celle-là nomme UN formateur,
 * et seul le mandataire nommé peut la signer (`estMandataireDeLaLettre`). Les
 * deux règles se ressemblent et ne doivent surtout pas être confondues :
 * l'appartenance ouvre les actes COLLECTIFS de la session (émarger le groupe,
 * viser le relevé, évaluer les stagiaires), le mandat ouvre un acte NOMINATIF.
 */

import { prisma } from "@/lib/prisma";
import { resoudreAppartenance, type RoleFormateur } from "./session-membership";

/**
 * @param sessionId la session de formation.
 * @param trainerId le formateur authentifié.
 * @returns `false` si la session n'existe pas — jamais une autorisation par
 *          défaut : une session introuvable n'ouvre aucun droit.
 */
export async function estMembreDeSession(sessionId: string, trainerId: string): Promise<boolean> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      formateurPrincipalId: true,
      sessionFormateurs: { where: { trainerId }, select: { role: true } },
    },
  });
  if (session === null) return false;
  return resoudreAppartenance({
    estPrincipalFk: session.formateurPrincipalId === trainerId,
    roleSessionFormateur: (session.sessionFormateurs[0]?.role as RoleFormateur | undefined) ?? null,
  }).estMembre;
}
