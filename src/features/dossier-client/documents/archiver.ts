/**
 * Archiver / réafficher un document de projet (ADR 0063, D5).
 *
 * Archiver = masquer par défaut ; rien n'est détruit, tout se défait en un
 * clic. Le geste vise le TRIPLET (id, projetId, clientId) : un document d'un
 * autre client est « introuvable », exactement comme un document inexistant.
 * Journal : `document_archive` / `document_reaffiche`, identifiants seulement.
 *
 * Un fichier infecté reste archivé (CHECK `documents_projet_infecte_archive`) :
 * le réafficher est refusé ici d'abord, en français.
 *
 * ⚠️ Module NEUTRE : il reçoit son client Prisma.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { ErreurDocument } from "./ajouter";

export interface Triplet {
  readonly id: string;
  readonly projetId: string;
  readonly clientId: string;
  readonly parAdminId: string | null;
  readonly maintenant?: Date;
}

type Db = {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

const NON_ARCHIVE = "Ce document n'a pas pu être archivé. Rechargez la page puis réessayez.";
const NON_REAFFICHE = "Ce document n'a pas pu être réaffiché. Rechargez la page puis réessayez.";

export async function archiver(db: Db, t: Triplet): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const doc = await tx.documentProjet.findFirst({
      where: { id: t.id, projetId: t.projetId, clientId: t.clientId, archiveLe: null },
      select: { id: true },
    });
    if (doc === null) throw new ErreurDocument(NON_ARCHIVE);
    const r = await tx.documentProjet.updateMany({
      where: { id: t.id, projetId: t.projetId, clientId: t.clientId, archiveLe: null },
      data: { archiveLe: t.maintenant ?? new Date(), archiveParId: t.parAdminId },
    });
    if (r.count !== 1) throw new ErreurDocument(NON_ARCHIVE);
    await tx.projetEvenement.create({
      data: {
        projetId: t.projetId,
        action: "document_archive",
        documentId: t.id,
        parAdminId: t.parAdminId,
      },
    });
    return { id: t.id };
  });
}

export async function reafficher(db: Db, t: Triplet): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const doc = await tx.documentProjet.findFirst({
      where: { id: t.id, projetId: t.projetId, clientId: t.clientId, archiveLe: { not: null } },
      select: { id: true, analyseAntivirus: true },
    });
    if (doc === null) throw new ErreurDocument(NON_REAFFICHE);
    if (doc.analyseAntivirus === "infecte") {
      throw new ErreurDocument(
        "L'antivirus a trouvé un risque dans ce fichier : il reste archivé et ne peut pas être réaffiché.",
      );
    }
    const r = await tx.documentProjet.updateMany({
      where: { id: t.id, projetId: t.projetId, clientId: t.clientId, archiveLe: { not: null } },
      data: { archiveLe: null, archiveParId: null },
    });
    if (r.count !== 1) throw new ErreurDocument(NON_REAFFICHE);
    await tx.projetEvenement.create({
      data: {
        projetId: t.projetId,
        action: "document_reaffiche",
        documentId: t.id,
        parAdminId: t.parAdminId,
      },
    });
    return { id: t.id };
  });
}
