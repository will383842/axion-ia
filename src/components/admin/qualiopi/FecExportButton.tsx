"use client";
// use-client: sélecteur d'année + téléchargement du FEC côté navigateur via Blob après appel exporterFecAction.

/**
 * FecExportButton — Export du Fichier des Écritures Comptables (FEC) d'un
 * exercice (contrôle fiscal / expert-comptable).
 *
 * Appelle `exporterFecAction({ annee })`, reçoit { contenu, nbFactures }, puis
 * déclenche le téléchargement `AXIONIA_FEC_{annee}.txt` (TAB-séparé) via un Blob.
 * Lecture seule (accessible au rôle comptable). Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { exporterFecAction } from "@/server/actions/qualiopi/facturation-hub";

export interface FecExportButtonProps {
  /** Année par défaut (généralement l'exercice courant). */
  anneeDefaut: number;
  /** Bornes du sélecteur d'année. */
  anneeMin: number;
  anneeMax: number;
}

export function FecExportButton({
  anneeDefaut,
  anneeMin,
  anneeMax,
}: FecExportButtonProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [annee, setAnnee] = useState<number>(anneeDefaut);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const annees: number[] = [];
  for (let a = anneeMax; a >= anneeMin; a--) annees.push(a);

  function handleExport() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await exporterFecAction({ annee });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const { contenu, nbFactures } = res.data;
      const blob = new Blob([contenu], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AXIONIA_FEC_${annee}.txt`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage(`FEC ${annee} exporté (${nbFactures} facture${nbFactures > 1 ? "s" : ""}).`);
    });
  }

  const inputCls =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <label htmlFor="fec-annee" className="text-[length:var(--text-admin-sm)]">
          Exercice
        </label>
        <select
          id="fec-annee"
          value={annee}
          onChange={(e) => setAnnee(Number.parseInt(e.target.value, 10))}
          disabled={isPending}
          className={inputCls}
        >
          {annees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={isPending}
          className="admin-button"
          aria-label={`Exporter le FEC ${annee}`}
        >
          {isPending ? "Export en cours…" : `Exporter le FEC ${annee}`}
        </button>
      </div>
      {message && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
