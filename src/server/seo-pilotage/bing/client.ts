/**
 * Client de l'API Bing Webmaster pour le pilotage SEO (P17). Lecture seule.
 *
 * - La clé vient de `BING_WMT_API_KEY` (environnement). Absente ou vide : module INACTIF, sans
 *   erreur et sans appel réseau.
 * - L'API Bing veut la clé dans l'URL : l'URL n'est donc JAMAIS journalisée, ni copiée dans une
 *   erreur. Seul un code d'état (`quota`, `erreur_http`, `reseau`, `reponse_invalide`) sort d'ici.
 * - `fetch` et `env` sont injectés : les tests n'appellent jamais le réseau.
 * - Un seul appel par lecture, jamais de nouvelle tentative : un 429 (quota) arrête le passage.
 */

const BING_WMT_API = "https://ssl.bing.com/webmaster/api.svc/json";
const SITE_PAR_DEFAUT = "https://axion-ia.com";
const DELAI_APPEL_MS = 20_000;

export type EtatBing = "ok" | "inactif" | "quota" | "erreur_http" | "reseau" | "reponse_invalide";

export interface DepsBing {
  readonly fetch?: typeof fetch;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface LigneStatBing {
  /** URL de la page (lecture « pages ») ou texte de la requête (lecture « requêtes »). */
  readonly cle: string;
  readonly jour: string;
  readonly clics: number;
  readonly impressions: number;
  readonly position: number;
}

export interface LigneExplorationBing {
  readonly jour: string;
  readonly pagesExplorees: number;
  readonly erreurs: number;
  readonly pagesIndexees: number;
  readonly codes4xx: number;
  readonly codes5xx: number;
}

export interface LectureBing<T> {
  readonly etat: EtatBing;
  readonly lignes: ReadonlyArray<T>;
}

export function bingPilotageActif(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return Boolean(env["BING_WMT_API_KEY"]?.trim());
}

/** « /Date(1700000000000)/ » (avec ou sans décalage) ou ISO → « AAAA-MM-JJ » (UTC) ; sinon null. */
export function dateBing(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const ms = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(brut);
  const date = ms
    ? new Date(Number(ms[1]))
    : /^\d{4}-\d{2}-\d{2}/.test(brut)
      ? new Date(brut)
      : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

const nombre = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;

async function appeler(
  methode: string,
  deps: DepsBing,
): Promise<{ etat: EtatBing; lignes: ReadonlyArray<Record<string, unknown>> }> {
  const env = deps.env ?? process.env;
  const cle = env["BING_WMT_API_KEY"]?.trim();
  if (!cle) return { etat: "inactif", lignes: [] };
  const site = env["NEXT_PUBLIC_SITE_URL"] ?? SITE_PAR_DEFAUT;
  const url = `${BING_WMT_API}/${methode}?apikey=${encodeURIComponent(cle)}&siteUrl=${encodeURIComponent(site)}`;
  try {
    const res = await (deps.fetch ?? fetch)(url, {
      method: "GET",
      signal: AbortSignal.timeout(DELAI_APPEL_MS),
    });
    if (res.status === 429) return { etat: "quota", lignes: [] };
    if (!res.ok) return { etat: "erreur_http", lignes: [] };
    const corps = (await res.json()) as { d?: unknown };
    if (!Array.isArray(corps?.d)) return { etat: "reponse_invalide", lignes: [] };
    const lignes = (corps.d as unknown[]).filter(
      (l): l is Record<string, unknown> => typeof l === "object" && l !== null,
    );
    return { etat: "ok", lignes };
  } catch {
    // Le message d'une erreur réseau peut contenir l'URL, donc la clé : on ne le garde pas.
    return { etat: "reseau", lignes: [] };
  }
}

async function lireStats(methode: string, deps: DepsBing): Promise<LectureBing<LigneStatBing>> {
  const r = await appeler(methode, deps);
  const lignes: LigneStatBing[] = [];
  for (const l of r.lignes) {
    const jour = dateBing(l["Date"]);
    const cle = typeof l["Query"] === "string" ? l["Query"].trim() : "";
    if (!jour || !cle) continue;
    lignes.push({
      cle,
      jour,
      clics: nombre(l["Clicks"]),
      impressions: nombre(l["Impressions"]),
      position: nombre(l["AvgImpressionPosition"]),
    });
  }
  return { etat: r.etat, lignes };
}

export const lirePagesBing = (deps: DepsBing = {}) => lireStats("GetPageStats", deps);
export const lireRequetesBing = (deps: DepsBing = {}) => lireStats("GetQueryStats", deps);

export async function lireExplorationBing(
  deps: DepsBing = {},
): Promise<LectureBing<LigneExplorationBing>> {
  const r = await appeler("GetCrawlStats", deps);
  const lignes: LigneExplorationBing[] = [];
  for (const l of r.lignes) {
    const jour = dateBing(l["Date"]);
    if (!jour) continue;
    lignes.push({
      jour,
      pagesExplorees: nombre(l["CrawledPages"]),
      erreurs: nombre(l["CrawlErrors"]),
      pagesIndexees: nombre(l["InIndex"]),
      codes4xx: nombre(l["Code4xx"]),
      codes5xx: nombre(l["Code5xx"]),
    });
  }
  return { etat: r.etat, lignes };
}
