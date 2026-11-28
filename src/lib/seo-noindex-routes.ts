/**
 * SEO — détection des routes pSEO en stub (anti-doorway HCU 2024).
 *
 * Edge-safe : utilisé par `middleware.ts` pour émettre `X-Robots-Tag: noindex, follow`
 * en en-tête HTTP. Le `<meta robots noindex>` HTML reste posé par `generateMetadata()`
 * côté Server Component ; le header HTTP en doublon permet à Googlebot de voir le
 * `noindex` SANS rendre le HTML complet → gain crawl budget x5 sur ~17 K stubs.
 *
 * Whitelist hardcodée (pas d'import des datas 2 157 villes pour éviter le bundle
 * Edge bloat). Sync garantie par `seo-noindex-routes.test.ts` qui compare à
 * `getIndexableVilles()` / `getIndexableRegions()`.
 */
import type { Locale } from "@/i18n/routing";
// Cap d'indexation villes généré depuis le SSOT (cf. scripts/gen-indexable-villes.ts).
import { INDEXABLE_VILLE_SLUGS_CAP } from "@/generated/indexable-villes";
import { villeIndexableParPorte } from "@/lib/villes-porte-qualite";

const LOCALES: ReadonlyArray<Locale> = ["fr", "en"];

/**
 * Villes RÉELLEMENT indexables = la liste `src/content/villes/villes-indexees.ts`
 * (40 villes, décision du 18/11/2026), via le fichier GÉNÉRÉ
 * `src/generated/indexable-villes.ts` (SSOT : `isVilleIndexable`).
 *
 * Audit indexation GSC 2026-07-31 (P1) — auparavant cette whitelist portait
 * ~2 157 slugs hardcodés (= `getIndexableVilles()`, « a un copy »), sémantique
 * ANTÉRIEURE au cap : les ~1 336 villes cappées ne recevaient PAS le
 * `X-Robots-Tag` et Googlebot devait rendre leur HTML pour découvrir le
 * `<meta>` noindex. Désormais header et meta dérivent du MÊME ensemble : ils ne
 * peuvent plus se contredire, et le header couvre toute la surface noindex.
 * (`isVilleIndexable` est déterministe depuis le 2026-06-14 — plus de drip.)
 *
 * Régénérer après modification des données villes :
 *   pnpm tsx scripts/gen-indexable-villes.ts
 * Sync garantie par `seo-noindex-routes.test.ts` (échec Gate A si périmé).
 */
const INDEXABLE_VILLE_SLUGS: ReadonlySet<string> = new Set(INDEXABLE_VILLE_SLUGS_CAP);

/**
 * Sections de pages service × ville (`/<section>/par-ville/<ville>` et
 * `/<section>/by-city/<ville>`). Décision du 18/11/2026 : TOUTES ces pages restent
 * en ligne mais en `noindex, follow` (une seule page indexée par ville : la page
 * `/implantations/<région>/<ville>`). Couvre aussi les sections qui ne recevaient
 * jamais l'en-tête (formations, un-a-un / one-to-one, sites-web-augmentes /
 * ai-augmented-websites).
 */
const NOINDEX_SERVICE_VILLE_SECTIONS: ReadonlySet<string> = new Set([
  "audit",
  "interventions",
  "implementation",
  "formations",
  "un-a-un",
  "one-to-one",
  "sites-web-augmentes",
  "ai-augmented-websites",
]);

/**
 * Régions indexables. 13 métropole + 5 DROM en V1 (Will 2026-05-26 — DROM
 * réintégrés avec pages SEO dédiées hand-crafted : metaTitleFr, metaDescFr,
 * audienceLocalFr, pitchFr, parité avec les 13 régions métropolitaines).
 * Sync test : `seo-noindex-routes.test.ts`.
 */
const INDEXABLE_REGION_SLUGS: ReadonlySet<string> = new Set([
  "auvergne-rhone-alpes",
  "bourgogne-franche-comte",
  "bretagne",
  "centre-val-de-loire",
  "corse",
  "grand-est",
  "guadeloupe",
  "guyane",
  "hauts-de-france",
  "ile-de-france",
  "la-reunion",
  "martinique",
  "mayotte",
  "normandie",
  "nouvelle-aquitaine",
  "occitanie",
  "pays-de-la-loire",
  "provence-alpes-cote-d-azur",
]);

const SERVICE_VILLE_SEGMENTS: ReadonlySet<string> = new Set(["par-ville", "by-city"]);
const IMPLANTATIONS_SEGMENTS: ReadonlySet<string> = new Set(["implantations", "locations"]);

/**
 * Retourne `true` si le pathname est une route stub anti-doorway qui doit
 * recevoir `X-Robots-Tag: noindex, follow` en plus du `<meta robots>` HTML.
 *
 * Patterns détectés :
 *   - `/[locale]/implantations/<region>` quand region pas indexable (Corse)
 *   - `/[locale]/implantations/<region>/<ville>` quand ville pas pilote
 *   - `/[locale]/<section>/par-ville/<ville>` : toujours (cf. NOINDEX_SERVICE_VILLE_SECTIONS)
 *
 * Faux négatifs OK (laisser passer une vraie page indexable) : pas de régression.
 * Faux positifs CRITIQUE (mettre noindex sur une page indexable) : audit obligatoire.
 *
 * Toute modification doit passer le test `seo-noindex-routes.test.ts` (sync vs
 * `getIndexableVilles()` / `getIndexableRegions()`).
 */
export function isNoindexStubRoute(
  pathname: string,
  env: Readonly<Record<string, string | undefined>> = {},
): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 3) return false;

  const [locale, section, ...rest] = parts;
  if (!locale || !LOCALES.includes(locale as Locale)) return false;
  if (!section) return false;

  // `/[locale]/implantations/...` ou `/[locale]/locations/...`
  if (IMPLANTATIONS_SEGMENTS.has(section)) {
    const region = rest[0];
    const ville = rest[1];
    if (!region) return false;
    // Région non indexable → noindex
    if (!INDEXABLE_REGION_SLUGS.has(region)) return true;
    // Région indexable mais ville présente → check ville
    if (ville && !INDEXABLE_VILLE_SLUGS.has(ville)) return true;
    return false;
  }

  // `/[locale]/<section>/par-ville/<ville>` ou `/[locale]/<section>/by-city/<ville>` :
  // toujours noindex (une seule page indexée par ville).
  if (NOINDEX_SERVICE_VILLE_SECTIONS.has(section) && rest.length >= 2) {
    const segment = rest[0];
    const ville = rest[1];
    // Porte de qualité (28/11/2026) : drapeau éteint par défaut ⇒ `env` vide ⇒ toujours noindex.
    // Allumé, une ville qui a passé la porte n'est plus noindex par l'en-tête (le meta de la
    // page décide alors seul).
    if (segment && SERVICE_VILLE_SEGMENTS.has(segment) && ville) {
      return !villeIndexableParPorte(ville, env);
    }
  }

  return false;
}

/** Exposé pour les tests de sync uniquement. */
export const __INTERNAL = {
  INDEXABLE_VILLE_SLUGS,
  NOINDEX_SERVICE_VILLE_SECTIONS,
  INDEXABLE_REGION_SLUGS,
} as const;
