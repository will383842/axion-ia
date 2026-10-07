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
import { createHash } from "node:crypto";

import {
  chiffrerOctetsPii,
  decryptPii,
  dechiffrerOctetsPii,
  ENTETE_OCTETS_V1,
  isEncryptedPii,
  PII_DECRYPT_PLACEHOLDER,
} from "@/lib/pii-crypto";
import { signalerErreurReseau } from "./signaler";

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

/** Vrai si la clé de ce processus déchiffre une valeur chiffrée écrite par le site. */
async function cleTemoinOk(): Promise<boolean> {
  const temoin = await prisma.apporteurReseau.findFirst({
    where: { email: { startsWith: "enc:v1:" } },
    select: { email: true },
  });
  // Aucun dossier encore : rien à comparer, et rien à chiffrer de toute façon.
  if (!temoin || !isEncryptedPii(temoin.email)) return true;
  try {
    const clair = decryptPii(temoin.email);
    return !!clair && clair !== PII_DECRYPT_PLACEHOLDER && !isEncryptedPii(clair);
  } catch {
    return false;
  }
}

/**
 * RATTRAPAGE : chiffre les pièces encore en clair. Idempotent (une pièce chiffrée sort de la
 * sélection) ; l'écriture est conditionnée au contenu lu (un dépôt concurrent gagne). Rien
 * n'est effacé. Rend le nombre de pièces chiffrées.
 */
export async function chiffrerPiecesEnClair(): Promise<number> {
  // Témoin (runbook R34, étape 2) : la clé de CE processus doit lire une valeur écrite par le
  // SITE. Sinon (clé du worker différente), on s'arrête et on alerte : rien n'est écrit.
  if (!(await cleTemoinOk())) {
    signalerErreurReseau(
      "chiffrement des pièces : rattrapage arrêté",
      new Error("la clé de ce processus ne déchiffre pas une valeur écrite par le site"),
    );
    return 0;
  }
  const enClair = await prisma.$queryRaw<Array<{ piece_id: string }>>`
    SELECT piece_id FROM pieces_apporteur_contenus
    WHERE substring(octets from 1 for 4) <> ${ENTETE_OCTETS_V1}
    LIMIT ${RATTRAPAGE_PAR_PASSAGE}`;
  let chiffrees = 0;
  for (const { piece_id: pieceId } of enClair) {
    const c = await prisma.pieceApporteurContenu.findUnique({
      where: { pieceId },
      select: { octets: true, piece: { select: { sha256: true } } },
    });
    if (!c || contenuChiffre(c.octets)) continue;
    const nouveau = chiffrerContenuPiece(c.octets);
    // Relu AVANT d'écrire : le chiffré redonne exactement la pièce déposée (même empreinte).
    const relu = createHash("sha256").update(dechiffrerOctetsPii(nouveau)).digest("hex");
    if (relu !== c.piece.sha256) {
      signalerErreurReseau(
        "chiffrement des pièces : empreinte différente, pièce laissée telle quelle",
        new Error("empreinte du contenu relu différente de celle du dépôt"),
      );
      continue;
    }
    const r = await prisma.pieceApporteurContenu.updateMany({
      where: { pieceId, octets: { equals: c.octets } },
      data: { octets: nouveau },
    });
    chiffrees += r.count;
  }
  return chiffrees;
}
