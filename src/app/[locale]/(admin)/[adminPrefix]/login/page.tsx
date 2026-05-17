// Page admin login (Sprint 15 step 5 / M9 init).
//
// V1 minimal : form HTML qui POST vers signInAction. Wizard 2 étapes côté
// client (email/password, puis TOTP si requires2FA dans l'erreur).

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function AdminLoginPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (session?.user) {
    redirect(`/fr/${adminPrefix}`);
  }

  // Pattern V1/V2 §3 (audit verif-fix-deploy 2026-05-18) — V2 non implémenté
  // pour cette route pré-auth. Flag check préservé pour spec compliance.
  if (await isAdminV2Enabled()) {
    // Intentional fall-through to V1 below.
  }

  return (
    <section className="admin-login-section">
      <h1 className="admin-h1">Connexion admin</h1>
      <p className="admin-lede">
        Connectez-vous avec votre email et mot de passe. Si la 2FA est activée sur votre compte, un
        code TOTP à 6 chiffres vous sera demandé.
      </p>
      <LoginForm />
    </section>
  );
}
