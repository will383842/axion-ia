"use client";
// use-client: état local (armement, envoi, résultat) + appel Server Action.

/**
 * « Relancer par e-mail » — bouton de la page À traiter (bloc Signatures).
 *
 * Réutilise `envoyerLienSignatureParEmailAction` TELLE QUELLE : l'adresse vient
 * de la fiche (jamais d'un champ libre), les gardes (rôle, SPÉCIMEN, partie
 * hors circuit, partie déjà signataire) restent celles de l'action, et l'e-mail
 * part — ou se gare dans la corbeille de validation, selon le réglage F60.
 *
 * ⚠️ La partie à relancer est décidée CÔTÉ SERVEUR par `partieARelancer`
 * (module pur, spec dédié) : ce composant ne reçoit que le résultat. Décider
 * ici dupliquerait le mapping des circuits dans le bundle client.
 *
 * Confirmation légère : le premier clic ARME le bouton (« Confirmer
 * l'envoi ? »), le second envoie. Réémettre un lien révoque le précédent —
 * un envoi au mauvais moment n'est donc pas anodin, mais pas assez grave pour
 * mériter une boîte de dialogue.
 */

import { useActionState, useState } from "react";
import { envoyerLienSignatureParEmailAction } from "@/server/actions/qualiopi/piece-lien-signature";
// ⚠️ Import de TYPE uniquement : effacé au build, aucun code serveur ne part
// dans le bundle client (même motif que PieceSignaturePanel).
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";
import { AdminButton } from "@/components/admin/ui/AdminButton";

/** Libellé humain de la partie relancée, pour la confirmation. */
const PARTIE_LABELS: Partial<Record<PartieSignataire, string>> = {
  client: "au client",
  beneficiaire: "au bénéficiaire",
  sous_traitant: "au sous-traitant",
  financeur: "au financeur",
};

type Etat =
  | { statut: "repos" }
  | { statut: "succes"; message: string; lienRemplace: boolean }
  | { statut: "erreur"; message: string };

export function RelancerSignatureButton({
  documentGenereId,
  partie,
}: {
  documentGenereId: string;
  /** Partie à relancer, décidée côté serveur (`partieARelancer`). */
  partie: PartieSignataire;
}): React.ReactElement {
  const [arme, setArme] = useState(false);

  const [etat, envoyer, enCours] = useActionState<Etat>(
    async (): Promise<Etat> => {
      const res = await envoyerLienSignatureParEmailAction({ documentGenereId, partie });
      // Message MÉTIER de l'action, jamais une erreur brute : les motifs sont
      // écrits pour être actionnables (« renseignez l'adresse sur la fiche… »).
      if ("error" in res) return { statut: "erreur", message: res.error };
      return {
        statut: "succes",
        message: res.data.garePourValidation
          ? "✓ Garé pour validation (corbeille e-mails)"
          : `✓ Envoyé à ${res.data.destinataire}`,
        lienRemplace: res.data.reemission,
      };
    },
    { statut: "repos" },
  );

  // Après un envoi réussi, l'état final remplace le bouton : renvoyer dans la
  // foulée révoquerait le lien qui vient de partir.
  if (etat.statut === "succes") {
    return (
      <span
        role="status"
        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
      >
        {etat.message}
        {etat.lienRemplace && (
          <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Ce lien remplace le précédent, qui ne fonctionne plus.
          </span>
        )}
      </span>
    );
  }

  const libelle = enCours
    ? "Envoi…"
    : arme
      ? `Confirmer l'envoi ${PARTIE_LABELS[partie] ?? "au signataire"} ?`
      : "Relancer par e-mail";

  return (
    <span className="inline-flex flex-col items-end gap-[var(--space-admin-1)]">
      <AdminButton
        variant="ghost"
        size="sm"
        loading={enCours}
        onClick={() => {
          if (!arme) {
            setArme(true);
            return;
          }
          setArme(false);
          envoyer();
        }}
      >
        {libelle}
      </AdminButton>
      {etat.statut === "erreur" && (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {etat.message}
        </span>
      )}
    </span>
  );
}
