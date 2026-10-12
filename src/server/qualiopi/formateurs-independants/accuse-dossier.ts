/**
 * Formateurs indépendants — F10 « Bien reçu : votre dossier et votre contrat » (lot B, M3).
 *
 * La pièce jointe est la copie de la signature du contrat, résolue par l'IDENTIFIANT de
 * la pièce que le formateur vient de signer (`signerContratDuDossier`), jamais par
 * récence. Sans copie archivée, F10 ne part pas : son texte annonce la pièce jointe.
 */

import "server-only";

import { archiverCopiePartielle } from "@/server/qualiopi/documents/signature/transmission-exemplaire";

import type { FormateurDuDossier } from "./contrat-dans-le-dossier";
import { envoyer, type ResultatEnvoiFormateur } from "./envois";

const PARTIE = "sous_traitant" as const;

/** F10 — « Bien reçu », avec la copie de la signature du contrat en pièce jointe. */
export async function envoyerAccuseDossier(
  d: FormateurDuDossier,
  documentGenereId: string,
): Promise<ResultatEnvoiFormateur> {
  const copie = await archiverCopiePartielle(documentGenereId, PARTIE);
  // F10 annonce une pièce jointe : sans elle, il ne part pas.
  if (!copie.ok) return "indisponible";
  return envoyer({
    gabarit: "formateur-dossier-recu",
    destinataire: d.email,
    payload: d.prenom.trim() ? { prenom: d.prenom.trim() } : {},
    entityType: "Trainer",
    entityId: d.id,
    jobId: `fi-dossier-recu-${d.id}-${documentGenereId}`,
    attachments: [
      { filename: copie.nomFichier, r2Key: copie.r2Key, contentType: "application/pdf" },
    ],
  });
}
