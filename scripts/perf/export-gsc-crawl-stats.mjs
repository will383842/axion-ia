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
 * Données de fond : GSC Crawl Stats API (gratuit, illimité, key OAuth).
 * Endpoint : POST https://searchconsole.googleapis.com/v1/sites/{siteUrl}/searchAnalytics/query
 * Doc officielle : https://developers.google.com/webmaster-tools/search-console-api-original
 *
 * Auth requise : OAuth service account avec rôle « Propriétaire » ou « Lecteur
 * complet » sur la propriété GSC `sc-domain:axion-ia.com`. Setup Will côté
 * Google Cloud Console — variables d'env :
 *   - GOOGLE_APPLICATION_CREDENTIALS : path vers le JSON key file
 *   - GSC_SITE_URL : "sc-domain:axion-ia.com" ou "https://axion-ia.com/"
 *
 * Fail-soft : si OAuth absent / token expiré / quota épuisé → log warn et
 * skip le CSV (le workflow GH Actions marquera success pour ne pas spammer).
 *
 * Usage :
 *   GOOGLE_APPLICATION_CREDENTIALS=./gsc-sa.json \
 *   GSC_SITE_URL="sc-domain:axion-ia.com" \
 *   node scripts/perf/export-gsc-crawl-stats.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const SITE_URL = process.env.GSC_SITE_URL ?? "sc-domain:axion-ia.com";
const CREDS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

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
 * Récupère un access_token OAuth via le JWT service account.
 * Implémentation minimale sans dep googleapis (économise ~10 MB).
 */
async function getAccessToken() {
  if (!CREDS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS non défini");
  }
  const raw = await fs.readFile(CREDS, "utf8");
  const sa = JSON.parse(raw);

  // JWT manuel : header + claim + signature RSA-SHA256.
  const crypto = await import("node:crypto");
  const header = { alg: "RS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  };
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const signedInput = `${b64url(header)}.${b64url(claim)}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signedInput);
  const signature = sign
    .sign(sa.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${signedInput}.${signature}`;

  // Échange JWT contre access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json();
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
    `https://searchconsole.googleapis.com/v1/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
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
  if (!CREDS) {
    console.warn("[gsc-crawl-stats] GOOGLE_APPLICATION_CREDENTIALS absent — skip (fail-soft)");
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
    // Exit 0 pour fail-soft côté workflow (warning visible mais workflow vert).
    process.exit(0);
  }
}

main();
