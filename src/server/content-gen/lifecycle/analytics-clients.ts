/**
 * Content Generator — Analytics clients (Sprint 10 V2).
 *
 * Clients réseau pour Google Search Console + Plausible. Graceful degrade :
 * retournent `null` si credentials absents (le décideur de lifecycle traite
 * `null` comme `no_data` = noop, comportement sûr).
 *
 * P0-4 (audit content-gen 2026-06-15) — `fetchSearchConsoleCtr` était un
 * skeleton qui retournait TOUJOURS `null` (même avec credentials, faute de SDK),
 * ce qui rendait le tier-lifecycle-worker totalement inopérant (jamais de
 * promote/demote auto). Désormais il délègue à `gscPageMetricsForUrl`
 * (`seo/gsc-client.ts`) qui appelle réellement l'API Search Analytics via le
 * flux OAuth refresh-token DÉJÀ câblé et utilisé par `content-keyword-sync`.
 *
 * Credentials (Coolify, scope RUN) — mêmes vars que gsc-client.ts :
 *   - `GSC_OAUTH_CLIENT_ID` / `GSC_OAUTH_CLIENT_SECRET` / `GSC_OAUTH_REFRESH_TOKEN`
 *   - `GSC_PROPERTY_URL` (ex: `sc-domain:axion-ia.com`)
 *   - Plausible : `PLAUSIBLE_API_KEY` + `PLAUSIBLE_SITE_ID`
 *
 * Design : "fetch one URL at a time" ; batch possible Sprint 11+ si volume > 1k/mois.
 */

import { gscPageMetricsForUrl } from "@/server/content-gen/seo/gsc-client";
import { buildStub, estTableAbsente, pilotageSeoActif } from "@/server/seo-pilotage/interrupteur";

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

async function metriquesDepuisHistorique(
  url: string,
  daysWindow: number,
): Promise<CtrMetrics | null> {
  if (!pilotageSeoActif() || buildStub()) return null;
  try {
    const [{ prisma }, { metriquesPageDepuisHistorique }] = await Promise.all([
      import("@/lib/prisma"),
      import("@/server/seo-pilotage/recalcul"),
    ]);
    return await metriquesPageDepuisHistorique(prisma, url, daysWindow);
  } catch (err) {
    // Tables absentes (P2021) ou panne de lecture : repli silencieux sur l'API.
    if (!estTableAbsente(err)) {
      console.warn("[lifecycle] lecture de l'historique SEO en échec, repli sur l'API.");
    }
    return null;
  }
}

/**
 * Fetch CTR/impressions réels via Google Search Console (Search Analytics API).
 *
 * Délègue à `gscPageMetricsForUrl` (flux OAuth refresh-token réel). Retourne
 * `null` si credentials absents ou erreur réseau → le décideur de lifecycle
 * (`computeTierDecision`) traite alors `ctr=null` comme `no_data` (noop sûr).
 *
 * @param url        URL canonique absolue de l'article (buildArticleUrl)
 * @param daysWindow Fenêtre lookback (14 promote / 30 demote)
 */
export async function fetchSearchConsoleCtr(
  url: string,
  daysWindow: number,
): Promise<CtrMetrics | null> {
  // P6a — pilotage SEO allumé ET historique couvrant ≥ 28 jours : lecture de la table, aucun
  // appel Google (quota préservé). Sinon (éteint, stub, historique court, table absente, panne) :
  // comportement d'avant, inchangé.
  const depuisHistorique = await metriquesDepuisHistorique(url, daysWindow);
  if (depuisHistorique) return depuisHistorique;
  const m = await gscPageMetricsForUrl(url, daysWindow);
  if (!m) return null;
  return {
    ctr: m.ctr,
    impressions: m.impressions,
    clicks: m.clicks,
    position: m.position,
  };
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
