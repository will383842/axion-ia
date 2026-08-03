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
      {/* 🔴 La consigne disait « SCANNEZ ce secret » — or aucun QR code n'est
          rendu sur cette page (V1 sans QR, cf. le commentaire de page.tsx). On
          demandait donc de scanner du texte. L'utilisateur suit l'instruction,
          cherche un code à photographier, ne le trouve pas, et se croit bloqué
          sur l'écran qui protège son compte. */}
      <AdminPageHeader
        title="Activer la double authentification (2FA)"
        description="Recopiez la clé ci-dessous dans votre application d'authentification (Google Authenticator, Authy, 1Password, Bitwarden), puis saisissez le premier code qu'elle affiche."
      />

      {!start.ok ? (
        <AdminCard className="border-l-4 border-l-[color:var(--color-admin-destructive)]">
          <p className="admin-meta-block">{start.error}</p>
        </AdminCard>
      ) : (
        <>
          <AdminCard className="mb-[var(--space-admin-5)]">
            <p className="admin-card-label">Clé à recopier</p>
            <code className="admin-2fa-code">{start.secret}</code>
            {/* Cette clé DOIT être affichée — c'est l'objet de la page. Mais
                elle vaut un mot de passe : on le dit, plutôt que de la poser
                nue à l'écran comme une donnée ordinaire. */}
            <p className="admin-meta-small mt-[var(--space-admin-3)]">
              Cette clé vaut un mot de passe : ne la partagez pas, ne la photographiez pas, et ne la
              laissez pas affichée pendant un partage d&apos;écran.
            </p>
            {/* L'URI `otpauth://` contient LA MÊME clé, en clair. L'afficher
                d'emblée doublait l'exposition sans rien apporter à qui recopie
                simplement la clé ci-dessus. Elle reste accessible, repliée,
                pour qui veut fabriquer un QR code avec un outil externe. */}
            <details className="mt-[var(--space-admin-3)]">
              <summary className="admin-meta-small cursor-pointer select-none">
                Lien pour générer un QR code avec un outil externe
              </summary>
              <code className="admin-2fa-uri mt-[var(--space-admin-2)] block break-all">
                {start.otpauthUrl}
              </code>
            </details>
          </AdminCard>
          <Setup2FAForm />
        </>
      )}
    </AdminPageShell>
  );
}
