/**
 * Recalcul des champs existants depuis l'historique Search Console (P6a).
 *
 * Remplace, quand c'est possible, les appels « une URL à la fois » à l'API : les champs
 * `SiteRoute.gsc*`, les lignes `KeywordTracking` et les métriques lues par le tier-lifecycle sont
 * recalculés depuis les tables du robot (P4), sur une fenêtre de 28 jours HOMOGÈNE (mêmes jours
 * pour toutes les pages) : aucun appel réseau, donc aucun quota consommé.
 *
 * ÉTEINT PAR DÉFAUT : tout est subordonné à `CONTENT_PILOTAGE_SEO="true"` (exact). Et même
 * allumé, rien n'est écrit tant que l'historique ne couvre pas la fenêtre : « 28 jours réussis
 * consécutifs, dernier jour final de moins de 5 jours ». Sinon l'appelant garde le comportement
 * d'avant (repli sur l'API). Un jour manquant ne devient jamais un zéro.
 */
import type { PrismaClient } from "../../../prisma/generated/client";

import { buildArticleUrl } from "@/server/content-gen/indexing/url-builder";
import { normaliserChemin, positionMoyenne } from "./donnees";
import { ajouterJours, enDate, enJour } from "./ingestion/dates";
import { buildStub, estTableAbsente, pilotageSeoActif } from "./interrupteur";

export const FENETRE_JOURS = 28;
/** Dernier jour final plus vieux que ça : le robot est à l'arrêt, l'historique est périmé. */
export const FRAICHEUR_MAX_JOURS = 5;
export const MOTS_CLES_PAR_PAGE = 10;
const TYPE_RECHERCHE = "web";
const LOT_ECRITURE = 50;
const ARTICLES_MAX = 500;
const MOT_CLE_LONGUEUR_MAX = 255;
const REQUETE_ARTICLES_PAR_LOT = 200;

export type BaseRecalcul = Pick<
  PrismaClient,
  | "gscImportRun"
  | "gscPageJour"
  | "gscRequete"
  | "gscPageRequeteJour"
  | "siteRoute"
  | "keywordTracking"
  | "article"
>;

export interface DepsRecalcul {
  readonly maintenant?: () => Date;
}

export interface FenetreHistorique {
  readonly debut: string;
  readonly fin: string;
  readonly jours: number;
}

const horloge = (deps?: DepsRecalcul) => deps?.maintenant ?? (() => new Date());

/**
 * Fenêtre de `jours` jours (28 au minimum, voir `FENETRE_JOURS`) entièrement couverte par des
 * jours `reussi`, finissant au dernier jour final collecté. `null` si un seul jour manque ou si
 * l'historique est périmé. La fenêtre rendue a exactement `jours` jours.
 */
export async function fenetreHistorique(
  prisma: Pick<PrismaClient, "gscImportRun">,
  jours: number = FENETRE_JOURS,
  maintenant: () => Date = () => new Date(),
): Promise<FenetreHistorique | null> {
  const n = Math.floor(jours);
  if (!Number.isFinite(n) || n < FENETRE_JOURS) return null;
  const aujourdhui = enJour(maintenant());
  const runs = await prisma.gscImportRun.findMany({
    where: {
      typeRecherche: TYPE_RECHERCHE,
      statut: "reussi",
      jour: {
        gte: enDate(ajouterJours(aujourdhui, -(n + 2 * FRAICHEUR_MAX_JOURS))),
        lte: enDate(aujourdhui),
      },
    },
    select: { jour: true },
  });
  const reussis = new Set(runs.map((r) => enJour(r.jour)));
  if (reussis.size === 0) return null;
  const fin = [...reussis].sort().at(-1)!;
  if (fin < ajouterJours(aujourdhui, -FRAICHEUR_MAX_JOURS)) return null;
  for (let i = 0; i < n; i++) if (!reussis.has(ajouterJours(fin, -i))) return null;
  return { debut: ajouterJours(fin, -(n - 1)), fin, jours: n };
}

