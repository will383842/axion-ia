/**
 * KB V4 (Sprint KB-13) — Pipeline ingest factory.
 *
 * Encapsule la logique :
 * 1. Vérifier idempotency (return existing entryId si déjà processed)
 * 2. PII scan (bloquant)
 * 3. Banned words (bloquant)
 * 4. Heuristic quality gates (bloquant)
 * 5. Dedup pgvector cosine (bloquant ≥ 0.92, warning 0.85-0.92)
 * 6. Si KB_AUTO_PUBLISH=true : publish immédiat avec source tracking
 *    Sinon : audience='team' (review humaine manuelle)
 *
 * V1 minimal : pas de BullMQ queue, synchrone. Sprint KB-13 v2 ajoutera la queue
 * pour gérer le throughput 100/jour (~4/heure peak).
 */

"use server";

import { prisma } from "@/lib/prisma";
import { detectPii } from "@/lib/knowledge/pii-scan";
import { checkTranslationBannedWords } from "@/lib/knowledge/banned-words";
import { validateAltText } from "@/lib/knowledge/alt-text-validation";
import { runHeuristicGates } from "@/lib/knowledge/quality-gates";
import {
  buildEmbeddingInput,
  generateEmbedding,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL_NAME,
} from "@/lib/knowledge/embeddings";
import { DEDUP_REJECT_THRESHOLD, findSimilarEntries } from "@/lib/knowledge/dedup-check";
import { appendAudit } from "@/lib/knowledge/audit-log";
import { refreshSeoCacheForTranslation } from "./seo-cache";
import type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbType,
  Prisma,
} from "../../../../prisma/generated/client";

export interface IngestPayload {
  readonly idempotencyKey: string;
  readonly type: KbType;
  readonly title: string;
  readonly body: string; // HTML Tiptap
  readonly bodyJson?: unknown;
  readonly bodyText?: string;
  readonly excerpt?: string;
  readonly tags?: readonly string[];
  readonly domain: KbDomain;
  readonly audience?: KbAudience;
  readonly confidentiality?: KbConfidentiality;
  readonly language: "fr"; // V1 FR-only
  readonly source: {
    readonly factoryId: string;
    readonly promptId: string;
    readonly modelUsed: string;
    readonly cost: number; // USD cents
    readonly generatedAt: string; // ISO
  };
}

export interface IngestResult {
  readonly accepted: boolean;
  readonly entryId?: string;
  readonly status: "duplicate" | "rejected" | "queued" | "published" | "team_review";
  readonly rejectReason?: string;
  readonly duplicateOfEntryId?: string;
}

const KILL_SWITCH_DEFAULT_REVIEW = process.env.KB_AUTO_PUBLISH !== "true"; // default OFF V1

/**
 * Entrée principale : ingère une payload factory.
 * Idempotent via `idempotencyKey`. Retourne `accepted=false` si rejet quality/PII/dedup/banned.
 */
