"use client";
// use-client: un bouton à confirmer en deux temps, avec retour sans recharger.

// « Étendre à toute l'entreprise » (contrat 2.6, art. 3.1) : à la demande de l'apporteur, Williams
// seul décide d'étendre une attribution d'établissement à toute l'entreprise (SIREN).

import { useActionState, useState, useTransition } from "react";

import {
  apercuExtensionAction,
  etendreALEntrepriseAction,
} from "@/features/apporteurs-reseau/actions-etablissement";
import type { EtatAction } from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };

export function EtendreALEntreprise({ id }: { id: string }) {
  const [etat, etendre, enCours] = useActionState(etendreALEntrepriseAction, INITIAL);
  const [demande, setDemande] = useState(false);
  const [apercu, setApercu] = useState<Array<{ siret: string; raison: string }> | null>(null);
  const [erreurApercu, setErreurApercu] = useState<string | null>(null);
  const [lecture, lire] = useTransition();
  // Avant de valider, la liste de ce qui sera EXCLU (art. 3.3, relecture de a1).
  const demander = () =>
    lire(async () => {
      setErreurApercu(null);
      const r = await apercuExtensionAction(id);
      if (r.ok) {
        setApercu(r.exclusions);
        setDemande(true);
      } else setErreurApercu(r.message);
    });
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
            Toute l&apos;entreprise sera attribuée à cet apporteur
            {apercu && apercu.length > 0 ? ", SAUF :" : " (aucun établissement exclu)."}
          </span>
          {apercu && apercu.length > 0 ? (
            <ul className="w-full list-disc pl-[var(--space-admin-5)]">
              {apercu.map((x) => (
                <li key={x.siret}>
                  SIRET {x.siret} — {x.raison}
                </li>
              ))}
            </ul>
          ) : null}
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
        <button
          type="button"
          className="admin-button-secondary"
          disabled={lecture}
          onClick={demander}
        >
          {lecture ? "…" : "Étendre à toute l'entreprise"}
        </button>
      )}
      {erreurApercu ? (
        <span role="alert" className="text-[color:var(--color-admin-destructive)]">
          {erreurApercu}
        </span>
      ) : null}
      {etat.etat === "erreur" ? (
        <span role="alert" className="text-[color:var(--color-admin-destructive)]">
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}
