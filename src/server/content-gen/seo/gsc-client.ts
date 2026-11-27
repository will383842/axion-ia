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
class GscOauthError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "GscOauthError";
  }
}

async function getAccessToken(fetchImpl: typeof fetch = fetch): Promise<string> {
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

  const res = await fetchImpl(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GscOauthError(
      `GSC OAuth refresh failed: ${res.status} ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new GscOauthError("GSC OAuth response missing access_token", null);
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

// ════════════════════════════════════════════════════════════════════════════
// Pilotage SEO/GEO — P1 : lecture Search Analytics PAR LOT (fonctions nouvelles,
// non branchées). Les fonctions ci-dessus gardent leur signature.
//
// Champs de `searchanalytics.query` utilisés (doc Google, v3 webmasters) :
//   requête : startDate, endDate (YYYY-MM-DD, heure du Pacifique), dimensions[]
//   (date|page|query|country|device|searchAppearance), type (web), dataState
//   (final|all|hourly_all), aggregationType (auto|byPage|byProperty),
//   rowLimit (1..25000), startRow (≥ 0), dimensionFilterGroups.
//   réponse : rows[{keys, clicks, impressions, ctr, position}],
//   responseAggregationType, metadata.first_incomplete_date.
// Aucun identifiant ni corps de réponse n'est jamais recopié dans un message.
// ════════════════════════════════════════════════════════════════════════════

export type GscDimension = "date" | "page" | "query" | "country" | "device" | "searchAppearance";
export type GscDataState = "final" | "all" | "hourly_all";
export type GscAggregationType = "auto" | "byPage" | "byProperty";

export type GscEtat = "ok" | "identifiants_absents" | "refus" | "quota" | "erreur";

export interface GscSearchAnalyticsParams {
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions: ReadonlyArray<GscDimension>;
  readonly aggregationType?: GscAggregationType;
  readonly dataState?: GscDataState;
  readonly startRow?: number;
  /** Taille de page (1..25000, défaut 25000). La pagination avance de cette taille. */
  readonly rowLimit?: number;
  /** Filtre exact sur une page (pour la variante à dates explicites). */
  readonly pageEquals?: string;
}

export interface GscLotDeps {
  readonly fetchImpl?: typeof fetch;
  /** Attente en millisecondes (injectable pour les tests). */
  readonly attendre?: (ms: number) => Promise<void>;
  /** Nombre maximal de réessais sur 429 (défaut 3). */
  readonly essaisMax?: number;
  /** Nombre maximal de pages lues (défaut 40, soit 1 M de lignes). */
  readonly pagesMax?: number;
  readonly maintenant?: () => Date;
}

export interface GscLotResultat {
  readonly etat: GscEtat;
  readonly rows: ReadonlyArray<GscSearchRow>;
  /** true seulement si la dernière page lue était incomplète (fin naturelle des données). */
  readonly complet: boolean;
  readonly premierJourIncomplet?: string;
  /** Message sûr : jamais d'identifiant, jamais de corps de réponse. */
  readonly message?: string;
}

const GSC_LIGNES_MAX = 25_000;
const REGEX_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RAISONS_QUOTA = new Set(["quotaExceeded", "rateLimitExceeded", "dailyLimitExceeded"]);
const ATTENTE_RETRY_AFTER_MAX_MS = 60_000;

const attendreParDefaut = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function identifiantsPresents(): boolean {
  return Boolean(
    process.env["GSC_PROPERTY_URL"] &&
    process.env["GSC_OAUTH_CLIENT_ID"] &&
    process.env["GSC_OAUTH_CLIENT_SECRET"] &&
    process.env["GSC_OAUTH_REFRESH_TOKEN"],
  );
}

function dateValide(d: string): boolean {
  if (!REGEX_DATE.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

function delaiRetryAfter(valeur: string | null): number | null {
  if (!valeur) return null;
  const s = Number(valeur);
  if (!Number.isFinite(s) || s < 0) return null;
  return Math.min(Math.round(s * 1000), ATTENTE_RETRY_AFTER_MAX_MS);
}

async function raisonsErreurGoogle(res: Response): Promise<ReadonlyArray<string>> {
  try {
    const data = (await res.json()) as {
      error?: { status?: string; errors?: ReadonlyArray<{ reason?: string }> };
    };
    const raisons = (data.error?.errors ?? []).map((e) => e.reason ?? "");
    if (data.error?.status) raisons.push(data.error.status);
    return raisons;
  } catch {
    return [];
  }
}

function resultatVide(etat: GscEtat, message: string): GscLotResultat {
  return { etat, rows: [], complet: false, message };
}

/**
 * Lit Search Analytics avec pagination (`startRow`), réessai sur 429 et arrêt
 * propre sur quota. Ne lève jamais ; ne rend jamais `null`. En cas d'échec en
 * cours de pagination, les lignes déjà lues sont rendues avec `complet: false`.
 */
export async function gscSearchAnalytics(
  params: GscSearchAnalyticsParams,
  deps: GscLotDeps = {},
): Promise<GscLotResultat> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const attendre = deps.attendre ?? attendreParDefaut;
  const essaisMax = Math.max(0, deps.essaisMax ?? 3);
  const pagesMax = Math.max(1, deps.pagesMax ?? 40);

  if (
    !dateValide(params.startDate) ||
    !dateValide(params.endDate) ||
    params.startDate > params.endDate
  ) {
    return resultatVide("erreur", "Période invalide (dates au format AAAA-MM-JJ, début ≤ fin).");
  }
  const taillePage = Math.min(
    Math.max(1, Math.floor(params.rowLimit ?? GSC_LIGNES_MAX)),
    GSC_LIGNES_MAX,
  );
  let startRow = Math.max(0, Math.floor(params.startRow ?? 0));

  if (!identifiantsPresents()) {
    return resultatVide("identifiants_absents", "Identifiants Search Console absents.");
  }
  const propertyUrl = process.env["GSC_PROPERTY_URL"] as string;

  let accessToken: string;
  try {
    accessToken = await getAccessToken(fetchImpl);
  } catch (err) {
    const status = err instanceof GscOauthError ? err.status : null;
    if (status === 400 || status === 401 || status === 403) {
      return resultatVide("refus", "Jeton OAuth refusé par Google.");
    }
    return resultatVide("erreur", "Échec du rafraîchissement du jeton OAuth.");
  }

  const url = `${WEBMASTERS_API}/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;
  const rows: GscSearchRow[] = [];
  let premierJourIncomplet: string | undefined;

  const echec = (etat: GscEtat, message: string): GscLotResultat => ({
    etat,
    rows,
    complet: false,
    message,
    ...(premierJourIncomplet ? { premierJourIncomplet } : {}),
  });

  for (let page = 0; page < pagesMax; page++) {
    const corps: Record<string, unknown> = {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions,
      type: "web",
      rowLimit: taillePage,
      startRow,
    };
    if (params.aggregationType) corps["aggregationType"] = params.aggregationType;
    if (params.dataState) corps["dataState"] = params.dataState;
    if (params.pageEquals) {
      corps["dimensionFilterGroups"] = [
        { filters: [{ dimension: "page", operator: "equals", expression: params.pageEquals }] },
      ];
    }

    let essai = 0;
    let res: Response;
    for (;;) {
      try {
        res = await fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(corps),
        });
      } catch {
        return echec("erreur", "Appel Search Console impossible (réseau).");
      }
      if (res.status !== 429) break;
      if (essai >= essaisMax) return echec("quota", "Search Console limite le débit (429).");
      const delai = delaiRetryAfter(res.headers.get("retry-after")) ?? 1000 * 2 ** essai;
      await attendre(delai);
      essai++;
    }

    if (!res.ok) {
      if (res.status === 403) {
        const raisons = await raisonsErreurGoogle(res);
        if (raisons.some((r) => RAISONS_QUOTA.has(r))) {
          return echec("quota", "Quota Search Console atteint (quotaExceeded).");
        }
        return echec("refus", "Accès Search Console refusé (403).");
      }
      if (res.status === 401) return echec("refus", "Accès Search Console refusé (401).");
      return echec("erreur", `Search Console a répondu ${res.status}.`);
    }

    let data: {
      rows?: GscSearchRow[];
      metadata?: { first_incomplete_date?: string };
    };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      return echec("erreur", "Réponse Search Console illisible.");
    }
    if (data.metadata?.first_incomplete_date) {
      premierJourIncomplet = data.metadata.first_incomplete_date;
    }
    const lot = data.rows ?? [];
    rows.push(...lot);
    if (lot.length < taillePage) {
      return {
        etat: "ok",
        rows,
        complet: true,
        ...(premierJourIncomplet ? { premierJourIncomplet } : {}),
      };
    }
    startRow += lot.length;
  }
  return {
    etat: "ok",
    rows,
    complet: false,
    message: "Nombre maximal de pages atteint.",
    ...(premierJourIncomplet ? { premierJourIncomplet } : {}),
  };
}

