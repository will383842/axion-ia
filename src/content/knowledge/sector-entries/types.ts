/**
 * Knowledge Base — Entries sectorielles statiques (Sprint S+5 Phase B3 2026-05-20).
 *
 * Ces fichiers TS sont la MATIÈRE éditoriale de la KB Axion-IA, séparée
 * de la couche Prisma (état runtime). ContentGen les consomme via RAG pour
 * composer landing pages et guides par ville × secteur × verticale.
 *
 * CONTRAT ABSOLU : aucune invention. Chaque entrée doit avoir ≥ 1 source URL
 * vérifiable dans `sources`. Si la source n'est pas trouvée → champ omis.
 *
 * Convention slugs : kebab-case ASCII, stable, jamais renommé sans migration.
 */

import type { KbType, KbDomain, KbAudience } from "../../../../prisma/generated/client";

/** Slug référençant un `KbSectorTag.slug` de `sector-tags.ts`. */
export type SectorTagSlug = string;

/**
 * Entry KB sectorielle statique. Destinée à alimenter le RAG ContentGen
 * (landing-ville.ts, guide-pilier.ts, kb-client.ts).
 *
 * Flux : fichier TS → seed Prisma (`KnowledgeEntry`) → embeddings Voyage AI →
 * requête RAG par ville × sectorTagSlugs → composition ContentGen.
 *
 * Phase V1 : bodyMarkdownFr uniquement. bodyMarkdownEn différé Sprint S+6.
 */
export interface SectorKbEntry {
  /** Slug stable kebab-case — clé de jointure avec KnowledgeEntry.slug. */
  readonly slug: string;
  /** Tags sectoriels couverts (1 à 4). Références vers `KB_SECTOR_TAGS`. */
  readonly sectorTagSlugs: ReadonlyArray<SectorTagSlug>;
  readonly type: KbType;
  readonly domain: KbDomain;
  readonly audience: KbAudience;
  /** Titre FR court (≤ 80 chars). */
  readonly titleFr: string;
  /** Titre EN court (≤ 80 chars, placeholder V1 si EN non rédigé). */
  readonly titleEn: string;
  /** Résumé FR 1-3 phrases (texte court pour snippets). */
  readonly summaryFr: string;
  /** Corps principal en Markdown FR. Cible 400-1200 mots selon le type. */
  readonly bodyMarkdownFr: string;
  /** Sources documentaires URL vérifiables. Au moins 1 requis. */
  readonly sources: ReadonlyArray<string>;
  readonly lastReviewedOn: string;
  readonly reviewedBy: string;
}
