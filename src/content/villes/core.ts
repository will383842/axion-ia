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
import { UNIQUE_VILLE_SLUGS } from "./unique-ville-slugs";
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

const INDEXATION_START = new Date("2026-05-28T00:00:00Z");
const VILLES_PER_DAY = 50;

const BURST_DAYS = 9; // socle figé = premium + 9*50 (~cohorte du 2026-06-06)
const REOPEN_START = new Date("2026-06-06T00:00:00Z");
const REOPEN_WEEK1 = 100; // villes rouvertes la 1re semaine
const REOPEN_ACCEL = 25; // +25 villes/semaine de plus chaque semaine (S1=100…S5=200)
const WEEK_MS = 7 * 86_400_000;

/** Nb de villes uniques rouvertes (cumul) depuis REOPEN_START — accélérant par semaine. */
function reopenedSince(now: Date): number {
  const ms = now.getTime() - REOPEN_START.getTime();
  if (ms <= 0) return 0;
  const w = Math.floor(ms / WEEK_MS); // semaines pleines écoulées
  // cumul = Σ_{k=1..w} (REOPEN_WEEK1 + REOPEN_ACCEL*(k-1))
  return REOPEN_WEEK1 * w + (REOPEN_ACCEL * (w * (w - 1))) / 2;
}

/** Ville premium = a un copy ET (pop ≥ 20k OU rewrite premium MANUAL-REWRITE). */
export function isPremiumVilleCore(v: VilleData): boolean {
  return hasVilleCopy(v.slug) && (v.population >= 20_000 || PREMIUM_REWRITE_SLUGS.has(v.slug));
}

// Villes RÉELLEMENT indexables — garde-fou anti-doorway au mérite (décision Will
// 2026-05-31 « indexation au mérite + AEO », Phase 2B). Une ville n'entre dans la
// cohorte d'indexation que si elle a un `copy` ET passe le scorer d'unicité
// (`UNIQUE_VILLE_SLUGS`). Les ~341 villes templatées restent PRÉSENTES, crawlables,
// maillées et citables par les IA (AEO), mais sortent `noindex` au niveau page.
//
// P0 2026-07-03 (décision Will) — CAP INDEXATION T1/T2 + CURÉES : la cohorte est
// restreinte aux villes PREMIUM. RÉVERSIBLE : retirer `isPremiumVilleCore(v) &&`.
//
// Tri par priorité : premium d'abord (population décroissante), puis le reste.
// Ordre déterministe et stable entre builds (tri par pop puis slug en tie-break).
const RANKED_INDEXABLE: ReadonlyArray<VilleData> = VILLES_CORE.filter(
  (v) => isPremiumVilleCore(v) && UNIQUE_VILLE_SLUGS.has(v.slug),
).sort((a, b) => {
  const pa = isPremiumVilleCore(a);
  const pb = isPremiumVilleCore(b);
  if (pa !== pb) return pa ? -1 : 1;
  if (b.population !== a.population) return b.population - a.population;
  return a.slug.localeCompare(b.slug);
});

const PREMIUM_COUNT = RANKED_INDEXABLE.filter(isPremiumVilleCore).length;
const INDEXABLE_RANK = new Map(RANKED_INDEXABLE.map((v, i) => [v.slug, i] as const));

/** Taille de la cohorte indexable à la date `now` (premium + ramp quotidien). */
export function cohortSize(now: Date = new Date()): number {
  const elapsed = Math.max(
    0,
    Math.floor((now.getTime() - INDEXATION_START.getTime()) / 86_400_000),
  );
  const burst = PREMIUM_COUNT + Math.min(elapsed, BURST_DAYS) * VILLES_PER_DAY;
  return Math.min(RANKED_INDEXABLE.length, burst + reopenedSince(now));
}

/**
 * True si la ville (par slug) est indexable.
 *
 * P0 2026-06-14 (décision Will) : le drip progressif est RETIRÉ — toutes les
 * villes UNIQUES éligibles sont indexables IMMÉDIATEMENT. `now` est conservé pour
 * compatibilité de signature.
 */
export function isVilleIndexable(slug: string, now: Date = new Date()): boolean {
  void now;
  return INDEXABLE_RANK.has(slug);
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
  return RANKED_INDEXABLE.slice(0, cohortSize(now));
}
