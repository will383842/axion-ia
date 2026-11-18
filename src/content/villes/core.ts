// Villes — noyau STRUCTUREL, sans contenu éditorial (2026-08-16).
//
// POURQUOI CE FICHIER EXISTE
//
// `@/content/villes` (le barrel) est un point d'entrée cher : il importe
// `copy/_auto-generated-index.ts`, qui fait à lui seul **2 118 imports statiques**
// pour ~29 Mo de TypeScript. Quiconque appelle `getVille(slug).geo` paie le parse
// de la totalité du contenu éditorial des 2 157 communes.
//
// Mesuré à froid le 2026-08-16 (cache vite vidé) :
//   data/ (13 modules)   :  1 065 ms
//   economic-data/       :  1 250 ms
//   copy/ + enrichissement : 38 793 ms   ← tout le coût est ici
//   TOTAL                : 41 202 ms
//
// Un import ESM statique ne se rend pas paresseux : découpler veut donc dire
// NE PAS PASSER par ce module quand on n'a pas besoin du contenu. Ce fichier est
// ce chemin-là — `data/` seul, plus les ensembles de slugs, soit ~1 s.
//
// CE QU'IL CONTIENT (et pourquoi ici plutôt que dans le barrel)
//
// Toute la logique d'INDEXABILITÉ vit ici, pas dans `index.ts`. Elle ne dépend
// que de champs structurels (slug, population, departement, region) et de trois
// ensembles de slugs — jamais du corps des `copy`. La placer ici évite de la
// dupliquer : `index.ts` l'importe et se contente d'habiller les résultats avec
// `copy` + `economicData`. Une seule source de vérité pour le SEO.
//
// Le prédicat historique `!!v.copy` est remplacé par `hasVilleCopy(slug)`, adossé
// au fichier généré `@/generated/villes-slugs-with-copy` (les CLÉS, pas les
// contenus — ~40 Ko). Le test `villes-slugs-with-copy.sync.test.ts` échoue si ce
// fichier dérive du vrai `COPY_BY_SLUG`.

import type { VilleData } from "./data/types";
import { PREMIUM_REWRITE_SLUGS } from "./premium-rewrite-slugs";
import { VILLES_INDEXEES, estCitableDansLeMaillage } from "./villes-indexees";
import { REGIONS, type Region } from "@/content/regions";
import { VILLE_SLUGS_WITH_COPY } from "@/generated/villes-slugs-with-copy";

import { VILLES_ILE_DE_FRANCE } from "./data/ile-de-france";
import { VILLES_AUVERGNE_RHONE_ALPES } from "./data/auvergne-rhone-alpes";
import { VILLES_PROVENCE_ALPES_COTE_D_AZUR } from "./data/provence-alpes-cote-d-azur";
import { VILLES_OCCITANIE } from "./data/occitanie";
import { VILLES_NOUVELLE_AQUITAINE } from "./data/nouvelle-aquitaine";
import { VILLES_HAUTS_DE_FRANCE } from "./data/hauts-de-france";
import { VILLES_GRAND_EST } from "./data/grand-est";
import { VILLES_PAYS_DE_LA_LOIRE } from "./data/pays-de-la-loire";
import { VILLES_BRETAGNE } from "./data/bretagne";
import { VILLES_NORMANDIE } from "./data/normandie";
import { VILLES_BOURGOGNE_FRANCHE_COMTE } from "./data/bourgogne-franche-comte";
import { VILLES_CENTRE_VAL_DE_LOIRE } from "./data/centre-val-de-loire";
import { VILLES_CORSE } from "./data/corse";

export type { VilleData } from "./data/types";

/**
 * Toutes les communes, données structurelles INSEE uniquement.
 *
 * ⚠️ Pas de `copy` ni d'`economicData` ici — c'est tout l'intérêt. Si tu as
 * besoin du contenu éditorial, importe `@/content/villes` (et accepte son coût).
 */
export const VILLES_CORE: ReadonlyArray<VilleData> = [
  ...VILLES_ILE_DE_FRANCE,
  ...VILLES_AUVERGNE_RHONE_ALPES,
  ...VILLES_PROVENCE_ALPES_COTE_D_AZUR,
  ...VILLES_OCCITANIE,
  ...VILLES_NOUVELLE_AQUITAINE,
  ...VILLES_HAUTS_DE_FRANCE,
  ...VILLES_GRAND_EST,
  ...VILLES_PAYS_DE_LA_LOIRE,
  ...VILLES_BRETAGNE,
  ...VILLES_NORMANDIE,
  ...VILLES_BOURGOGNE_FRANCHE_COMTE,
  ...VILLES_CENTRE_VAL_DE_LOIRE,
  ...VILLES_CORSE,
];

