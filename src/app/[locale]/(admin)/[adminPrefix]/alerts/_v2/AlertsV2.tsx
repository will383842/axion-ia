// Refonte admin mai 2026 — PR 10 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Alerts V2 — AdminPageShell + AdminPageHeader + AdminCard + AdminStatCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";
import { AlertTriangle, AlertCircle, Info, Hash } from "lucide-react";

interface Alert {
  source: "sentry" | "uptimerobot" | "coolify" | "backups";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  url: string | null;
  createdAt: string | null;
}

interface UnconfiguredSource {
  name: string;
  err: string;
}

interface Props {
  adminPrefix: string;
  allAlerts: ReadonlyArray<Alert>;
  counts: { critical: number; warning: number; info: number };
  unconfigured: ReadonlyArray<UnconfiguredSource>;
}

function severityPill(severity: Alert["severity"]) {
  const labels: Record<Alert["severity"], string> = {
    critical: "● Critique",
    warning: "● Avertissement",
    info: "● Information",
  };
  return <span className={`admin-status-pill admin-severity-${severity}`}>{labels[severity]}</span>;
}

function sourceLabel(source: Alert["source"]): string {
  switch (source) {
    case "sentry":
      return "Sentry";
    case "uptimerobot":
      return "UptimeRobot";
    case "coolify":
      return "Coolify";
    case "backups":
      return "Sauvegardes";
  }
}

function AlertCard({ alert }: { alert: Alert }) {
  const content = (
    <>
      <div className="admin-infra-card-head">
        <strong>
          [{sourceLabel(alert.source)}] {alert.title}
        </strong>
        {severityPill(alert.severity)}
      </div>
      <p className="admin-meta-block">{alert.detail}</p>
      {alert.createdAt && (
        <p className="admin-meta">{new Date(alert.createdAt).toLocaleString("fr-FR")}</p>
      )}
    </>
  );
  return alert.url ? (
    <a
      href={alert.url}
      target="_blank"
      rel="noopener noreferrer"
      className="admin-card admin-infra-card"
    >
      {content}
    </a>
  ) : (
    <div className="admin-card admin-infra-card">{content}</div>
  );
}

export function AlertsV2({
  adminPrefix,
  allAlerts,
  counts,
  unconfigured,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Alertes ops"
        description="Vue agrégée des alertes (Sentry · UptimeRobot · Coolify). Email Sentry reste actif pour notif push — cette page = consultation pull à toi de venir."
        actions={
          <Link href={`/fr/${adminPrefix}`} className="admin-link">
            ← Retour au tableau de bord
          </Link>
        }
      />

      <section
        aria-label="KPIs alertes"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard
          label="Critiques"
          value={counts.critical}
          tone={counts.critical > 0 ? "destructive" : "default"}
          icon={AlertTriangle}
        />
        <AdminStatCard
          label="Avertissements"
          value={counts.warning}
          tone={counts.warning > 0 ? "warning" : "default"}
          icon={AlertCircle}
        />
        <AdminStatCard label="Information" value={counts.info} icon={Info} />
        <AdminStatCard label="Total" value={allAlerts.length} icon={Hash} />
      </section>

      {unconfigured.length > 0 && (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <h2 className="admin-h2">Sources non configurées</h2>
          <ul className="admin-meta-block">
            {unconfigured.map((u) => (
              <li key={u.name}>
                {u.name} — {u.err}
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      {allAlerts.length === 0 ? (
        <AdminCard>
          <h2 className="admin-h2">Aucune alerte active</h2>
          <p className="admin-meta-block">
            Tout va bien. Les sources configurées ne remontent aucun problème dans la fenêtre
            récente (24h Sentry, 7j Coolify, statut courant UptimeRobot).
          </p>
        </AdminCard>
      ) : (
        <div className="admin-kpi-grid">
          {allAlerts.map((alert, idx) => (
            <AlertCard key={`${alert.source}-${idx}`} alert={alert} />
          ))}
        </div>
      )}
    </AdminPageShell>
  );
}
