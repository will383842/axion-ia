// Refonte admin mai 2026 — PR 11 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Settings V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

interface SettingRow {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: Date;
}

interface Props {
  adminPrefix: string;
  settings: ReadonlyArray<SettingRow>;
}

export function SettingsListV2({ adminPrefix, settings }: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Paramètres"
        description={`${settings.length} clé${settings.length > 1 ? "s" : ""} configurée${settings.length > 1 ? "s" : ""}`}
        actions={
          <Link href={`/fr/${adminPrefix}/settings/new`} className="admin-button">
            + Nouvelle clé
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <p className="admin-meta">
          Settings centralisés (pricing dynamique 3 modules, ROI simulator, CTA central, mode
          maintenance). Format JSON par clé. Modification par super_admin/admin uniquement,
          suppression par super_admin uniquement.
        </p>
      </AdminCard>

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
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
                      <Link
                        href={`/fr/${adminPrefix}/settings/${encodeURIComponent(s.key)}`}
                        className="admin-link"
                      >
                        Éditer →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
