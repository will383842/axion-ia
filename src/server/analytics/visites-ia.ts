// Visites venues des assistants IA — lecture SEULE de l'API Stats de Plausible
// auto-hébergé (fiche GEO V1-10). Aucun réglage de Plausible n'est touché.
//
// - API v2 (`POST /api/v2/query`), dimension `visit:source` (référent reconnu OU
//   `utm_source`, même sans en-tête Referer), filtre EXACT `is` sur `SOURCES_PLAUSIBLE`
//   OU `visit:referrer` contient un domaine de `REFERENTS_IA` (+ `bing.com/chat`).
//   Le classement par IA se fait ICI.
//   ⚠️ Pourquoi les deux : Plausible v3.0.1 (prod) range d'abord le référent via RefInspector,
//   sous-domaines compris (`source.ex` → `resolve/1`, `ref_inspector/parser.ex:59`) ; or
//   `google.com` est sous « Google » (`referers.yml:1513`). Une visite de `gemini.google.com`
//   a donc `visit:source = "Google"` et `visit:referrer = "gemini.google.com"` : seul le
//   filtre sur le référent la voit. Les versions récentes nomment « Microsoft Copilot » et
//   « Google Gemini » (`custom_sources.json`) : les deux noms sont listés.
// - Périodes : `7d` / `30d` natifs (alignés sur la v1) ; hebdo = lundi d'il y a 11
//   semaines → aujourd'hui, fuseau Europe/Paris (semaine en cours partielle).
// - Pas de repli v1 : son parseur de filtres (Plausible v3.0.1, `stats_api_filter_parser.ex`) ne
//   connaît ni `=~` ni `!=` sur une liste, donc le décompte serait faux. Un 404 de la v2 rend
//   « indisponible » (version trop ancienne) ; la production parle la v2.
// - Filtres insensibles à la casse (`case_sensitive: false`) : un `utm_source=ChatGPT.com` est
//   stocké tel quel par Plausible.
// - Échec silencieux : clé absente, stubs de build, API injoignable ou en erreur →
//   `{ statut: "indisponible" }`, jamais d'exception. Aucun appel réseau au build.
// - Cache mémoire court (5 min) : la page admin est force-dynamic.
//
// Note : les visiteurs d'une période sont additionnés d'une IA à l'autre ; une
// personne venue de deux IA différentes est comptée deux fois (écart négligeable).

import "server-only";

import { classerReferentIA, REFERENTS_IA, type IdIA } from "@/lib/analytics/referents-ia";

// Module SERVEUR uniquement (`server-only`) : jamais dans le bundle public.
// `src/lib/tracking-referer.ts` (chargé sur tout le site) n'importe rien de ceci et reste
// identique à sa version d'avant la PR.
export const LIBELLES_IA: Readonly<Record<IdIA, string>> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  copilot: "Copilot",
  gemini: "Gemini",
  mistral: "Le Chat (Mistral)",
  claude: "Claude",
  deepseek: "DeepSeek",
  you: "You.com",
  phind: "Phind",
};

/** Valeurs EXACTES de `visit:source` : nom reconnu par Plausible + domaine (utm_source). */
export const SOURCES_PLAUSIBLE: Readonly<Record<IdIA, readonly string[]>> = {
  chatgpt: ["ChatGPT", "chatgpt.com", "chat.openai.com"],
  perplexity: ["Perplexity", "perplexity.ai", "pplx.ai"],
  copilot: ["Copilot", "Microsoft Copilot", "copilot.microsoft.com", "copilot.com"],
  gemini: ["Gemini", "Google Gemini", "gemini.google.com", "bard.google.com"],
  mistral: ["Mistral", "chat.mistral.ai", "mistral.ai"],
  claude: ["Claude", "claude.ai"],
  deepseek: ["DeepSeek", "chat.deepseek.com", "deepseek.com"],
  you: ["You.com", "you.com"],
  phind: ["Phind", "phind.com"],
};

