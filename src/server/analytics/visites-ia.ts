// Visites venues des assistants IA — lecture SEULE de l'API Stats de Plausible
// auto-hébergé (fiche GEO V1-10). Aucun réglage de Plausible n'est touché.
//
// - API v2 (`POST /api/v2/query`), dimension `visit:source` (référent reconnu OU
//   `utm_source`, même sans en-tête Referer), filtre EXACT `is` sur `SOURCES_PLAUSIBLE`
//   (+ `visit:referrer` contient `bing.com/chat`). Le classement par IA se fait ICI.
// - Périodes : `7d` / `30d` natifs (alignés sur la v1) ; hebdo = lundi d'il y a 11
//   semaines → aujourd'hui, fuseau Europe/Paris (semaine en cours partielle).
// - Repli v1 (`/api/v1/stats/breakdown`, `visit:source==…`) si la v2 répond 404 :
//   totaux 7 j / 30 j seulement (ni série hebdomadaire, ni pages d'arrivée, ni bing.com/chat).
// - Échec silencieux : clé absente, stubs de build, API injoignable ou en erreur →
//   `{ statut: "indisponible" }`, jamais d'exception. Aucun appel réseau au build.
// - Cache mémoire court (5 min) : la page admin est force-dynamic.
//
// Note : les visiteurs d'une période sont additionnés d'une IA à l'autre ; une
// personne venue de deux IA différentes est comptée deux fois (écart négligeable).

import { classerReferentIA, type IdIA } from "@/lib/analytics/referents-ia";

// Libellés et sources Plausible : côté SERVEUR uniquement (zéro octet dans le bundle public).
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
  perplexity: ["Perplexity", "perplexity.ai"],
  copilot: ["Copilot", "copilot.microsoft.com"],
  gemini: ["Gemini", "gemini.google.com", "bard.google.com"],
  mistral: ["Mistral", "chat.mistral.ai", "mistral.ai"],
  claude: ["Claude", "claude.ai"],
  deepseek: ["DeepSeek", "chat.deepseek.com"],
  you: ["You.com", "you.com"],
  phind: ["Phind", "phind.com"],
};

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
export type VisitesIA =
  | {
      readonly statut: "ok";
      readonly sept: PeriodeIA;
      readonly trente: PeriodeIA;
      readonly semaines: readonly SemaineIA[];
      readonly pages: readonly PageArriveeIA[];
      /** Faux si l'instance n'offre que l'API v1 (pas de courbe hebdomadaire). */
      readonly serieHebdo: boolean;
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
          ["is", "visit:source", [...TOUTES_SOURCES]],
          ["contains", "visit:referrer", ["bing.com/chat"]],
        ],
      ],
    ],
    order_by: [["visitors", "desc"]],
    pagination: { limit: 1000, offset: 0 },
  };
}

async function breakdownV1(
  api: string,
  cle: string,
  site: string,
  jours: number,
  propriete: string,
): Promise<unknown[]> {
  const p = new URLSearchParams({
    site_id: site,
    period: `${jours}d`,
    property: propriete,
    metrics: "visitors,visits",
    limit: "1000",
    filters: `visit:source==${TOUTES_SOURCES.join("|")}`,
  });
  const res = await fetch(`${api}/api/v1/stats/breakdown?${p.toString()}`, {
    headers: { authorization: `Bearer ${cle}` },
    signal: AbortSignal.timeout(DELAI_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (json.results ?? []).map((r) => ({
    dimensions: [String(r[propriete.replace(/^[a-z]+:/, "")] ?? "")],
    metrics: [r.visitors, r.visits],
  }));
}

export async function lireVisitesIA(): Promise<VisitesIA> {
  const cle = process.env.PLAUSIBLE_API_KEY;
  const site = process.env.PLAUSIBLE_SITE_ID;
  if (!cle || !site)
    return { statut: "indisponible", raison: "Clé d'accès Plausible non configurée." };
  // Build GitHub Actions (stubs ADR 0026) : aucun appel réseau.
  if (
    process.env.SKIP_ENV_VALIDATION === "true" ||
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
        serieHebdo: true,
      };
    } catch (e) {
      if (!(e instanceof V2Absente)) throw e;
      const [r7, r30] = await Promise.all([
        breakdownV1(api, cle, site, 7, "visit:source"),
        breakdownV1(api, cle, site, 30, "visit:source"),
      ]);
      // v1 ne croise pas deux propriétés : pages d'arrivée non disponibles en repli.
      resultat = {
        statut: "ok",
        sept: agregerParIA(r7),
        trente: agregerParIA(r30),
        semaines: [],
        pages: [],
        serieHebdo: false,
      };
    }
  } catch (err) {
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
