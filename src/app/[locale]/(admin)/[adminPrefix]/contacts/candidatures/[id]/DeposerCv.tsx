"use client";
// use-client: sélection de fichier + état d'envoi. Aucun code serveur ici.

/**
 * « Déposer le CV » — n'apparaît QUE sur un dossier qui n'en a pas.
 *
 * 🔴 CE QUE ÇA RÉPARE. La fiche savait dire « non fourni », et s'arrêtait là.
 *    Les treize candidatures importées hors formulaire le 2026-09-23 — dont
 *    huit annoncent un CV — restaient donc des fiches sans dossier, la pièce
 *    dormant dans une boîte de messagerie que la console ne voit pas.
 *
 * 🔑 LE BOUTON N'EXISTE PAS QUAND UN CV EST DÉJÀ LÀ. L'action refuse aussi
 *    l'écrasement, et c'est elle qui fait foi — mais une commande qu'on ne
 *    peut que se voir refuser n'a rien à faire à l'écran.
 *
 * ⚠️ Pas de confirmation en deux temps, contrairement à `RelancerSignatureButton` :
 *    ce geste n'envoie rien à personne et ne remplace rien. Il comble un vide.
 */

import { useActionState } from "react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  televerserCvAction,
  type ResultatDepotCv,
} from "@/features/admin-job-applications/televerser-cv";

export function DeposerCv({ applicationId }: { applicationId: string }): React.ReactElement {
  const [etat, envoyer, enCours] = useActionState<ResultatDepotCv | null, FormData>(
    televerserCvAction,
    null,
  );

  // Une fois la pièce attachée, le formulaire s'efface : la fiche est rechargée
  // par `revalidatePath` et affichera le lien de téléchargement à sa place.
  if (etat?.ok) {
    return (
      <span role="status" className="text-[color:var(--color-admin-success)]">
        {etat.message}
      </span>
    );
  }

  return (
    <form action={envoyer} className="flex flex-col gap-[var(--space-admin-1)]">
      <input type="hidden" name="applicationId" value={applicationId} />
      <span className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <span>non fourni</span>
        <input
          type="file"
          name="cv"
          required
          // Filtre de confort du sélecteur : il ne protège rien (un fichier se
          // renomme), les contrôles qui comptent sont côté serveur.
          accept=".pdf,.doc,.docx"
          aria-label="Fichier du CV à déposer"
          className="text-[length:var(--text-admin-sm)]"
        />
        <AdminButton type="submit" variant="ghost" size="sm" loading={enCours}>
          {enCours ? "Dépôt…" : "Déposer le CV"}
        </AdminButton>
      </span>
      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        PDF, DOC ou DOCX, 8 Mo au maximum. Le candidat n&apos;est pas prévenu.
      </span>
      {etat && !etat.ok && (
        <span role="alert" className="text-[color:var(--color-admin-error)]">
          {etat.message}
        </span>
      )}
    </form>
  );
}
