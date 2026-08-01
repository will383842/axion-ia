"use client";
// use-client: useActionState + useState hooks pour wizard 2 etapes login (email+password puis TOTP)
// + toggle show/hide password (UX courante : œil pour relire ce qu'on a tapé sans devoir tout retaper).

import { useActionState, useState } from "react";
import { signInAction, type SignInState } from "@/features/admin-auth/actions";

const initialState: SignInState = { ok: false, error: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [show2FA, setShow2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Si l'action retourne requires2FA, on bascule en step 2
  if (!state.ok && "requires2FA" in state && state.requires2FA && !show2FA) {
    setShow2FA(true);
  }

  return (
    <form action={formAction} className="admin-form">
      <div className="admin-field">
        <label htmlFor="email" className="admin-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="admin-input"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor="password" className="admin-label">
          Mot de passe
        </label>
        <div className="admin-input-with-toggle">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            minLength={8}
            className="admin-input"
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="admin-input-toggle"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            tabIndex={-1}
          >
            {showPassword ? "Masquer" : "Afficher"}
          </button>
        </div>
      </div>
      {show2FA && (
        <div className="admin-field">
          <label htmlFor="totp" className="admin-label">
            Code 2FA (6 chiffres)
          </label>
          <input
            id="totp"
            name="totp"
            type="text"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            className="admin-input admin-input-totp"
            disabled={pending}
          />
        </div>
      )}
      {!state.ok && state.error && (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      )}
      {/* Depuis la refonte UI 2026-08-01, `.admin-button` s'ajuste à son
          contenu ; ce formulaire vertical étroit veut la pleine largeur.
          `.admin-button-block` et NON `w-full` : les classes `.admin-*` sont
          hors couche CSS et l'emportent sur les utilitaires Tailwind, un
          `w-full` serait donc silencieusement sans effet ici. */}
      <button type="submit" className="admin-button admin-button-block" disabled={pending}>
        {pending ? "Connexion..." : show2FA ? "Vérifier le code 2FA" : "Continuer"}
      </button>
    </form>
  );
}
