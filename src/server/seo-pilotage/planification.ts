/** Cadences du robot « pilotage SEO » (P4). Fichier léger : lisible par un test sans charger BullMQ. */

/** 06 h 37 à Paris : ni sur la minute 0 de `site-route-gsc` / `content-keyword-sync` (04:00 UTC). */
export const PATTERN_SEO_INGESTION = "37 6 * * *";
/** Rattrapage : jusqu'à 30 jours d'historique à :07, :27 et :47 (≈ 6 h pour 16 mois, voir `JOURS_PAR_PASSAGE`). */
export const PATTERN_SEO_RATTRAPAGE = "7,27,47 * * * *";
/** Purge : le dimanche, 03 h 17 à Paris. */
export const PATTERN_SEO_PURGE = "17 3 * * 0";
/** Inspection d'URL en rotation : tous les jours, 07 h 00 à Paris. */
export const PATTERN_SEO_INSPECTION = "0 7 * * *";
export const FUSEAU_SEO_PILOTAGE = "Europe/Paris";
/** Recalcul (P6a) : 07 h 07 à Paris, après l'ingestion de 06 h 37 ; jamais sur la minute 0. */
export const PATTERN_SEO_RECALCUL = "7 7 * * *";
/** Robots d'IA (P10) : tous les jours à 07 h 07 à Paris, après la collecte Search Console de 06 h 37. */
export const PATTERN_SEO_ROBOTS_IA = "7 7 * * *";
/** Panel GEO (P11) : jours ouvrés, 08 h 17 à Paris (3 questions par passage) ; jamais sur la minute 0. */
export const PATTERN_SEO_PANEL_GEO = "17 8 * * 1-5";
