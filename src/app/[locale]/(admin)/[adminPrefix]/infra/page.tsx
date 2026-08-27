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
import { InfraV2 } from "./_v2/InfraV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

// "not-checked" (distinct de "unknown") : aucune tentative de vérification live
// n'existe pour cette card — pas un échec de check, l'absence assumée d'un check.
// Introduit pour ne plus afficher un "● UP" figé jamais vérifié (audit UX admin).
type Status = "ok" | "degraded" | "down" | "not-configured" | "unknown" | "not-checked";

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
    // 🔴 Le détail affichait la chaîne brute de Coolify — « running:healthy »
    // s'écrivait tel quel sur un écran par ailleurs entièrement en français.
    // On dit l'état, et on garde la valeur d'origine entre parenthèses : elle
    // sert quand il faut la recopier dans un ticket.
    const enMarche = containerStatus.startsWith("running");
    return {
      status: isHealthy ? "ok" : "degraded",
      detail: isHealthy
        ? `En marche, sonde de santé au vert (${containerStatus})`
        : enMarche
          ? `En marche, sonde de santé non confirmée (${containerStatus})`
          : `À l'arrêt (${containerStatus})`,
    };
  } catch {
    return { status: "unknown", detail: "Service injoignable" };
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
      detail: `${up}/${total} sonde${total > 1 ? "s" : ""} en ligne`,
    };
  } catch {
    return { status: "unknown", detail: "Service injoignable" };
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
    return { status: "unknown", detail: "Service injoignable" };
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
    return { status: "unknown", detail: "Service injoignable" };
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
    return { status: "unknown", detail: "Service injoignable" };
  }
}

/**
 * Statut live du VPS Hetzner lui-même (pas seulement de ses backups).
 *
 * Avant : la card "Hetzner Cloud" affichait un "ok" codé en dur, jamais
 * vérifié — contrairement aux ~14 autres cards de cette grille qui font un
 * vrai fetch(). Réutilise les MÊMES credentials que checkHetznerBackups()
 * (HETZNER_API_TOKEN + HETZNER_SERVER_ID, déjà en place) : aucun nouveau
 * secret requis, donc pas de raison de laisser un statut mensonger ici.
 */
