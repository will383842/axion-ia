"use client";
// use-client: useActionState pour afficher le refus (rôle, texte inconnu) ou la confirmation.

import { useActionState } from "react";

import {
  validerTexteEmailFormAction,
  type EtatValidation,
} from "@/server/email/textes-valides-actions";

const INITIAL: EtatValidation = { ok: true, message: "" };

interface Props {
  gabarit: string;
  variante: string | null;
  valide: boolean;
  /** Lot 8A — l'empreinte du texte affiché : l'action refuse si le texte a changé depuis. */
  empreinte: string;
}

/** M1 — valider le texte affiché, ou retirer sa validation (super-admin). */
export function BoutonValidationTexte({ gabarit, variante, valide, empreinte }: Props) {
  const [etat, formAction, enCours] = useActionState(validerTexteEmailFormAction, INITIAL);
  return (
    <div className="space-y-2">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            valide &&
            !window.confirm("Retirer la validation ? Plus aucun e-mail de ce texte ne partira.")
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="gabarit" value={gabarit} />
        <input type="hidden" name="variante" value={variante ?? ""} />
        <input type="hidden" name="valide" value={valide ? "0" : "1"} />
        <input type="hidden" name="empreinte" value={empreinte} />
        <button
          type="submit"
          className={valide ? "admin-button-ghost" : "admin-button"}
          disabled={enCours}
        >
          {valide ? "Retirer la validation" : "Valider ce texte"}
        </button>
      </form>
      {!etat.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {etat.error}
        </p>
      ) : etat.message ? (
        <p className="text-fg-soft text-sm">{etat.message}</p>
      ) : null}
    </div>
  );
}
