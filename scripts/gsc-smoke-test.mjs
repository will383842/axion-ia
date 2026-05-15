// Smoke test API GSC : valide la chaîne refresh_token → access_token → searchanalytics.query.
// Usage : node scripts/gsc-smoke-test.mjs
// Prérequis : avoir lancé scripts/gsc-oauth-init.mjs au moins une fois.
// Lit GSC_OAUTH_REFRESH_TOKEN + GSC_PROPERTY_URL depuis ../.secrets/api-tokens.env.
// Aucune dépendance externe.

// Stratégie env vars (uniforme local + prod Coolify) :
//   GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET, GSC_OAUTH_REFRESH_TOKEN, GSC_PROPERTY_URL
//
// Local : sourcer .secrets/api-tokens.env avant de lancer
//   set -a && source ../.secrets/api-tokens.env && set +a && node scripts/gsc-smoke-test.mjs
//
// Prod (Coolify) : ces 4 vars doivent être set dans Configuration → Environment Variables
// de l'app axion-ia. Aucun fichier filesystem n'est lu (zéro divergence).
//
// Fallback dev-only : si une var manque, le script tente de la lire depuis
// .secrets/api-tokens.env + .secrets/gsc-oauth-client.json pour faciliter le local.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const ENV_FILE = path.join(ROOT, ".secrets", "api-tokens.env");
const CLIENT_JSON = path.join(ROOT, ".secrets", "gsc-oauth-client.json");

function parseEnv(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

async function loadDevFallback() {
  const fallback = {};
  try {
    const envContent = await readFile(ENV_FILE, "utf8");
    Object.assign(fallback, parseEnv(envContent));
  } catch {}
  try {
    const client = JSON.parse(await readFile(CLIENT_JSON, "utf8")).installed;
    fallback.GSC_OAUTH_CLIENT_ID ||= client.client_id;
    fallback.GSC_OAUTH_CLIENT_SECRET ||= client.client_secret;
  } catch {}
  return fallback;
}

function resolveConfig(envCache) {
  const get = (name) => process.env[name] || envCache[name];
  const cfg = {
    clientId: get("GSC_OAUTH_CLIENT_ID"),
    clientSecret: get("GSC_OAUTH_CLIENT_SECRET"),
    refreshToken: get("GSC_OAUTH_REFRESH_TOKEN"),
    propertyUrl: get("GSC_PROPERTY_URL"),
    fromEnv: {
      clientId: !!process.env.GSC_OAUTH_CLIENT_ID,
      clientSecret: !!process.env.GSC_OAUTH_CLIENT_SECRET,
      refreshToken: !!process.env.GSC_OAUTH_REFRESH_TOKEN,
      propertyUrl: !!process.env.GSC_PROPERTY_URL,
    },
  };
  const missing = [];
  if (!cfg.clientId) missing.push("GSC_OAUTH_CLIENT_ID");
  if (!cfg.clientSecret) missing.push("GSC_OAUTH_CLIENT_SECRET");
  if (!cfg.refreshToken) missing.push("GSC_OAUTH_REFRESH_TOKEN");
  if (!cfg.propertyUrl) missing.push("GSC_PROPERTY_URL");
  if (missing.length) {
    throw new Error(
      `Env vars manquantes : ${missing.join(", ")}\n` +
        `Local : set -a && source .secrets/api-tokens.env && set +a\n` +
        `Prod : configurer dans Coolify → Environment Variables.`,
    );
  }
  return cfg;
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh ${res.status} : ${text}`);
  }
  return res.json();
}

async function queryGsc({ accessToken, siteUrl, startDate, endDate }) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 10,
      orderBy: [{ field: "clicks", descending: true }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC query ${res.status} : ${text}`);
  }
  return res.json();
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const envCache = await loadDevFallback();
  const cfg = resolveConfig(envCache);

  process.stdout.write(`[gsc-smoke] Refresh → access token...\n`);
  const tokens = await refreshAccessToken({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    refreshToken: cfg.refreshToken,
  });
  process.stdout.write(`[gsc-smoke] access_token OK (expire ${tokens.expires_in}s)\n`);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  const startDate = fmtDate(start);
  const endDate = fmtDate(end);

  process.stdout.write(
    `[gsc-smoke] Query searchAnalytics : ${cfg.propertyUrl} | ${startDate} → ${endDate} | top 10 queries by clicks\n`,
  );
  const data = await queryGsc({
    accessToken: tokens.access_token,
    siteUrl: cfg.propertyUrl,
    startDate,
    endDate,
  });

  const rows = data.rows || [];
  if (rows.length === 0) {
    process.stdout.write(
      `[gsc-smoke] ⚠️  Aucune donnée retournée (normal si propriété récente / pas d'impressions sur 7j).\n`,
    );
    process.stdout.write(`[gsc-smoke] Réponse complète : ${JSON.stringify(data)}\n`);
  } else {
    process.stdout.write(`[gsc-smoke] ✅ ${rows.length} lignes retournées :\n`);
    process.stdout.write(
      `\nQuery${" ".repeat(40)} Clicks  Impr.   CTR    Pos.\n` + "─".repeat(75) + "\n",
    );
    for (const r of rows) {
      const q = (r.keys?.[0] || "(empty)").slice(0, 44).padEnd(44);
      process.stdout.write(
        `${q} ${String(r.clicks).padStart(6)} ${String(r.impressions).padStart(6)} ${(r.ctr * 100).toFixed(2).padStart(5)}% ${r.position.toFixed(1).padStart(5)}\n`,
      );
    }
  }
  process.stdout.write(`\n[gsc-smoke] ✅ Chaîne complète validée (auth → API → query).\n`);
}

main().catch((e) => {
  process.stderr.write(`[gsc-smoke] ERREUR : ${e.message}\n`);
  process.exit(1);
});