async function checkHetznerServer(): Promise<{ status: Status; detail: string | null }> {
  const token = process.env["HETZNER_API_TOKEN"];
  const serverId = process.env["HETZNER_SERVER_ID"];
  if (!token || !serverId)
    return { status: "not-configured", detail: "HETZNER_API_TOKEN + HETZNER_SERVER_ID manquants" };
  try {
    const res = await fetch(`https://api.hetzner.cloud/v1/servers/${serverId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { status: "down", detail: `HTTP ${res.status}` };
    const data = (await res.json()) as {
      server?: { status?: string; public_net?: { ipv4?: { ip?: string } } };
    };
    const serverStatus = data.server?.status ?? "?";
    const ip = data.server?.public_net?.ipv4?.ip;
    // Même correctif que pour le conteneur : « running » venait de l'API
    // Hetzner et s'affichait sans traduction au milieu d'une ligne française.
    const enMarche = serverStatus === "running";
    return {
      status: enMarche ? "ok" : "degraded",
      detail: `ID ${serverId} · ${enMarche ? "en marche" : `état « ${serverStatus} »`}${ip ? ` · ${ip}` : ""}`,
    };
  } catch {
    return { status: "unknown", detail: "Service injoignable" };
  }
}

async function checkCloudflareR2(): Promise<{ status: Status; detail: string | null }> {
  const accessKey = process.env["R2_ACCESS_KEY_ID"];
  const bucket = process.env["R2_BUCKET_NAME"];
  if (!accessKey || !bucket)
    return { status: "not-configured", detail: "R2_ACCESS_KEY_ID + R2_BUCKET_NAME manquants" };
  return { status: "ok", detail: `bucket=${bucket}` };
}

/**
 * Statut Telegram + destination réelle des 3 groupes.
 *
 * Le bot « UP » ne prouvait rien sur l'ARRIVÉE des messages : `resolveTelegramChatId()`
 * retombe silencieusement sur `TELEGRAM_CHAT_ID` quand un `TELEGRAM_CHAT_ID_<GROUPE>`
 * manque. Trois canaux censés être séparés pouvaient donc atterrir au même endroit
 * sans qu'aucun écran ne le dise. On affiche la répartition constatée.
 */
async function checkTelegram(): Promise<{ status: Status; detail: string | null }> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { status: "not-configured", detail: "TELEGRAM_BOT_TOKEN manquant" };

  const groups = [
    ["RDV", process.env["TELEGRAM_CHAT_ID_RDV"]],
    ["Messages", process.env["TELEGRAM_CHAT_ID_MESSAGES"]],
    ["Système", process.env["TELEGRAM_CHAT_ID_SYSTEM"]],
  ] as const;
  const fallback = process.env["TELEGRAM_CHAT_ID"];
  const dedicated = groups.filter(([, id]) => Boolean(id)).map(([label]) => label);
  const missing = groups.filter(([, id]) => !id).map(([label]) => label);

  // Aucun chat_id nulle part = les messages ne partent VERS PERSONNE, même si
  // le bot répond. C'est le seul cas réellement cassé.
  if (dedicated.length === 0 && !fallback) {
    return { status: "down", detail: "Bot OK mais AUCUN chat_id : rien n'est délivré" };
  }

  let routing: string;
  if (missing.length === 0) {
    routing = "3 groupes dédiés (RDV · Messages · Système)";
  } else if (dedicated.length === 0) {
    routing = `1 seul canal : ${missing.join(", ")} → TELEGRAM_CHAT_ID`;
  } else {
    routing = `${dedicated.join(", ")} dédié${dedicated.length > 1 ? "s" : ""} · ${missing.join(", ")} → canal par défaut`;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { status: "down", detail: `HTTP ${res.status}` };
    const data = (await res.json()) as { result?: { username?: string; first_name?: string } };
    const name = data.result?.username ? `@${data.result.username}` : "bot OK";
    return { status: missing.length === 0 ? "ok" : "unknown", detail: `${name} · ${routing}` };
  } catch {
    return { status: "unknown", detail: `API injoignable · ${routing}` };
  }
}

/**
 * Statut du doublon WhatsApp (CallMeBot).
 *
 * Aucune carte n'existait : le canal est no-op silencieux tant que la clé et le
 * numéro ne sont pas posés (cf. `server/notifications/channels/whatsapp.ts`), et
 * rien dans la console ne permettait de savoir dans quel état on se trouvait —
 * « je ne reçois pas de WhatsApp » était indiagnosticable depuis l'admin.
 *
 * Volontairement SANS appel réseau : CallMeBot n'a pas d'endpoint de santé, et
 * un ping enverrait un vrai message WhatsApp à chaque ouverture de la page.
 * On ne divulgue jamais la clé — seulement le numéro masqué.
 */
function checkWhatsApp(): { status: Status; detail: string | null } {
  const key = process.env["WHATSAPP_CALLMEBOT_APIKEY"]?.trim();
  const phone = process.env["WHATSAPP_NOTIFY_PHONE"]?.replace(/[\s-]/g, "");
  if (!key && !phone) {
    return {
      status: "not-configured",
      detail: "WHATSAPP_CALLMEBOT_APIKEY + WHATSAPP_NOTIFY_PHONE manquants — canal inactif",
    };
  }
  // Une seule des deux variables = panne muette : le canal skip sans rien dire.
  if (!key)
    return { status: "down", detail: "WHATSAPP_CALLMEBOT_APIKEY manquante — rien n'est envoyé" };
  if (!phone)
    return { status: "down", detail: "WHATSAPP_NOTIFY_PHONE manquant — rien n'est envoyé" };
  const masked = phone.length > 4 ? `…${phone.slice(-4)}` : "configuré";
  return { status: "ok", detail: `Doublon leads actif → ${masked}` };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminInfraPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  // Run all live checks in parallel — best-effort, timeouts handled.
  const [
    coolify,
    uptimeRobot,
    cloudflare,
    sentry,
    plausible,
    telegram,
    hetznerBackup,
    hetznerServer,
    r2,
  ] = await Promise.all([
    checkCoolify(),
    checkUptimeRobot(),
    checkCloudflare(),
    checkSentry(),
    checkPlausible(),
    checkTelegram(),
    checkHetznerBackups(),
    checkHetznerServer(),
    checkCloudflareR2(),
  ]);
  // Synchrone et volontairement hors du Promise.all : CallMeBot n'a pas
  // d'endpoint de santé, et le « pinger » enverrait un vrai WhatsApp à chaque
  // ouverture de cette page.
  const whatsapp = checkWhatsApp();

  const cards: Card[] = [
    {
      name: "Hetzner Cloud",
      role: "VPS axionia-web (CPX32 8 GB / 150 GB), datacenter Nuremberg",
      externalUrl: "https://console.hetzner.com/projects",
      status: hetznerServer.status,
      detail: hetznerServer.detail ?? "ID 130002660 · 178.105.55.15",
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
      paid: "0 € (offre gratuite : 10 Go de stockage, 1 M de requêtes/mois)",
    },
    {
      name: "Cloudflare",
      role: "DNS · CDN · DDoS protection · WAF",
      externalUrl: "https://dash.cloudflare.com",
      status: cloudflare.status,
      detail: cloudflare.detail,
      paid: "0 € (offre gratuite)",
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
      // Pas de vrai check ici : le repo est PRIVÉ, l'API GitHub y répondrait
      // 404 sans token — il faudrait créer un secret dédié (PAT) rien que
      // pour ce ping. Coût/complexité jugés disqualifiants pour une simple
      // card de lien. Mieux vaut un badge honnête que faire semblant.
      name: "GitHub repo",
      role: "Code source, branches, PRs",
      externalUrl: "https://github.com/will383842/axion-ia",
      status: "not-checked",
      detail:
        "main = production · non vérifié automatiquement (repo privé, nécessiterait un token dédié)",
      paid: "0 € (dépôt privé gratuit)",
    },
    {
      // Même raison que GitHub repo ci-dessus : l'API Actions runs d'un repo
      // privé exige aussi un token dédié.
      name: "GitHub Actions",
      role: "CI tests + auto-deploy Coolify",
      externalUrl: "https://github.com/will383842/axion-ia/actions",
      status: "not-checked",
      detail:
        "Workflow deploy-coolify.yml · non vérifié automatiquement (repo privé, nécessiterait un token dédié)",
      paid: "0 € (2 000 min/mois incluses)",
    },
    {
      name: "UptimeRobot",
      role: "Sonde externe healthz + homepage (alerte email <5 min)",
      externalUrl: "https://uptimerobot.com/dashboard",
      status: uptimeRobot.status,
      detail: uptimeRobot.detail,
      paid: "0 € (offre gratuite, 50 sondes)",
    },
    {
      name: "Sentry",
      role: "Capture erreurs JS/React/API runtime + alertes",
      externalUrl: "https://sentry.io/organizations/axion-ia-prod/projects/",
      status: sentry.status,
      detail: sentry.detail,
      paid: "0 € (5 000 erreurs/mois incluses)",
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
      role: "Alertes RDV · messages · ops — 3 groupes",
      externalUrl: "https://web.telegram.org/",
      status: telegram.status,
      detail: telegram.detail,
      paid: "0 €",
    },
    {
      name: "WhatsApp (CallMeBot)",
      role: "Doublon des leads humains (contact, devis, RDV, candidature, podcast)",
      externalUrl: "https://www.callmebot.com/blog/free-api-whatsapp-messages/",
      status: whatsapp.status,
      detail: whatsapp.detail,
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
      // Les « réservations » ont disparu avec le système Booking (PR 860) :
      // une description d'infra qui nomme une table morte fait chercher ce qui
      // n'existe plus.
      //
      // ⚠️ Écrire le numéro de PR avec un croisillon (« # » suivi de 860) fait
      // rougir `anti-hex:check`, qui y lit une couleur hexadécimale à trois
      // chiffres. La garde a raison : elle ne peut pas deviner l'intention.
      role: "Base de données prod (sessions, inscriptions, messages, blog, FAQ, etc.)",
      externalUrl: `${process.env["COOLIFY_URL"] ?? "http://178.105.55.15:8000"}/project/wfm03z4asw5yf5mro2fk6gp9`,
      status: process.env["DATABASE_URL"] ? "ok" : "not-configured",
      detail: process.env["DATABASE_URL"] ? "DATABASE_URL configuré" : "DATABASE_URL manquant",
      paid: "0 € (hébergé par Coolify sur le serveur)",
    },
    {
      name: "Redis",
      role: "Rate limit + queue emails BullMQ + cache",
      externalUrl: `${process.env["COOLIFY_URL"] ?? "http://178.105.55.15:8000"}/project/wfm03z4asw5yf5mro2fk6gp9`,
      status: process.env["REDIS_URL"] ? "ok" : "not-configured",
      detail: process.env["REDIS_URL"] ? "REDIS_URL configuré" : "REDIS_URL manquant",
      paid: "0 € (hébergé par Coolify sur le serveur)",
    },
  ];

  return <InfraV2 adminPrefix={adminPrefix} cards={cards} />;
}
