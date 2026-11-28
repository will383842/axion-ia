/**
 * Bing Webmaster Tools API client — audit indexation 2026-05-18 P2-30.
 *
 * Spec : <https://www.bing.com/webmasters/url-submission-api>
 *
 * Permet (read-only) :
 *   - Quota : Get remaining URL submission quota
 *   - GetUrlInfo : statut indexation d'une URL spécifique
 *   - GetCrawlStats : pages crawled / discovered / errors par fenêtre
 *
 * Et (mutating, NON utilisé V1 par doctrine — IndexNow couvre déjà Bing) :
 *   - SubmitUrl : soumettre 1 URL pour indexation
 *   - SubmitUrlBatch : batch jusqu'à 500 URLs/jour
 *
 * V1 = read-only audit. Pas de soumission manuelle (IndexNow universal
 * couvre Bing automatiquement, cf. audit AGENT-03 §3.7).
 *
 * Env var requise :
 *   - BING_WMT_API_KEY (obtenir via https://www.bing.com/webmasters → API access)
 *
 * Skip silencieux si BING_WMT_API_KEY absent (V1 graceful degrade, cohérent
 * `gsc-client.ts`).
 */

import * as Sentry from "@sentry/nextjs";

const BING_WMT_API = "https://ssl.bing.com/webmaster/api.svc/json";
const DEFAULT_SITE_URL = "https://axion-ia.com";

/** Jamais l'objet d'erreur entier : l'URL d'appel porte la clé. Le nom seul est journalisé. */
function errName(err: unknown): string {
  return err instanceof Error ? err.name : "erreur";
}

interface BingWmtCrawlStats {
  readonly date: string;
  readonly pagesCrawled: number;
  readonly pagesDiscovered: number;
  readonly crawlErrors: number;
  readonly inIndex: number;
}

interface BingWmtUrlInfo {
  readonly url: string;
  readonly indexed: boolean;
  readonly anchorCount?: number;
  readonly httpCode?: number;
  readonly documentSize?: number;
  readonly lastCrawled?: string;
}

interface BingWmtQuota {
  readonly dailyQuota: number;
  readonly monthlyQuota: number;
}

/**
 * Lit les stats de crawl Bing sur les N derniers jours.
 * Endpoint : `GetCrawlStats?apikey=X&siteUrl=Y`
 *
 * Skip + null si BING_WMT_API_KEY absent.
 */
export async function bingWmtGetCrawlStats(
  daysWindow = 28,
): Promise<ReadonlyArray<BingWmtCrawlStats> | null> {
  const apiKey = process.env["BING_WMT_API_KEY"];
  if (!apiKey) return null;

  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? DEFAULT_SITE_URL;
  const url = `${BING_WMT_API}/GetCrawlStats?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.error(`[bing-wmt-client] GetCrawlStats ${res.status}`);
      Sentry.captureMessage(`Bing WMT GetCrawlStats ${res.status}`, {
        level: "warning",
        tags: { component: "bing-wmt-client", endpoint: "GetCrawlStats" },
      });
      return null;
    }
    const data = (await res.json()) as { d?: Array<Record<string, unknown>> };
    const rows = data.d ?? [];
    return rows.slice(0, daysWindow).map((r): BingWmtCrawlStats => ({
      date: typeof r.Date === "string" ? r.Date : "",
      pagesCrawled: typeof r.CrawledPages === "number" ? r.CrawledPages : 0,
      pagesDiscovered: typeof r.DiscoveredPages === "number" ? r.DiscoveredPages : 0,
      crawlErrors: typeof r.CrawlErrors === "number" ? r.CrawlErrors : 0,
      inIndex: typeof r.InIndex === "number" ? r.InIndex : 0,
    }));
  } catch (err) {
    console.error(`[bing-wmt-client] GetCrawlStats error: ${errName(err)}`);
    return null;
  }
}

/**
 * Lit l'info d'indexation d'une URL spécifique.
 * Endpoint : `GetUrlInfo?apikey=X&siteUrl=Y&url=Z`
 *
 * Skip + null si BING_WMT_API_KEY absent.
 */
export async function bingWmtGetUrlInfo(targetUrl: string): Promise<BingWmtUrlInfo | null> {
  const apiKey = process.env["BING_WMT_API_KEY"];
  if (!apiKey) return null;

  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? DEFAULT_SITE_URL;
  const url = `${BING_WMT_API}/GetUrlInfo?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}&url=${encodeURIComponent(targetUrl)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.error(`[bing-wmt-client] GetUrlInfo ${res.status} for ${targetUrl}`);
      return null;
    }
    const data = (await res.json()) as { d?: Record<string, unknown> };
    const d = data.d ?? {};
    return {
      url: targetUrl,
      indexed: Boolean(d.InIndex),
      ...(typeof d.AnchorCount === "number" ? { anchorCount: d.AnchorCount } : {}),
      ...(typeof d.HttpCode === "number" ? { httpCode: d.HttpCode } : {}),
      ...(typeof d.DocumentSize === "number" ? { documentSize: d.DocumentSize } : {}),
      ...(typeof d.LastCrawled === "string" ? { lastCrawled: d.LastCrawled } : {}),
    };
  } catch (err) {
    console.error(`[bing-wmt-client] GetUrlInfo error: ${errName(err)}`);
    return null;
  }
}

