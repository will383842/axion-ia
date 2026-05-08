// Page admin login (Sprint 15 step 5 / M9 init).
//
// V1 minimal : form HTML qui POST vers signInAction. Wizard 2 étapes côté
// client (email/password, puis TOTP si requires2FA dans l'erreur).

import { auth } from "@/auth";
import { redirect } from "next/navigation";
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
  return (
    <section className="admin-login-section">
      <h1 className="admin-h1">Connexion admin</h1>
      <p className="admin-lede">
        Authentification 2FA TOTP requise pour les rôles super_admin et admin.
      </p>
      <LoginForm />
    </section>
  );
}
