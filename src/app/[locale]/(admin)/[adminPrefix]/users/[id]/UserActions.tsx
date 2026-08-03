"use client";
// use-client: useActionState pour 3 actions (update + reset 2FA + reset pwd).

import { useActionState, useState } from "react";
import {
  updateAdminUserAction,
  reset2FACrossUserAction,
  resetPasswordCrossUserAction,
  type UpdateUserState,
  type Reset2FAState,
  type ResetPasswordState,
} from "@/features/admin-users/actions";

const initU: UpdateUserState = { ok: false, error: "" };
const init2FA: Reset2FAState = { ok: false, error: "" };
const initPwd: ResetPasswordState = { ok: false, error: "" };

interface Props {
  userId: string;
  userName: string;
  currentRole: string;
  currentStatus: string;
  twoFactorEnabled: boolean;
  isSuperAdmin: boolean;
}

export function UserActions({
  userId,
  userName,
  currentRole,
  currentStatus,
  twoFactorEnabled,
  isSuperAdmin,
}: Props) {
  const [uState, uAction, uPending] = useActionState(updateAdminUserAction, initU);
  const [resetState, resetAction, resetPending] = useActionState(reset2FACrossUserAction, init2FA);
  const [pwdState, pwdAction, pwdPending] = useActionState(resetPasswordCrossUserAction, initPwd);
  const [confirm2FA, setConfirm2FA] = useState(false);
  const [confirmPwd, setConfirmPwd] = useState(false);

  return (
    <div className="admin-actions-stack">
      {/* Update name + role + status */}
      <form action={uAction} className="admin-form">
        <input type="hidden" name="id" value={userId} />
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="name" className="admin-label">
              Nom
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={userName}
              className="admin-input"
              disabled={uPending}
            />
          </div>
          {isSuperAdmin && (
            <div className="admin-field">
              <label htmlFor="role" className="admin-label">
                Rôle (modifiable par un Super Admin uniquement)
              </label>
              <select
                id="role"
                name="role"
                defaultValue={currentRole}
                className="admin-input"
                disabled={uPending}
              >
                <option value="reader">Lecteur</option>
                <option value="editor">Éditeur</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          )}
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={currentStatus}
              className="admin-input"
              disabled={uPending}
            >
              <option value="active">Actif</option>
              <option value="suspended">Suspendu</option>
            </select>
          </div>
        </div>
        {uState.ok ? (
          <p role="status" className="admin-alert admin-alert-success">
            Mise à jour enregistrée.
          </p>
        ) : uState.error ? (
          <p role="alert" className="admin-alert admin-alert-error">
            {uState.error}
          </p>
        ) : null}
        <button type="submit" disabled={uPending} className="admin-button">
          {uPending ? "Enregistrement..." : "Mettre à jour"}
        </button>
      </form>

      {/* Reset 2FA cross-user (super_admin only) */}
      {isSuperAdmin && twoFactorEnabled && (
        <div className="admin-card admin-card-inline">
          <h3 className="admin-h2">Réinitialiser la double authentification</h3>
          <p className="admin-meta">
            Cette personne devra reconfigurer sa double authentification à sa prochaine connexion.
            L&apos;opération est enregistrée dans le journal.
          </p>
          {!confirm2FA ? (
            <button
              type="button"
              className="admin-button-ghost"
              onClick={() => setConfirm2FA(true)}
            >
              Réinitialiser…
            </button>
          ) : (
            <form action={resetAction} className="admin-filters-actions">
              <input type="hidden" name="id" value={userId} />
              <button
                type="submit"
                className="admin-button admin-button-refuse"
                disabled={resetPending}
              >
                {resetPending ? "Réinitialisation…" : "Confirmer la réinitialisation"}
              </button>
              <button
                type="button"
                className="admin-button-ghost"
                onClick={() => setConfirm2FA(false)}
                disabled={resetPending}
              >
                Annuler
              </button>
            </form>
          )}
          {resetState.ok && (
            <p role="status" className="admin-alert admin-alert-success">
              Double authentification réinitialisée. Cette personne devra la reconfigurer à sa
              prochaine connexion.
            </p>
          )}
          {!resetState.ok && resetState.error && (
            <p role="alert" className="admin-alert admin-alert-error">
              {resetState.error}
            </p>
          )}
        </div>
      )}

      {/* Reset password cross-user (super_admin only) */}
      {isSuperAdmin && (
        <div className="admin-card admin-card-inline">
          <h3 className="admin-h2">Réinitialiser le mot de passe</h3>
          <p className="admin-meta">
            Définit un nouveau mot de passe, que vous communiquerez de manière sécurisée.
            L&apos;opération est enregistrée dans le journal.
          </p>
          {!confirmPwd ? (
            <button
              type="button"
              className="admin-button-ghost"
              onClick={() => setConfirmPwd(true)}
            >
              Réinitialiser…
            </button>
          ) : (
            <form action={pwdAction} className="admin-form">
              <input type="hidden" name="id" value={userId} />
              <div className="admin-field">
                <label htmlFor="newPassword" className="admin-label">
                  Nouveau mot de passe (12 caractères minimum)
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  minLength={12}
                  className="admin-input"
                  disabled={pwdPending}
                  autoComplete="new-password"
                />
              </div>
              <div className="admin-filters-actions">
                <button
                  type="submit"
                  className="admin-button admin-button-refuse"
                  disabled={pwdPending}
                >
                  {pwdPending ? "Réinitialisation…" : "Confirmer la réinitialisation"}
                </button>
                <button
                  type="button"
                  className="admin-button-ghost"
                  onClick={() => setConfirmPwd(false)}
                  disabled={pwdPending}
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
          {pwdState.ok && (
            <p role="status" className="admin-alert admin-alert-success">
              Mot de passe réinitialisé. Communiquez-le de manière sécurisée.
            </p>
          )}
          {!pwdState.ok && pwdState.error && (
            <p role="alert" className="admin-alert admin-alert-error">
              {pwdState.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
