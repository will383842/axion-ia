// Page admin /users/[id] — detail + actions (suspend, role, reset 2FA, reset password).

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminUserDetailAction } from "@/features/admin-users/actions";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { UserActions } from "./UserActions";
import { formatDateFr, formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Éditeur",
  reader: "Lecteur",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
};

export default async function UserDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const callerRole = (session.user as { role?: string }).role;

  const user = await getAdminUserDetailAction(id);
  if (!user) notFound();

  const isSelf = id === session.user.id;
  const canManage = callerRole === "super_admin" || callerRole === "admin";
  const isSuperAdmin = callerRole === "super_admin";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={user.name}
        description={`${user.email} · créé le ${formatDateFrShort(user.createdAt)}${isSelf ? " · (c'est vous)" : ""}`}
        breadcrumbs={
          <a href={`/fr/${adminPrefix}/users`} className="admin-link admin-back">
            ← Utilisateurs
          </a>
        }
        meta={
          <>
            <span className={`admin-badge admin-badge-${user.role}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <span className={`admin-badge admin-badge-${user.status}`}>
              {STATUS_LABELS[user.status] ?? user.status}
            </span>
          </>
        }
      />
      <div className="admin-detail-grid">
        <div className="admin-card">
          <h2 className="admin-h2">Identité</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Nom</dt>
            <dd className="admin-dd">{user.name}</dd>
            <dt className="admin-dt">Email</dt>
            <dd className="admin-dd">{user.email}</dd>
            <dt className="admin-dt">Rôle</dt>
            <dd className="admin-dd">
              <span className={`admin-badge admin-badge-${user.role}`}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </dd>
            <dt className="admin-dt">Statut</dt>
            <dd className="admin-dd">
              <span className={`admin-badge admin-badge-${user.status}`}>
                {STATUS_LABELS[user.status] ?? user.status}
              </span>
            </dd>
          </dl>
        </div>
        <div className="admin-card">
          <h2 className="admin-h2">Sécurité</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">2FA TOTP</dt>
            <dd className="admin-dd">{user.twoFactorEnabled ? "Activée" : "Non activée"}</dd>
            <dt className="admin-dt">Dernier login</dt>
            <dd className="admin-dd">
              {user.lastLoginAt ? formatDateFr(user.lastLoginAt) : "Jamais connecté"}
            </dd>
            {user.lastLoginIp && (
              <>
                <dt className="admin-dt">IP dernier login</dt>
                <dd className="admin-dd admin-meta-small">{user.lastLoginIp}</dd>
              </>
            )}
            <dt className="admin-dt">Mise à jour</dt>
            <dd className="admin-dd">{formatDateFrShort(user.updatedAt)}</dd>
          </dl>
        </div>
        {canManage && !isSelf && (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Actions admin</h2>
            <UserActions
              userId={user.id}
              userName={user.name}
              currentRole={user.role}
              currentStatus={user.status}
              twoFactorEnabled={user.twoFactorEnabled}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        )}
        {isSelf && (
          <div className="admin-card admin-card-wide">
            <p className="admin-meta">
              Vous ne pouvez pas modifier votre propre compte ici. Pour activer/désactiver votre
              propre 2FA, utilisez{" "}
              <a href={`/fr/${adminPrefix}/2fa/setup`} className="admin-link">
                /2fa/setup
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
