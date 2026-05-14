/**
 * Content Generator — KB V4 feeder (Sprint 5 AGT-H — § 11.1 master prompt v2.5).
 *
 * Écriture vers KB V4 via POST /api/internal/kb/ingest HMAC + idempotency UUID v4.
 * Le content-gen NE FAIT JAMAIS de prisma.knowledgeEntry.create direct.
 *
 * Gates appliqués côté KB (autoritaires) :
 * 1. PII scan (bloquant)
 * 2. Banned words (bloquant)
 * 3. Heuristic quality gates (bloquant)
 * 4. Dedup pgvector cosine ≥ 0.92 (bloquant)
 *
 * Réponses :
 * - 202 → entry queuée/processed (return accepted: true + entryId)
 * - 422 → quality/PII/banned/dedup gate failed (rejet définitif)
 * - 409 → idempotency conflict (jamais en théorie car UUID v4)
 */

import { randomUUID } from "node:crypto";
import { computeKbSignature } from "@/lib/knowledge/hmac";
import type { ContentType, KbType } from "../../../prisma/generated/client";

/**
 * Mapping ContentType → KbType (§ 11.0 master prompt v2.5).
 *
 * Sprint 5 (2026-05-14) — arbitrage confirmé : `blog_from_rss` → `article` (et
 * non un nouvel enum `news_brief`). Raisons :
 *  - Volume actualités RSS V1 reste faible (< 50/jour estimé) → pas besoin
 *    d'un domaine KbType dédié.
 *  - `article` est déjà l'enum legacy V3 + utilisé par blog_article/keywords/
 *    title → cohérence.
 *  - Tag interne `news` peut être ajouté en `tags` côté KB ingest si besoin
 *    de filtrer ultérieurement.
 *
 * Si volume RSS dépasse 500/jour en V2 (industrialisation 2150 villes), un
 * ADR dédié arbitrera l'ajout de `news_brief` à l'enum KbType.
 */
const CONTENT_TYPE_TO_KB_TYPE: Record<ContentType, KbType> = {
  landing_ville: "industry_use_case",
  blog_article: "article",
  blog_from_rss: "article",
  blog_from_keywords: "article",
  blog_from_title: "article",
  comparison: "comparison",
  guide_pilier: "implementation_playbook",
  qa_derived: "faq",
  faq_standalone: "faq",
};

export interface KbIngestPayload {
  readonly contentType: ContentType;
  readonly title: string;
  readonly body: string;
  readonly bodyJson?: unknown;
  readonly bodyText?: string;
  readonly excerpt?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly factoryId: string;
  readonly promptId: string;
  readonly modelUsed: string;
  readonly costCents: number;
  readonly generatedAt: Date;
}

export interface KbIngestResult {
  readonly accepted: boolean;
  readonly entryId?: string;
  readonly status: string;
  readonly rejectReason?: string;
}

/**
 * Publie un contenu généré dans la KB V4 via API HMAC.
 * Throw uniquement si erreur réseau / config (pas si rejet 422 — return result).
 */
export async function publishToKB(payload: KbIngestPayload): Promise<KbIngestResult> {
  const secret = process.env.KB_INGEST_SECRET;
  if (!secret || secret.length < 32) {
    return {
      accepted: false,
      status: "config_missing",
      rejectReason: "KB_INGEST_SECRET not set or < 32 chars",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const idempotencyKey = randomUUID();

  const body = {
    type: CONTENT_TYPE_TO_KB_TYPE[payload.contentType],
    title: payload.title,
    body: payload.body,
    ...(payload.bodyJson !== undefined ? { bodyJson: payload.bodyJson } : {}),
    ...(payload.bodyText !== undefined ? { bodyText: payload.bodyText } : {}),
    ...(payload.excerpt !== undefined ? { excerpt: payload.excerpt } : {}),
    ...(payload.tags && payload.tags.length > 0 ? { tags: [...payload.tags] } : {}),
    domain: "commercial" as const, // V1 par défaut — V2 inferDomain depuis contentType
    audience: "public" as const,
    confidentiality: "public" as const,
    language: "fr" as const,
    source: {
      factoryId: payload.factoryId,
      promptId: payload.promptId,
      modelUsed: payload.modelUsed,
      cost: payload.costCents,
      generatedAt: payload.generatedAt.toISOString(),
    },
  };

  const rawBody = JSON.stringify(body);
  const signature = computeKbSignature(rawBody, secret);

  const res = await fetch(`${siteUrl}/api/internal/kb/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-KB-Signature": signature,
      "X-Idempotency-Key": idempotencyKey,
    },
    body: rawBody,
  });

  if (res.status === 202) {
    const data = (await res.json()) as { entryId?: string; status?: string };
    return {
      accepted: true,
      status: data.status ?? "accepted",
      ...(data.entryId ? { entryId: data.entryId } : {}),
    };
  }

  if (res.status === 422) {
    const errBody = (await res.json()) as { status?: string; rejectReason?: string };
    return {
      accepted: false,
      status: errBody.status ?? "rejected",
      ...(errBody.rejectReason ? { rejectReason: errBody.rejectReason } : {}),
    };
  }

  if (res.status === 409) {
    return {
      accepted: false,
      status: "idempotency_conflict",
      rejectReason: `409 — UUID collision (rare)`,
    };
  }

  // Autres erreurs (auth, 5xx) → relancer pour retry upstream
  const errText = await res.text();
  throw new Error(`KB ingest failed ${res.status}: ${errText.slice(0, 200)}`);
}