/**
 * Vrai seulement si le robot est allumé, hors build stub, ET que l'historique couvre la fenêtre.
 * Une panne de lecture, tables absentes comprises (P2021 : worker plus récent que la migration),
 * donne faux : l'appelant garde l'ancien chemin.
 */
export async function historiqueDisponible(
  prisma: Pick<PrismaClient, "gscImportRun">,
  opts: {
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly maintenant?: () => Date;
  } = {},
): Promise<boolean> {
  const env = opts.env ?? process.env;
  if (!pilotageSeoActif(env) || buildStub(env)) return false;
  try {
    return (await fenetreHistorique(prisma, FENETRE_JOURS, opts.maintenant)) !== null;
  } catch (err) {
    if (estTableAbsente(err)) return false;
    console.warn("[seo-pilotage-recalcul] lecture de l'historique en échec : repli sur l'API.");
    return false;
  }
}

interface Cumul {
  clics: number;
  impressions: number;
  positionSum: number;
}

function cumuler(
  acc: Map<string, Cumul>,
  cle: string,
  l: { clics: number; impressions: number; positionSum: number },
): void {
  const c = acc.get(cle) ?? { clics: 0, impressions: 0, positionSum: 0 };
  c.clics += l.clics;
  c.impressions += l.impressions;
  c.positionSum += l.positionSum;
  acc.set(cle, c);
}

async function parChemin(
  prisma: Pick<PrismaClient, "gscPageJour">,
  f: FenetreHistorique,
  chemins?: ReadonlyArray<string>,
): Promise<Map<string, Cumul>> {
  const lignes = await prisma.gscPageJour.findMany({
    where: {
      typeRecherche: TYPE_RECHERCHE,
      date: { gte: enDate(f.debut), lte: enDate(f.fin) },
      ...(chemins ? { chemin: { in: [...chemins] } } : {}),
    },
    select: { chemin: true, clics: true, impressions: true, positionSum: true },
  });
  const acc = new Map<string, Cumul>();
  for (const l of lignes) cumuler(acc, l.chemin, l);
  return acc;
}

export type IssueRecalcul =
  { readonly issue: "saute"; readonly motif: string } | { readonly issue: "fait" };

export async function recalculerSiteRoutes(
  prisma: Pick<BaseRecalcul, "gscImportRun" | "gscPageJour" | "siteRoute">,
  deps: DepsRecalcul = {},
): Promise<{ issue: "saute"; motif: string } | { issue: "fait"; routesMisesAJour: number }> {
  const maintenant = horloge(deps);
  const f = await fenetreHistorique(prisma, FENETRE_JOURS, maintenant);
  if (!f) return { issue: "saute", motif: "historique_insuffisant" };

  const cumuls = await parChemin(prisma, f);
  // Mêmes routes que l'ancien worker `site-route-gsc` : publiques, indexables, résolues.
  const routes = await prisma.siteRoute.findMany({
    where: {
      visibility: "public",
      removedAt: null,
      isIndexable: true,
      pathRendered: { not: null },
    },
    select: { id: true, pathRendered: true },
  });

  const horodatage = maintenant();
  const aEcrire: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const r of routes) {
    const brut = r.pathRendered;
    if (!brut || brut.includes("[")) continue;
    // Route EN : le site la redirige vers le FR, l'historique la rabat sur le chemin FR.
    // Lui donner les chiffres de la page FR doublerait les totaux : on la laisse.
    if (/^\/en(?:\/|$)/i.test(brut)) continue;
    const chemin = normaliserChemin(brut);
    if (!chemin) continue;
    const c = cumuls.get(chemin) ?? { clics: 0, impressions: 0, positionSum: 0 };
    aEcrire.push({
      id: r.id,
      data: {
        gscClicks: c.clics,
        gscImpressions: c.impressions,
        gscCtr: c.impressions > 0 ? c.clics / c.impressions : 0,
        gscPosition: positionMoyenne(c.positionSum, c.impressions),
        gscDataAt: horodatage,
      },
    });
  }
  let misesAJour = 0;
  for (let i = 0; i < aEcrire.length; i += LOT_ECRITURE) {
    const issues = await Promise.all(
      aEcrire.slice(i, i + LOT_ECRITURE).map((e) =>
        prisma.siteRoute.update({ where: { id: e.id }, data: e.data }).then(
          () => true,
          // Route supprimée entre la lecture et l'écriture : on passe, comme l'ancien worker.
          () => false,
        ),
      ),
    );
    misesAJour += issues.filter(Boolean).length;
  }
  return { issue: "fait", routesMisesAJour: misesAJour };
}

