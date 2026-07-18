"use client";
// use-client: formulaire de re-demande d'accès avec état local (input email + submit async).

/**
 * Formulaire self-service de re-demande d'un lien d'accès à l'espace stagiaire.
 * Anti-énumération : le message de succès est TOUJOURS le même (l'action ne
 * révèle jamais si l'email correspond à un stagiaire).
 */

import { useState } from "react";
import { demanderAccesPortailAction } from "@/server/actions/qualiopi/portail";

export function DemanderAccesForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    try {
      await demanderAccesPortailAction({ email });
    } catch {
      // fail-soft : on affiche le même message générique
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div
        role="status"
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-6 text-center"
      >
        <p className="text-sm font-semibold text-emerald-800">Demande enregistrée</p>
        <p className="mt-2 text-sm text-emerald-700">
          Si un espace est associé à cette adresse, un email contenant votre lien d&apos;accès vient
          d&apos;être envoyé. Pensez à vérifier vos indésirables.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="portail-email" className="mb-1 block text-sm font-medium text-gray-700">
          Votre adresse email
        </label>
        <input
          id="portail-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@exemple.fr"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
      </div>
      <button
        type="submit"
        disabled={state === "loading"}
        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
      >
        {state === "loading" ? "Envoi…" : "Recevoir mon lien d'accès"}
      </button>
    </form>
  );
}
