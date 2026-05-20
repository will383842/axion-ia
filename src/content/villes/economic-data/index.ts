// Data économique enrichie par ville — barrel + lookup.
//
// Sprint City Quality 39 villes pilote 2026-05-18 (terminé).
// Top démographique France métropolitaine. Saint-Denis (La Réunion) exclu
// (dataset INSEE métropole uniquement).
//
// CONTRAT : aucune entrée n'est ajoutée ici sans data source-vérifiée.
// Voir `types.ts` § contrat absolu zéro invention.

import type { VilleEconomicData } from "./types";

import { PARIS_ECONOMIC_DATA } from "./paris";
import { MARSEILLE_ECONOMIC_DATA } from "./marseille";
import { LYON_ECONOMIC_DATA } from "./lyon";
import { TOULOUSE_ECONOMIC_DATA } from "./toulouse";
import { NICE_ECONOMIC_DATA } from "./nice";
import { NANTES_ECONOMIC_DATA } from "./nantes";
import { MONTPELLIER_ECONOMIC_DATA } from "./montpellier";
import { STRASBOURG_ECONOMIC_DATA } from "./strasbourg";
import { BORDEAUX_ECONOMIC_DATA } from "./bordeaux";
import { LILLE_ECONOMIC_DATA } from "./lille";
import { RENNES_ECONOMIC_DATA } from "./rennes";
import { TOULON_ECONOMIC_DATA } from "./toulon";
import { REIMS_ECONOMIC_DATA } from "./reims";
import { SAINT_ETIENNE_ECONOMIC_DATA } from "./saint-etienne";
import { LE_HAVRE_ECONOMIC_DATA } from "./le-havre";
import { VILLEURBANNE_ECONOMIC_DATA } from "./villeurbanne";
import { ANGERS_ECONOMIC_DATA } from "./angers";
import { DIJON_ECONOMIC_DATA } from "./dijon";
import { GRENOBLE_ECONOMIC_DATA } from "./grenoble";
import { NIMES_ECONOMIC_DATA } from "./nimes";
import { AIX_EN_PROVENCE_ECONOMIC_DATA } from "./aix-en-provence";
import { CLERMONT_FERRAND_ECONOMIC_DATA } from "./clermont-ferrand";
import { LE_MANS_ECONOMIC_DATA } from "./le-mans";
import { BREST_ECONOMIC_DATA } from "./brest";
import { TOURS_ECONOMIC_DATA } from "./tours";
import { AMIENS_ECONOMIC_DATA } from "./amiens";
import { ANNECY_ECONOMIC_DATA } from "./annecy";
import { LIMOGES_ECONOMIC_DATA } from "./limoges";
import { METZ_ECONOMIC_DATA } from "./metz";
import { PERPIGNAN_ECONOMIC_DATA } from "./perpignan";
import { BOULOGNE_BILLANCOURT_ECONOMIC_DATA } from "./boulogne-billancourt";
import { BESANCON_ECONOMIC_DATA } from "./besancon";
import { ORLEANS_ECONOMIC_DATA } from "./orleans";
import { ROUEN_ECONOMIC_DATA } from "./rouen";
import { MONTREUIL_ECONOMIC_DATA } from "./montreuil";
import { CAEN_ECONOMIC_DATA } from "./caen";
import { ARGENTEUIL_ECONOMIC_DATA } from "./argenteuil";
import { MULHOUSE_ECONOMIC_DATA } from "./mulhouse";
import { NANCY_ECONOMIC_DATA } from "./nancy";

/**
 * Lookup slug → data économique. 39 villes pilote (top démographique France
 * métropolitaine). Sprint 2026-05-18 terminé : 39/39 villes branchées.
 */
export const ECONOMIC_DATA_BY_SLUG: Record<string, VilleEconomicData> = {
  paris: PARIS_ECONOMIC_DATA,
  marseille: MARSEILLE_ECONOMIC_DATA,
  lyon: LYON_ECONOMIC_DATA,
  toulouse: TOULOUSE_ECONOMIC_DATA,
  nice: NICE_ECONOMIC_DATA,
  nantes: NANTES_ECONOMIC_DATA,
  montpellier: MONTPELLIER_ECONOMIC_DATA,
  strasbourg: STRASBOURG_ECONOMIC_DATA,
  bordeaux: BORDEAUX_ECONOMIC_DATA,
  lille: LILLE_ECONOMIC_DATA,
  rennes: RENNES_ECONOMIC_DATA,
  toulon: TOULON_ECONOMIC_DATA,
  reims: REIMS_ECONOMIC_DATA,
  "saint-etienne": SAINT_ETIENNE_ECONOMIC_DATA,
  "le-havre": LE_HAVRE_ECONOMIC_DATA,
  villeurbanne: VILLEURBANNE_ECONOMIC_DATA,
  angers: ANGERS_ECONOMIC_DATA,
  dijon: DIJON_ECONOMIC_DATA,
  grenoble: GRENOBLE_ECONOMIC_DATA,
  nimes: NIMES_ECONOMIC_DATA,
  "aix-en-provence": AIX_EN_PROVENCE_ECONOMIC_DATA,
  "clermont-ferrand": CLERMONT_FERRAND_ECONOMIC_DATA,
  "le-mans": LE_MANS_ECONOMIC_DATA,
  brest: BREST_ECONOMIC_DATA,
  tours: TOURS_ECONOMIC_DATA,
  amiens: AMIENS_ECONOMIC_DATA,
  annecy: ANNECY_ECONOMIC_DATA,
  limoges: LIMOGES_ECONOMIC_DATA,
  metz: METZ_ECONOMIC_DATA,
  perpignan: PERPIGNAN_ECONOMIC_DATA,
  "boulogne-billancourt": BOULOGNE_BILLANCOURT_ECONOMIC_DATA,
  besancon: BESANCON_ECONOMIC_DATA,
  orleans: ORLEANS_ECONOMIC_DATA,
  rouen: ROUEN_ECONOMIC_DATA,
  montreuil: MONTREUIL_ECONOMIC_DATA,
  caen: CAEN_ECONOMIC_DATA,
  argenteuil: ARGENTEUIL_ECONOMIC_DATA,
  mulhouse: MULHOUSE_ECONOMIC_DATA,
  nancy: NANCY_ECONOMIC_DATA,
};

export function getVilleEconomicData(slug: string): VilleEconomicData | undefined {
  return ECONOMIC_DATA_BY_SLUG[slug];
}

export function hasVilleEconomicData(slug: string): boolean {
  return slug in ECONOMIC_DATA_BY_SLUG;
}

export function getAllEconomicDataSlugs(): ReadonlyArray<string> {
  return Object.keys(ECONOMIC_DATA_BY_SLUG);
}

export type { VilleEconomicData } from "./types";
export {
  ECONOMIC_DATA_DIMENSIONS,
  countNonEmptyEconomicFields,
  type EconomicDataDimension,
} from "./types";
