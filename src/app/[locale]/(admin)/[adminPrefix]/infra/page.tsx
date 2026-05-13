// Console infra & outils (Sprint 24+ / M9 extension).
//
// Centralise les liens vers tous les outils tiers utilisés par Axion-IA :
// Hetzner Cloud, Cloudflare, Coolify, GitHub, UptimeRobot, Sentry, Plausible,
// Telegram, Search Console, etc. Chaque card affiche le rôle, le statut quand
// l'API externe répond (lecture seule, server-only), et le lien vers la console
// externe. Aucune valeur sensible (token, password) n'est rendue côté client.
//
// Toutes les requêtes status sont best-effort : un timeout ou erreur réseau
// rend simplement la card en mode "unknown" sans casser la page.
//
// Auth requise : redirect login si pas de session. Force-dynamic car lecture
// d'env vars + appels API live.
//
// Non-objectifs : pas d'actions write depuis cette page (read-only). Pour
// modifier un outil → cliquer le lien externe et utiliser sa propre UI.
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

type Status = "ok" | "degraded" | "down" | "not-configured" | "unknown";

interface Card {
  name: string;
  role: string;
  externalUrl: string;
  status: Status;
  detail: string | null;
  paid: string;
}

// ─── Live status checks (server-only, never exposed to client) ──────────────

