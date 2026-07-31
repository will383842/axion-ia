"use client";
// use-client: saisie de l'acompte d'une formation — useTransition + refresh.

/**
 * AcompteFormationPanel — pose l'acompte (suivi manuel) d'une formation.
 * Réutilise `setAcompteAction` (prestation = "formation"). Aucun lien Stripe :
 * le moyen de paiement est du texte libre.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setAcompteAction } from "@/server/actions/qualiopi/audit-missions";

interface Props {
  sessionId: string;
  montantCents: number | null;
  dateVersement: string; // YYYY-MM-DD ou ""
  recu: boolean;
  moyen: string;
}

export function AcompteFormationPanel({
  sessionId,
  montantCents,
  dateVersement,
  recu,
  moyen,
}: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [m, setM] = useState(montantCents !== null ? String(montantCents / 100) : "");
  const [d, setD] = useState(dateVersement);
  const [r, setR] = useState(recu);
  const [moy, setMoy] = useState(moyen);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setAcompteAction({
        prestation: "formation",
        id: sessionId,
        montantEuros: m === "" ? undefined : Number(m),
        dateVersement: d === "" ? undefined : d,
        recu: r,
        moyen: moy === "" ? undefined : moy,
      });
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="admin-h2">Acompte (suivi manuel)</h2>
      <div className="mt-[var(--space-admin-3)] flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <div className="admin-field">
          <label className="admin-label" htmlFor="fmt-acompte-montant">
            Montant (€)
          </label>
          <input
            id="fmt-acompte-montant"
            type="number"
            min={0}
            step="0.01"
            className="admin-input"
            value={m}
            onChange={(e) => setM(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="fmt-acompte-date">
            Date de versement
          </label>
          <input
            id="fmt-acompte-date"
            type="date"
            className="admin-input"
            value={d}
            onChange={(e) => setD(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="fmt-acompte-moyen">
            Moyen (virement, carte…)
          </label>
          <input
            id="fmt-acompte-moyen"
            className="admin-input"
            value={moy}
            onChange={(e) => setMoy(e.target.value)}
          />
        </div>
        <label className="admin-field flex-row items-center gap-2">
          <input type="checkbox" checked={r} onChange={(e) => setR(e.target.checked)} />
          <span className="admin-label">Acompte reçu</span>
        </label>
        <button type="button" className="admin-button" disabled={isPending} onClick={save}>
          {isPending ? "…" : "Enregistrer l'acompte"}
        </button>
      </div>
      {error !== null && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
