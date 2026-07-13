"use client";
// use-client: téléchargement du CSV côté navigateur (Blob + URL.createObjectURL) après appel Server Action.

/**
 * CsvExportButton — Bouton générique d'export CSV à la volée (LOT 4).
 *
 * Appelle une Server Action qui retourne `{ csv, filename }`, construit un
 * Blob et déclenche le téléchargement. Pendant générique de PdfExportButton
 * (même pattern que BpfExportButton, mais action injectée — réutilisable).
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

export interface CsvExportButtonProps<I> {
  /** Libellé du bouton (ex. « Exporter le pilotage (CSV) »). */
  label: string;
  /** Entrée passée telle quelle à la Server Action. */
  input: I;
  /** Server Action d'export retournant le CSV + nom de fichier. */
  action: (input: I) => Promise<ActionResult<{ csv: string; filename: string }>>;
}

export function CsvExportButton<I>({
  label,
  input,
  action,
}: CsvExportButtonProps<I>): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await action(input);
      if ("error" in result) {
        setError(result.error);
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
    <div className="flex flex-col items-end gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="admin-button"
        aria-label={label}
      >
        {isPending ? "Export en cours…" : label}
      </button>
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
