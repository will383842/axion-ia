"use client";
// use-client: retour du geste sans recharger la page.

import { useActionState } from "react";

import {
  relireEchangesDuPontAction,
  type EtatPontEchanges,
} from "@/server/actions/qualiopi/formateurs-pont-echanges";

const INITIAL: EtatPontEchanges = { etat: "initial" };

export function RelirePontForm(): React.ReactElement {
  const [etat, action, enCours] = useActionState(relireEchangesDuPontAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-3)]">
      <input type="hidden" name="confirmer" value="oui" />
      <div>
        <button type="submit" className="admin-button" disabled={enCours}>
          {enCours ? "Relecture…" : "Figer la liste et relire les échanges sans candidature"}
        </button>
      </div>
      {etat.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {etat.message}
        </p>
      ) : etat.etat === "ok" ? (
        <p role="status" className="text-[color:var(--color-admin-success)]">
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}
