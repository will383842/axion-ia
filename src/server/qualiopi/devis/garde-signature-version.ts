/**
 * Garde de version : une version de devis déjà remplacée ne reçoit plus aucune signature.
 *
 * Dès que la version suivante est émise (statut autre que `brouillon`), la version signée ne doit
 * plus rien recevoir, ni papier ni électronique. L'envoi de la version suivante verrouille la
 * ligne de la version remplacée (`cloreVersionRemplacee`) ; la signature prend le même verrou puis
 * relit les versions suivantes : l'un des deux voit forcément l'autre.
 *
 * À appeler en PREMIÈRE instruction de la transaction qui inscrit une signature sur une pièce de devis.
 */

import type { Prisma } from "../../../../prisma/generated/client";

/** `true` si la signature peut s'inscrire ; `false` si une version plus récente est émise. */
export async function versionDevisEncoreSignable(
  tx: Prisma.TransactionClient,
  documentGenereId: string,
): Promise<boolean> {
  // Verrou de LIGNE sur la version signée, tenu jusqu'à la fin de la transaction, puis relecture
  // des versions suivantes par une instruction DISTINCTE. L'envoi d'une version suivante prend la
  // même ligne (`cloreVersionRemplacee`) : l'un des deux voit forcément l'autre. Ne jamais réunir
  // les deux requêtes en une seule : son instantané daterait d'avant l'attente du verrou. Ne
  // jamais retirer ce verrou : sans lui, une signature peut s'inscrire sur une version déjà remplacée.
  const lignes = await tx.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM devis
    WHERE document_genere_id = ${documentGenereId}::uuid
    ORDER BY id
    FOR NO KEY UPDATE
  `;
  if (lignes.length === 0) return true;

  const suivantes = await tx.devis.count({
    where: { replacesDevisId: { in: lignes.map((l) => l.id) }, statut: { not: "brouillon" } },
  });
  return suivantes === 0;
}