export async function ingestEntry(payload: IngestPayload): Promise<IngestResult> {
  // ----- 1. Idempotency check -----
  const existing = await prisma.knowledgeIngestRequest.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
    select: { entryId: true, status: true },
  });
  if (existing) {
    return {
      accepted: existing.status === "published" || existing.status === "team_review",
      status:
        existing.status === "published" ? "duplicate" : (existing.status as IngestResult["status"]),
      ...(existing.entryId ? { entryId: existing.entryId } : {}),
    };
  }

  // Enregistre la demande (audit trace, idempotence even on errors)
  await prisma.knowledgeIngestRequest.create({
    data: {
      idempotencyKey: payload.idempotencyKey,
      factoryId: payload.source.factoryId,
      status: "queued",
    },
  });

  // ----- 2. Banned words gate -----
  const bannedCheck = checkTranslationBannedWords({
    title: payload.title,
    excerpt: payload.excerpt ?? null,
    body: payload.body,
    bodyText: payload.bodyText ?? null,
  });
  if (!bannedCheck.valid) {
    await rejectIngest(
      payload.idempotencyKey,
      `Banned words: ${bannedCheck.fieldViolations.map((v) => v.field).join(", ")}`,
    );
    return { accepted: false, status: "rejected", rejectReason: "banned_words" };
  }

  // ----- 3. PII scan -----
  const piiFields = [payload.title, payload.excerpt ?? "", payload.body, payload.bodyText ?? ""]
    .filter(Boolean)
    .join(" ");
  const piiResult = detectPii(piiFields);
  if (piiResult.hasPii) {
    await rejectIngest(
      payload.idempotencyKey,
      `PII detected: ${piiResult.matches.map((m) => m.kind).join(", ")}`,
    );
    return { accepted: false, status: "rejected", rejectReason: "pii_detected" };
  }

  // ----- 4. Alt text gate (WCAG 2.2 AA 1.1.1) -----
  const altCheck = validateAltText(payload.body);
  if (!altCheck.valid) {
    await rejectIngest(
      payload.idempotencyKey,
      `Alt text manquant : ${altCheck.imagesWithoutAlt}/${altCheck.totalImages} images`,
    );
    return { accepted: false, status: "rejected", rejectReason: "alt_text_violation" };
  }

  // ----- 5. Heuristic quality gates -----
  const heuristics = runHeuristicGates({
    type: payload.type,
    title: payload.title,
    body: payload.body,
    bodyText: payload.bodyText ?? null,
  });
  if (!heuristics.valid) {
    await rejectIngest(
      payload.idempotencyKey,
      `Quality: ${heuristics.violations.map((v) => v.gate).join(", ")}`,
    );
    return {
      accepted: false,
      status: "rejected",
      rejectReason: heuristics.violations[0]?.gate ?? "quality",
    };
  }

  // ----- 6. Dedup pgvector -----
  const embeddingInput = buildEmbeddingInput({
    title: payload.title,
    excerpt: payload.excerpt ?? null,
    bodyText: payload.bodyText ?? null,
  });
  const embedding = await generateEmbedding(embeddingInput, payload.confidentiality ?? "public");
  const dedup = await findSimilarEntries({
    embedding: embedding.embedding,
    type: payload.type,
    topK: 5,
  });
  if (dedup.action === "reject") {
    await rejectIngest(
      payload.idempotencyKey,
      `Dedup match ≥ ${DEDUP_REJECT_THRESHOLD}: ${dedup.matches[0]!.slug}`,
    );
    return {
      accepted: false,
      status: "rejected",
      rejectReason: "dedup_match",
      duplicateOfEntryId: dedup.matches[0]!.entryId,
    };
  }

  // ----- 7. Création KnowledgeEntry + KnowledgeTranslation + KnowledgeEmbedding -----
  const slug = await generateUniqueSlug(payload.title, payload.idempotencyKey);
  const autoPublish = !KILL_SWITCH_DEFAULT_REVIEW;
  const targetStatus = autoPublish ? "published" : "draft";
  const targetAudience = autoPublish ? (payload.audience ?? "public") : "team";

  try {
    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.knowledgeEntry.create({
        data: {
          type: payload.type,
          domain: payload.domain,
          audience: targetAudience,
          confidentiality: payload.confidentiality ?? "public",
          status: targetStatus,
          pipelineStage: autoPublish ? "published" : "draft",
          slug,
          publishedAt: autoPublish ? new Date() : null,
          // Source tracking factory
          sourceFactoryId: payload.source.factoryId,
          sourcePromptId: payload.source.promptId,
          sourceModelUsed: payload.source.modelUsed,
          sourceCostCents: Math.round(payload.source.cost),
          sourceGeneratedAt: new Date(payload.source.generatedAt),
        },
        select: { id: true, type: true },
      });

      const translation = await tx.knowledgeTranslation.create({
        data: {
          entryId: entry.id,
          locale: "fr",
          title: payload.title,
          slug,
          excerpt: payload.excerpt ?? null,
          body: payload.body,
          bodyText: payload.bodyText ?? null,
          ...(payload.bodyJson != null
            ? { bodyJson: payload.bodyJson as Prisma.InputJsonValue }
            : {}),
        },
        select: { id: true },
      });

      // Persiste embedding pour dedup futur
      const vectorLiteral = `[${embedding.embedding.join(",")}]`;
      await tx.$executeRawUnsafe(
        `INSERT INTO knowledge_embeddings (id, translation_id, embedding, model, model_version, dimensionality, embedded_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::vector, $3, $4, $5, NOW())`,
        translation.id,
        vectorLiteral,
        EMBEDDING_MODEL_NAME,
        embedding.modelVersion,
        EMBEDDING_DIMENSION,
      );

      // Tags optionnels (upsert)
      if (payload.tags && payload.tags.length > 0) {
        for (const slugTag of payload.tags) {
          const tag = await tx.knowledgeTag.upsert({
            where: { slug: slugTag },
            create: { slug: slugTag, nameFr: slugTag, nameEn: slugTag },
            update: {},
          });
          await tx.knowledgeTagOnEntry.create({
            data: { entryId: entry.id, tagId: tag.id },
          });
        }
      }

      return { ...entry, translationId: translation.id };
    });

    // KB-14 V4 : hook auto-SEO/AEO/GEO post-création (non-bloquant en cas d'erreur)
    try {
      await refreshSeoCacheForTranslation(created.translationId);
    } catch (seoErr) {
      console.error(
        `[kb-ingest] refreshSeoCacheForTranslation failed for ${created.translationId}:`,
        seoErr instanceof Error ? seoErr.message : seoErr,
      );
    }

    await prisma.knowledgeIngestRequest.update({
      where: { idempotencyKey: payload.idempotencyKey },
      data: {
        entryId: created.id,
        status: autoPublish ? "published" : "team_review",
        completedAt: new Date(),
      },
    });

    // KB-17 V4 : audit log immuable (non-bloquant)
    try {
      await appendAudit({
        eventKind: autoPublish ? "publish" : "ingest_accepted",
        entryId: created.id,
        actor: payload.source.factoryId,
        payload: {
          idempotencyKey: payload.idempotencyKey,
          type: payload.type,
          domain: payload.domain,
          source: payload.source,
          autoPublish,
          slug,
        },
      });
    } catch (auditErr) {
      console.error(
        `[kb-ingest] appendAudit failed for ${created.id}:`,
        auditErr instanceof Error ? auditErr.message : auditErr,
      );
    }

    return {
      accepted: true,
      entryId: created.id,
      status: autoPublish ? "published" : "team_review",
    };
  } catch (err) {
    await rejectIngest(
      payload.idempotencyKey,
      err instanceof Error ? err.message : String(err),
      "failed",
    );
    return { accepted: false, status: "rejected", rejectReason: "internal" };
  }
}

async function rejectIngest(
  idempotencyKey: string,
  reason: string,
  status: "rejected" | "failed" = "rejected",
): Promise<void> {
  await prisma.knowledgeIngestRequest.update({
    where: { idempotencyKey },
    data: { status, rejectReason: reason, completedAt: new Date() },
  });
  // KB-17 V4 : trace audit non-bloquante
  try {
    await appendAudit({
      eventKind: "ingest_rejected",
      entryId: null,
      actor: "system",
      payload: { idempotencyKey, reason, status },
    });
  } catch (err) {
    console.error("[kb-ingest] audit rejet failed:", err instanceof Error ? err.message : err);
  }
}

async function generateUniqueSlug(title: string, idempotencyKey: string): Promise<string> {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);

  const candidate = base || `factory-${idempotencyKey.slice(0, 8)}`;

  const existing = await prisma.knowledgeEntry.findUnique({
    where: { slug: candidate },
    select: { id: true },
  });
  if (!existing) return candidate;

  return `${candidate}-${idempotencyKey.slice(0, 8)}`;
}
