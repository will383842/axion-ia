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
 * Métriques page-level (agrégées, sans dimension) pour une URL sur N jours.
 *
 * Utilisé par le tier-lifecycle (`fetchSearchConsoleCtr`) pour décider
 * promote/demote d'un article selon son CTR/impressions réels GSC. Query sans
 * `dimensions` → Google renvoie une seule ligne agrégée pour la page filtrée.
 *
 * Skip silencieux + return `null` si credentials absents (graceful degrade :
 * le décideur de lifecycle retombe alors sur `no_data` = noop, comportement sûr).
 *
 * @param targetUrl  URL canonique absolue (ex: https://axion-ia.com/fr/blog/abc)
 * @param daysWindow Fenêtre lookback en jours (14 promote / 30 demote)
 */
export async function gscPageMetricsForUrl(
  targetUrl: string,
  daysWindow = 28,
): Promise<{
  ctr: number; // 0-1
  impressions: number;
  clicks: number;
  position: number; // 1.0 = #1 SERP
} | null> {
  const propertyUrl = process.env["GSC_PROPERTY_URL"];
  if (!propertyUrl) return null;
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
    // Pas de `dimensions` → agrégat page-level (1 ligne) pour l'URL filtrée.
    dimensionFilterGroups: [
      {
        filters: [{ dimension: "page", operator: "equals", expression: targetUrl }],
      },
    ],
    rowLimit: 1,
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
      `[gsc-client] page metrics failed for ${targetUrl}: ${res.status} ${text.slice(0, 150)}`,
    );
    return null;
  }

  const data = (await res.json()) as { rows?: GscSearchRow[] };
  const row = data.rows?.[0];
  if (!row) {
    // Aucune ligne = page sans impressions sur la fenêtre (pas encore crawlée /
    // zéro trafic). On renvoie des zéros explicites : le décideur traite
    // impressions=0 comme "pas assez de signal" (noop), pas comme une erreur.
    return { ctr: 0, impressions: 0, clicks: 0, position: 0 };
  }
  return {
    ctr: row.ctr,
    impressions: row.impressions,
    clicks: row.clicks,
    position: row.position,
  };
}

/**
 * Test helper — retourne l'access_token courant (cached) sans appel API.
 * Utile pour smoke tests ou debug local.
 */
export function getGscCachedToken(): CachedAccessToken | null {
  return cachedToken;
}

/**
 * Audit indexation 2026-05-18 P1-10 — URL Inspection API.
 *
 * Endpoint : `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`
 * Quota : 2 000 req/jour, 600 req/min (read-only, n'utilise PAS le quota Indexing API).
 *
 * Permet d'auditer l'état Google d'une URL individuelle (canonicalUrl,
 * coverageState, indexingState, lastCrawlTime, mobileUsability) sans CSV
 * export manuel. Outil clé pour observabilité indexation au quotidien.
 *
 * Skip silencieux + return null si credentials absents (V1 graceful degrade).
 *
 * @param inspectedUrl URL canonique à inspecter (ex: https://axion-ia.com/fr/blog/abc)
 * @param languageCode  BCP-47 (ex: "fr-FR"), optional ; aide Google pour rendre la page
 *
 * Doc : <https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect>
 */
export interface GscUrlInspectionResult {
  readonly inspectionResultLink?: string;
  readonly indexStatusResult?: {
    readonly verdict?: string;
    readonly coverageState?: string;
    readonly robotsTxtState?: string;
    readonly indexingState?: string;
    readonly lastCrawlTime?: string;
    readonly pageFetchState?: string;
    readonly googleCanonical?: string;
    readonly userCanonical?: string;
    readonly sitemap?: ReadonlyArray<string>;
    readonly referringUrls?: ReadonlyArray<string>;
    readonly crawledAs?: string;
  };
  readonly mobileUsabilityResult?: {
    readonly verdict?: string;
    readonly issues?: ReadonlyArray<{ readonly issueType?: string; readonly severity?: string }>;
  };
  readonly richResultsResult?: {
    readonly verdict?: string;
    readonly detectedItems?: ReadonlyArray<{ readonly richResultType?: string }>;
  };
}

export async function gscInspectUrl(
  inspectedUrl: string,
  languageCode = "fr-FR",
): Promise<GscUrlInspectionResult | null> {
  const propertyUrl = process.env["GSC_PROPERTY_URL"];
  if (!propertyUrl) return null;
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

  const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inspectionUrl: inspectedUrl,
      siteUrl: propertyUrl,
      languageCode,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[gsc-client] urlInspect failed for ${inspectedUrl}: ${res.status} ${text.slice(0, 200)}`,
    );
    return null;
  }

  const data = (await res.json()) as { inspectionResult?: GscUrlInspectionResult };
  return data.inspectionResult ?? null;
}