/**
 * Lit le quota URL submission restant (daily + monthly).
 * Endpoint : `GetUrlSubmissionQuota?apikey=X&siteUrl=Y`
 *
 * Utile pour vérifier que IndexNow universal n'a pas consommé tout le quota
 * (Bing partage le pool entre IndexNow et URL Submission API).
 */
export async function bingWmtGetQuota(): Promise<BingWmtQuota | null> {
  const apiKey = process.env["BING_WMT_API_KEY"];
  if (!apiKey) return null;

  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? DEFAULT_SITE_URL;
  const url = `${BING_WMT_API}/GetUrlSubmissionQuota?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as { d?: { DailyQuota?: number; MonthlyQuota?: number } };
    const d = data.d ?? {};
    return {
      dailyQuota: typeof d.DailyQuota === "number" ? d.DailyQuota : 0,
      monthlyQuota: typeof d.MonthlyQuota === "number" ? d.MonthlyQuota : 0,
    };
  } catch (err) {
    console.error(`[bing-wmt-client] GetUrlSubmissionQuota error: ${errName(err)}`);
    return null;
  }
}

/** True si BING_WMT_API_KEY env var est set. */
export function isBingWmtReady(): boolean {
  return Boolean(process.env["BING_WMT_API_KEY"]);
}

// ─── P17 : lectures par page et par requête ──────────────────────────────────
// Noms des méthodes : `GetPageStats` et `GetQueryStats` (API JSON Bing Webmaster, méthodes
// GetPageStats / GetQueryStats de l'interface IWebmasterApi). La documentation officielle de
// Microsoft n'a pas pu être relue depuis cet environnement : noms et champs de réponse
// (`Query`, `Date` au format `/Date(ms)/`, `Clicks`, `Impressions`, `AvgImpressionPosition`)
// à confirmer au premier relevé réel.

export interface BingWmtStatLigne {
  /** Pour `GetPageStats`, l'URL de la page ; pour `GetQueryStats`, la requête. */
  readonly cle: string;
  readonly date: Date;
  readonly clics: number;
  readonly impressions: number;
  readonly position: number;
}

async function lireStats(
  methode: "GetPageStats" | "GetQueryStats",
): Promise<ReadonlyArray<BingWmtStatLigne> | null> {
  const apiKey = process.env["BING_WMT_API_KEY"];
  if (!apiKey) return null;
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? DEFAULT_SITE_URL;
  const url = `${BING_WMT_API}/${methode}?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.error(`[bing-wmt-client] ${methode} ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { d?: Array<Record<string, unknown>> };
    const out: BingWmtStatLigne[] = [];
    for (const r of data.d ?? []) {
      const m =
        typeof r["Date"] === "string"
          ? /^\/Date\((-?\d{1,15})(?:[+-]\d{4})?\)\/$/.exec(r["Date"])
          : null;
      if (!m?.[1] || typeof r["Query"] !== "string") continue;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
      out.push({
        cle: r["Query"],
        date: new Date(Number(m[1])),
        clics: num(r["Clicks"]),
        impressions: num(r["Impressions"]),
        position: num(r["AvgImpressionPosition"]),
      });
    }
    return out;
  } catch (err) {
    console.error(`[bing-wmt-client] ${methode} error: ${errName(err)}`);
    return null;
  }
}

/** Stats par page (une ligne par page et par jour). `null` si clé absente ou API en échec. */
export function bingWmtGetPageStats() {
  return lireStats("GetPageStats");
}

/** Stats par requête (une ligne par requête et par jour). `null` si clé absente ou API en échec. */
export function bingWmtGetQueryStats() {
  return lireStats("GetQueryStats");
}
