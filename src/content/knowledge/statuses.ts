/**
 * Knowledge Base — workflow états (7 valeurs).
 * Dédié (n'étend pas `PublishStatus` global) — cf. ADR 0021 + SYNTHESIS §3.
 * State machine : transitions allowed définies dans `src/lib/knowledge/state-machine.ts` (Sprint KB-4).
 */

import type { KbStatus, KbPipelineStage } from "../../../prisma/generated/client";

export const KB_STATUSES: readonly KbStatus[] = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "archived",
  "deprecated",
] as const;

export const KB_STATUS_LABELS_FR: Record<KbStatus, string> = {
  draft: "Brouillon",
  review: "En revue",
  approved: "Validé",
  scheduled: "Publication programmée",
  published: "Publié",
  archived: "Archivé",
  deprecated: "Obsolète",
};

export const KB_STATUS_LABELS_EN: Record<KbStatus, string> = {
  draft: "Draft",
  review: "Under review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
  deprecated: "Deprecated",
};

export function getStatusLabel(status: KbStatus, locale: "fr" | "en"): string {
  return locale === "fr" ? KB_STATUS_LABELS_FR[status] : KB_STATUS_LABELS_EN[status];
}

/** Statuts qui rendent une entrée visible côté public (selon audience). */
export const VISIBLE_STATUSES: readonly KbStatus[] = ["published", "deprecated"] as const;

export function isVisibleStatus(status: KbStatus): boolean {
  return VISIBLE_STATUSES.includes(status);
}

/** Pipeline éditorial (9 valeurs). Orthogonal à `KbStatus`. */
export const KB_PIPELINE_STAGES: readonly KbPipelineStage[] = [
  "idea",
  "brief",
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "archived",
  "deprecated",
] as const;

export const KB_PIPELINE_STAGE_LABELS_FR: Record<KbPipelineStage, string> = {
  idea: "Idée",
  brief: "Brief",
  draft: "Brouillon",
  review: "En revue",
  approved: "Validé",
  scheduled: "Programmé",
  published: "Publié",
  archived: "Archivé",
  deprecated: "Obsolète",
};

export function getPipelineStageLabel(stage: KbPipelineStage, locale: "fr" | "en"): string {
  if (locale === "fr") return KB_PIPELINE_STAGE_LABELS_FR[stage];
  // EN labels = capitalize values (jamais traduit dans la base, juste affichage)
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}