/** Domaines cherchés dans `visit:referrer` (sous-domaines compris) : filet quand la source est « Google », « Bing »… */
const DOMAINES_REFERENT: readonly string[] = [
  ...REFERENTS_IA.flatMap((ia) => ia.domaines),
  "bing.com/chat",
];

const TOUTES_SOURCES: readonly string[] = Object.values(SOURCES_PLAUSIBLE).flat();
const IA_PAR_SOURCE: ReadonlyMap<string, IdIA> = new Map(
  (Object.entries(SOURCES_PLAUSIBLE) as Array<[IdIA, readonly string[]]>).flatMap(([id, l]) =>
    l.map((x) => [x.toLowerCase(), id] as const),
  ),
);

/** Source d'abord (exacte), référent en secours (bing.com/chat). */
function iaDe(source: string, referent: string): IdIA | null {
  return IA_PAR_SOURCE.get(source.trim().toLowerCase()) ?? classerReferentIA(referent)?.id ?? null;
}

export interface LigneIA {
  readonly id: IdIA;
  readonly libelle: string;
  readonly visiteurs: number;
  readonly visites: number;
}
export interface PeriodeIA {
  readonly visiteurs: number;
  readonly visites: number;
  readonly parIA: readonly LigneIA[];
}
export interface SemaineIA {
  readonly debut: string;
  readonly visiteurs: number;
  readonly visites: number;
}
export interface PageArriveeIA {
  readonly page: string;
  readonly visiteurs: number;
  readonly visites: number;
}
/** Une semaine de la tendance, avec le détail par IA (P10). */
export interface SemaineParIA extends SemaineIA {
  readonly parIA: readonly LigneIA[];
}
/** Une page d'arrivée, avec le détail par IA (P10 : page d'arrivée × IA). */
export interface PageParIA extends PageArriveeIA {
  readonly parIA: readonly LigneIA[];
}
export type VisitesIA =
  | {
      readonly statut: "ok";
      readonly sept: PeriodeIA;
      readonly trente: PeriodeIA;
      readonly semaines: readonly SemaineIA[];
      readonly pages: readonly PageArriveeIA[];
      /** P10 : tendance sur 12 semaines, par IA. Mêmes lignes que `semaines`, aucun appel de plus. */
      readonly semainesParIA: readonly SemaineParIA[];
      /** P10 : page d'arrivée × IA (top 10). Mêmes lignes que `pages`, aucun appel de plus. */
      readonly pagesParIA: readonly PageParIA[];
    }
  | { readonly statut: "indisponible"; readonly raison: string };

interface LigneBrute {
  dimensions?: unknown;
  metrics?: unknown;
}

const SRC = ["visit:source", "visit:referrer"];
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const dim = (l: LigneBrute, i: number): string => {
  const d = Array.isArray(l?.dimensions) ? l.dimensions[i] : undefined;
  return typeof d === "string" ? d : "";
};
const met = (l: LigneBrute, i: number): number =>
  Array.isArray(l?.metrics) ? num(l.metrics[i]) : 0;
const lignes = (r: unknown): LigneBrute[] => (Array.isArray(r) ? (r as LigneBrute[]) : []);

/** Lignes `[source, référent?]` → totaux + répartition par IA (référents non IA ignorés). */
export function agregerParIA(rows: unknown): PeriodeIA {
  const m = new Map<IdIA, { libelle: string; visiteurs: number; visites: number }>();
  for (const l of lignes(rows)) {
    const id = iaDe(dim(l, 0), dim(l, 1));
    if (!id) continue;
    const c = m.get(id) ?? { libelle: LIBELLES_IA[id], visiteurs: 0, visites: 0 };
    c.visiteurs += met(l, 0);
    c.visites += met(l, 1);
    m.set(id, c);
  }
  const parIA = [...m.entries()]
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => b.visiteurs - a.visiteurs || b.visites - a.visites);
  return {
    parIA,
    visiteurs: parIA.reduce((s, x) => s + x.visiteurs, 0),
    visites: parIA.reduce((s, x) => s + x.visites, 0),
  };
}

