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
import { REGIONS, type Region } from "@/content/regions";

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

import { AIX_EN_PROVENCE_COPY } from "./copy/aix-en-provence";
import { AMIENS_COPY } from "./copy/amiens";
import { ANGERS_COPY } from "./copy/angers";
import { ANNECY_COPY } from "./copy/annecy";
import { ARGENTEUIL_COPY } from "./copy/argenteuil";
import { BESANCON_COPY } from "./copy/besancon";
import { BORDEAUX_COPY } from "./copy/bordeaux";
import { BOULOGNE_BILLANCOURT_COPY } from "./copy/boulogne-billancourt";
import { BREST_COPY } from "./copy/brest";
import { CAEN_COPY } from "./copy/caen";
import { CLERMONT_FERRAND_COPY } from "./copy/clermont-ferrand";
import { DIJON_COPY } from "./copy/dijon";
import { GRENOBLE_COPY } from "./copy/grenoble";
import { LE_HAVRE_COPY } from "./copy/le-havre";
import { LE_MANS_COPY } from "./copy/le-mans";
import { LILLE_COPY } from "./copy/lille";
import { LIMOGES_COPY } from "./copy/limoges";
import { LYON_COPY } from "./copy/lyon";
import { MARSEILLE_COPY } from "./copy/marseille";
import { METZ_COPY } from "./copy/metz";
import { MONTPELLIER_COPY } from "./copy/montpellier";
import { MONTREUIL_COPY } from "./copy/montreuil";
import { MULHOUSE_COPY } from "./copy/mulhouse";
import { NANCY_COPY } from "./copy/nancy";
import { NANTES_COPY } from "./copy/nantes";
import { NICE_COPY } from "./copy/nice";
import { NIMES_COPY } from "./copy/nimes";
import { ORLEANS_COPY } from "./copy/orleans";
import { PARIS_COPY } from "./copy/paris";
import { PERPIGNAN_COPY } from "./copy/perpignan";
import { REIMS_COPY } from "./copy/reims";
import { RENNES_COPY } from "./copy/rennes";
import { ROUEN_COPY } from "./copy/rouen";
import { SAINT_DENIS_COPY } from "./copy/saint-denis";
import { SAINT_ETIENNE_COPY } from "./copy/saint-etienne";
import { STRASBOURG_COPY } from "./copy/strasbourg";
import { TOULON_COPY } from "./copy/toulon";
import { TOULOUSE_COPY } from "./copy/toulouse";
import { TOURS_COPY } from "./copy/tours";
import { VILLEURBANNE_COPY } from "./copy/villeurbanne";

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
  "aix-en-provence": AIX_EN_PROVENCE_COPY,
  amiens: AMIENS_COPY,
  angers: ANGERS_COPY,
  annecy: ANNECY_COPY,
  argenteuil: ARGENTEUIL_COPY,
  besancon: BESANCON_COPY,
  bordeaux: BORDEAUX_COPY,
  "boulogne-billancourt": BOULOGNE_BILLANCOURT_COPY,
  brest: BREST_COPY,
  caen: CAEN_COPY,
  "clermont-ferrand": CLERMONT_FERRAND_COPY,
  dijon: DIJON_COPY,
  grenoble: GRENOBLE_COPY,
  "le-havre": LE_HAVRE_COPY,
  "le-mans": LE_MANS_COPY,
  lille: LILLE_COPY,
  limoges: LIMOGES_COPY,
  lyon: LYON_COPY,
  marseille: MARSEILLE_COPY,
  metz: METZ_COPY,
  montpellier: MONTPELLIER_COPY,
  montreuil: MONTREUIL_COPY,
  mulhouse: MULHOUSE_COPY,
  nancy: NANCY_COPY,
  nantes: NANTES_COPY,
  nice: NICE_COPY,
  nimes: NIMES_COPY,
  orleans: ORLEANS_COPY,
  paris: PARIS_COPY,
  perpignan: PERPIGNAN_COPY,
  reims: REIMS_COPY,
  rennes: RENNES_COPY,
  rouen: ROUEN_COPY,
  "saint-denis": SAINT_DENIS_COPY,
  "saint-etienne": SAINT_ETIENNE_COPY,
  strasbourg: STRASBOURG_COPY,
  toulon: TOULON_COPY,
  toulouse: TOULOUSE_COPY,
  tours: TOURS_COPY,
  villeurbanne: VILLEURBANNE_COPY,
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

/**
 * Toutes les villes d'un département donné (code INSEE 2 ou 3 caractères :
 * "75", "13", "2A", "2B", "974" pour l'historique DROM, etc.).
 * Retourne un tableau vide si le code est inconnu (pas d'erreur).
 * P2-4 Sprint S+5 — utilisé par les pages /implantations/[region]/[dept] et
 * par les helpers content-gen quand un cas concret cible un département.
 */
export function getVillesByDepartement(code: string): ReadonlyArray<Ville> {
  return VILLES.filter((v) => v.departement === code);
}

/**
 * Retourne la région métropolitaine contenant le code département fourni,
 * ou undefined si le code n'appartient à aucune région connue (DROM hors V1).
 * P2-4 Sprint S+5 — utilisé pour réconcilier un cas concret département-only
 * vers sa région parente sans relire VILLES.
 */
export function getRegionByDepartement(code: string): Region | undefined {
  return REGIONS.find((r) => r.departements.includes(code));
}
