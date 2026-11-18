/**
 * V1-18 (chantier GEO) — la plume IA n'est jamais présentée comme une personne experte.
 *
 * Source unique du libellé de l'auteur IA (« Manon »). Il est imposé au rendu et au
 * JSON-LD quelle que soit la valeur de `AuthorProfile.jobTitle` en base : les anciennes
 * lignes (« Experte IA… ») ne sont ni modifiées ni supprimées, elles ne s'affichent plus.
 * Le nœud structuré est une `Organization` (jamais une `Person`), cohérent avec la
 * signature « Point de vue d'Axion-IA » des avis (`SIGNATURE_AVIS`, PR #1639).
 */
export const LIBELLE_PLUME_IA = "Plume IA d'Axion-IA";

/** Slug de la plume IA dans `AuthorProfile`. */
export const SLUG_PLUME_IA = "manon";
