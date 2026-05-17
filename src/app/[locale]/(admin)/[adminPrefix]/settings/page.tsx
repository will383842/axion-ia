// Listing settings admin (M9 Tier 3 section 2).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listSettingsAction } from "@/features/admin-settings/actions";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { SettingsListV2 } from "./_v2/SettingsListV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function SettingsListPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const settings = await listSettingsAction();

  if (await isAdminV2Enabled()) {
    return <SettingsListV2 adminPrefix={adminPrefix} settings={settings} />;
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Paramètres</h1>
          <p className="admin-meta">
            {settings.length} clé{settings.length > 1 ? "s" : ""} configurée
            {settings.length > 1 ? "s" : ""}
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/settings/new`} className="admin-button">
          + Nouvelle clé
        </a>
      </div>

      <div className="admin-card admin-meta-block">
        <p className="admin-meta">
          Settings centralisés (pricing dynamique 3 modules, ROI simulator, CTA central, mode
          maintenance). Format JSON par clé. Modification par super_admin/admin uniquement,
          suppression par super_admin uniquement.
        </p>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Clé</th>
              <th>Valeur (JSON)</th>
              <th>Description</th>
              <th>Mise à jour</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-table-empty">
                  Aucun paramètre.
                </td>
              </tr>
            ) : (
              settings.map((s) => (
                <tr key={s.key}>
                  <td>
                    <code className="admin-meta-small">{s.key}</code>
                  </td>
                  <td>
                    <pre className="admin-json admin-json-cell">
                      {JSON.stringify(s.value, null, 2)}
                    </pre>
                  </td>
                  <td className="admin-meta-small">{s.description ?? "—"}</td>
                  <td>{s.updatedAt.toISOString().slice(0, 10)}</td>
                  <td>
                    <a
                      href={`/fr/${adminPrefix}/settings/${encodeURIComponent(s.key)}`}
                      className="admin-link"
                    >
                      Éditer →
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
