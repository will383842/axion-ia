"use client";
// use-client: déclenchement du téléchargement CSV côté navigateur via Blob + URL.createObjectURL après appel Server Action.

/**
 * BpfExportButton — Bouton d'export CSV du Bilan Pédagogique et Financier.
 *
 * Appelle `exportBpfCsvAction({ annee })` (AGENT B), reçoit { csv, filename },
 * puis déclenche le téléchargement via un Blob côté navigateur.
 * Zéro appel DB côté client.
 */

import { useTransition } from "react";
import { exportBpfCsvAction } from "@/server/actions/qualiopi/satisfaction";

interface BpfExportButtonProps {
  annee: number;
}

export function BpfExportButton({ annee }: BpfExportButtonProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const result = await exportBpfCsvAction({ annee });
      if ("error" in result) {
        // Feedback minimal — pas d'état local persistant
        window.alert(`Erreur export BPF : ${result.error}`);
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
      aria-label={`Exporter le BPF ${annee} au format CSV`}
    >
      {isPending ? "Export en cours…" : `Exporter BPF ${annee} (CSV)`}
    </button>
  );
}
