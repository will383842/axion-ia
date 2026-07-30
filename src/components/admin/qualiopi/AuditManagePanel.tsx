"use client";
// use-client: gestion d'un audit (formateur, statut, acompte) — useTransition.

/**
 * AuditManagePanel — affecte/retire le formateur, change le statut, et pose
 * l'acompte (suivi manuel) d'une mission d'audit.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  assignAuditFormateurAction,
  setAuditStatutAction,
  setAcompteAction,
} from "@/server/actions/qualiopi/audit-missions";

const STATUTS: { value: string; label: string }[] = [
  { value: "planifiee", label: "Planifiée" },
  { value: "en_cours", label: "En cours" },
  { value: "realisee", label: "Réalisée" },
  { value: "annulee", label: "Annulée" },
  { value: "reportee", label: "Reportée" },
];

interface Props {
  auditId: string;
  currentFormateurId: string | null;
  currentStatut: string;
  trainers: { id: string; label: string }[];
  acompte: {
    montantCents: number | null;
    dateVersement: string; // YYYY-MM-DD ou ""
    recu: boolean;
    moyen: string;
  };
}

export function AuditManagePanel({
  auditId,
  currentFormateurId,
  currentStatut,
  trainers,
  acompte,
}: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formateur, setFormateur] = useState(currentFormateurId ?? "");
  const [statut, setStatut] = useState(currentStatut);
  const [montant, setMontant] = useState(
    acompte.montantCents !== null ? String(acompte.montantCents / 100) : "",
  );
  const [dateVersement, setDateVersement] = useState(acompte.dateVersement);
  const [recu, setRecu] = useState(acompte.recu);
  const [moyen, setMoyen] = useState(acompte.moyen);

  function run(fn: () => Promise<{ error: string } | { data: unknown }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="admin-h2">Gestion</h2>

      {/* Formateur */}
      <div className="mt-[var(--space-admin-4)] flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <div className="admin-field">
          <label className="admin-label" htmlFor="audit-formateur">
            Formateur
          </label>
          <select
            id="audit-formateur"
            className="admin-input"
            value={formateur}
            onChange={(e) => setFormateur(e.target.value)}
          >
            <option value="">— Aucun —</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="admin-button"
          disabled={isPending}
          onClick={() =>
            run(() =>
              assignAuditFormateurAction({
                id: auditId,
                formateurId: formateur === "" ? null : formateur,
              }),
            )
          }
        >
          {formateur === "" ? "Retirer" : "Affecter"}
        </button>

        <div className="admin-field">
          <label className="admin-label" htmlFor="audit-statut">
            Statut
          </label>
          <select
            id="audit-statut"
            className="admin-input"
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="admin-button-ghost"
          disabled={isPending}
          onClick={() => run(() => setAuditStatutAction({ id: auditId, statut: statut as never }))}
        >
          Enregistrer le statut
        </button>
      </div>

      {/* Acompte */}
      <h3 className="admin-h2 mt-[var(--space-admin-5)]">Acompte (suivi manuel)</h3>
      <div className="mt-[var(--space-admin-3)] flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <div className="admin-field">
          <label className="admin-label" htmlFor="acompte-montant">
            Montant (€)
          </label>
          <input
            id="acompte-montant"
            type="number"
            min={0}
            step="0.01"
            className="admin-input"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="acompte-date">
            Date de versement
          </label>
          <input
            id="acompte-date"
            type="date"
            className="admin-input"
            value={dateVersement}
            onChange={(e) => setDateVersement(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="acompte-moyen">
            Moyen (virement, carte…)
          </label>
          <input
            id="acompte-moyen"
            className="admin-input"
            value={moyen}
            onChange={(e) => setMoyen(e.target.value)}
          />
        </div>
        <label className="admin-field flex-row items-center gap-2">
          <input type="checkbox" checked={recu} onChange={(e) => setRecu(e.target.checked)} />
          <span className="admin-label">Acompte reçu</span>
        </label>
        <button
          type="button"
          className="admin-button"
          disabled={isPending}
          onClick={() =>
            run(() =>
              setAcompteAction({
                prestation: "audit",
                id: auditId,
                montantEuros: montant === "" ? undefined : Number(montant),
                dateVersement: dateVersement === "" ? undefined : dateVersement,
                recu,
                moyen: moyen === "" ? undefined : moyen,
              }),
            )
          }
        >
          Enregistrer l&apos;acompte
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