export async function recalculerKeywordTracking(
  prisma: BaseRecalcul,
  deps: DepsRecalcul = {},
): Promise<{ issue: "saute"; motif: string } | { issue: "fait"; motsCles: number }> {
  const maintenant = horloge(deps);
  const f = await fenetreHistorique(prisma, FENETRE_JOURS, maintenant);
  if (!f) return { issue: "saute", motif: "historique_insuffisant" };

  // Mêmes articles que l'ancien `content-keyword-sync` : tier 1 et 2, publiés depuis 7 jours.
  const seuil = new Date(maintenant().getTime() - 7 * 86_400_000);
  const articles = await prisma.article.findMany({
    where: {
      status: "published",
      publishedAt: { lte: seuil },
      indexationTier: { in: ["tier_1_indexable", "tier_2_noindex_follow"] },
    },
    include: { translations: { where: { locale: "fr" } } },
    take: ARTICLES_MAX,
    orderBy: { publishedAt: "desc" },
  });

  const cibles: Array<{ articleId: string; url: string; chemin: string }> = [];
  for (const a of articles) {
    const t = a.translations[0];
    if (!t) continue;
    const url = buildArticleUrl({
      slug: t.slug,
      isNews: a.isNews,
      templateVariant: a.templateVariant ?? null,
    });
    const chemin = normaliserChemin(url);
    if (chemin) cibles.push({ articleId: a.id, url, chemin });
  }
  if (cibles.length === 0) return { issue: "fait", motsCles: 0 };

  // Cumul 28 jours par (page, requête).
  const parPage = new Map<string, Map<number, Cumul>>();
  for (let i = 0; i < cibles.length; i += REQUETE_ARTICLES_PAR_LOT) {
    const lot = cibles.slice(i, i + REQUETE_ARTICLES_PAR_LOT).map((c) => c.chemin);
    const lignes = await prisma.gscPageRequeteJour.findMany({
      where: {
        typeRecherche: TYPE_RECHERCHE,
        date: { gte: enDate(f.debut), lte: enDate(f.fin) },
        chemin: { in: lot },
      },
      select: {
        chemin: true,
        requeteId: true,
        clics: true,
        impressions: true,
        positionSum: true,
      },
    });
    for (const l of lignes) {
      const m = parPage.get(l.chemin) ?? new Map<number, Cumul>();
      const c = m.get(l.requeteId) ?? { clics: 0, impressions: 0, positionSum: 0 };
      c.clics += l.clics;
      c.impressions += l.impressions;
      c.positionSum += l.positionSum;
      m.set(l.requeteId, c);
      parPage.set(l.chemin, m);
    }
  }

  // Meilleurs mots-clés par page : clics, puis impressions (ordre par défaut de Google).
  const retenus = new Map<string, Array<{ requeteId: number } & Cumul>>();
  const ids = new Set<number>();
  for (const [chemin, m] of parPage) {
    const top = [...m.entries()]
      .filter(([, c]) => c.impressions > 0)
      .map(([requeteId, c]) => ({ requeteId, ...c }))
      .sort(
        (a, b) => b.clics - a.clics || b.impressions - a.impressions || a.requeteId - b.requeteId,
      )
      .slice(0, MOTS_CLES_PAR_PAGE);
    retenus.set(chemin, top);
    for (const t of top) ids.add(t.requeteId);
  }
  if (ids.size === 0) return { issue: "fait", motsCles: 0 };

  const textes = new Map<number, string>();
  const idsListe = [...ids];
  for (let i = 0; i < idsListe.length; i += 1000) {
    const lignes = await prisma.gscRequete.findMany({
      where: { id: { in: idsListe.slice(i, i + 1000) } },
      select: { id: true, texte: true },
    });
    for (const l of lignes) textes.set(l.id, l.texte);
  }

  const horodatage = maintenant();
  let motsCles = 0;
  for (const cible of cibles) {
    for (const k of retenus.get(cible.chemin) ?? []) {
      const keyword = textes.get(k.requeteId);
      // Texte purgé (requête rare) : on ne reconstruit jamais un mot-clé sans son texte.
      const position = positionMoyenne(k.positionSum, k.impressions);
      // `KeywordTracking.keyword` est limité à 255 caractères (le texte stocké, à 512).
      if (!keyword || keyword.length > MOT_CLE_LONGUEUR_MAX || position === null) continue;
      try {
        const existant = await prisma.keywordTracking.findUnique({
          where: { keyword_targetUrl: { keyword, targetUrl: cible.url } },
        });
        const positionDelta = existant ? position - Number(existant.position) : null;
        const ctr = k.clics / k.impressions;
        await prisma.keywordTracking.upsert({
          where: { keyword_targetUrl: { keyword, targetUrl: cible.url } },
          create: {
            keyword,
            targetUrl: cible.url,
            articleId: cible.articleId,
            position,
            ctr,
            impressions: k.impressions,
            clicks: k.clics,
            source: "gsc",
          },
          update: {
            position,
            positionDelta,
            ctr,
            impressions: k.impressions,
            clicks: k.clics,
            syncedAt: horodatage,
          },
        });
        motsCles++;
      } catch {
        // Une ligne en échec ne fait pas tomber les autres (nombres seulement dans les journaux).
      }
    }
  }
  return { issue: "fait", motsCles };
}

