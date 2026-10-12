/**
 * Formateurs indépendants — F39 « Facture rectifiée » (lot D2, M10 ; plan 08 §3).
 *
 * Part quand la NOUVELLE facture d'un désaccord accepté est émise (le relevé
 * réémis a été validé par un humain, puis l'autofacture établie par le chemin
 * existant). Trois numéros DISTINCTS : la facture d'origine, l'avoir qui
 * l'annule, la nouvelle facture. L'avoir et la nouvelle facture sont joints.
 *
 * Une fois par avoir (clé `formateur-facture-rectifiee-<avoir>`). Un avoir pas
 * encore numéroté l'est ici d'abord (idempotent). Ne lève jamais.
 */

import { prisma } from "@/lib/prisma";
import { documentPdfKey } from "@/lib/r2-storage";
import { emettrePieceAvoirMission } from "@/server/qualiopi/remuneration/autofacture-emission";

import { envoyer } from "../envois";

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export type IssueFactureRectifiee =
  | Awaited<ReturnType<typeof envoyer>>
  /** Pas une facture rectifiée (relevé mensuel, pièce sans remplacement…). */
  | "ignore"
  /** L'avoir n'a pas pu être numéroté : rien ne part, l'écran du relevé le dit. */
  | "avoir_sans_numero";

async function pieceJointe(documentId: string | null, nom: string) {
  if (documentId === null) return null;
  const doc = await prisma.documentGenere.findUnique({
    where: { id: documentId },
    select: { type: true, numero: true, createdAt: true },
  });
  return doc === null ? null : { filename: `${nom}.pdf`, r2Key: documentPdfKey(doc) };
}

export async function envoyerFactureRectifiee(nouvelleId: string): Promise<IssueFactureRectifiee> {
  try {
    const n = await prisma.trainerStatement.findUnique({
      where: { id: nouvelleId },
      select: {
        id: true,
        origine: true,
        trainerId: true,
        numeroFacture: true,
        autofactureDocumentId: true,
        echeanceAt: true,
        remplaceId: true,
        remplace: { select: { numeroFacture: true } },
        trainer: { select: { email: true, prenom: true } },
      },
    });
    if (
      n === null ||
      n.origine !== "passage_mission" ||
      n.remplaceId === null ||
      n.numeroFacture === null ||
      n.remplace?.numeroFacture == null
    ) {
      return "ignore";
    }
    const avoir = await prisma.trainerStatement.findFirst({
      where: { avoirDeId: n.remplaceId, statut: { not: "annule" } },
      select: { id: true },
    });
    if (avoir === null) return "ignore";
    const pieceAvoir = await emettrePieceAvoirMission(avoir.id);
    if (pieceAvoir === null) return "avoir_sans_numero";
    const jointes = (
      await Promise.all([
        pieceJointe(pieceAvoir.documentId, pieceAvoir.numero),
        pieceJointe(n.autofactureDocumentId, n.numeroFacture),
      ])
    ).filter((x): x is { filename: string; r2Key: string } => x !== null);
    return await envoyer({
      gabarit: "formateur-facture-rectifiee",
      destinataire: n.trainer.email,
      entityType: "Trainer",
      entityId: n.trainerId,
      jobId: `formateur-facture-rectifiee-${avoir.id}`,
      ...(jointes.length > 0 ? { attachments: jointes } : {}),
      payload: {
        prenom: n.trainer.prenom,
        valeurs: {
          numéro: n.remplace.numeroFacture,
          "numéro de l'avoir": pieceAvoir.numero,
          "numéro de la nouvelle facture": n.numeroFacture,
          date: n.echeanceAt === null ? null : DATE_LONGUE.format(n.echeanceAt),
        },
      },
    });
  } catch {
    return "indisponible";
  }
}