async function checkCoolify(): Promise<{ status: Status; detail: string | null }> {
  const url = process.env["COOLIFY_URL"];
  const token = process.env["COOLIFY_API_TOKEN"];
  const appUuid = process.env["COOLIFY_APP_UUID"];
  if (!url || !token || !appUuid)
    return { status: "not-configured", detail: "env vars manquantes" };
  try {
    const res = await fetch(`${url}/api/v1/applications/${appUuid}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { status: "down", detail: `HTTP ${res.status}` };
    const data = (await res.json()) as { status?: string; last_online_at?: string };
    const containerStatus = data.status ?? "?";
    const isHealthy = containerStatus.includes("running:healthy");
    return {
      status: isHealthy ? "ok" : "degraded",
      detail: containerStatus,
    };
  } catch {
    return { status: "unknown", detail: "API unreachable" };
  }
}

async function checkUptimeRobot(): Promise<{ status: Status; detail: string | null }> {
  const apiKey = process.env["UPTIMEROBOT_API_KEY"];
  if (!apiKey) return { status: "not-configured", detail: "UPTIMEROBOT_API_KEY manquant" };
  try {
    const res = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `api_key=${encodeURIComponent(apiKey)}&format=json`,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { status: "down", detail: `HTTP ${res.status}` };
    const data = (await res.json()) as { monitors?: Array<{ status: number }> };
    const monitors = data.monitors ?? [];
    const up = monitors.filter((m) => m.status === 2).length;
    const total = monitors.length;
    return {
      status: total === 0 ? "unknown" : up === total ? "ok" : "degraded",
      detail: `${up}/${total} monitors UP`,
    };
  } catch {
    return { status: "unknown", detail: "API unreachable" };
  }
}

async function checkCloudflare(): Promise<{ status: Status; detail: string | null }> {
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  const zoneId = process.env["CLOUDFLARE_ZONE_ID"];
  if (!token || !zoneId) return { status: "not-configured", detail: "env vars manquantes" };
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { status: "down", detail: `HTTP ${res.status}` };
    const data = (await res.json()) as { result?: { status?: string; name?: string } };
    const zoneStatus = data.result?.status ?? "?";
    return {
      status: zoneStatus === "active" ? "ok" : "degraded",
      detail: `${data.result?.name} · ${zoneStatus}`,
    };
  } catch {
    return { status: "unknown", detail: "API unreachable" };
  }
}

async function checkSentry(): Promise<{ status: Status; detail: string | null }> {
  const dsn = process.env["SENTRY_DSN"] ?? process.env["NEXT_PUBLIC_SENTRY_DSN"];
  if (!dsn) return { status: "not-configured", detail: "SENTRY_DSN manquant" };
  return { status: "ok", detail: "DSN configuré (vérifier alertes côté UI)" };
}

async function checkPlausible(): Promise<{ status: Status; detail: string | null }> {
  const url = process.env["NEXT_PUBLIC_PLAUSIBLE_API_URL"];
  if (!url) return { status: "not-configured", detail: "API URL manquante" };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    return {
      status: res.ok || res.status === 404 ? "ok" : "degraded",
      detail: `HTTP ${res.status}`,
    };
  } catch {
    return { status: "unknown", detail: "API unreachable" };
  }
}

async function checkHetznerBackups(): Promise<{ status: Status; detail: string | null }> {
  const token = process.env["HETZNER_API_TOKEN"];
  const serverId = process.env["HETZNER_SERVER_ID"];
  if (!token || !serverId)
    return { status: "not-configured", detail: "HETZNER_API_TOKEN + HETZNER_SERVER_ID manquants" };
  try {
    // Backups Hetzner natifs (option "Backups" cochée à la commande VPS).
    // Filtre par bound_to=server_id pour ne récupérer que les backups de ce serveur.
    const res = await fetch(
      `https://api.hetzner.cloud/v1/images?type=backup&bound_to=${serverId}&sort=created:desc`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
    if (!res.ok) return { status: "down", detail: `HTTP ${res.status}` };
    const data = (await res.json()) as {
      images?: Array<{ created: string; description?: string }>;
    };
    const backups = data.images ?? [];
    if (backups.length === 0)
      return {
        status: "degraded",
        detail: "Aucun backup encore — première sauvegarde dans la fenêtre 10-14 UTC",
      };
    const last = backups[0];
    if (!last) return { status: "degraded", detail: "Aucun backup trouvé" };
    const ageMs = Date.now() - new Date(last.created).getTime();
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    return {
      status: ageHours <= 26 ? "ok" : "degraded",
      detail: `${backups.length} backups Hetzner natifs · dernier il y a ${ageHours}h`,
    };
  } catch {
    return { status: "unknown", detail: "API unreachable" };
  }
}

async function checkCloudflareR2(): Promise<{ status: Status; detail: string | null }> {
  const accessKey = process.env["R2_ACCESS_KEY_ID"];
  const bucket = process.env["R2_BUCKET_NAME"];
  if (!accessKey || !bucket)
    return { status: "not-configured", detail: "R2_ACCESS_KEY_ID + R2_BUCKET_NAME manquants" };
  return { status: "ok", detail: `bucket=${bucket}` };
}

async function checkTelegram(): Promise<{ status: Status; detail: string | null }> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { status: "not-configured", detail: "TELEGRAM_BOT_TOKEN manquant" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { status: "down", detail: `HTTP ${res.status}` };
    const data = (await res.json()) as { result?: { username?: string; first_name?: string } };
    return { status: "ok", detail: data.result?.username ? `@${data.result.username}` : "ok" };
  } catch {
    return { status: "unknown", detail: "API unreachable" };
  }
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

function statusPill(status: Status) {
  const labels: Record<Status, string> = {
    ok: "● UP",
    degraded: "● Dégradé",
    down: "● DOWN",
    "not-configured": "○ Non configuré",
    unknown: "? Inconnu",
  };
  return <span className={`admin-status-pill admin-status-${status}`}>{labels[status]}</span>;
}

function CardItem({ card }: { card: Card }) {
  return (
    <a
      href={card.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="admin-card admin-infra-card"
    >
      <div className="admin-infra-card-head">
        <strong>{card.name}</strong>
        {statusPill(card.status)}
      </div>
      <p className="admin-meta-block">{card.role}</p>
      {card.detail && <p className="admin-meta">{card.detail}</p>}
      <p className="admin-meta">
        <em>{card.paid}</em>
      </p>
    </a>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminInfraPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  // Run all live checks in parallel — best-effort, timeouts handled.
  const [coolify, uptimeRobot, cloudflare, sentry, plausible, telegram, hetznerBackup, r2] =
    await Promise.all([
      checkCoolify(),
      checkUptimeRobot(),
      checkCloudflare(),
      checkSentry(),
      checkPlausible(),
      checkTelegram(),
      checkHetznerBackups(),
      checkCloudflareR2(),
    ]);

  const cards: Card[] = [
    {
      name: "Hetzner Cloud",
      role: "VPS axionia-web (CPX32 8 GB / 150 GB), datacenter Nuremberg",
      externalUrl: "https://console.hetzner.com/projects",
      status: "ok",
      detail: "ID 130002660 · 178.105.55.15",
      paid: "6,49 €/mois TTC · paiement Hetzner",
    },
    {
      name: "Hetzner Backups Auto",
      role: "Backups quotidiens VPS (image complète : OS + Docker + DB + configs) · DR rapide ~10 min",
      externalUrl: "https://console.hetzner.com/projects/14511547/servers/130002660/backups",
      status: hetznerBackup.status,
      detail: hetznerBackup.detail,
      paid: "~1,30 €/mois (option Backups cochée à la commande VPS, déjà sur facture Hetzner)",
    },
    {
      name: "Cloudflare R2",
      role: "Backups DB Postgres off-site (S3-compatible, redondance hors Hetzner)",
      externalUrl: "https://dash.cloudflare.com/?to=/:account/r2",
      status: r2.status,
      detail: r2.detail,
      paid: "0 € (Free tier 10 GB stockage + 1M requests/mois)",
    },
    {
      name: "Cloudflare",
      role: "DNS · CDN · DDoS protection · WAF",
      externalUrl: "https://dash.cloudflare.com",
      status: cloudflare.status,
      detail: cloudflare.detail,
      paid: "0 € (Free plan)",
    },
    {
      name: "Coolify",
      role: "App hosting + Postgres + Redis (self-hosted sur Hetzner)",
      externalUrl: process.env["COOLIFY_URL"] ?? "http://178.105.55.15:8000",
      status: coolify.status,
      detail: coolify.detail,
      paid: "0 € (auto-hébergé)",
    },
    {
      name: "GitHub repo",
      role: "Code source, branches, PRs",
      externalUrl: "https://github.com/will383842/axion-ia",
      status: "ok",
      detail: "main = production",
      paid: "0 € (Free private repo)",
    },
    {
      name: "GitHub Actions",
      role: "CI tests + auto-deploy Coolify",
      externalUrl: "https://github.com/will383842/axion-ia/actions",
      status: "ok",
      detail: "Workflow deploy-coolify.yml live",
      paid: "0 € (2000 min/mois free)",
    },
    {
      name: "UptimeRobot",
      role: "Sonde externe healthz + homepage (alerte email <5 min)",
      externalUrl: "https://uptimerobot.com/dashboard",
      status: uptimeRobot.status,
      detail: uptimeRobot.detail,
      paid: "0 € (Free plan, 50 monitors)",
    },
    {
      name: "Sentry",
      role: "Capture erreurs JS/React/API runtime + alertes",
      externalUrl: "https://sentry.io/organizations/axion-ia-prod/projects/",
      status: sentry.status,
      detail: sentry.detail,
      paid: "0 € (Free 5k errors/mois)",
    },
    {
      name: "Plausible",
      role: "Analytics RGPD-friendly (pas de cookies, pas de bandeau)",
      externalUrl: "https://plausible.axion-ia.com",
      status: plausible.status,
      detail: plausible.detail,
      paid: "0 € (auto-hébergé)",
    },
    {
      name: "Telegram bot",
      role: "Alertes booking + ops · canal Will",
      externalUrl: "https://web.telegram.org/",
      status: telegram.status,
      detail: telegram.detail,
      paid: "0 €",
    },
    {
      name: "Search Console (Google)",
      role: "Indexation Google + sitemap-index + monitoring SEO",
      externalUrl: "https://search.google.com/search-console?resource_id=sc-domain%3Aaxion-ia.com",
      status: process.env["GOOGLE_SITE_VERIFICATION"] ? "ok" : "not-configured",
      detail: process.env["GOOGLE_SITE_VERIFICATION"]
        ? "Balise meta posée — vérifier coverage report"
        : "GOOGLE_SITE_VERIFICATION manquante (balise meta absente)",
      paid: "0 €",
    },
    {
      name: "Bing Webmaster Tools",
      role: "Indexation Bing/Copilot + sitemap + IndexNow",
      externalUrl: "https://www.bing.com/webmasters/home",
      status: process.env["BING_SITE_VERIFICATION"] ? "ok" : "not-configured",
      detail: process.env["BING_SITE_VERIFICATION"]
        ? "Balise meta msvalidate.01 posée"
        : "BING_SITE_VERIFICATION manquante",
      paid: "0 €",
    },
    {
      name: "IndexNow",
      role: "Notification instantanée Bing/Seznam/Naver sur changement contenu",
      externalUrl: "https://www.indexnow.org/documentation",
      status: process.env["INDEXNOW_KEY"] ? "ok" : "not-configured",
      detail: process.env["INDEXNOW_KEY"]
        ? "Clé configurée · ping auto sur publication blog · ping manuel via /analytics"
        : "INDEXNOW_KEY manquante",
      paid: "0 €",
    },
    {
      name: "Postgres axion-ia-db",
      role: "Base de données prod (réservations, blog, users, FAQ, etc.)",
      externalUrl: `${process.env["COOLIFY_URL"] ?? "http://178.105.55.15:8000"}/project/wfm03z4asw5yf5mro2fk6gp9`,
      status: process.env["DATABASE_URL"] ? "ok" : "not-configured",
      detail: process.env["DATABASE_URL"] ? "DATABASE_URL configuré" : "DATABASE_URL manquant",
      paid: "0 € (managed by Coolify sur VPS)",
    },
    {
      name: "Redis",
      role: "Rate limit + queue emails BullMQ + cache",
      externalUrl: `${process.env["COOLIFY_URL"] ?? "http://178.105.55.15:8000"}/project/wfm03z4asw5yf5mro2fk6gp9`,
      status: process.env["REDIS_URL"] ? "ok" : "not-configured",
      detail: process.env["REDIS_URL"] ? "REDIS_URL configuré" : "REDIS_URL manquant",
      paid: "0 € (managed by Coolify sur VPS)",
    },
  ];

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Infrastructure &amp; outils</h1>
          <p className="admin-meta">
            Centralise les liens vers chaque outil tiers + statut live (best-effort). Pas
            d&apos;action write depuis ici — chaque card pointe vers la console externe
            correspondante.
          </p>
        </div>
        <div>
          <a href={`/fr/${adminPrefix}`} className="admin-link">
            ← Retour au tableau de bord
          </a>
        </div>
      </div>

      <div className="admin-kpi-grid">
        {cards.map((card) => (
          <CardItem key={card.name} card={card} />
        ))}
      </div>
    </section>
  );
}
