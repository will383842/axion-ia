"use client";
// use-client: téléchargement du PDF côté navigateur (Blob + URL.createObjectURL) après appel Server Action.

/**
 * PdfExportButton — Bouton générique d'export PDF à la volée (LOT 2).
 *
 * Appelle une Server Action qui retourne `{ base64, filename }` (export
 * d'ÉTAT, pas un document officiel numéroté), décode le base64 en Blob et
 * déclenche le téléchargement. Pattern : BpfExportButton (CSV).
 *
 * Réutilisé pour : registres (réclamations/veille/revue/partenariats/
 * sous-traitants), fiche formateur (CV), fiche d'adaptation individuelle.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

export interface PdfExportButtonProps<I> {
  /** Libellé du bouton (ex. « Exporter le registre (PDF) »). */
  label: string;
  /** Entrée passée telle quelle à la Server Action. */
  input: I;
  /** Server Action d'export retournant le PDF en base64. */
  action: (input: I) => Promise<ActionResult<{ base64: string; filename: string }>>;
}

/** Décode une chaîne base64 en Uint8Array backé par un ArrayBuffer strict (BlobPart TS). */
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function PdfExportButton<I>({
  label,
  input,
  action,
}: PdfExportButtonProps<I>): React.ReactElement {
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
      const { base64, filename } = result.data;
      const blob = new Blob([base64ToBytes(base64)], { type: "application/pdf" });
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
