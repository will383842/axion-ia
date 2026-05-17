// Refonte admin mai 2026 — PR 11 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// 2FA setup V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { Setup2FAForm } from "../Setup2FAForm";

interface StartResult {
  ok: boolean;
  error?: string;
  secret?: string;
  otpauthUrl?: string;
}

interface Props {
  start: StartResult;
}

export function Setup2FAV2({ start }: Props): React.ReactElement {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Activer la double authentification (2FA)"
        description="Scannez ce secret avec Google Authenticator, Authy, 1Password ou Bitwarden, puis entrez le premier code généré pour finaliser."
      />

      {!start.ok ? (
        <AdminCard className="border-l-4 border-l-[color:var(--color-admin-destructive)]">
          <p className="admin-meta-block">{start.error}</p>
        </AdminCard>
      ) : (
        <>
          <AdminCard className="mb-[var(--space-admin-5)]">
            <p className="admin-card-label">Secret TOTP (à scanner manuellement)</p>
            <code className="admin-2fa-code">{start.secret}</code>
            <p className="admin-2fa-uri-hint">
              URI otpauth (compatible générateur QR externe) :{" "}
              <code className="admin-2fa-uri">{start.otpauthUrl}</code>
            </p>
          </AdminCard>
          <Setup2FAForm />
        </>
      )}
    </AdminPageShell>
  );
}
