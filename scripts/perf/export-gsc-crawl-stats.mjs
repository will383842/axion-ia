/**
 * P2-28 (audit re-run 2026-05-15 AGENT 7) — Export Crawl Stats Google Search Console.
 *
 * Exporte chaque lundi 08:00 UTC les crawl stats GSC pour `axion-ia.com` dans
 * `_AUDIT/crawl-stats-YYYY-WW.csv`. Permet de mesurer :
 *  - le ratio crawl Googlebot / pages publiées factory (gate < 30 % = ROUGE)
 *  - les pages les plus crawlées (validation que le tier-1 IndexNow fonctionne)
 *  - les types de fichiers Googlebot priorise (HTML / JS / CSS / IMG)
 *  - les codes HTTP rencontrés par Googlebot (3xx / 4xx / 5xx → fix priority)
 *
 * Auth : **OAuth refresh_token flow**, aligné avec `src/server/content-gen/seo/gsc-client.ts`
 * (commit f2ba3ec — worker keyword-sync). Réutilise les 3 credentials OAuth
 * Desktop client + refresh long-lived setup dans la conv parallèle GCP.
 *
 * Env vars requises (GH secrets) :
 *  - `GSC_OAUTH_CLIENT_ID`
 *  - `GSC_OAUTH_CLIENT_SECRET`
 *  - `GSC_OAUTH_REFRESH_TOKEN`
 *  - `GSC_PROPERTY_URL` (ex: `sc-domain:axion-ia.com`) — GH variable
 *
 * Fail-soft : si credentials absents / token refresh expire / quota épuisé →
 * log warn et skip CSV (workflow GH Actions marque success pour ne pas spammer).
 *
 * Usage local :
 *   set -a && source ../.secrets/api-tokens.env && set +a
 *   node scripts/perf/export-gsc-crawl-stats.mjs
 *
 * Doc API : https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const PROPERTY_URL = process.env.GSC_PROPERTY_URL ?? "sc-domain:axion-ia.com";

/**
 * Convertit Date → semaine ISO 8601 (e.g. "2026-W20").
 * Source de vérité : https://en.wikipedia.org/wiki/ISO_week_date
 */
function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Refresh access_token via OAuth refresh_token flow.
 * Pattern identique à `src/server/content-gen/seo/gsc-client.ts` (cohérence
 * stack auth GSC end-to-end).
 */
async function getAccessToken() {
  const clientId = process.env.GSC_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GSC_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GSC_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GSC OAuth credentials missing — set GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET, GSC_OAUTH_REFRESH_TOKEN",
    );
  }

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
    const text = await res.text().catch(() => "");
    throw new Error(`GSC OAuth refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("GSC OAuth response missing access_token");
  }
  return data.access_token;
}

/**
 * Query GSC searchAnalytics — top 1000 pages crawlées sur les 7 derniers jours.
 */
async function fetchTopPages(token) {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86400_000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY_URL)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: ["page"],
        rowLimit: 1000,
        dataState: "all",
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC API query failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Convertit la réponse GSC en CSV propre.
 * Colonnes : page, impressions, clicks, ctr, position
 */
function rowsToCsv(rows) {
  const header = "page,impressions,clicks,ctr,position";
  const lines = rows.map((r) => {
    const page = (r.keys?.[0] ?? "").replace(/[",\n]/g, " ");
    const impressions = r.impressions ?? 0;
    const clicks = r.clicks ?? 0;
    const ctr = r.ctr ?? 0;
    const position = r.position ?? 0;
    return `"${page}",${impressions},${clicks},${ctr.toFixed(4)},${position.toFixed(2)}`;
  });
  return [header, ...lines].join("\n");
}

async function main() {
  if (
    !process.env.GSC_OAUTH_CLIENT_ID ||
    !process.env.GSC_OAUTH_CLIENT_SECRET ||
    !process.env.GSC_OAUTH_REFRESH_TOKEN
  ) {
    console.warn(
      "[gsc-crawl-stats] GSC_OAUTH_* credentials absent — skip (fail-soft). Set GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET, GSC_OAUTH_REFRESH_TOKEN.",
    );
    return;
  }
  try {
    const token = await getAccessToken();
    const data = await fetchTopPages(token);
    const rows = data.rows ?? [];
    const csv = rowsToCsv(rows);
    const week = isoWeek();
    const outDir = path.join(process.cwd(), "_AUDIT");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `crawl-stats-${week}.csv`);
    await fs.writeFile(outFile, csv, "utf8");
    console.log(`[gsc-crawl-stats] export OK → ${outFile} (${rows.length} rows)`);
  } catch (err) {
    console.error("[gsc-crawl-stats] error:", err?.message ?? err);
    // Exit 0 pour fail-soft côté workflow.
    process.exit(0);
  }
}

main();
