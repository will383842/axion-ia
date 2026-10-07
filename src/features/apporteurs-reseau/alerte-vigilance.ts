/**
 * Réseau d'apporteurs — ALERTE INTERNE quand un apporteur dépose son attestation URSSAF ou son
 * extrait d'immatriculation (seuil de vigilance, art. 5.4 et 6.2).
 *
 * Sans elle, la pièce attend dans la console et les commissions bloquées avec elle. Le message
 * réutilise le gabarit d'alerte interne existant (`qualiopi-alerte-interne`) : aucun nouveau
 * gabarit. Une alerte par pièce déposée (clé « une fois » = id de la pièce), jamais de doublon.
 *
 * ⚠️ Tourne dans le WORKER : aucun `server-only`. Appelée par le passage quotidien ; le dépôt
 * lui-même peut l'appeler pour une alerte immédiate (`alerterPieceVigilance`).
 */

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";

import { dejaEnvoye } from "./commissions";
import { LIBELLE_PIECE, type TypePiece } from "./regles";
import { signalerErreurReseau } from "./signaler";

/** On ne signale que les dépôts récents : un vieux dépôt oublié n'est pas une alerte du jour. */
export const FENETRE_ALERTE_PIECE_JOURS = 30;

export function jobIdAlertePiece(pieceId: string): string {
  return `apporteur-piece-vigilance-alerte-${pieceId}`;
}

/** Envoie l'alerte d'UNE pièce, une seule fois. Rend vrai si elle part maintenant. */
export async function alerterPieceVigilance(pieceId: string): Promise<boolean> {
  const jobId = jobIdAlertePiece(pieceId);
  if (await dejaEnvoye(jobId)) return false;
  const p = await prisma.pieceApporteur.findUnique({
    where: { id: pieceId },
    select: {
      id: true,
      type: true,
      statut: true,
      deposeeAt: true,
      apporteurId: true,
      apporteur: { select: { prenom: true, nom: true } },
    },
  });
  if (!p || p.statut !== "deposee") return false;
  const nom = [decryptPii(p.apporteur.prenom), decryptPii(p.apporteur.nom)]
    .filter(Boolean)
    .join(" ");
  const piece = LIBELLE_PIECE[p.type as TypePiece] ?? p.type;
  const r = await enqueueEmail(
    "qualiopi-alerte-interne",
    destinataireAlertesInternes(),
    "fr",
    {
      niveau: "important",
      code: "apporteur_piece_vigilance_deposee",
      titre: `Pièce de vigilance déposée : ${nom || "un apporteur"}`,
      message: `${nom || "Un apporteur"} a déposé : ${piece.toLowerCase()}. À vérifier depuis sa fiche : ses commissions en attente sont libérées dès que les deux pièces sont jugées conformes.`,
      cibleType: "ApporteurReseau",
      cibleId: p.apporteurId,
      createdAt: p.deposeeAt.toLocaleDateString("fr-FR"),
    },
    { jobId, entityType: "ApporteurReseau", entityId: p.apporteurId },
  );
  return r.enqueued === true;
}

/** Les pièces de vigilance déposées et pas encore jugées : une alerte chacune. */
export async function alerterPiecesVigilanceDeposees(maintenant: Date): Promise<number> {
  const depuis = new Date(maintenant.getTime() - FENETRE_ALERTE_PIECE_JOURS * 86_400_000);
  const pieces = await prisma.pieceApporteur.findMany({
    where: {
      type: { in: ["vigilance", "immatriculation"] },
      statut: "deposee",
      remplaceeAt: null,
      purgeeAt: null,
      deposeeAt: { gte: depuis },
    },
    select: { id: true },
    take: 100,
  });
  let n = 0;
  for (const p of pieces) {
    try {
      if (await alerterPieceVigilance(p.id)) n += 1;
    } catch (err) {
      signalerErreurReseau("alerte pièce", err);
    }
  }
  return n;
}
