"use client";
// use-client: bouton « Établir un relevé rectificatif » avec retour sans recharger.

import { useActionState } from "react";

import {
  etablirRectificatifAction,
  type EtatActionRectificatif,
} from "@/features/apporteurs-reseau/releve-mensuel/actions-rectificatif";

const INITIAL: EtatActionRectificatif = { etat: "initial" };

export function BoutonRectificatif({ id }: { id: string }) {
  const [etat, action, enCours] = useActionState(etablirRectificatifAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="admin-button" disabled={enCours}>
        Établir un relevé rectificatif
      </button>
      {etat.etat === "initial" ? null : (
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
      )}
    </form>
  );
}
