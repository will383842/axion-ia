"use client";
// use-client: état du formulaire (useActionState) et message de confirmation sans recharger.

import { useActionState } from "react";

import { demanderLienEspace } from "./actions";
import type { EtatRetrouver } from "./messages";

export function FormulaireRetrouver() {
  const [etat, action, enCours] = useActionState<EtatRetrouver | undefined, FormData>(
    demanderLienEspace,
    undefined,
  );
  if (etat?.envoye) {
    return (
      <p role="status" className="bg-sand mt-6 rounded-2xl p-5 text-[16px] leading-relaxed">
        {etat.message}
      </p>
    );
  }
  return (
    <form action={action} className="mt-6 grid gap-4">
      <label className="grid gap-2">
        <span className="font-semibold">Votre adresse e-mail</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          className="border-border bg-paper min-h-[48px] rounded-xl border px-4 text-[17px]"
        />
      </label>
      {/* Champ piège : invisible pour une personne, rempli par un robot. */}
      <input
        type="text"
        name="site"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      {etat && !etat.envoye ? (
        <p role="alert" className="text-terracotta-deep text-[15px]">
          {etat.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={enCours}
        className="bg-terracotta-deep min-h-[48px] rounded-xl px-5 text-[17px] font-bold text-white"
      >
        {enCours ? "Envoi…" : "Recevoir mon lien"}
      </button>
    </form>
  );
}
