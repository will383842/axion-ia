"use client";
// use-client: appel Server Action de génération documentaire + feedback interactif (numéro généré / erreur).

/**
 * GenererInventaireMoyensButton — Génère le PDF officiel « Inventaire des
 * moyens pédagogiques » (DocumentType inventaire_moyens, doc A14).
 *
 * Document officiel numéroté (AXI-FORM) archivé dans DocumentGenere — le PDF
 * se télécharge ensuite depuis les documents générés (et entre dans le ZIP du
 * dossier d'audit). Pattern : GenererAttestationButton.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { genererInventaireMoyensAction } from "@/server/actions/qualiopi/documents";

export function GenererInventaireMoyensButton(): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);

  function handleGenerer() {
    setError(null);
    setNumero(null);
    startTransition(async () => {
      const result = await genererInventaireMoyensAction();
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
        aria-label="Générer le PDF officiel de l'inventaire des moyens pédagogiques"
      >
        {isPending ? "Génération…" : "Générer l'inventaire (PDF officiel)"}
      </button>
      {numero !== null && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          Inventaire n° {numero} généré.
        </p>
      )}
      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
    </div>
  );
}