/**
 * Métriques d'une page sur les `jours` derniers jours finaux, au format de l'ancien
 * `gscPageMetricsForUrl` (page sans impression : zéros explicites). `null` si l'historique ne
 * couvre pas `max(jours, 28)` jours : l'appelant retombe sur l'API.
 */
export async function metriquesPageDepuisHistorique(
  prisma: Pick<PrismaClient, "gscImportRun" | "gscPageJour">,
  url: string,
  jours: number,
  maintenant: () => Date = () => new Date(),
): Promise<{ ctr: number; impressions: number; clicks: number; position: number } | null> {
  const n = Math.floor(jours);
  if (!Number.isFinite(n) || n < 1) return null;
  const chemin = normaliserChemin(url);
  if (!chemin) return null;
  const f = await fenetreHistorique(prisma, Math.max(n, FENETRE_JOURS), maintenant);
  if (!f) return null;
  const c = (await parChemin(prisma, { ...f, debut: ajouterJours(f.fin, -(n - 1)) }, [chemin])).get(
    chemin,
  );
  if (!c || c.impressions <= 0) return { ctr: 0, impressions: 0, clicks: 0, position: 0 };
  return {
    ctr: c.clics / c.impressions,
    impressions: c.impressions,
    clicks: c.clics,
    position: positionMoyenne(c.positionSum, c.impressions) ?? 0,
  };
}

export type IssueTacheRecalcul =
  | { readonly issue: "saute"; readonly motif: string }
  | { readonly issue: "fait"; readonly routesMisesAJour: number; readonly motsCles: number };

/** Tâche `recalcul` du worker `seo-pilotage` : les deux recalculs, après l'ingestion du jour. */
export async function tacheRecalcul(deps: {
  readonly prisma: BaseRecalcul;
  readonly maintenant?: () => Date;
}): Promise<IssueTacheRecalcul> {
  const d: DepsRecalcul = deps.maintenant ? { maintenant: deps.maintenant } : {};
  const routes = await recalculerSiteRoutes(deps.prisma, d);
  if (routes.issue === "saute") return routes;
  const mots = await recalculerKeywordTracking(deps.prisma, d);
  return {
    issue: "fait",
    routesMisesAJour: routes.routesMisesAJour,
    motsCles: mots.issue === "fait" ? mots.motsCles : 0,
  };
}
