"use client";
// use-client: useActionState pour afficher le refus (préalable manquant, habilitation).

import { useActionState } from "react";

import type { EtatBascule } from "@/server/actions/qualiopi/formateurs-interrupteurs";

const INITIAL: EtatBascule = { ok: true, message: "" };

type Sorte = "envoi" | "garde" | "garde_niveau" | "date";

interface Props {
  action: (prev: EtatBascule, formData: FormData) => Promise<EtatBascule>;
  sorte: Sorte;
  valeur: boolean | string | null;
  desactive: boolean;
}

export function BoutonInterrupteur({ action, sorte, valeur, desactive }: Props) {
  const [etat, formAction, enCours] = useActionState(action, INITIAL);
  const inactif = desactive || enCours;

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-1)]">
      {sorte === "garde_niveau" ? (
        <form action={formAction}>
          <input type="hidden" name="valeur" value={valeur === "avertir" ? "refuser" : "avertir"} />
          <button type="submit" className="admin-button-ghost" disabled={inactif}>
            {valeur === "avertir" ? "Revenir à « refuser »" : "Passer à « avertir »"}
          </button>
        </form>
      ) : sorte === "date" ? (
        <form action={formAction} className="flex items-center gap-[var(--space-admin-2)]">
          <input
            type="month"
            name="mois"
            aria-label="Mois de passage"
            className="admin-input"
            disabled={inactif}
            defaultValue={typeof valeur === "string" ? valeur.slice(0, 7) : ""}
            onChange={(e) => {
              const cache = e.currentTarget.form?.elements.namedItem("date");
              if (cache instanceof HTMLInputElement) {
                cache.value = e.currentTarget.value ? `${e.currentTarget.value}-01` : "";
              }
            }}
          />
          <input
            type="hidden"
            name="date"
            defaultValue={typeof valeur === "string" ? valeur : ""}
          />
          <button type="submit" className="admin-button-ghost" disabled={inactif}>
            Enregistrer
          </button>
        </form>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="actif" value={valeur === true ? "0" : "1"} />
          <button type="submit" className="admin-button-ghost" disabled={inactif}>
            {sorte === "garde"
              ? valeur === true
                ? "Lever la garde"
                : "Rétablir la garde"
              : valeur === true
                ? "Couper"
                : "Allumer"}
          </button>
        </form>
      )}
      {!etat.ok ? (
        <p role="alert" className="admin-meta-small text-[color:var(--color-admin-destructive-fg)]">
          {etat.error}
        </p>
      ) : etat.message ? (
        <p className="admin-meta-small">{etat.message}</p>
      ) : null}
    </div>
  );
}
