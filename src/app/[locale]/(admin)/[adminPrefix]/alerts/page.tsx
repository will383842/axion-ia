// Console alertes ops (Sprint 24+ / M9 extension).
//
// Agrège dans une seule vue les alertes provenant de :
//  - UptimeRobot (monitors DOWN ou en degraded)
//  - Coolify (deployments en failed récents)
//  - Sentry (issues unresolved récents — si SENTRY_AUTH_TOKEN configuré)
//
// Évite à Will d'avoir à checker chaque outil séparément. Email Sentry
// reste actif pour notif push, cette page = vue agrégée pull.
//
// Toutes les requêtes externes sont best-effort, parallèles, server-only
// (5s timeout chacune). Aucune valeur sensible n'est rendue côté client.
//
// Auth requise : redirect login si pas de session admin. Force-dynamic.
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBackupAlerts } from "@/server/backups/queries";
import { AlertsV2 } from "./_v2/AlertsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

interface Alert {
  source: "sentry" | "uptimerobot" | "coolify" | "backups";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  url: string | null;
  createdAt: string | null;
}

// ─── Pulls (server-only) ────────────────────────────────────────────────────

async function fetchUptimeRobotAlerts(): Promise<{
  alerts: Alert[];
  configured: boolean;
  err: string | null;
}> {
  const apiKey = process.env["UPTIMEROBOT_API_KEY"];
  if (!apiKey) return { alerts: [], configured: false, err: "UPTIMEROBOT_API_KEY manquant" };
  try {
    const res = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `api_key=${encodeURIComponent(apiKey)}&format=json&logs=1&logs_limit=1`,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { alerts: [], configured: true, err: `HTTP ${res.status}` };
    const data = (await res.json()) as {
      monitors?: Array<{
        id: number;
        friendly_name: string;
        url: string;
        status: number;
        logs?: Array<{ datetime: number; type: number; reason?: { code: string } }>;
      }>;
    };
    const monitors = data.monitors ?? [];
    // status 2 = up. Anything else = degraded/down/paused.
    const issuesMonitors = monitors.filter((m) => m.status !== 2 && m.status !== 0);
    const alerts: Alert[] = issuesMonitors.map((m) => {
      const lastLog = m.logs?.[0];
      const severity: Alert["severity"] = m.status === 9 || m.status === 8 ? "critical" : "warning";
      return {
        source: "uptimerobot",
        severity,
        title: m.friendly_name,
        detail: `${m.url} · ${statusLabelUptimeRobot(m.status)}${lastLog?.reason?.code ? ` · ${lastLog.reason.code}` : ""}`,
        url: "https://uptimerobot.com/dashboard",
        createdAt: lastLog?.datetime ? new Date(lastLog.datetime * 1000).toISOString() : null,
      };
    });
    return { alerts, configured: true, err: null };
  } catch (e) {
    return { alerts: [], configured: true, err: e instanceof Error ? e.message : "unknown" };
  }
}

function statusLabelUptimeRobot(status: number): string {
  switch (status) {
    case 0:
      return "en pause";
    case 1:
      return "pas encore vérifié";
    case 2:
      return "en ligne";
    case 8:
      return "semble hors service";
    case 9:
      return "hors service";
    default:
      return `statut ${status}`;
  }
}

