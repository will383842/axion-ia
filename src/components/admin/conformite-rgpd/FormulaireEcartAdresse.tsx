"use client";
// use-client: useActionState — garder la saisie quand le serveur refuse le geste.

// Conformité RGPD — « Mettre une adresse à l'écart » (super_admin). Classes de la console seulement.

import { useActionState } from "react";

import { AdminSubmitButton } from "@/components/admin/ui/AdminSubmitButton";
import {
  ecarterAdresseAction,
  type EtatEcartAdresse,
} from "@/features/conformite-rgpd/actions-ecart-adresse";

export function FormulaireEcartAdresse() {
  const [etat, action] = useActionState<EtatEcartAdresse, FormData>(ecarterAdresseAction, null);
  return (
    <form action={action} className="admin-card flex flex-col gap-[var(--space-admin-3)]">
      <h3 className="text-[length:var(--text-admin-sm)] font-semibold">
        Mettre une adresse à l&apos;écart
      </h3>
      <p className="admin-help">
        Pour une demande d&apos;effacement reçue par e-mail, par le portail stagiaire ou en message
        privé (adresse à vérifier d&apos;abord). La personne ne reçoit plus AUCUN envoi,
        convocations et factures comprises. Rien n&apos;est supprimé.
      </p>
      <div className="admin-field flex flex-col gap-[var(--space-admin-1)]">
        <label htmlFor="ecart-email" className="admin-label">
          Adresse e-mail *
        </label>
        <input
          id="ecart-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          className="admin-input"
        />
      </div>
      <div className="admin-field flex flex-col gap-[var(--space-admin-1)]">
        <label htmlFor="ecart-motif" className="admin-label">
          Motif *
        </label>
        <input
          id="ecart-motif"
          name="motif"
          type="text"
          required
          minLength={3}
          maxLength={500}
          className="admin-input"
        />
        <p className="admin-help">Sans adresse e-mail : le motif est gardé au journal.</p>
      </div>
      {etat?.ok === false ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {etat.erreur}
        </p>
      ) : null}
      {etat?.ok === true ? (
        <p role="status" className="admin-alert admin-alert-success">
          {etat.message}
        </p>
      ) : null}
      <AdminSubmitButton>Mettre à l&apos;écart</AdminSubmitButton>
    </form>
  );
}
