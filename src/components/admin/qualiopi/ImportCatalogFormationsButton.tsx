"use client";
// use-client: action d'import déclenchée par clic + état local (useTransition)
// pour appeler la server action et afficher le rapport ; zéro appel DB client.

/**
 * ImportCatalogFormationsButton — Importe ET réconcilie le catalogue marketing
 * dans la table Formation (DB) en un clic. Idempotent : ré-exécutable sans
 * risque.
 *
 * Après import, les formations sont prêtes à recevoir des sessions, conventions
 * et factures (plus aucune création manuelle de formation requise).
 *
 * Le rapport (WS3) distingue : créées · synchronisées (catalogue adopté) · en
 * écart (édition admin ≠ catalogue → revue, l'admin est PRÉSERVÉ) · sans offre.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCatalogFormationsAction } from "@/server/actions/qualiopi/import-catalog";
import type {
  CatalogImportReport,
  ReconciledField,
} from "@/server/qualiopi/formations/catalog-import";

/**
 * Libellés humains des 7 champs réconciliables (`RECONCILED_FIELDS`). Un
 * admin non technicien ne doit jamais voir de camelCase brut (`ratioPratiquePct`,
 * `accessibleHandicap`…) dans un rapport d'écart.
 */
const RECONCILED_FIELD_LABELS: Record<ReconciledField, string> = {
  titre: "Titre",
  objectifsPedagogiques: "Objectifs pédagogiques",
  programmeDetaille: "Programme détaillé",
  methodesPedagogiques: "Méthodes pédagogiques",
  ratioPratiquePct: "Ratio pratique",
  accessibleHandicap: "Accessibilité handicap",
  certificationType: "Type de certification",
};

function driftFieldLabel(field: ReconciledField): string {
  return RECONCILED_FIELD_LABELS[field] ?? field;
}

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

  const driftItems = report?.items.filter((i) => i.status === "drifted") ?? [];

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
        <div
          role="status"
          className="flex max-w-md flex-col items-end gap-[var(--space-admin-1)] text-right text-[length:var(--text-admin-sm)]"
        >
          <p className="text-[color:var(--color-admin-success)]">
            {report.created > 0
              ? `${report.created} formation${report.created > 1 ? "s" : ""} créée${report.created > 1 ? "s" : ""}.`
              : "Catalogue déjà à jour."}{" "}
            {report.synced > 0 && (
              <span className="text-[color:var(--color-admin-success)]">
                {report.synced} synchronisée{report.synced > 1 ? "s" : ""} depuis le catalogue.{" "}
              </span>
            )}
            {report.skippedExistantes > 0 && (
              <span className="text-[color:var(--color-admin-fg-muted)]">
                {report.skippedExistantes} déjà à jour.{" "}
              </span>
            )}
            {report.skippedOffreAbsente > 0 && (
              <span className="text-[color:var(--color-admin-warning)]">
                {report.skippedOffreAbsente} sans offre rattachée — initialisez d&apos;abord le
                référentiel depuis la page Configuration.
              </span>
            )}
          </p>

          {driftItems.length > 0 && (
            <div className="text-[color:var(--color-admin-warning)]">
              <p className="font-[var(--font-weight-admin-semibold)]">
                {driftItems.length} formation{driftItems.length > 1 ? "s" : ""} en écart catalogue —
                édition admin préservée, à revoir :
              </p>
              <ul className="mt-[var(--space-admin-1)] list-disc pl-[var(--space-admin-4)] text-left text-[color:var(--color-admin-fg-muted)]">
                {driftItems.map((item) => (
                  <li key={item.slug}>
                    <code>{item.slug}</code> —{" "}
                    {(item.driftFields ?? []).map(driftFieldLabel).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
