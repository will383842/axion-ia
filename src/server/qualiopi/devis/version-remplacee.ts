/**
 * Clôture de la version REMPLACÉE d'un devis (révision) — module SANS « use server » : partagé
 * par `sendDevisAction` (envoi en ligne) et `marquerRemisEnMainPropreAction` (remise papier).
 *
 * À appeler DANS la transaction qui pose la nouvelle version « envoye » : l'ancienne version
 * passe « expire » (jamais d'écrasement) et son lien de signature est révoqué, dans la MÊME
 * transaction. Sa ligne est verrouillée (`FOR NO KEY UPDATE`) et son statut relu sous ce verrou :
 * la décision ne repose jamais sur un statut lu en début de transaction. La révocation ne touche AUCUNE signature déjà apposée : elle ferme le lien, elle
 * n'efface pas une preuve.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { pasSigneParLeClient } from "./pas-signe-par-le-client";

/** Message lisible : le client a signé l'ancienne version pendant l'émission de la nouvelle. */
export const MSG_VERSION_REMPLACEE_SIGNEE_ENTRE_TEMPS =
  "Le client vient de signer la version précédente de ce devis : cette correction n'a pas été émise. Ouvrez la version signée pour la contresigner.";

/**
 * Course perdue : la version remplacée passait pour « envoye » à la relecture, mais le client l'a
 * signée (ou son état a changé) avant l'écriture. La transaction est annulée ; l'appelant
 * reconnaît cette classe pour rendre un message lisible.
 */
export class VersionRemplaceeSigneeEntreTempsError extends Error {
  constructor() {
    super("version remplacée non expirée : elle a été signée ou a changé d'état");
    this.name = "VersionRemplaceeSigneeEntreTempsError";
  }
}

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
    /**
     * Facultatif et NON LU : le statut de début de transaction peut dater de 60 s. La décision
     * se prend sur le statut relu SOUS le verrou de ligne (voir ci-dessous).
     */
    statutRemplace?: string | null | undefined;
  },
): Promise<void> {
  const { replacesDevisId, documentGenereIdRemplace, numero } = params;
  if (replacesDevisId != null) {
    // Verrou de LIGNE sur la version remplacée, tenu jusqu'à la fin de la transaction, et statut
    // relu SOUS ce verrou. Le statut lu en début de transaction (`statutRemplace`) peut dater de
    // 60 s : une prolongation ou une acceptation a pu passer entre-temps. Ne jamais retirer ce
    // verrou : sans lui, deux versions du même devis peuvent rester ouvertes.
    const [ligne] = await tx.$queryRaw<{ statut: string }[]>`
      SELECT statut::text AS statut FROM devis WHERE id = ${replacesDevisId}::uuid FOR NO KEY UPDATE
    `;
    const statutFrais = ligne?.statut;
    if (statutFrais === "accepte" || statutFrais === "transforme_convention") {
      throw new VersionRemplaceeSigneeEntreTempsError();
    }
    if (statutFrais === "envoye") {
      // Seule une version « envoye » et non signée par le client passe `expire`.
      const maj = await tx.devis.updateMany({
        where: { id: replacesDevisId, statut: "envoye", ...pasSigneParLeClient },
        data: { statut: "expire" as const },
      });
      if (maj.count === 0) {
        throw new VersionRemplaceeSigneeEntreTempsError();
      }
    } else if (statutFrais === "expire") {
      // Aucune écriture de statut (ligne verrouillée jusqu'à la fin) ; mais un client qui a signé
      // entre-temps (scan papier, par exemple) interdit l'émission.
      const nonSigne = await tx.devis.count({
        where: { id: replacesDevisId, ...pasSigneParLeClient },
      });
      if (nonSigne === 0) throw new VersionRemplaceeSigneeEntreTempsError();
    }
    // Absente, « refuse » ou « brouillon » : aucune écriture de statut.
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
