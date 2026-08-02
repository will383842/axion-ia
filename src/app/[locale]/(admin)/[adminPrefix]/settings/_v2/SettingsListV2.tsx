// Refonte admin mai 2026 — PR 11 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Settings V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminButton,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { formatDateFrShort } from "@/lib/format-date-fr";

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
  const columns: ReadonlyArray<AdminTableColumn<SettingRow>> = [
    {
      key: "key",
      header: "Clé",
      cell: (s) => <code className="admin-meta-small">{s.key}</code>,
    },
    {
      key: "value",
      header: "Valeur (JSON)",
      cell: (s) => (
        <pre className="admin-json admin-json-cell">{JSON.stringify(s.value, null, 2)}</pre>
      ),
    },
    {
      key: "description",
      header: "Description",
      cell: (s) => <span className="admin-meta-small">{s.description ?? "—"}</span>,
    },
    {
      key: "updatedAt",
      header: "Mise à jour",
      cell: (s) => formatDateFrShort(s.updatedAt),
    },
  ];

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

      {settings.length === 0 ? (
        <AdminEmptyState title="Aucun paramètre." />
      ) : (
        <AdminTable
          columns={columns}
          rows={settings}
          getRowId={(s) => s.key}
          caption="Liste des paramètres"
          rowAction={(s) => (
            <AdminButton
              href={`/fr/${adminPrefix}/settings/${encodeURIComponent(s.key)}`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Éditer
            </AdminButton>
          )}
        />
      )}
    </AdminPageShell>
  );
}
