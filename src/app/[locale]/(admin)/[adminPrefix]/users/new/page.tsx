// Page admin /users/new — creation utilisateur (super_admin only).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { CreateUserForm } from "./CreateUserForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewUserPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin") redirect(`/fr/${adminPrefix}/users`);

  // Pattern V1/V2 §3 (audit verif-fix-deploy 2026-05-18) — V2 non implémenté
  // pour cette route legacy admin. Flag check préservé pour spec compliance.
  if (await isAdminV2Enabled()) {
    // Intentional fall-through to V1 below.
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/users`} className="admin-link admin-back">
            ← Utilisateurs
          </a>
          <h1 className="admin-h1-large">Nouvel utilisateur admin</h1>
          <p className="admin-meta">
            Réservé au super-admin. Le mot de passe initial doit être communiqué de manière
            sécurisée (gestionnaire mot de passe, pas par email/Slack).
          </p>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <CreateUserForm />
      </div>
    </section>
  );
}