/** Lignes `[semaine, source, référent?]` → une ligne par semaine, ordre chronologique. */
export function agregerSemainesIA(rows: unknown): SemaineIA[] {
  const m = new Map<string, { visiteurs: number; visites: number }>();
  for (const l of lignes(rows)) {
    if (!iaDe(dim(l, 1), dim(l, 2))) continue;
    const debut = dim(l, 0).slice(0, 10);
    if (!debut) continue;
    const c = m.get(debut) ?? { visiteurs: 0, visites: 0 };
    c.visiteurs += met(l, 0);
    c.visites += met(l, 1);
    m.set(debut, c);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([debut, c]) => ({ debut, ...c }));
}

/** Lignes `[page d'arrivée, source, référent?]` → top 10 des pages. */
export function agregerPagesIA(rows: unknown): PageArriveeIA[] {
  const m = new Map<string, { visiteurs: number; visites: number }>();
  for (const l of lignes(rows)) {
    if (!iaDe(dim(l, 1), dim(l, 2))) continue;
    const page = dim(l, 0);
    if (!page) continue;
    const c = m.get(page) ?? { visiteurs: 0, visites: 0 };
    c.visiteurs += met(l, 0);
    c.visites += met(l, 1);
    m.set(page, c);
  }
  return [...m.entries()]
    .map(([page, c]) => ({ page, ...c }))
    .sort((a, b) => b.visiteurs - a.visiteurs || b.visites - a.visites)
    .slice(0, 10);
}

/** Clé de regroupement → total + détail par IA, pour des lignes `[clé, source, référent?]`. */
function regrouperParIA(rows: unknown): Map<string, PeriodeIA & { cle: string }> {
  const parCle = new Map<string, LigneBrute[]>();
  for (const l of lignes(rows)) {
    const cle = dim(l, 0);
    if (!cle) continue;
    const ia = iaDe(dim(l, 1), dim(l, 2));
    if (!ia) continue;
    // Le sous-agrégat lit `[source, référent]` : on le lui présente tel quel.
    const vue: LigneBrute = { dimensions: [dim(l, 1), dim(l, 2)], metrics: l.metrics };
    parCle.set(cle, [...(parCle.get(cle) ?? []), vue]);
  }
  return new Map([...parCle.entries()].map(([cle, ls]) => [cle, { cle, ...agregerParIA(ls) }]));
}

/** Lignes `[semaine, source, référent?]` → tendance par semaine, détail par IA. */
export function agregerSemainesParIA(rows: unknown): SemaineParIA[] {
  return [...regrouperParIA(rows).values()]
    .map((p) => ({
      debut: p.cle.slice(0, 10),
      visiteurs: p.visiteurs,
      visites: p.visites,
      parIA: p.parIA,
    }))
    .sort((a, b) => a.debut.localeCompare(b.debut));
}

/** Lignes `[page d'arrivée, source, référent?]` → top 10 des pages, détail par IA. */
export function agregerPagesParIA(rows: unknown): PageParIA[] {
  return [...regrouperParIA(rows).values()]
    .map((p) => ({ page: p.cle, visiteurs: p.visiteurs, visites: p.visites, parIA: p.parIA }))
    .sort((a, b) => b.visiteurs - a.visiteurs || b.visites - a.visites)
    .slice(0, 10);
}

// ─── Appels réseau ──────────────────────────────────────────────────────────

const DELAI_MS = 4_000;
const TTL_MS = 5 * 60_000;
const TTL_ECHEC_MS = 60_000;
let cache: { a: number; ttl: number; v: VisitesIA } | null = null;

export function _viderCacheVisitesIA(): void {
  cache = null;
}

