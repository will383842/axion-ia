"use client";
// use-client: formulaire à état local (saisie, envoi en cours, message de retour).

// Fiche apporteur : « Corriger le nom » (prénom et nom), tant que le contrat n'est pas signé.
// Le contrôle du droit et du contrat signé est refait côté serveur (`corrigerNomAction`).

import { useState, useTransition } from "react";

import { corrigerNomAction } from "@/features/apporteurs-reseau/actions-identite";

export function CorrigerNom({
  apporteurId,
  prenom,
  nom,
}: {
  apporteurId: string;
  prenom: string;
  nom: string;
}) {
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <details className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
      <summary className="cursor-pointer">Corriger le nom</summary>
      <form
        className="mt-[var(--space-admin-2)] flex flex-wrap items-end gap-[var(--space-admin-2)]"
        onSubmit={(ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.currentTarget);
          demarrer(async () => {
            setRetour(
              await corrigerNomAction({
                apporteurId,
                prenom: String(fd.get("prenom") ?? ""),
                nom: String(fd.get("nom") ?? ""),
              }),
            );
          });
        }}
      >
        <label className="flex flex-col gap-1">
          Prénom
          <input
            name="prenom"
            required
            maxLength={80}
            defaultValue={prenom}
            className="admin-input"
          />
        </label>
        <label className="flex flex-col gap-1">
          Nom
          <input name="nom" required maxLength={80} defaultValue={nom} className="admin-input" />
        </label>
        <button type="submit" className="admin-button-secondary" disabled={enCours}>
          Enregistrer
        </button>
        {retour ? (
          <p
            role={retour.ok ? "status" : "alert"}
            className={
              retour.ok
                ? "text-[color:var(--color-admin-success)]"
                : "text-[color:var(--color-admin-destructive)]"
            }
          >
            {retour.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
