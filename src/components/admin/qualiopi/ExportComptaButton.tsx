"use client";
// use-client: déclenchement du téléchargement CSV côté navigateur via Blob + URL.createObjectURL après appel Server Action exportComptaCsvAction.

/**
 * ExportComptaButton — Bouton d'export CSV comptable des factures de formation.
 *
 * Appelle `exportComptaCsvAction({ annee })` (AGENT B), reçoit { csv, filename },
 * puis déclenche le téléchargement via un Blob côté navigateur.
 * Pattern identique à BpfExportButton.
 * Zéro appel DB côté client.
 */

import { useTransition } from "react";
import { exportComptaCsvAction } from "@/server/actions/qualiopi/financements";

interface ExportComptaButtonProps {
  annee: number;
}

export function ExportComptaButton({ annee }: ExportComptaButtonProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const result = await exportComptaCsvAction({ annee });
      if ("error" in result) {
        window.alert(`Erreur export compta : ${result.error}`);
        return;
      }
      const { csv, filename } = result.data;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isPending}
      className="admin-button"
      aria-label={`Exporter les factures de formation ${annee} au format CSV comptable`}
    >
      {isPending ? "Export en cours…" : `Exporter factures ${annee} (CSV compta)`}
    </button>
  );
}