/** `[lundi d'il y a 11 semaines, aujourd'hui]`, dates `AAAA-MM-JJ` du fuseau Europe/Paris. */
export function plageHebdoParis(maintenant: Date = new Date()): [string, string] {
  const auj = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(maintenant);
  const t = Date.parse(`${auj}T00:00:00Z`);
  const joursDepuisLundi = (new Date(t).getUTCDay() + 6) % 7;
  const debut = new Date(t - (joursDepuisLundi + 11 * 7) * 86_400_000);
  return [debut.toISOString().slice(0, 10), auj];
}

class V2Absente extends Error {}

async function post(api: string, cle: string, corps: unknown): Promise<unknown> {
  const res = await fetch(`${api}/api/v2/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${cle}`, "content-type": "application/json" },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(DELAI_MS),
    cache: "no-store",
  });
  if (res.status === 404) throw new V2Absente();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { results?: unknown };
  return json.results ?? [];
}

function requete(site: string, plage: "7d" | "30d" | [string, string], dimensions: string[]) {
  return {
    site_id: site,
    metrics: ["visitors", "visits"],
    date_range: plage,
    dimensions,
    filters: [
      [
        "or",
        [
          ["is", "visit:source", [...TOUTES_SOURCES], { case_sensitive: false }],
          ["contains", "visit:referrer", [...DOMAINES_REFERENT], { case_sensitive: false }],
        ],
      ],
    ],
    order_by: [["visitors", "desc"]],
    pagination: { limit: 1000, offset: 0 },
  };
}

export async function lireVisitesIA(): Promise<VisitesIA> {
  const cle = process.env.PLAUSIBLE_API_KEY;
  const site = process.env.PLAUSIBLE_SITE_ID;
  if (!cle || !site)
    return { statut: "indisponible", raison: "Clé d'accès Plausible non configurée." };
  // Build GitHub Actions (stubs ADR 0026) : aucun appel réseau.
  // `SKIP_ENV_VALIDATION` ne vaut « build » que pendant la phase de build : posée à
  // l'exécution (Coolify), elle ne doit pas éteindre la mesure.
  if (
    (process.env.SKIP_ENV_VALIDATION === "true" &&
      process.env.NEXT_PHASE === "phase-production-build") ||
    process.env.DATABASE_URL?.includes("stub.invalid")
  ) {
    return {
      statut: "indisponible",
      raison: "Mesure non disponible pendant la construction du site.",
    };
  }
  if (cache && Date.now() - cache.a < cache.ttl) return cache.v;

  const api = (
    process.env.NEXT_PUBLIC_PLAUSIBLE_API_URL ?? "https://plausible.axion-ia.com"
  ).replace(/\/+$/, "");
  let resultat: VisitesIA;
  try {
    const [r7, r30, rSem, rPages] = await Promise.all([
      post(api, cle, requete(site, "7d", SRC)),
      post(api, cle, requete(site, "30d", SRC)),
      post(api, cle, requete(site, plageHebdoParis(), ["time:week", ...SRC])),
      post(api, cle, requete(site, "30d", ["visit:entry_page", ...SRC])),
    ]);
    resultat = {
      statut: "ok",
      sept: agregerParIA(r7),
      trente: agregerParIA(r30),
      semaines: agregerSemainesIA(rSem),
      pages: agregerPagesIA(rPages),
      semainesParIA: agregerSemainesParIA(rSem),
      pagesParIA: agregerPagesParIA(rPages),
    };
  } catch (err) {
    if (err instanceof V2Absente) {
      const v: VisitesIA = {
        statut: "indisponible",
        raison: "API v2 de Plausible absente (version trop ancienne).",
      };
      cache = { a: Date.now(), ttl: TTL_ECHEC_MS, v };
      return v;
    }
    console.warn(
      "[visites-ia] lecture Plausible impossible :",
      err instanceof Error ? err.message : err,
    );
    const v: VisitesIA = {
      statut: "indisponible",
      raison: "Plausible ne répond pas pour le moment.",
    };
    cache = { a: Date.now(), ttl: TTL_ECHEC_MS, v };
    return v;
  }
  cache = { a: Date.now(), ttl: TTL_MS, v: resultat };
  return resultat;
}
