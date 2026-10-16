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
      {/* V2-N-8 — le compte est ouvert sur l'adresse de la CANDIDATURE : une autre adresse
          ne reçoit rien, et la réponse (neutre, anti-énumération) ne peut pas le dire. */}
      <label htmlFor="email" className="text-mocha block text-sm font-medium">
        Votre adresse e-mail
      </label>
      <p id="email-aide" className="text-fg-muted text-sm">
        Celle de votre candidature, où vous recevez nos e-mails. Une autre adresse ne recevra rien.
      </p>
      {/* V2-N-9 — 16 px (`text-base`) : en dessous, l'iPhone zoome au toucher du champ. */}
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        aria-describedby="email-aide"
        placeholder="prenom.nom@exemple.fr"
        className="border-border-field focus:border-terracotta block min-h-[44px] w-full rounded-md border px-3 py-2 text-base outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-terracotta min-h-[44px] w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
      {/* V2-N-9 — zone annoncée aux lecteurs d'écran, présente avant la réponse. */}
      <div role="status">
        {state ? (
          <p className={`text-sm ${state.ok ? "text-success" : "text-error"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
