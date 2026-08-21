"use client";
// use-client: useActionState bind createAdminUserAction (super_admin only).

import { useActionState } from "react";
import { createAdminUserAction, type CreateUserState } from "@/features/admin-users/actions";
import { ROLES_ADMIN, LIBELLES_ROLE, DESCRIPTIONS_ROLE } from "@/features/admin-users/roles";

const init: CreateUserState = { ok: false, error: "" };

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createAdminUserAction, init);

  return (
    <form action={formAction} className="admin-form">
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="name" className="admin-label">
            Nom complet
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={255}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="email" className="admin-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="admin-input"
            disabled={pending}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="password" className="admin-label">
            Mot de passe initial (min 12 chars)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            className="admin-input"
            disabled={pending}
            autoComplete="new-password"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="role" className="admin-label">
            Rôle
          </label>
          <select id="role" name="role" required className="admin-input" disabled={pending}>
            {/* 🔴 `D6-2-M1` — ce menu offrait quatre rôles, écrits un à un, alors
                que l&apos;enum en portait six depuis le 2026-08-15 : personne ne
                pouvait attribuer « secrétaire » ou « responsable qualité »
                autrement qu&apos;en SQL. Il se dérive du SSOT, comme le schéma
                `zod` qui valide sa réponse — les deux ne peuvent plus diverger. */}
            {ROLES_ADMIN.map((role) => (
              <option key={role} value={role}>
                {LIBELLES_ROLE[role]} ({DESCRIPTIONS_ROLE[role]})
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          Utilisateur créé. Communiquez le mot de passe initial de manière sécurisée. Le user devra
          activer 2FA au premier login si rôle super_admin/admin.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Création…" : "Créer l'utilisateur"}
      </button>
    </form>
  );
}
