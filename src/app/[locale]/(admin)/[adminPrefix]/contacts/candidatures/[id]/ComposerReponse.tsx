"use client";
// use-client: adaptateur du composeur unique (fonctions d'envoi passées au panneau client).

/**
 * RÉPONDRE À UN CANDIDAT — l'adaptateur « emploi » du composeur unique
 * (`components/admin/echanges/Composeur.tsx`, Candidatures unifiées L6).
 *
 * Ce fichier ne porte plus de panneau : il donne au composeur les modèles de
 * recrutement, les actions d'envoi de la candidature, la bibliothèque complète
 * (« Depuis mon ordinateur » compris) et la case du dépôt L5b. Le panneau, la
 * machine d'états et l'aperçu sont ceux de tous les écrans.
 */

import {
  repondreAuCandidatAction,
  rejouerReponseEchoueeAction,
  etatLivraisonReponseAction,
} from "@/features/admin-job-applications/reply-actions";
// 🔴 Les libellés d'erreur vivent HORS du fichier d'actions : un module
// `"use server"` ne peut exporter que des fonctions asynchrones.
import { LIBELLES_ERREUR_REPONSE } from "@/features/admin-job-applications/libelles-erreurs";
import { MODELES_REPONSE, type ModeleReponseId } from "@/content/recrutement/modeles-reponse";
import {
  Composeur,
  type EnvoiComposeur,
  type EtatLivraisonComposeur,
  type FichierBibliothequeComposeur,
  type LienInsertionComposeur,
  type ResultatComposeur,
} from "@/components/admin/echanges/Composeur";

export type {
  FichierBibliothequeComposeur,
  FichierJoint,
  LienInsertionComposeur,
} from "@/components/admin/echanges/Composeur";

interface Props {
  readonly applicationId: string;
  readonly prenom: string;
  readonly poste: string;
  /** Boutons « Insérer un lien » proposés à côté du corps du message. */
  readonly liensInsertion?: readonly LienInsertionComposeur[];
  /** Fichiers à joindre (L5). `null` tant que la bibliothèque est ÉTEINTE. */
  readonly partages?: { readonly bibliotheque: ReadonlyArray<FichierBibliothequeComposeur> } | null;
}

function libelleErreur(r: { error: string; detail?: string }): string {
  return (
    (LIBELLES_ERREUR_REPONSE[r.error] ?? `Échec (${r.error}).`) + (r.detail ? ` ${r.detail}` : "")
  );
}

async function rejouer(replyId: string): Promise<ResultatComposeur> {
  const r = await rejouerReponseEchoueeAction(replyId);
  return r.ok ? r : { ok: false, message: LIBELLES_ERREUR_REPONSE[r.error] ?? r.error };
}

async function etat(replyId: string): Promise<EtatLivraisonComposeur> {
  return etatLivraisonReponseAction(replyId);
}

export function ComposerReponse({
  applicationId,
  prenom,
  poste,
  liensInsertion = [],
  partages = null,
}: Props): React.ReactElement {
  async function envoyer(e: EnvoiComposeur): Promise<ResultatComposeur> {
    const r = await repondreAuCandidatAction({
      applicationId,
      subject: e.objet,
      bodyMarkdown: e.corps,
      modele: e.modele as ModeleReponseId,
      ...(e.note ? { internalNote: e.note } : {}),
      ...(e.fichierIds && e.fichierIds.length > 0
        ? { fichierIds: [...e.fichierIds], depotAutorise: e.depotAutorise === true }
        : {}),
    });
    return r.ok
      ? { ok: true, replyId: r.replyId }
      : { ok: false, message: libelleErreur(r), ...(r.replyId ? { replyId: r.replyId } : {}) };
  }

  return (
    <Composeur
      libelleOuvrir="Répondre au candidat"
      modeles={MODELES_REPONSE}
      valeurs={{ prenom, poste }}
      envoyer={envoyer}
      rejouer={rejouer}
      etat={etat}
      liensInsertion={liensInsertion}
      partages={
        partages
          ? {
              bibliotheque: partages.bibliotheque,
              ordinateur: true,
              libelleDepot:
                "Permettre au candidat de déposer sa version par ce lien (4 Go au plus)",
            }
          : null
      }
    />
  );
}
