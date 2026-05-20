/**
 * Barrel — KB Entries sectorielles statiques Axion-IA.
 *
 * Sprint S+5 Phase B3 2026-05-20.
 * 31 entries / 6 thématiques / 29 tags sectoriels.
 *
 * Usage ContentGen :
 *   import { ALL_SECTOR_KB_ENTRIES } from "@/content/knowledge/sector-entries"
 *   const relevant = ALL_SECTOR_KB_ENTRIES.filter(e =>
 *     e.sectorTagSlugs.some(t => ville.kbSectorTags.includes(t))
 *   )
 */

export type { SectorKbEntry, SectorTagSlug } from "./types";

export { CONSEIL_FINANCE_KB_ENTRIES } from "./conseil-finance";
export { INDUSTRIE_KB_ENTRIES } from "./industrie";
export { COMMERCE_LOGISTIQUE_KB_ENTRIES } from "./commerce-logistique";
export { IT_CYBER_KB_ENTRIES } from "./it-cyber";
export { SANTE_AGRO_KB_ENTRIES } from "./sante-agro";
export { DOCTRINES_CROSS_KB_ENTRIES } from "./doctrines-cross";

import { CONSEIL_FINANCE_KB_ENTRIES } from "./conseil-finance";
import { INDUSTRIE_KB_ENTRIES } from "./industrie";
import { COMMERCE_LOGISTIQUE_KB_ENTRIES } from "./commerce-logistique";
import { IT_CYBER_KB_ENTRIES } from "./it-cyber";
import { SANTE_AGRO_KB_ENTRIES } from "./sante-agro";
import { DOCTRINES_CROSS_KB_ENTRIES } from "./doctrines-cross";

/** Toutes les entries sectorielles KB, plate, prête pour le RAG. */
export const ALL_SECTOR_KB_ENTRIES = [
  ...CONSEIL_FINANCE_KB_ENTRIES,
  ...INDUSTRIE_KB_ENTRIES,
  ...COMMERCE_LOGISTIQUE_KB_ENTRIES,
  ...IT_CYBER_KB_ENTRIES,
  ...SANTE_AGRO_KB_ENTRIES,
  ...DOCTRINES_CROSS_KB_ENTRIES,
] as const;
