"use client";
// use-client: création interactive d'un audit (useTransition + router.refresh).

/**
 * AuditCreatePanel — création d'une mission d'audit IA.
 *
 * Champs essentiels : titre, client (facultatif), dates, montant en euros. Le
 * reste (formateur, lieu, OPCO, acompte) se règle sur la fiche de l'audit.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createAuditMissionAction } from "@/server/actions/qualiopi/audit-missions";

interface Props {
  clients: { id: string; nom: string }[];
}

export function AuditCreatePanel({ clients }: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [titre, setTitre] = useState("");
  const [clientId, setClientId] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [montant, setMontant] = useState("");

  function creer() {
    setError(null);
    startTransition(async () => {
      const r = await createAuditMissionAction({
        titre,
        clientId: clientId === "" ? undefined : clientId,
        dateDebut,
        dateFin,
        montantEuros: montant === "" ? 0 : Number(montant),
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.push(`./audits/${r.data.id}`);
    });
  }

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="admin-h2">Nouvel audit</h2>
      <div className="mt-[var(--space-admin-4)] flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <div className="admin-field">
          <label className="admin-label" htmlFor="audit-titre">
            Titre
          </label>
          <input
            id="audit-titre"
            className="admin-input"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="audit-client">
            Client
          </label>
          <select
            id="audit-client"
            className="admin-input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">— Aucun —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="audit-debut">
            Du
          </label>
          <input
            id="audit-debut"
            type="date"
            className="admin-input"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="audit-fin">
            Au
          </label>
          <input
            id="audit-fin"
            type="date"
            className="admin-input"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="audit-montant">
            Montant HT (€)
          </label>
          <input
            id="audit-montant"
            type="number"
            min={0}
            step="0.01"
            className="admin-input"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="admin-button"
          disabled={isPending || titre === "" || dateDebut === "" || dateFin === ""}
          onClick={creer}
        >
          {isPending ? "…" : "Créer l'audit"}
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
