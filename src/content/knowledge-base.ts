/**
 * Knowledge Base — SSOT principal (barrel export).
 *
 * Spec : `_AUDIT/KNOWLEDGE-BASE-2026/02-SSOT.md`.
 * ADR : `docs/adr/0021-knowledge-base-unifiee.md` (à créer).
 *
 * Pattern aligné sur `interventions-taxonomy.ts` + `pricing.ts` (mémoire
 * `axionia_doctrine_code_ssot` + `axionia_pricing_zero_hardcode_2026-05-08`).
 *
 * Tous les SSOT KB (enums, labels, mappings, thresholds) vivent ici ou
 * dans `src/content/knowledge/*.ts`. AUCUNE string magique dans les composants.
 */

export * from "./knowledge/audiences";
export * from "./knowledge/confidentialities";
export * from "./knowledge/domains";
export * from "./knowledge/quality-thresholds";
export * from "./knowledge/relation-kinds";
export * from "./knowledge/review-windows";
export * from "./knowledge/routes";
export * from "./knowledge/statuses";
export * from "./knowledge/types";

import type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbPipelineStage,
  KbRelationKind,
  KbStatus,
  KbType,
} from "../../prisma/generated/client";

/**
 * Type "façade" pour une entrée KB minimale (avant chargement DB).
 * Utilisé pour les helpers cross-module.
 */
export interface KbEntryFacade {
  readonly id: string;
  readonly type: KbType;
  readonly domain: KbDomain;
  readonly audience: KbAudience;
  readonly confidentiality: KbConfidentiality;
  readonly status: KbStatus;
  readonly pipelineStage: KbPipelineStage;
  readonly slug: string;
  readonly publishedAt: Date | null;
  readonly deletedAt: Date | null;
}

export type KbLocale = "fr" | "en";

/** Re-export des enums runtime (depuis Prisma) pour usage côté composants. */
export type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbPipelineStage,
  KbRelationKind,
  KbStatus,
  KbType,
};
