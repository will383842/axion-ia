"use client";
// use-client: qualification (choix du palier) et versement confirmé, avec retour sans recharger.

import { useActionState } from "react";

import {
  marquerVerseAction,
  qualifierCommissionAction,
  type EtatActionCommission,
} from "@/features/apporteurs-reseau/actions-commissions";

const INITIAL: EtatActionCommission = { etat: "initial" };

function Retour({ etat }: { etat: EtatActionCommission }) {
  if (etat.etat === "initial") return null;
  return (
    <span
      role={etat.etat === "ok" ? "status" : "alert"}
      className={
        etat.etat === "ok"
          ? "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
          : "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
      }
    >
      {etat.message}
    </span>
  );
}

export function QualifierForm({
  id,
  paliers,
}: {
  id: string;
  paliers: ReadonlyArray<{ id: string; libelle: string; detail: string }>;
}) {
  const [etat, action, enCours] = useActionState(qualifierCommissionAction, INITIAL);
  return (
    <form action={action} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      <input type="hidden" name="id" value={id} />
      <select
        name="palier"
        required
        defaultValue=""
        className="admin-input"
        aria-label="Palier de formation"
      >
        <option value="" disabled>
          Palier…
        </option>
        {paliers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.libelle} ({p.detail})
          </option>
        ))}
      </select>
      <input
        type="number"
        name="quantite"
        min={1}
        max={99}
        step={1}
        defaultValue={1}
        required
        className="admin-input"
        style={{ width: "5rem" }}
        aria-label="Nombre de sessions du palier"
        title="Nombre de sessions identiques dans la commande"
      />
      <button type="submit" className="admin-button" disabled={enCours}>
        Qualifier
      </button>
      <Retour etat={etat} />
    </form>
  );
}

export function VerserForm({
  apporteurId,
  numero,
  montant,
}: {
  apporteurId: string;
  numero: string;
  montant: string;
}) {
  const [etat, action, enCours] = useActionState(marquerVerseAction, INITIAL);
  if (etat.etat === "ok") return <Retour etat={etat} />;
  return (
    <form action={action} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      <input type="hidden" name="apporteurId" value={apporteurId} />
      <input type="hidden" name="numero" value={numero} />
      <label className="inline-flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
        <input type="checkbox" name="confirmer" value="oui" required />
        Virement de {montant} fait
      </label>
      <button type="submit" className="admin-button" disabled={enCours}>
        {enCours ? "…" : "Virement fait"}
      </button>
      <Retour etat={etat} />
    </form>
  );
}
