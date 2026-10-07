// Pièces des apporteurs (pièce d'identité, RIB, attestations) CHIFFRÉES AU REPOS (2026-10-07).
//
// Les octets d'une pièce étaient stockés en clair dans `pieces_apporteur_contenus`, alors que
// l'IBAN est chiffré. Ils le sont désormais avec la même clé (`PII_ENCRYPTION_KEY`, identique
// sur le site et le service d'envoi), dans l'enveloppe binaire de `pii-crypto` (« AXB1 »).
//
//   · `chiffrerContenuPiece` à l'écriture — LÈVE sans clé (jamais de repli en clair) ;
//   · `lireContenuPiece` à la lecture — lit les DEUX formats le temps du rattrapage ;
//   · `chiffrerPiecesEnClair` : le rattrapage, idempotent, par lots, sans rien effacer.
//
// ⚠️ Atteint par le WORKER (passage quotidien) : aucun `server-only`.

import { prisma } from "@/lib/prisma";
import { chiffrerOctetsPii, dechiffrerOctetsPii, ENTETE_OCTETS_V1 } from "@/lib/pii-crypto";

/** Combien de pièces en clair le rattrapage chiffre par passage. */
const RATTRAPAGE_PAR_PASSAGE = 50;

/** Vrai si ces octets sont déjà dans l'enveloppe chiffrée. */
export function contenuChiffre(octets: Uint8Array): boolean {
  return (
    octets.length >= ENTETE_OCTETS_V1.length &&
    Buffer.from(octets.subarray(0, ENTETE_OCTETS_V1.length)).equals(ENTETE_OCTETS_V1)
  );
}

/** Les octets à écrire en base : chiffrés. Lève si la clé manque. */
export function chiffrerContenuPiece(clair: Uint8Array): Buffer {
  return chiffrerOctetsPii(Buffer.from(clair));
}

/** Les octets en clair d'une pièce, qu'elle soit déjà chiffrée ou encore en clair (ancienne). */
export function lireContenuPiece(stocke: Uint8Array): Uint8Array {
  return contenuChiffre(stocke)
    ? new Uint8Array(dechiffrerOctetsPii(Buffer.from(stocke)))
    : new Uint8Array(stocke);
}

/**
 * RATTRAPAGE : chiffre les pièces encore en clair. Idempotent (une pièce chiffrée sort de la
 * sélection) ; l'écriture est conditionnée au contenu lu (un dépôt concurrent gagne). Rien
 * n'est effacé. Rend le nombre de pièces chiffrées.
 */
export async function chiffrerPiecesEnClair(): Promise<number> {
  const enClair = await prisma.$queryRaw<Array<{ piece_id: string }>>`
    SELECT piece_id FROM pieces_apporteur_contenus
    WHERE substring(octets from 1 for 4) <> ${ENTETE_OCTETS_V1}
    LIMIT ${RATTRAPAGE_PAR_PASSAGE}`;
  let chiffrees = 0;
  for (const { piece_id: pieceId } of enClair) {
    const c = await prisma.pieceApporteurContenu.findUnique({
      where: { pieceId },
      select: { octets: true },
    });
    if (!c || contenuChiffre(c.octets)) continue;
    const r = await prisma.pieceApporteurContenu.updateMany({
      where: { pieceId, octets: { equals: c.octets } },
      data: { octets: chiffrerContenuPiece(c.octets) },
    });
    chiffrees += r.count;
  }
  return chiffrees;
}
