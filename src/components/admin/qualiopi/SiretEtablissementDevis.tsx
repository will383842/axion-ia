"use client";
// use-client: saisie du SIRET de l'établissement qui commande, avec retour sans recharger.

// Contrat d'apporteur 2.6 (art. 3.1) : le SIRET de l'établissement qui COMMANDE, porté par le
// devis (facultatif). Il passe avant celui de la fiche client pour attribuer la commande à
// l'apporteur de cet établissement (ex. le siège paie, l'agence de Grenoble commande).

import { useActionState } from "react";

import { enregistrerSiretDevisAction } from "@/features/apporteurs-reseau/actions-etablissement";
import type { EtatAction } from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };

export function SiretEtablissementDevis({
  devisId,
  siret,
}: {
  devisId: string;
  siret: string | null;
}) {
  const [etat, enregistrer, enCours] = useActionState(enregistrerSiretDevisAction, INITIAL);
  return (
    <form
      action={enregistrer}
      className="flex flex-wrap items-end gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
    >
      <input type="hidden" name="devisId" value={devisId} />
      <label className="flex flex-col gap-1">
        SIRET de l&apos;établissement qui commande (facultatif)
        <input
          name="siret"
          defaultValue={siret ?? ""}
          inputMode="numeric"
          maxLength={17}
          placeholder="14 chiffres — sinon celui de la fiche client"
          className="admin-input"
        />
      </label>
      <button type="submit" className="admin-button-secondary" disabled={enCours}>
        Enregistrer
      </button>
      {etat.etat !== "initial" ? (
        <span
          role={etat.etat === "erreur" ? "alert" : "status"}
          className={
            etat.etat === "erreur"
              ? "text-[color:var(--color-admin-destructive)]"
              : "text-[color:var(--color-admin-success)]"
          }
        >
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}
