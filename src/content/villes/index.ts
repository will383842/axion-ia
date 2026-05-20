// Villes — barrel + composite type + helpers (Sprint 14.9, ADR 0006).
//
// Architecture (cf. doctrine pSEO villes/régions) :
//   data/<region-slug>.ts   ← VilleData[] structurel INSEE (régénéré par script)
//   copy/<slug>.ts          ← VilleCopy éditorial gold standard (curaté manuellement)
//   index.ts                ← composite Ville = VilleData & { copy? } + helpers
//
// Règle anti-doorway HCU 2024 : seules les villes avec `copy` sont
// `indexable` (cf. `getIndexableVilles()`). Les ~2 280 communes sans copy
// existent en SSG mais sortent en `<meta name="robots" content="noindex" />`.

import type { VilleData } from "./data/types";
import type { VilleCopy } from "./copy/types";
import type { VilleEconomicData } from "./economic-data/types";
import { getVilleEconomicData } from "./economic-data";

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

import { PARIS_COPY } from "./copy/paris";

export type { VilleData } from "./data/types";
export type { VilleCopy, VilleFaq } from "./copy/types";

/** Type composite consommé par les pages et helpers (geo.ts, sitemap, etc.). */
export interface Ville extends VilleData {
  /** Contenu éditorial gold standard. Présent ⇒ page indexable. */
  copy?: VilleCopy;
  /**
   * Data économique enrichie (secteurs NAF, pôles, distances, KB tags…)
   * sourcée. Consommée par ContentGen RAG + dashboard /content-gen/city-coverage.
   * Sprint City Quality 2026-05-18 — contrat zéro invention.
   */
  economicData?: VilleEconomicData;
}

// Lookup slug → contenu éditorial. Étendu manuellement à mesure que les
// pages villes gold standard sont produites (Paris d'abord, puis 50 top, etc.).
const COPY_BY_SLUG: Record<string, VilleCopy> = {
  paris: PARIS_COPY,
};

const RAW_VILLES: ReadonlyArray<VilleData> = [
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

export const VILLES: ReadonlyArray<Ville> = RAW_VILLES.map((v) => {
  const copy = COPY_BY_SLUG[v.slug];
  const economicData = getVilleEconomicData(v.slug);
  const base: Ville = { ...v };
  if (copy) base.copy = copy;
  if (economicData) base.economicData = economicData;
  return base;
});

const SLUG_INDEX = new Map(VILLES.map((v) => [v.slug, v] as const));
const INSEE_INDEX = new Map(VILLES.map((v) => [v.inseeCode, v] as const));

export function getVille(slug: string): Ville | undefined {
  return SLUG_INDEX.get(slug);
}

export function getVilleByInsee(inseeCode: string): Ville | undefined {
  return INSEE_INDEX.get(inseeCode);
}

export function getAllVilleSlugs(): ReadonlyArray<string> {
  return VILLES.map((v) => v.slug);
}

export function getVillesByRegion(regionSlug: string): ReadonlyArray<Ville> {
  return VILLES.filter((v) => v.region === regionSlug);
}

/**
 * Pages villes éligibles à indexation Google. Filtre les villes qui ont un
 * `copy` éditorial — pas d'indexation des stubs structurels (anti-doorway HCU).
 */
export function getIndexableVilles(): ReadonlyArray<Ville> {
  return VILLES.filter((v) => !!v.copy);
}
