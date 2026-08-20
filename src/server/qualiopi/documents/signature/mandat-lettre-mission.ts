/**
 * « Cette lettre de mission est-elle CELLE de ce formateur ? »
 *
 * ## Pourquoi ce module existe
 *
 * 🔴 `D4-1-A` (2026-08-20). La règle vivait à l'intérieur de
 * `signerLettreMissionFormateurAction`, en variable locale. Elle devient
 * partagée parce qu'une seconde surface en a besoin : le formateur doit pouvoir
 * **lire** la lettre avant de la signer, et l'habilitation de lecture est
 * exactement celle de signature — ni plus large, ni plus étroite.
 *
 * 🔑 Extraite, pas recopiée. Deux copies d'une règle d'autorisation divergent au
 * premier cas particulier, et la moitié qui diverge est toujours celle qui
 * autorise trop. Ce dépôt l'a payé le même jour sur deux autres prédicats —
 * `enAttente()` (constat `D3-4-06`, une alerte critique par nuit) et
 * `pieceAdmissibleAuDossier()` (constat `D2-5-12`, trois recopies).
 *
 * ## La règle, et son invariant
 *
 * L'ancre directe `trainerId` PRIME quand elle existe (pièces émises depuis le
 * 2026-08-01, lettres-CADRE comprises — qui n'ont aucune session) : c'est le
 * rattachement que le générateur a posé en imprimant le nom. Le détour par la
 * session ne subsiste que pour les lettres legacy dépourvues d'ancre.
 *
 * 🔴 Le résolveur de session est celui du GÉNÉRATEUR
 * (`resolvePrincipalTrainerId`), et c'est l'invariant : c'est lui qui a imprimé
 * `data.formateur.nomPrenom` sur la pièce. Toute autre règle — l'appartenance à
 * la session, une lecture directe de la FK sans le repli Json — autoriserait un
 * jour quelqu'un que la lettre ne nomme pas, ou refuserait celui qu'elle nomme
 * sur une session legacy.
 *
 * ⚠️ Aucun formateur résolvable ⇒ REFUS pour tout le monde, et c'est voulu :
 * dans ce cas le générateur a imprimé la raison sociale de l'organisme à la
 * place d'un nom. La pièce ne mandate personne d'identifiable — elle doit être
 * régénérée, ni lue à ce titre, ni signée.
 */

import { prisma } from "@/lib/prisma";
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";

/** Ce que la règle a besoin de connaître de la pièce. */
export interface AncragePiece {
  /** Ancre directe posée par le générateur depuis le 2026-08-01. */
  trainerId: string | null;
  /** Session de rattachement — absente sur une lettre-CADRE. */
  sessionId: string | null;
}

/**
 * Ce formateur est-il celui que la lettre NOMME ?
 *
 * @param piece l'ancrage de la pièce, tel que lu en base.
 * @param trainerId le formateur authentifié.
 */
export async function estMandataireDeLaLettre(
  piece: AncragePiece,
  trainerId: string,
): Promise<boolean> {
  if (piece.trainerId != null) return piece.trainerId === trainerId;
  if (piece.sessionId == null) return false;

  const session = await prisma.trainingSession.findUnique({
    where: { id: piece.sessionId },
    select: { formateurPrincipalId: true, coFormateurs: true },
  });
  if (session === null) return false;

  const principal = resolvePrincipalTrainerId({
    formateurPrincipalId: session.formateurPrincipalId,
    coFormateurs: session.coFormateurs,
  });
  return principal !== null && principal === trainerId;
}
