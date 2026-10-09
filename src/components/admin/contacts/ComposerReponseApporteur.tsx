"use client";
// use-client: adaptateur du composeur unique (fonctions d'envoi passées au panneau client).

/**
 * ÉCRIRE À UN FUTUR APPORTEUR — l'adaptateur « réseau » du composeur unique
 * (`components/admin/echanges/Composeur.tsx`, Candidatures unifiées L6).
 *
 * Même panneau que pour un candidat, autres ingrédients :
 *   - les modèles du réseau (`content/apporteurs/modeles-reponse.ts`) ;
 *   - le kit et la présentation SEULS (filtrés côté serveur,
 *     `fichiersPourComposeur("apporteur")`) — ni « Depuis mon ordinateur », ni
 *     LUT, ni consigne, ni dépôt de version ;
 *   - aucune pièce à joindre si la personne s'est opposée (`opposee`).
 *
 * 🔴 Aucun mot de recrutement ici ni dans ce qui est passé au panneau
 * (`vocabulaire-apporteur.spec.ts`, `ComposerReponseApporteur.spec.tsx`).
 * Un message CLIENT garde l'ancien composeur (`ReplyComposer`).
 */

import {
  getReplyDeliveryStatusAction,
  replyToSubmissionAction,
  retryFailedReplyAction,
} from "@/features/admin-submissions/reply-actions";
import { MODELES_REPONSE_APPORTEUR } from "@/content/apporteurs/modeles-reponse";
import {
  Composeur,
  type EnvoiComposeur,
  type EtatLivraisonComposeur,
  type FichierBibliothequeComposeur,
  type ResultatComposeur,
} from "@/components/admin/echanges/Composeur";

/** Codes d'erreur de l'action → phrases lisibles, sans vocabulaire d'emploi. */
const LIBELLES_ERREUR: Readonly<Record<string, string>> = {
  submission_not_found: "Fiche introuvable.",
  render_failed: "Erreur de génération de l'e-mail.",
  db_failed: "Échec d'enregistrement en base.",
  enqueue_failed: "File d'envoi indisponible — réessayez dans un instant.",
  invalid_recipient: "Adresse du destinataire illisible.",
  unauthorized: "Session expirée — reconnectez-vous.",
  forbidden: "Droits insuffisants.",
  not_found: "Message introuvable.",
  not_retryable: "Ce message n'est pas rejouable.",
  opposee: "Cette personne s'est opposée aux sollicitations : aucun fichier ne lui est envoyé.",
  fichiers_refuses: "Fichiers refusés.",
  fichiers_reserves_apporteur: "Les fichiers ne se joignent qu'aux futurs apporteurs.",
};

function libelle(code: string, detail?: string): string {
  return (LIBELLES_ERREUR[code] ?? `Échec de l'envoi (${code}).`) + (detail ? ` ${detail}` : "");
}

async function rejouer(replyId: string): Promise<ResultatComposeur> {
  const r = await retryFailedReplyAction(replyId);
  return r.ok ? { ok: true, replyId } : { ok: false, message: libelle(r.error ?? "inconnu") };
}

async function etat(replyId: string): Promise<EtatLivraisonComposeur> {
  const r = await getReplyDeliveryStatusAction(replyId);
  return r ? { statut: r.status === "delivered" ? "sent" : r.status, erreur: r.errorMsg } : null;
}

interface Props {
  readonly submissionId: string;
  readonly prenom: string | null;
  /** Kit et présentation à joindre ; `null` : bibliothèque éteinte ou personne opposée. */
  readonly bibliotheque: ReadonlyArray<FichierBibliothequeComposeur> | null;
}

export function ComposerReponseApporteur({
  submissionId,
  prenom,
  bibliotheque,
}: Props): React.ReactElement {
  async function envoyer(e: EnvoiComposeur): Promise<ResultatComposeur> {
    const r = await replyToSubmissionAction({
      submissionId,
      subject: e.objet,
      bodyMarkdown: e.corps,
      template: "custom",
      ...(e.modele !== "libre"
        ? { modele: e.modele as (typeof MODELES_REPONSE_APPORTEUR)[number]["id"] }
        : {}),
      ...(e.note ? { internalNote: e.note } : {}),
      ...(e.fichierIds && e.fichierIds.length > 0 ? { fichierIds: [...e.fichierIds] } : {}),
    });
    return r.ok
      ? { ok: true, replyId: r.replyId }
      : {
          ok: false,
          message: libelle(r.error, r.detail),
          ...(r.replyId ? { replyId: r.replyId } : {}),
        };
  }

  return (
    <Composeur
      libelleOuvrir="Répondre"
      modeles={MODELES_REPONSE_APPORTEUR}
      valeurs={{ prenom }}
      envoyer={envoyer}
      rejouer={rejouer}
      etat={etat}
      partages={
        bibliotheque
          ? {
              bibliotheque,
              ordinateur: false,
              libelleDepot: null,
              videTexte:
                "Aucun kit ni présentation dans la bibliothèque : ajoutez-les d'abord dans « Bibliothèque de fichiers ».",
            }
          : null
      }
    />
  );
}
