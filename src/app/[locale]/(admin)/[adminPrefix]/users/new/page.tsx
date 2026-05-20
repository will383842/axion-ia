// Page admin /users/new — creation utilisateur (super_admin only).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
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

  const v2 = await isAdminV2Enabled();
  if (v2) {
    return (
      <AdminPageShell width="narrow">
        <AdminPageHeader
          title="Nouvel utilisateur admin"
          description="Réservé au super-admin. Communiquer le mot de passe initial via gestionnaire de mots de passe."
          breadcrumbs={
            <a href={`/fr/${adminPrefix}/users`} className="admin-link admin-back">
              ← Utilisateurs
            </a>
          }
        />
        <div className="admin-card admin-card-wide">
          <CreateUserForm />
        </div>
      </AdminPageShell>
    );
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
