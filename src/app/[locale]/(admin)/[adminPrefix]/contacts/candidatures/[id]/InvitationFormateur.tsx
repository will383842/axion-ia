"use client";
// use-client: retour du geste « J'ai répondu ailleurs » sans recharger la page.

// L-INV (S-UX-16) — sur une candidature de formateur indépendant : où en est
// l'invitation à l'échange, et le geste « J'ai répondu ailleurs » qui arrête les rappels.

import { useActionState } from "react";

import {
  reponduAilleursFormateurAction,
  type EtatGesteInvitation,
} from "@/features/admin-job-applications/invitation-formateur-actions";

const INITIAL: EtatGesteInvitation = { etat: "initial" };

export function InvitationFormateur({
  candidatureId,
  resume,
  peutDeclarer,
}: {
  candidatureId: string;
  resume: string;
  peutDeclarer: boolean;
}): React.ReactElement {
  const [etat, action, enCours] = useActionState(reponduAilleursFormateurAction, INITIAL);
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <p className="text-[length:var(--text-admin-sm)]">{resume}</p>
      {peutDeclarer ? (
        <form action={action}>
          <input type="hidden" name="candidatureId" value={candidatureId} />
          <button type="submit" className="admin-button-secondary" disabled={enCours}>
            {enCours ? "Enregistrement…" : "J'ai répondu ailleurs"}
          </button>
        </form>
      ) : null}
      {etat.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {etat.message}
        </p>
      ) : etat.etat === "ok" ? (
        <p role="status" className="text-[color:var(--color-admin-success)]">
          {etat.message}
        </p>
      ) : null}
    </div>
  );
}