async function fetchCoolifyAlerts(): Promise<{
  alerts: Alert[];
  configured: boolean;
  err: string | null;
}> {
  const url = process.env["COOLIFY_URL"];
  const token = process.env["COOLIFY_API_TOKEN"];
  const appUuid = process.env["COOLIFY_APP_UUID"];
  if (!url || !token || !appUuid)
    return { alerts: [], configured: false, err: "env vars manquantes" };
  try {
    const res = await fetch(`${url}/api/v1/deployments`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { alerts: [], configured: true, err: `HTTP ${res.status}` };
    const data = (await res.json()) as
      | Array<{ status: string; commit?: string; created_at: string; deployment_uuid?: string }>
      | {
          data?: Array<{
            status: string;
            commit?: string;
            created_at: string;
            deployment_uuid?: string;
          }>;
        };
    const items = Array.isArray(data) ? data : (data.data ?? []);
    // Keep only failed/cancelled-by-user deployments from the last 7 days.
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const failed = items.filter((d) => {
      if (!["failed", "cancelled-by-user"].includes(d.status)) return false;
      return new Date(d.created_at).getTime() >= sevenDaysAgo;
    });
    const alerts: Alert[] = failed.slice(0, 5).map((d) => ({
      source: "coolify",
      severity: d.status === "failed" ? "critical" : "info",
      // Le statut sortait brut : « Déploiement failed », « Déploiement
      // cancelled-by-user ».
      title: d.status === "failed" ? "Déploiement en échec" : "Déploiement annulé",
      detail: `commit ${(d.commit ?? "?").slice(0, 8)} · ${new Date(d.created_at).toLocaleString("fr-FR")}`,
      url: d.deployment_uuid ? `${url}/deployment/${d.deployment_uuid}` : url,
      createdAt: d.created_at,
    }));
    return { alerts, configured: true, err: null };
  } catch (e) {
    return { alerts: [], configured: true, err: e instanceof Error ? e.message : "unknown" };
  }
}

async function fetchSentryAlerts(): Promise<{
  alerts: Alert[];
  configured: boolean;
  err: string | null;
}> {
  const token = process.env["SENTRY_AUTH_TOKEN"];
  const orgSlug = process.env["SENTRY_ORG_SLUG"] ?? "axion-ia-prod";
  const projectSlug = process.env["SENTRY_PROJECT_SLUG"] ?? "axion-ia";
  if (!token) {
    return {
      alerts: [],
      configured: false,
      err: "SENTRY_AUTH_TOKEN manquant — créer un Internal Integration sur sentry.io (Settings → Custom Integrations → Create New Integration → Permissions: Project:Read, Issue:Read)",
    };
  }
  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/issues/?query=is:unresolved&limit=10&statsPeriod=24h`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
    if (!res.ok) return { alerts: [], configured: true, err: `HTTP ${res.status}` };
    const data = (await res.json()) as Array<{
      id: string;
      title: string;
      culprit?: string;
      level: string;
      lastSeen: string;
      count: string;
      permalink: string;
    }>;
    const alerts: Alert[] = data.map((issue) => ({
      source: "sentry",
      severity:
        issue.level === "fatal" || issue.level === "error"
          ? "critical"
          : issue.level === "warning"
            ? "warning"
            : "info",
      title: issue.title,
      detail: `${issue.culprit ?? ""} · ${issue.count} occurrences · dernière le ${new Date(issue.lastSeen).toLocaleString("fr-FR")}`,
      url: issue.permalink,
      createdAt: issue.lastSeen,
    }));
    return { alerts, configured: true, err: null };
  } catch (e) {
    return { alerts: [], configured: true, err: e instanceof Error ? e.message : "unknown" };
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminAlertsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  const [uptime, coolify, sentry, backups] = await Promise.all([
    fetchUptimeRobotAlerts(),
    fetchCoolifyAlerts(),
    fetchSentryAlerts(),
    getBackupAlerts(adminPrefix).catch(() => [] as Alert[]),
  ]);

  const allAlerts = [...uptime.alerts, ...coolify.alerts, ...sentry.alerts, ...backups].sort(
    (a, b) => {
      // critical > warning > info, then by date desc
      const sevOrder: Record<Alert["severity"], number> = { critical: 0, warning: 1, info: 2 };
      if (sevOrder[a.severity] !== sevOrder[b.severity])
        return sevOrder[a.severity] - sevOrder[b.severity];
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    },
  );

  const counts = {
    critical: allAlerts.filter((a) => a.severity === "critical").length,
    warning: allAlerts.filter((a) => a.severity === "warning").length,
    info: allAlerts.filter((a) => a.severity === "info").length,
  };

  const unconfiguredV2 = [
    ...(uptime.configured ? [] : [{ name: "UptimeRobot", err: uptime.err ?? "unknown" }]),
    ...(coolify.configured ? [] : [{ name: "Coolify", err: coolify.err ?? "unknown" }]),
    ...(sentry.configured ? [] : [{ name: "Sentry", err: sentry.err ?? "unknown" }]),
  ];

  return (
    <AlertsV2
      adminPrefix={adminPrefix}
      allAlerts={allAlerts}
      counts={counts}
      unconfigured={unconfiguredV2}
    />
  );
}