const FENETRE_DERNIER_JOUR_FINAL_JOURS = 14;

/**
 * Dernier jour pour lequel `dataState: "final"` rend des données. Détecté, jamais
 * codé en dur à J-3. `jour` vaut `null` s'il n'y a aucune donnée finale (ou si
 * l'état n'est pas « ok » : lire `etat` d'abord).
 */
export async function gscDernierJourFinal(
  deps: GscLotDeps = {},
): Promise<{ etat: GscEtat; jour: string | null }> {
  const fin = (deps.maintenant ?? (() => new Date()))();
  const debut = new Date(fin.getTime() - FENETRE_DERNIER_JOUR_FINAL_JOURS * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const r = await gscSearchAnalytics(
    {
      startDate: fmt(debut),
      endDate: fmt(fin),
      dimensions: ["date"],
      dataState: "final",
      rowLimit: 100,
    },
    deps,
  );
  if (r.etat !== "ok") return { etat: r.etat, jour: null };
  const jours = r.rows.map((l) => l.keys[0]).filter((k): k is string => !!k && REGEX_DATE.test(k));
  jours.sort();
  return { etat: "ok", jour: jours.length > 0 ? (jours[jours.length - 1] as string) : null };
}

/**
 * Sonde de santé : un appel minimal. Rend toujours un état, **jamais `null`** ;
 * ne lève jamais ; ne contient aucun identifiant.
 */
export async function gscSonde(deps: GscLotDeps = {}): Promise<{ etat: GscEtat }> {
  try {
    const fin = (deps.maintenant ?? (() => new Date()))();
    const debut = new Date(fin.getTime() - 7 * 86_400_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const r = await gscSearchAnalytics(
      {
        startDate: fmt(debut),
        endDate: fmt(fin),
        dimensions: ["date"],
        dataState: "final",
        rowLimit: 1,
      },
      { ...deps, essaisMax: 0, pagesMax: 1 },
    );
    return { etat: r.etat };
  } catch {
    return { etat: "erreur" };
  }
}

/**
 * Variante de `gscPageMetricsForUrl` à **dates explicites** (fenêtres avant/après
 * d'une modification). Même forme de retour ; `null` si l'API échoue ou si les
 * identifiants manquent (jamais 0 par erreur). Page sans ligne = zéros explicites.
 */
export async function gscPageMetricsForUrlDates(
  targetUrl: string,
  startDate: string,
  endDate: string,
  deps: GscLotDeps = {},
): Promise<{ ctr: number; impressions: number; clicks: number; position: number } | null> {
  const r = await gscSearchAnalytics(
    {
      startDate,
      endDate,
      dimensions: [],
      dataState: "final",
      rowLimit: 1,
      pageEquals: targetUrl,
    },
    { ...deps, pagesMax: 1 },
  );
  if (r.etat !== "ok") return null;
  const row = r.rows[0];
  if (!row) return { ctr: 0, impressions: 0, clicks: 0, position: 0 };
  return { ctr: row.ctr, impressions: row.impressions, clicks: row.clicks, position: row.position };
}
