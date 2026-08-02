"use client";
// use-client: useActionState hook pour bind setup2FAConfirmAction Server Action au form.

import { useActionState } from "react";
import { setup2FAConfirmAction, type Setup2FAConfirmState } from "@/features/admin-auth/actions";

const initialState: Setup2FAConfirmState = { ok: false, error: "" };

export function Setup2FAForm() {
  const [state, formAction, pending] = useActionState(setup2FAConfirmAction, initialState);
  return (
    <form action={formAction} className="admin-form">
      <div className="admin-field">
        <label htmlFor="code" className="admin-label">
          Premier code TOTP (6 chiffres)
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          className="admin-input admin-input-totp-large"
          disabled={pending}
        />
      </div>
      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          2FA activée avec succès. Vous serez requis(e) à chaque login.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}
      {/* Cf. LoginForm : `.admin-button` s'ajuste à son contenu depuis la
          refonte UI 2026-08-01, la pleine largeur est ici voulue. Modificateur
          maison et non `w-full`, inopérant face aux classes hors couche. */}
      <button type="submit" disabled={pending} className="admin-button admin-button-block">
        {pending ? "Vérification..." : "Activer 2FA"}
      </button>
    </form>
  );
}
