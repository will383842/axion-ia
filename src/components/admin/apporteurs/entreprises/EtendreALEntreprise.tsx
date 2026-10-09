"use client";
// use-client: un bouton à confirmer en deux temps, avec retour sans recharger.

// « Étendre à toute l'entreprise » (contrat 2.6, art. 3.1) : à la demande de l'apporteur, Williams
// seul décide d'étendre une attribution d'établissement à toute l'entreprise (SIREN).

import { useActionState, useState } from "react";

import { etendreALEntrepriseAction } from "@/features/apporteurs-reseau/actions-etablissement";
import type { EtatAction } from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };

export function EtendreALEntreprise({ id }: { id: string }) {
  const [etat, etendre, enCours] = useActionState(etendreALEntrepriseAction, INITIAL);
  const [demande, setDemande] = useState(false);
  if (etat.etat === "ok") {
    return (
      <p
        role="status"
        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
      >
        {etat.message}
      </p>
    );
  }
  return (
    <form
      action={etendre}
      className="flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
    >
      <input type="hidden" name="id" value={id} />
      {demande ? (
        <>
          <span>
            Toute l&apos;entreprise sera attribuée à cet apporteur, sauf les établissements déjà
            attribués à d&apos;autres.
          </span>
          <button type="submit" className="admin-button" disabled={enCours}>
            Oui, étendre
          </button>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={enCours}
            onClick={() => setDemande(false)}
          >
            Annuler
          </button>
        </>
      ) : (
        <button type="button" className="admin-button-secondary" onClick={() => setDemande(true)}>
          Étendre à toute l&apos;entreprise
        </button>
      )}
      {etat.etat === "erreur" ? (
        <span role="alert" className="text-[color:var(--color-admin-destructive)]">
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}
