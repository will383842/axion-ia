/**
 * Knowledge Base — 7 kinds de relation entry-to-entry.
 * Cycle detection en server action (Sprint KB-4).
 */

import type { KbRelationKind } from "../../../prisma/generated/client";

export const KB_RELATION_KINDS: readonly KbRelationKind[] = [
  "replaces",
  "cites",
  "depends_on",
  "related_to",
  "supersedes",
  "contradicts",
  "extends",
] as const;

export const KB_RELATION_KIND_LABELS_FR: Record<KbRelationKind, string> = {
  replaces: "Remplace",
  cites: "Cite",
  depends_on: "Dépend de",
  related_to: "En relation avec",
  supersedes: "Supplante",
  contradicts: "Contredit",
  extends: "Étend",
};

export const KB_RELATION_KIND_LABELS_EN: Record<KbRelationKind, string> = {
  replaces: "Replaces",
  cites: "Cites",
  depends_on: "Depends on",
  related_to: "Related to",
  supersedes: "Supersedes",
  contradicts: "Contradicts",
  extends: "Extends",
};

/**
 * Relations qui doivent former un DAG (pas de cycle autorisé).
 * Vérifié en server action `add-relation.ts` Sprint KB-4.
 */
export const DAG_RELATION_KINDS: readonly KbRelationKind[] = [
  "replaces",
  "depends_on",
  "supersedes",
  "extends",
] as const;

export function isDagKind(kind: KbRelationKind): boolean {
  return DAG_RELATION_KINDS.includes(kind);
}

export function getRelationKindLabel(kind: KbRelationKind, locale: "fr" | "en"): string {
  return locale === "fr" ? KB_RELATION_KIND_LABELS_FR[kind] : KB_RELATION_KIND_LABELS_EN[kind];
}
