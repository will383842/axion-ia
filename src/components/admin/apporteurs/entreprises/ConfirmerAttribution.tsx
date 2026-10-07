"use client";
// use-client: un bouton à confirmer en deux temps, avec retour sans recharger.

// « Confirmer l'attribution maintenant » (2026-10-07) : attribution définitive tout de suite
// (contrat 2.2, art. 3.2). Proposé après « Bien reçu » seulement : avant, la prise de
// contact avec l'entreprise et la réponse à l'apporteur ne seraient jamais parties.

import { useActionState, useState } from "react";

import { confirmerAttributionMaintenantAction } from "@/features/apporteurs-reseau/actions-attribution";
import type { EtatAction } from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };

export function ConfirmerAttribution({ id }: { id: string }) {
  const [etat, confirmer, enCours] = useActionState(confirmerAttributionMaintenantAction, INITIAL);
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
      action={confirmer}
      className="flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
    >
      <input type="hidden" name="id" value={id} />
      {demande ? (
        <>
          <span>L&apos;attribution deviendra définitive dès maintenant.</span>
          <button type="submit" className="admin-button" disabled={enCours}>
            Oui, confirmer
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
          Confirmer l&apos;attribution maintenant
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
