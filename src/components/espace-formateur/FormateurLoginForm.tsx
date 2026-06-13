"use client";
// use-client: formulaire de connexion passwordless (useActionState).

import { useActionState } from "react";
import {
  sendFormateurMagicLinkAction,
  type FormateurAuthState,
} from "@/server/actions/formateur/auth.actions";

export function FormateurLoginForm(): React.ReactElement {
  const [state, formAction, pending] = useActionState<FormateurAuthState | undefined, FormData>(
    sendFormateurMagicLinkAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="email" className="text-mocha block text-sm font-medium">
        Votre adresse e-mail professionnelle
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="prenom.nom@exemple.fr"
        className="border-border focus:border-terracotta block w-full rounded-md border px-3 py-2 text-sm outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-terracotta w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
      {state ? (
        <p className={`text-sm ${state.ok ? "text-success" : "text-error"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
