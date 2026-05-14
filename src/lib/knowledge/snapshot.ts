/**
 * KB-4 — Snapshot d'une `KnowledgeEntry` pour `KnowledgeVersion`.
 * Pure. Aucune I/O DB.
 */

import type {
  KnowledgeEntry,
  KnowledgeRelation,
  KnowledgeTagOnEntry,
  KnowledgeTranslation,
} from "../../../prisma/generated/client";

export interface EntrySnapshotInput {
  readonly entry: KnowledgeEntry;
  readonly translations: KnowledgeTranslation[];
  readonly tags?: Array<KnowledgeTagOnEntry & { tag: { slug: string } }>;
  readonly outgoingRelations?: KnowledgeRelation[];
}

export interface EntrySnapshot {
  readonly version: 1;
  readonly capturedAt: string;
  readonly entry: {
    readonly id: string;
    readonly type: string;
    readonly domain: string;
    readonly audience: string;
    readonly confidentiality: string;
    readonly status: string;
    readonly pipelineStage: string;
    readonly slug: string;
    readonly briefMarkdown: string | null;
    readonly targetKeyword: string | null;
    readonly targetWordCount: number | null;
    readonly publishedAt: string | null;
    readonly scheduledFor: string | null;
    readonly assignedAuthorId: string | null;
    readonly assignedReviewerId: string | null;
  };
  readonly translations: ReadonlyArray<{
    readonly id: string;
    readonly locale: string;
    readonly title: string;
    readonly slug: string;
    readonly excerpt: string | null;
    readonly body: string;
    readonly bodyText: string | null;
    readonly metaTitle: string | null;
    readonly metaDescription: string | null;
  }>;
  readonly tagSlugs: readonly string[];
  readonly outgoingRelations: ReadonlyArray<{ readonly toEntryId: string; readonly kind: string }>;
}

export function makeEntrySnapshot(input: EntrySnapshotInput): EntrySnapshot {
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    entry: {
      id: input.entry.id,
      type: input.entry.type,
      domain: input.entry.domain,
      audience: input.entry.audience,
      confidentiality: input.entry.confidentiality,
      status: input.entry.status,
      pipelineStage: input.entry.pipelineStage,
      slug: input.entry.slug,
      briefMarkdown: input.entry.briefMarkdown,
      targetKeyword: input.entry.targetKeyword,
      targetWordCount: input.entry.targetWordCount,
      publishedAt: input.entry.publishedAt?.toISOString() ?? null,
      scheduledFor: input.entry.scheduledFor?.toISOString() ?? null,
      assignedAuthorId: input.entry.assignedAuthorId,
      assignedReviewerId: input.entry.assignedReviewerId,
    },
    translations: input.translations.map((t) => ({
      id: t.id,
      locale: t.locale,
      title: t.title,
      slug: t.slug,
      excerpt: t.excerpt,
      body: t.body,
      bodyText: t.bodyText,
      metaTitle: t.metaTitle,
      metaDescription: t.metaDescription,
    })),
    tagSlugs: (input.tags ?? []).map((t) => t.tag.slug),
    outgoingRelations: (input.outgoingRelations ?? []).map((r) => ({
      toEntryId: r.toEntryId,
      kind: r.kind,
    })),
  };
}
