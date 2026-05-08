// Page setup 2FA (Sprint 15 step 5).
//
// Flow :
// 1. Server Action setup2FAStartAction génère un secret + URI otpauth
// 2. La page affiche le secret en mode manual (V1 sans QR — Will pourra
//    ajouter qrcode lib en M9). User scan dans son authenticator.
// 3. User entre le 1er code TOTP → setup2FAConfirmAction valide + active.

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { setup2FAStartAction } from "@/features/admin-auth/actions";
import { Setup2FAForm } from "./Setup2FAForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function AdminSetup2FAPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  const start = await setup2FAStartAction();

  return (
    <section className="admin-2fa-section">
      <h1 className="admin-h1">Activer la double authentification (2FA)</h1>
      <p className="admin-lede">
        Scannez ce secret avec Google Authenticator, Authy, 1Password ou Bitwarden, puis entrez le
        premier code généré pour finaliser.
      </p>

      {!start.ok ? (
        <div className="admin-alert admin-alert-error">{start.error}</div>
      ) : (
        <>
          <div className="admin-card admin-2fa-secret-card">
            <p className="admin-card-label">Secret TOTP (à scanner manuellement)</p>
            <code className="admin-2fa-code">{start.secret}</code>
            <p className="admin-2fa-uri-hint">
              URI otpauth (compatible générateur QR externe) :{" "}
              <code className="admin-2fa-uri">{start.otpauthUrl}</code>
            </p>
          </div>
          <Setup2FAForm />
        </>
      )}
    </section>
  );
}
