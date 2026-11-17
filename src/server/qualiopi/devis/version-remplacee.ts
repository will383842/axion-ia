/**
 * Clôture de la version REMPLACÉE d'un devis (révision) — module SANS « use server » : partagé
 * par `sendDevisAction` (envoi en ligne) et `marquerRemisEnMainPropreAction` (remise papier).
 *
 * À appeler DANS la transaction qui pose la nouvelle version « envoye » : l'ancienne version
 * passe « expire » (jamais d'écrasement) et son lien de signature est révoqué, dans la MÊME
 * transaction. La révocation ne touche AUCUNE signature déjà apposée : elle ferme le lien, elle
 * n'efface pas une preuve.
 */

import type { Prisma } from "@prisma/client";

export async function cloreVersionRemplacee(
  tx: Prisma.TransactionClient,
  params: {
    replacesDevisId: string | null;
    documentGenereIdRemplace: string | null | undefined;
    numero: string;
  },
): Promise<void> {
  const { replacesDevisId, documentGenereIdRemplace, numero } = params;
  // Révision : l'ancienne version passe `expire` — jamais d'écrasement.
  if (replacesDevisId !== null) {
    await tx.devis.update({
      where: { id: replacesDevisId },
      data: { statut: "expire" as const },
    });
  }
  // 🔴 …et son lien de signature est RÉVOQUÉ, dans la MÊME transaction : sinon le client
  // détiendrait deux liens vivants et pourrait signer la version périmée.
  if (documentGenereIdRemplace != null) {
    await tx.documentSignatureToken.updateMany({
      where: { documentGenereId: documentGenereIdRemplace, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedMotif: `Devis révisé — remplacé par ${numero}`,
      },
    });
  }
}
