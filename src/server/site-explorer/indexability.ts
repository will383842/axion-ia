// Indexabilité LIVE des URLs publiques — source de vérité de l'onglet « Toutes les URLs ».
//
// Calcule, pour une route donnée, si elle est `index` ou `noindex` AUJOURD'HUI,
// en réutilisant la logique RÉELLE de rendu (PAS du scraping HTML) :
//   - villes (hub + 5 verticales) → drip temporel `isVilleIndexable(slug, now)`
//   - régions → `getIndexableRegions()`
//   - articles DB (blog/guides/actualités/connaissances) → `IndexationTier`
//   - termes du glossaire → gate anti-thin `isGlossaryTermIndexable(slug)`
//   - routes stub anti-doorway → `isNoindexStubRoute()`
//   - pages statiques exclues du sitemap → liste `NOINDEX_STATIC_PATHS`
//
// Comme `isVilleIndexable` et les tiers évoluent dans le temps, recalculer cette
// valeur chaque jour (worker de découverte) fait basculer noindex→indexable tout
// seul → c'est ce qui rend l'onglet « vivant ». Déterministe pour un `now` donné.

import { isVilleIndexable } from "@/content/villes/core";
import { getIndexableRegions } from "@/content/regions";
import { isNoindexStubRoute } from "@/lib/seo-noindex-routes";
import { isGlossaryTermIndexable, GLOSSARY_MIN_INDEX_WORDS } from "@/content/glossary-extension";

/** Tier d'indexation d'un article (miroir de l'enum Prisma `IndexationTier`). */
export type ArticleIndexationTier =
  "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow";

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

  // 3 bis) Glossaire : `isGlossaryTermIndexable` est le MEME SSOT que le rendu
  //    (`/glossaire/[slug]/page.tsx` emet `noindex, follow` sous le seuil) et que
  //    `app/sitemap.ts`. Sans cette branche, le Site Explorer declarait les 60
  //    termes INDEXABLES alors que la prod sert `noindex` — verifie le
  //    2026-07-26 : 61 lignes `site_routes` sur ce pattern avec
  //    `is_indexable = t`, zero `noindex_reason`. L'outil cense detecter les
  //    trous d'indexation affirmait le contraire de la production : c'est ce qui
  //    a permis au constat F49 de passer inapercu.
  //
  //    ⚠️ `is_indexable` N'EST PAS QU'UN AFFICHAGE. Trois consommateurs :
  //      1. l'UI « Toutes les URLs » — filtre, tri et compteurs KPI
  //         (`src/server/actions/site-explorer/site-routes.ts`) ;
  //      2. le worker GSC (`site-route-gsc-worker.ts`), qui echantillonne
  //         `where: { isIndexable: true }`, 400 URLs/run sur un pool de 2 162.
  //         CONSEQUENCE ASSUMEE : les 60 pages glossaire sortent du pool de
  //         rafraichissement GSC — elles y etaient, leurs 60 lignes ont un
  //         `gsc_data_at` non nul — et leurs `gscClicks/gscImpressions/
  //         gscPosition` se figent a leur derniere valeur tout en restant
  //         affiches. C'est souhaitable (des pages `noindex` ne doivent pas
  //         bruler du quota GSC), mais ce n'est PAS cosmetique ;
  //      3. `discovery-runner.ts`, qui persiste le champ a chaque run.
  //    Aucun effet en revanche sur le sitemap ni sur le rendu public : les deux
  //    appellent deja `isGlossaryTermIndexable` directement.
  //
  //    Deux cas volontairement laisses indexables : le hub `/fr/glossaire` (pas
  //    de slug) et le template non resolu `/fr/glossaire/[slug]` — on ne conclut
  //    rien sur un placeholder plutot que d'inventer un noindex.
  if (input.section === "glossaire") {
    const termSlug = rest[0];
    if (termSlug && !termSlug.startsWith("[") && !isGlossaryTermIndexable(termSlug)) {
      return {
        indexable: false,
        reason: `Terme sous le seuil anti-thin (${GLOSSARY_MIN_INDEX_WORDS} mots cumulés)`,
      };
    }
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
