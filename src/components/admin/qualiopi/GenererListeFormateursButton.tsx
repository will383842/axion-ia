"use client";
// use-client: appel Server Action de génération documentaire + feedback interactif (numéro généré / erreur).

/**
 * GenererListeFormateursButton — produit la LISTE des intervenants
 * (DocumentType `liste_formateurs`), pièce exigée à l'appui de la déclaration
 * d'activité (art. R.6351-5) et par l'indicateur 21.
 *
 * À ne pas confondre avec la fiche individuelle (`cv_formateur`), générée
 * depuis chaque formateur : une fiche n'est pas une liste.
 *
 * Pattern : GenererInventaireMoyensButton. Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { genererListeFormateursAction } from "@/server/actions/qualiopi/documents";

export function GenererListeFormateursButton(): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);

  function handleGenerer() {
    setError(null);
    setNumero(null);
    startTransition(async () => {
      const result = await genererListeFormateursAction();
      if ("error" in result) {
        setError(result.error);
      } else {
        setNumero(result.data.numero);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleGenerer}
        disabled={isPending}
        className="admin-button"
        aria-label="Générer la liste des formateurs et qualifications (PDF officiel)"
      >
        {isPending ? "Génération…" : "Générer la liste des formateurs (PDF)"}
      </button>
      {numero !== null && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          Liste n° {numero} générée — téléchargeable depuis les documents générés.
        </p>
      )}
      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
