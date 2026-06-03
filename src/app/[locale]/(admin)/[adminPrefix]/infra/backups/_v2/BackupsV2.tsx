// Sauvegardes & DR V2 (ADR 0032) — présentation.
// AdminPageShell + AdminPageHeader + AdminStatCard + AdminCard + AdminTable.
// FR-only, Server Component pur (aucun JS client).

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminTable,
  AdminPagination,
  AdminEmptyState,
  type AdminTableColumn,
} from "@/components/admin/ui";
import { ageVsRpoLabel, formatBytes, formatDateFr, formatDuration } from "@/server/backups/format";
import { TriggerDrillButton } from "./TriggerDrillButton";
import {
  KIND_LABELS_FR,
  STATUS_LABELS_FR,
  type BackupBanners,
  type BackupComponentValue,
  type BackupHistoryItem,
  type BackupHistoryPage,
  type BackupOverviewRow,
} from "@/server/backups/types";

interface Props {
  adminPrefix: string;
  overview: ReadonlyArray<BackupOverviewRow>;
  history: BackupHistoryPage;
  banners: BackupBanners;
  activeComponent: BackupComponentValue | null;
}

function toneIcon(tone: BackupOverviewRow["tone"]): string {
  return tone === "success" ? "✅" : tone === "warning" ? "⚠️" : "🔴";
}

function statusPill(status: BackupHistoryItem["status"]) {
  const sev = status === "failed" ? "critical" : status === "warning" ? "warning" : "info";
  return (
    <span className={`admin-status-pill admin-severity-${sev}`}>{STATUS_LABELS_FR[status]}</span>
  );
}

export function BackupsV2({
  adminPrefix,
  overview,
  history,
  banners,
  activeComponent,
}: Props): React.ReactElement {
  const ok = overview.filter((o) => o.tone === "success").length;
  const warn = overview.filter((o) => o.tone === "warning").length;
  const bad = overview.filter((o) => o.tone === "destructive").length;
  const totalPages = Math.max(1, Math.ceil(history.total / history.pageSize));
  const baseHref = `/fr/${adminPrefix}/infra/backups`;

  const columns: ReadonlyArray<AdminTableColumn<BackupHistoryItem>> = [
    { key: "component", header: "Composant", cell: (r) => r.componentLabel },
    { key: "kind", header: "Type", cell: (r) => KIND_LABELS_FR[r.kind], hiddenBelow: "sm" },
    { key: "status", header: "Statut", cell: (r) => statusPill(r.status) },
    { key: "startedAt", header: "Démarré", cell: (r) => formatDateFr(r.startedAt) },
    {
      key: "duration",
      header: "Durée",
      cell: (r) => formatDuration(r.durationSec),
      hiddenBelow: "md",
      align: "right",
    },
    {
      key: "size",
      header: "Taille",
      cell: (r) => formatBytes(r.sizeBytes),
      hiddenBelow: "md",
      align: "right",
    },
    {
      key: "destinations",
      header: "Destinations",
      cell: (r) => r.destinations.join(" + ") || "—",
      hiddenBelow: "lg",
    },
    {
      key: "age",
      header: "Âge / RPO",
      cell: (r) => ageVsRpoLabel(r.ageVsRpoMin),
      hiddenBelow: "lg",
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Sauvegardes & DR"
        description="Suivi des sauvegardes (Postgres, PITR, Redis, fichiers, Docuseal, Plausible, secrets, miroir Git) et des tests de restauration. Données issues des scripts cron VPS + drill CI (ADR 0032)."
        actions={
          <span className="inline-flex items-center gap-[var(--space-admin-4)]">
            <TriggerDrillButton />
            <Link href={`/fr/${adminPrefix}/infra`} className="admin-link">
              ← Infra & outils
            </Link>
          </span>
        }
      />

      {/* Bandeau rouge si backup manqué / drill périmé */}
      {(banners.missedBackup || banners.staleDrill) && (
        <AdminCard className="admin-infra-card mb-[var(--space-admin-5)]">
          <div className="admin-infra-card-head">
            <strong>🔴 Attention sauvegardes</strong>
            <span className="admin-status-pill admin-severity-critical">● Action requise</span>
          </div>
          <ul className="admin-meta-block">
            {banners.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
            {banners.staleDrill && (
              <li>Un ou plusieurs composants n’ont pas de test de restauration récent.</li>
            )}
          </ul>
        </AdminCard>
      )}

      {/* KPIs */}
      <section
        aria-label="KPIs sauvegardes"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard label="Composants à jour" value={ok} tone={ok > 0 ? "success" : "default"} />
        <AdminStatCard
          label="En retard / alerte"
          value={warn}
          tone={warn > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="En échec / jamais"
          value={bad}
          tone={bad > 0 ? "destructive" : "default"}
        />
        <AdminStatCard label="Composants suivis" value={overview.length} />
      </section>

      {/* Vue d'ensemble par composant */}
      <h2 className="admin-h2">Vue d’ensemble</h2>
      <div className="admin-kpi-grid mb-[var(--space-admin-6)]">
        {overview.map((o) => (
          <div key={o.component} className="admin-card admin-infra-card">
            <div className="admin-infra-card-head">
              <strong>
                {toneIcon(o.tone)} {o.label}
              </strong>
              {o.lastStatus && (
                <span
                  className={`admin-status-pill admin-severity-${
                    o.tone === "destructive"
                      ? "critical"
                      : o.tone === "warning"
                        ? "warning"
                        : "info"
                  }`}
                >
                  {STATUS_LABELS_FR[o.lastStatus]}
                </span>
              )}
            </div>
            <p className="admin-meta-block">
              Dernier&nbsp;: {formatDateFr(o.lastAt)}
              {" · "}
              {formatBytes(o.sizeBytes)} · {formatDuration(o.durationSec)}
              <br />
              Destinations&nbsp;: {o.destinations.join(" + ") || "—"}
              <br />
              {ageVsRpoLabel(o.ageVsRpoMin)}
              <br />
              Dernier drill&nbsp;: {formatDateFr(o.lastDrillAt)}
              {o.drillStale && <span className="admin-severity-warning"> · périmé</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Historique paginé */}
      <h2 className="admin-h2">Historique{activeComponent ? ` — ${activeComponent}` : ""}</h2>
      {activeComponent && (
        <p className="admin-meta-block mb-[var(--space-admin-4)]">
          <Link href={baseHref} className="admin-link">
            ✕ Retirer le filtre composant
          </Link>
        </p>
      )}
      <AdminTable<BackupHistoryItem>
        columns={columns}
        rows={history.items}
        getRowId={(r) => r.id}
        caption="Historique des sauvegardes"
        emptyState={
          <AdminEmptyState
            title="Aucune sauvegarde enregistrée"
            description="Les scripts backup-*.sh n'ont pas encore remonté de statut (vérifier BACKUP_INGEST_SECRET + BACKUP_REPORT_URL côté cron VPS)."
          />
        }
      />
      <AdminPagination
        page={history.page}
        totalPages={totalPages}
        baseHref={baseHref}
        preservedParams={{ component: activeComponent ?? undefined }}
      />
    </AdminPageShell>
  );
}
