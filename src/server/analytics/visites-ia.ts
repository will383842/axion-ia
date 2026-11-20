// Visites venues des assistants IA — lecture SEULE de l'API Stats de Plausible
// auto-hébergé (fiche GEO V1-10). Aucun réglage de Plausible n'est touché.
//
// - API v2 (`POST /api/v2/query`), dimension `visit:referrer`, filtrée par la liste
//   unique `referents-ia.ts` ; le classement par IA se fait ICI (sous-domaines,
//   casse), pas dans la requête.
// - Repli v1 (`/api/v1/stats/breakdown`) si l'instance répond 404 à la v2 : totaux
//   7 j / 30 j et pages d'arrivée seulement (pas de série hebdomadaire).
// - Échec silencieux : clé absente, stubs de build, API injoignable ou en erreur →
//   `{ statut: "indisponible" }`, jamais d'exception. Aucun appel réseau au build.
// - Cache mémoire court (5 min) : la page admin est force-dynamic.
//
// Note : les visiteurs d'une période sont additionnés d'une IA à l'autre ; une
// personne venue de deux IA différentes est comptée deux fois (écart négligeable).

import { classerReferentIA, FILTRES_REFERENT_IA, type IdIA } from "@/lib/analytics/referents-ia";

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

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const dim = (l: LigneBrute, i: number): string => {
  const d = Array.isArray(l?.dimensions) ? l.dimensions[i] : undefined;
  return typeof d === "string" ? d : "";
};
const met = (l: LigneBrute, i: number): number =>
  Array.isArray(l?.metrics) ? num(l.metrics[i]) : 0;
const lignes = (r: unknown): LigneBrute[] => (Array.isArray(r) ? (r as LigneBrute[]) : []);

/** Lignes `[référent]` → totaux + répartition par IA (référents non IA ignorés). */
export function agregerParIA(rows: unknown): PeriodeIA {
  const m = new Map<IdIA, { libelle: string; visiteurs: number; visites: number }>();
  for (const l of lignes(rows)) {
    const ia = classerReferentIA(dim(l, 0));
    if (!ia) continue;
    const c = m.get(ia.id) ?? { libelle: ia.libelle, visiteurs: 0, visites: 0 };
    c.visiteurs += met(l, 0);
    c.visites += met(l, 1);
    m.set(ia.id, c);
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

/** Lignes `[semaine, référent]` → une ligne par semaine, ordre chronologique. */
export function agregerSemainesIA(rows: unknown): SemaineIA[] {
  const m = new Map<string, { visiteurs: number; visites: number }>();
  for (const l of lignes(rows)) {
    if (!classerReferentIA(dim(l, 1))) continue;
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

/** Lignes `[page d'arrivée, référent]` → top 10 des pages. */
export function agregerPagesIA(rows: unknown): PageArriveeIA[] {
  const m = new Map<string, { visiteurs: number; visites: number }>();
  for (const l of lignes(rows)) {
    if (!classerReferentIA(dim(l, 1))) continue;
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

const DELAI_MS = 6_000;
const TTL_MS = 5 * 60_000;
let cache: { a: number; v: VisitesIA } | null = null;

export function _viderCacheVisitesIA(): void {
  cache = null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const joursAvant = (n: number) => iso(new Date(Date.now() - n * 86_400_000));

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

function requete(site: string, plage: [string, string], dimensions: string[]) {
  return {
    site_id: site,
    metrics: ["visitors", "visits"],
    date_range: plage,
    dimensions,
    filters: [["contains", "visit:referrer", [...FILTRES_REFERENT_IA]]],
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
    filters: `visit:referrer~${FILTRES_REFERENT_IA.join("|")}`,
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
  if (cache && Date.now() - cache.a < TTL_MS) return cache.v;

  const api = (
    process.env.NEXT_PUBLIC_PLAUSIBLE_API_URL ?? "https://plausible.axion-ia.com"
  ).replace(/\/+$/, "");
  const auj = joursAvant(0);
  let resultat: VisitesIA;
  try {
    try {
      const [r7, r30, rSem, rPages] = await Promise.all([
        post(api, cle, requete(site, [joursAvant(7), auj], ["visit:referrer"])),
        post(api, cle, requete(site, [joursAvant(30), auj], ["visit:referrer"])),
        post(api, cle, requete(site, [joursAvant(83), auj], ["time:week", "visit:referrer"])),
        post(
          api,
          cle,
          requete(site, [joursAvant(30), auj], ["visit:entry_page", "visit:referrer"]),
        ),
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
        breakdownV1(api, cle, site, 7, "visit:referrer"),
        breakdownV1(api, cle, site, 30, "visit:referrer"),
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
    return { statut: "indisponible", raison: "Plausible ne répond pas pour le moment." };
  }
  cache = { a: Date.now(), v: resultat };
  return resultat;
}
