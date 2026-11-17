/**
 * Clôture de la version REMPLACÉE d'un devis (révision) — module SANS « use server » : partagé
 * par `sendDevisAction` (envoi en ligne) et `marquerRemisEnMainPropreAction` (remise papier).
 *
 * À appeler DANS la transaction qui pose la nouvelle version « envoye » : l'ancienne version
 * passe « expire » (jamais d'écrasement) et son lien de signature est révoqué, dans la MÊME
 * transaction. La révocation ne touche AUCUNE signature déjà apposée : elle ferme le lien, elle
 * n'efface pas une preuve.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { pasSigneParLeClient } from "./pas-signe-par-le-client";

/** Refus d'émettre une correction dont la version précédente est acceptée ou signée. */
export const MSG_VERSION_REMPLACEE_ACCEPTEE =
  "La version précédente de ce devis a été acceptée ou signée : cette correction ne peut pas être envoyée.";

/**
 * Relecture, DANS la transaction et AVANT tout effet externe (PDF, jeton, courriel) : la version
 * remplacée interdit-elle l'émission de sa correction ? Oui si elle est signée par le client
 * (signature non révoquée, pièce non annulée), ou si son statut est « accepte » ou
 * « transforme_convention ». Sans version remplacée : jamais de blocage.
 */
export async function versionRemplaceeBloqueEmission(
  tx: Prisma.TransactionClient,
  params: { replacesDevisId: string | null; statutRemplace: string | null | undefined },
): Promise<boolean> {
  const { replacesDevisId, statutRemplace } = params;
  if (replacesDevisId == null) return false;
  if (statutRemplace === "accepte" || statutRemplace === "transforme_convention") return true;
  const nonSigne = await tx.devis.count({ where: { id: replacesDevisId, ...pasSigneParLeClient } });
  return nonSigne === 0;
}

export async function cloreVersionRemplacee(
  tx: Prisma.TransactionClient,
  params: {
    replacesDevisId: string | null;
    documentGenereIdRemplace: string | null | undefined;
    numero: string;
    /** Statut de la version remplacée vu à la relecture (même transaction). */
    statutRemplace?: string | null | undefined;
  },
): Promise<void> {
  const { replacesDevisId, documentGenereIdRemplace, numero, statutRemplace } = params;
  // Révision : seule une version « envoye » et non signée par le client passe `expire`
  // (jamais d'écrasement). Déjà « refuse » ou « expire » : laissée telle quelle.
  if (replacesDevisId != null && statutRemplace === "envoye") {
    const maj = await tx.devis.updateMany({
      where: { id: replacesDevisId, statut: "envoye", ...pasSigneParLeClient },
      data: { statut: "expire" as const },
    });
    // La relecture la voyait « envoye » : 0 ligne = une signature est arrivée entre-temps.
    if (maj.count === 0) {
      throw new Error("version remplacée non expirée : elle a été signée ou a changé d'état");
    }
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
