"use client";
// use-client: action d'import déclenchée par clic + état local (useTransition)
// pour appeler la server action et afficher le rapport ; zéro appel DB client.

/**
 * ImportCatalogFormationsButton — Importe le catalogue marketing dans la table
 * Formation (DB) en un clic. Idempotent : ré-exécutable sans risque.
 *
 * Après import, les formations sont prêtes à recevoir des sessions, conventions
 * et factures (plus aucune création manuelle de formation requise).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCatalogFormationsAction } from "@/server/actions/qualiopi/import-catalog";
import type { CatalogImportReport } from "@/server/qualiopi/formations/catalog-import";

export function ImportCatalogFormationsButton(): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CatalogImportReport | null>(null);

  function handleImport() {
    setError(null);
    setReport(null);
    startTransition(async () => {
      const result = await importCatalogFormationsAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setReport(result.data);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
      <button
        type="button"
        onClick={handleImport}
        disabled={isPending}
        className="admin-button-ghost shrink-0"
        aria-label="Importer les formations du catalogue dans la base"
        title="Crée en base les formations du catalogue absentes (idempotent)"
      >
        {isPending ? "Import en cours…" : "Importer le catalogue"}
      </button>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

      {report && (
        <p
          role="status"
          className="max-w-md text-right text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {report.created > 0
            ? `${report.created} formation(s) créée(s).`
            : "Catalogue déjà à jour."}{" "}
          {report.skippedExistantes > 0 && (
            <span className="text-[color:var(--color-admin-fg-muted)]">
              {report.skippedExistantes} déjà présente(s).{" "}
            </span>
          )}
          {report.skippedOffreAbsente > 0 && (
            <span className="text-[color:var(--color-admin-warning)]">
              {report.skippedOffreAbsente} sans offre rattachée — lancez d&apos;abord{" "}
              <code>pnpm qualiopi:seed</code>.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
