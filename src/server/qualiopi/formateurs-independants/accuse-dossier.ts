/**
 * Formateurs indépendants — F10 « Bien reçu : votre dossier et votre contrat » (lot B, M3).
 *
 * La pièce jointe est la copie de la signature du contrat, résolue par l'IDENTIFIANT de
 * la pièce que le formateur vient de signer (`signerContratDuDossier`), jamais par
 * récence. Sans copie archivée, F10 ne part pas : son texte annonce la pièce jointe.
 *
 * La signature du dossier coupe la copie du moteur commun (`sansCopiePartielle`) parce
 * que F10 la porte. Si F10 ne part pas (texte non validé, copie non archivée…), la copie
 * du moteur commun part en REPLI, sous son propre interrupteur (`copie_partielle`) : le
 * formateur reçoit toujours ce qu'il a signé, jamais deux fois.
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";

import {
  archiverCopiePartielle,
  transmettreCopiePartielle,
} from "@/server/qualiopi/documents/signature/transmission-exemplaire";

import type { FormateurDuDossier } from "./contrat-dans-le-dossier";
import { envoyer, type ResultatEnvoiFormateur } from "./envois";
import { lireEtatsSignature } from "./interrupteurs-lecture";

const PARTIE = "sous_traitant" as const;

/** Ce que F10 rend quand il part, ou partira (validation humaine) : aucun repli. */
const F10_PART: ReadonlySet<ResultatEnvoiFormateur> = new Set<ResultatEnvoiFormateur>([
  "envoye",
  "en-validation",
  "fiche-retiree",
  "fin-de-collaboration",
]);

/** F10, puis la copie du moteur commun en repli s'il ne part pas. */
export async function envoyerAccuseDossier(
  d: FormateurDuDossier,
  documentGenereId: string,
): Promise<ResultatEnvoiFormateur> {
  const r = await envoyerF10(d, documentGenereId);
  if (F10_PART.has(r)) return r;
  try {
    if ((await lireEtatsSignature()).copie_partielle) {
      await transmettreCopiePartielle(documentGenereId, PARTIE);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "envoyerAccuseDossier:copie_repli" } });
  }
  return r;
}

/** F10 — « Bien reçu », avec la copie de la signature du contrat en pièce jointe. */
async function envoyerF10(
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
