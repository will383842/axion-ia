/**
 * Google Search Console API client — OAuth refresh token flow.
 *
 * Activation Sprint 10.5 (2026-05-15). L'auth est faite via OAuth Desktop client
 * + refresh_token long-lived (setup hors-band conv parallèle GSC). Les 4 env
 * vars sont injectées en prod via Coolify :
 *
 *  - `GSC_OAUTH_CLIENT_ID` (OAuth Desktop client)
 *  - `GSC_OAUTH_CLIENT_SECRET`
 *  - `GSC_OAUTH_REFRESH_TOKEN` (refresh long-lived obtenu via gsc-oauth-init.mjs)
 *  - `GSC_PROPERTY_URL` (ex: `sc-domain:axion-ia.com`)
 *
 * Pas de SDK `googleapis` requis — 2 endpoints HTTP suffisent. Évite +5 MB
 * de deps + lazy-load possible si voie 3 future.
 *
 * Cache access_token in-memory durée TTL (~55 min de marge sous 1h Google).
 * Re-fetch automatique si expiré.
 *
 * Doc : <https://developers.google.com/webmaster-tools/v1/searchanalytics/query>
 */

interface CachedAccessToken {
  readonly token: string;
  readonly expiresAt: number; // epoch ms
}

let cachedToken: CachedAccessToken | null = null;

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const WEBMASTERS_API = "https://www.googleapis.com/webmasters/v3";

/**
 * Refresh access_token via OAuth refresh_token flow.
 * Cache 55 min (sous 1h Google TTL) pour mutualiser entre les ~500 articles
 * d'un même run du worker keyword-sync.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env["GSC_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GSC_OAUTH_CLIENT_SECRET"];
  const refreshToken = process.env["GSC_OAUTH_REFRESH_TOKEN"];

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

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GSC OAuth refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("GSC OAuth response missing access_token");
  }

  // Cache 55 min (Google TTL = 1h, marge 5 min).
  const ttlMs = (data.expires_in ?? 3600) * 1000 - 5 * 60_000;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + ttlMs };
  return data.access_token;
}

/**
 * GSC searchAnalytics row format.
 * `keys` ordering match l'ordre des `dimensions` envoyé en query.
 */
export interface GscSearchRow {
  readonly keys: ReadonlyArray<string>;
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number;
  readonly position: number;
}

/**
 * Top keywords pour une URL spécifique sur les N derniers jours.
 * Skip silencieux + return null si credentials absents (V1 graceful degrade).
 *
 * @param targetUrl  URL canonique de la page (ex: https://axion-ia.com/fr/blog/abc)
 * @param daysWindow Fenêtre lookback (28 = standard SEO mensuel)
 * @param topN       Nombre max de keywords retournés (10 = doctrine V1)
 */
export async function gscTopKeywordsForUrl(
  targetUrl: string,
  daysWindow = 28,
  topN = 10,
): Promise<ReadonlyArray<{
  keyword: string;
  position: number;
  ctr: number;
  impressions: number;
  clicks: number;
}> | null> {
  const propertyUrl = process.env["GSC_PROPERTY_URL"];
  if (!propertyUrl) return null;

  // Test des autres credentials avant l'appel coûteux.
  if (
    !process.env["GSC_OAUTH_CLIENT_ID"] ||
    !process.env["GSC_OAUTH_CLIENT_SECRET"] ||
    !process.env["GSC_OAUTH_REFRESH_TOKEN"]
  ) {
    return null;
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error("[gsc-client] OAuth refresh failed:", err);
    return null;
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - daysWindow * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const query = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dimensions: ["query"],
    dimensionFilterGroups: [
      {
        filters: [
          {
            dimension: "page",
            operator: "equals",
            expression: targetUrl,
          },
        ],
      },
    ],
    rowLimit: topN,
    type: "web",
  };

  const url = `${WEBMASTERS_API}/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[gsc-client] query failed for ${targetUrl}: ${res.status} ${text.slice(0, 150)}`,
    );
    return null;
  }

  const data = (await res.json()) as { rows?: GscSearchRow[] };
  const rows = data.rows ?? [];

  return rows.map((row) => ({
    keyword: row.keys[0] ?? "",
    position: row.position,
    ctr: row.ctr,
    impressions: row.impressions,
    clicks: row.clicks,
  }));
}

/**
 * Test helper — retourne l'access_token courant (cached) sans appel API.
 * Utile pour smoke tests ou debug local.
 */
export function getGscCachedToken(): CachedAccessToken | null {
  return cachedToken;
}
