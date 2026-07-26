// Indexabilité LIVE des URLs publiques — source de vérité de l'onglet « Toutes les URLs ».
//
// Calcule, pour une route donnée, si elle est `index` ou `noindex` AUJOURD'HUI,
// en réutilisant la logique RÉELLE de rendu (PAS du scraping HTML) :
//   - villes (hub + 5 verticales) → drip temporel `isVilleIndexable(slug, now)`
//   - régions → `getIndexableRegions()`
//   - articles DB (blog/guides/actualités/connaissances) → `IndexationTier`
//   - routes stub anti-doorway → `isNoindexStubRoute()`
//   - pages statiques exclues du sitemap → liste `NOINDEX_STATIC_PATHS`
//
// Comme `isVilleIndexable` et les tiers évoluent dans le temps, recalculer cette
// valeur chaque jour (worker de découverte) fait basculer noindex→indexable tout
// seul → c'est ce qui rend l'onglet « vivant ». Déterministe pour un `now` donné.

import { isVilleIndexable } from "@/content/villes";
import { getIndexableRegions } from "@/content/regions";
import { isNoindexStubRoute } from "@/lib/seo-noindex-routes";

/** Tier d'indexation d'un article (miroir de l'enum Prisma `IndexationTier`). */
export type ArticleIndexationTier =
  | "tier_1_indexable"
  | "tier_2_noindex_follow"
  | "tier_3_noindex_nofollow";

export interface IndexabilityInput {
  /** URL FR rendue, AVEC préfixe locale (ex. `/fr/audit/par-ville/lyon`). */
  pathRendered: string | null;
  /** Template (ex. `/fr/audit/par-ville/[ville]`). */
  pathPattern: string;
  /** 1er segment après la locale (ex. `audit`, `blog`, `implantations`). */
  section: string | null;
  /**
   * Tier d'indexation si la route vient d'un article DB. Quand fourni, il
   * prime sur toute autre heuristique (c'est la décision réelle du rendu blog).
   */
  articleTier?: ArticleIndexationTier | string | null;
}

export interface IndexabilityResult {
  indexable: boolean;
  /** Raison courte affichée en tooltip quand noindex (vide si indexable). */
  reason: string;
}

// Pages statiques présentes physiquement mais volontairement hors index
// (miroir de `EXCLUDED_FROM_INDEX` dans src/app/sitemap.ts). Comparé au
// pathPattern privé de la locale.
const NOINDEX_STATIC_PATHS: ReadonlySet<string> = new Set([
  "/design",
  "/components",
  "/desabonnement",
  "/mes-donnees",
  "/mes-donnees/export",
  "/confirmation",
  "/recherche",
  "/preferences-cookies",
  "/reserver",
  // Pages de tunnel / self-service gated (noindex by design).
  "/booking",
]);

const REGION_INDEXABLE_SLUGS = new Set(getIndexableRegions().map((r) => r.slug));

/** Retire le préfixe locale (`/fr`, `/en`) d'un pathname. */
function stripLocale(path: string): string {
  return path.replace(/^\/(fr|en)(?=\/|$)/, "") || "/";
}

/**
 * Calcule l'indexabilité live d'une route. `now` injectable pour les tests et
 * pour figer la cohorte drip sur la date du run.
 */
export function computeIndexability(
  input: IndexabilityInput,
  now: Date = new Date(),
): IndexabilityResult {
  const rendered = input.pathRendered ?? input.pathPattern;
  const parts = rendered.split("/").filter(Boolean); // [locale, section, ...rest]
  const rest = parts.slice(2);
  const pathNoLocale = stripLocale(input.pathPattern);

  // 1) Articles DB : la décision de rendu est portée par le tier.
  if (input.articleTier != null && input.articleTier !== "") {
    if (input.articleTier === "tier_1_indexable") {
      return { indexable: true, reason: "" };
    }
    return {
      indexable: false,
      reason:
        input.articleTier === "tier_3_noindex_nofollow"
          ? "Article tier-3 (noindex, nofollow)"
          : "Article tier-2 (noindex, follow) — promu à tier-1 selon CTR",
    };
  }

  // 2) Implantations région / ville (drip + whitelist région).
  if (input.section === "implantations" || input.section === "locations") {
    const regionSlug = rest[0];
    const villeSlug = rest[1];
    if (regionSlug && !REGION_INDEXABLE_SLUGS.has(regionSlug)) {
      return { indexable: false, reason: `Région « ${regionSlug} » non indexable` };
    }
    if (villeSlug && !isVilleIndexable(villeSlug, now)) {
      return { indexable: false, reason: "Ville hors cohorte drip (noindex temporaire)" };
    }
    if (villeSlug) return { indexable: true, reason: "" };
    // Hub région indexable.
    return { indexable: true, reason: "" };
  }

  // 3) Pages ville×service `/fr/<service>/par-ville/<ville>` (drip temporel).
  if (rest[0] === "par-ville" || rest[0] === "by-city") {
    const villeSlug = rest[1];
    if (villeSlug && !isVilleIndexable(villeSlug, now)) {
      return { indexable: false, reason: "Ville hors cohorte drip (noindex temporaire)" };
    }
    if (villeSlug) return { indexable: true, reason: "" };
  }

  // 4) Filet stub anti-doorway (couvre régions/villes non gérées ci-dessus via
  //    la whitelist Edge — faux négatif OK, jamais de faux positif).
  if (input.pathRendered && isNoindexStubRoute(input.pathRendered)) {
    return { indexable: false, reason: "Stub anti-doorway (noindex, follow)" };
  }

  // 5) Pages statiques explicitement hors index.
  if (NOINDEX_STATIC_PATHS.has(pathNoLocale)) {
    return { indexable: false, reason: "Page hors index (technique / tunnel)" };
  }

  // 6) Par défaut : indexable (page publiée avec contenu réel).
  return { indexable: true, reason: "" };
}
