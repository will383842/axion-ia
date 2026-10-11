"use client";
// use-client: retour du geste sans recharger la page.

import { useActionState } from "react";

import {
  envoyerRattrapageFormateursAction,
  type EtatGesteInvitation,
} from "@/features/admin-job-applications/invitation-formateur-actions";

const INITIAL: EtatGesteInvitation = { etat: "initial" };

export function EnvoyerRattrapageForm({
  empreinte,
  nombre,
}: {
  empreinte: string;
  nombre: number;
}): React.ReactElement {
  const [etat, action, enCours] = useActionState(envoyerRattrapageFormateursAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-3)]">
      <input type="hidden" name="confirmer" value="oui" />
      <input type="hidden" name="empreinte" value={empreinte} />
      <div>
        <button type="submit" className="admin-button" disabled={enCours || nombre === 0}>
          {enCours ? "Envoi…" : `Envoyer l'invitation à ces ${nombre} personne(s)`}
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