const CORE_BY_SLUG = new Map(VILLES_CORE.map((v) => [v.slug, v] as const));
const CORE_BY_INSEE = new Map(VILLES_CORE.map((v) => [v.inseeCode, v] as const));
const SLUGS_WITH_COPY = new Set<string>(VILLE_SLUGS_WITH_COPY);

export function getVilleCore(slug: string): VilleData | undefined {
  return CORE_BY_SLUG.get(slug);
}

export function getVilleCoreByInsee(inseeCode: string): VilleData | undefined {
  return CORE_BY_INSEE.get(inseeCode);
}

export function getAllVilleSlugs(): ReadonlyArray<string> {
  return VILLES_CORE.map((v) => v.slug);
}

export function getVillesCoreByRegion(regionSlug: string): ReadonlyArray<VilleData> {
  return VILLES_CORE.filter((v) => v.region === regionSlug);
}

export function getVillesCoreByDepartement(code: string): ReadonlyArray<VilleData> {
  return VILLES_CORE.filter((v) => v.departement === code);
}

export function getRegionByDepartement(code: string): Region | undefined {
  return REGIONS.find((r) => r.departements.includes(code));
}

/** Cette commune a-t-elle un contenu éditorial ? (sans charger ledit contenu) */
export function hasVilleCopy(slug: string): boolean {
  return SLUGS_WITH_COPY.has(slug);
}

// ─── Indexation : phasage et cohorte ─────────────────────────────────────────
//
// Logique DÉPLACÉE telle quelle depuis `index.ts` (2026-08-16). Aucun changement
// de comportement : mêmes constantes, même tri, mêmes seuils. Seul le prédicat
// « a un copy » change de forme — `!!v.copy` devient `hasVilleCopy(v.slug)`,
// adossé aux clés générées plutôt qu'aux contenus. Les commentaires d'origine
// sont conservés : ils portent les décisions SEO, pas de l'ornement.

/** Ville premium = a un copy ET (pop ≥ 20k OU rewrite premium MANUAL-REWRITE). */
export function isPremiumVilleCore(v: VilleData): boolean {
  return hasVilleCopy(v.slug) && (v.population >= 20_000 || PREMIUM_REWRITE_SLUGS.has(v.slug));
}

// Villes RÉELLEMENT indexables : UNIQUEMENT celles de `villes-indexees.ts` (source
// unique, décision du 18/11/2026 : 40 villes de 100 000 habitants ou plus). Toutes
// les autres villes restent présentes, crawlables et en ligne, mais sortent
// `noindex, follow` au niveau page et en-tête, et hors des sitemaps.
// RÉVERSIBLE : modifier la liste dans `villes-indexees.ts`.
//
// Ordre déterministe : population décroissante, puis slug.
const RANKED_INDEXABLE: ReadonlyArray<VilleData> = VILLES_CORE.filter((v) =>
  VILLES_INDEXEES.has(v.slug),
).sort((a, b) => {
  if (b.population !== a.population) return b.population - a.population;
  return a.slug.localeCompare(b.slug);
});

/** Taille de la cohorte indexable : toute la liste `villes-indexees.ts` (plus de drip). */
export function cohortSize(now: Date = new Date()): number {
  void now;
  return RANKED_INDEXABLE.length;
}

/**
 * True si la ville (par slug) est indexable.
 *
 * Lit UNIQUEMENT `villes-indexees.ts` (source unique, 18/11/2026). `now` est
 * conservé pour compatibilité de signature.
 */
export function isVilleIndexable(slug: string, now: Date = new Date()): boolean {
  void now;
  return VILLES_INDEXEES.has(slug);
}

/** Slugs des villes ÉLIGIBLES à indexation (= ont un `copy`). Base du sitemap. */
export function getIndexableVilleSlugsCore(): ReadonlyArray<string> {
  return VILLES_CORE.filter((v) => hasVilleCopy(v.slug)).map((v) => v.slug);
}

/** Villes éligibles à indexation, données structurelles. */
export function getIndexableVillesCore(): ReadonlyArray<VilleData> {
  return VILLES_CORE.filter((v) => hasVilleCopy(v.slug));
}

/** Villes de la cohorte indexable à la date `now`, dans l'ordre de classement. */
export function getVillesCoreIndexableNow(now: Date = new Date()): ReadonlyArray<VilleData> {
  // Liste de MAILLAGE (pages nationales « nos villes ») : les villes hors maillage
  // (cf. `villes-indexees.ts`) n'y figurent jamais, tout en restant indexées.
  return RANKED_INDEXABLE.filter((v) => estCitableDansLeMaillage(v.slug)).slice(
    0,
    cohortSize(now),
  );
}
