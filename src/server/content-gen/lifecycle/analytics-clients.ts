/**
 * Content Generator — Analytics clients (Sprint 10 V2).
 *
 * Stubs réseau pour Google Search Console + Plausible. V1 = noop si credentials
 * absents (mode skeleton). Activation prod = Will fournit :
 *   - `GOOGLE_INDEXING_SA_JSON` (JWT service account inline JSON) + `GSC_PROPERTY_URL`
 *   - `PLAUSIBLE_API_KEY` + `PLAUSIBLE_SITE_ID`
 *
 * SSOT env vars aligné audit indexation 2026-05-15 P0-9 :
 *   - Google Indexing JWT inline = `GOOGLE_INDEXING_SA_JSON` (cohérent .env.example,
 *     content-google-indexing-worker.ts, runbook R15, scripts/check-prod-env.sh)
 *   - GSC property = `GSC_PROPERTY_URL` (cohérent gsc-client.ts, scripts/*.mjs,
 *     .github/workflows/gsc-crawl-stats-weekly.yml)
 *
 * Sans credentials → retourne `null`, le décideur de lifecycle skip l'article.
 * Avec credentials → utilise les SDK officiels (`googleapis` + fetch direct).
 *
 * Design : les fonctions sont des "fetch one URL at a time" pour rester simple ;
 * batch optimisations possibles Sprint 11+ si volume > 1k articles/mois.
 */

export interface CtrMetrics {
  readonly ctr: number; // 0-1
  readonly impressions: number;
  readonly clicks: number;
  readonly position: number; // 1.0 = #1 SERP
}

export interface PageviewMetrics {
  readonly views: number;
  readonly bounceRate: number; // 0-1
}

/**
 * Fetch CTR via Google Search Console API.
 *
 * V1 SKELETON : retourne `null` (les credentials/SDK ne sont pas câblés en V1).
 * Le décideur `computeTierDecision` retourne `noop` quand ctr=null, donc le
 * tier-lifecycle-worker reste safe en attendant Sprint 10.5.
 *
 * Activation Sprint 10.5 (quand Will fournira credentials + SDK) :
 *   1. `pnpm add googleapis` (ou client REST custom + google-auth-library)
 *   2. Setter Coolify env vars : `GOOGLE_INDEXING_SA_JSON` (JWT inline) +
 *      `GSC_PROPERTY_URL` (ex `sc-domain:axion-ia.com`)
 *   3. Décommenter le bloc `if (credentials && property)` ci-dessous et
 *      remplacer par l'appel SDK réel.
 */
export async function fetchSearchConsoleCtr(
  _url: string,
  _daysWindow: number,
): Promise<CtrMetrics | null> {
  const credentials = process.env.GOOGLE_INDEXING_SA_JSON;
  const property = process.env.GSC_PROPERTY_URL;
  if (!credentials || !property) {
    return null; // skeleton mode V1
  }
  // V1 : pas de SDK installé → retourne null même si credentials présents.
  // Will doit lancer Sprint 10.5 pour ajouter googleapis.
  console.warn(
    "[gsc] credentials set but googleapis SDK not installed — run Sprint 10.5 to activate",
  );
  return null;
}

/**
 * Fetch pageviews via Plausible API.
 * Retourne `null` si credentials absent (mode skeleton V1).
 */
export async function fetchPlausiblePageviews(
  url: string,
  daysWindow: number,
): Promise<PageviewMetrics | null> {
  const apiKey = process.env.PLAUSIBLE_API_KEY;
  const siteId = process.env.PLAUSIBLE_SITE_ID;
  const apiUrl = process.env.NEXT_PUBLIC_PLAUSIBLE_API_URL ?? "https://plausible.io";
  if (!apiKey || !siteId) return null;

  try {
    const u = new URL(url);
    const params = new URLSearchParams({
      site_id: siteId,
      period: `${daysWindow}d`,
      metrics: "pageviews,bounce_rate",
      filters: `event:page==${u.pathname}`,
    });
    const resp = await fetch(`${apiUrl}/api/v1/stats/aggregate?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      console.warn(`[plausible] fetch ${url} returned ${resp.status}`);
      return null;
    }
    const data = (await resp.json()) as {
      results?: {
        pageviews?: { value?: number };
        bounce_rate?: { value?: number };
      };
    };
    return {
      views: data.results?.pageviews?.value ?? 0,
      bounceRate: (data.results?.bounce_rate?.value ?? 0) / 100,
    };
  } catch (err) {
    console.warn(
      `[plausible] fetch failed for ${url}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
