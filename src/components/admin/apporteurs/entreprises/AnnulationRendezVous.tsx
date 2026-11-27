"use client";
// use-client: formulaires à retour sans rechargement (qualifier une annulation, lier un report).

import { useActionState } from "react";

import {
  lierReportAction,
  qualifierAnnulationAction,
} from "@/features/apporteurs-reseau/actions-annulations";
import type { EtatAction } from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };

function Retour({ etat }: { etat: EtatAction }) {
  if (etat.etat === "ok") return <span role="status">{etat.message}</span>;
  if (etat.etat === "erreur")
    return (
      <span role="alert" className="text-[color:var(--color-admin-destructive)]">
        {etat.message}
      </span>
    );
  return null;
}

export function QualifierAnnulation({ id }: { id: string }) {
  const [etat, agir, enCours] = useActionState(qualifierAnnulationAction, INITIAL);
  return (
    <form action={agir} className="flex flex-col gap-[var(--space-admin-2)]">
      <input type="hidden" name="id" value={id} />
      <label className="text-[length:var(--text-admin-sm)]">
        Motif (obligatoire si l&apos;entreprise a annulé)
        <textarea name="motif" rows={2} maxLength={2000} className="admin-input w-full" />
      </label>
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button
          type="submit"
          name="auteur"
          value="axion"
          className="admin-button-secondary"
          disabled={enCours}
        >
          Annulé par Axion IA
        </button>
        <button
          type="submit"
          name="auteur"
          value="entreprise"
          className="admin-button-secondary"
          disabled={enCours}
        >
          Annulé ou manqué par l&apos;entreprise
        </button>
      </div>
      <Retour etat={etat} />
    </form>
  );
}

export function LierReport({
  id,
  options,
}: {
  id: string;
  options: ReadonlyArray<{ cle: string; libelle: string }>;
}) {
  const [etat, agir, enCours] = useActionState(lierReportAction, INITIAL);
  if (options.length === 0)
    return <span>Aucun autre rendez-vous connu pour cette présentation.</span>;
  return (
    <form
      action={agir}
      className="flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
    >
      <input type="hidden" name="id" value={id} />
      <select name="reportCle" className="admin-input" aria-label="Rendez-vous de report">
        {options.map((o) => (
          <option key={o.cle} value={o.cle}>
            {o.libelle}
          </option>
        ))}
      </select>
      <button type="submit" className="admin-button-secondary" disabled={enCours}>
        Lier le report
      </button>
      <Retour etat={etat} />
    </form>
  );
}
