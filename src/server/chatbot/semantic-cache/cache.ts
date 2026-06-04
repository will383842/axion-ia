// Cache sémantique (T-26 / T-27, ADR-CB-05) — évite un appel LLM quand une
// question proche a déjà été répondue.
//
// Lookup : embed la question → cosine top-1 dans chat_semantic_cache (filtré
// tenant + version de knowledge COURANTE + non expiré) ; hit si similarité ≥
// seuil tenant. Write : mémorise la réponse + son embedding + TTL + version.
//
// Invalidation par version (T-27) : `knowledge_version` = max(version) des chunks
// actifs du tenant. Quand l'ingestion bumpe la version, les entrées d'une version
// antérieure ne matchent plus → invalidées de facto (et purgées par la rétention).
//
// Repli gracieux : si l'embedding est indisponible (Voyage down / pas de clé) ou
// le cache désactivé, lookup/write sont des no-op silencieux (jamais de crash).
// Tout est paramétré ($queryRaw/$executeRaw) → pas d'injection SQL. Runtime-only
// (jamais au build SSG) → contrat stub.invalid respecté.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/knowledge/embeddings";
import type { TenantSettings } from "@/server/chatbot/constants";

export interface CachedAnswer {
  readonly reponse: string;
  readonly sources: ReadonlyArray<{ sourceType: string; sourceRef: string }>;
}

interface CacheRow {
  id: string;
  reponse: string;
  sources: unknown;
  sim: number;
}

/** Embedding → littéral pgvector, ou null si indisponible (repli gracieux). */
async function embedToLiteral(text: string): Promise<string | null> {
  try {
    const { embedding } = await generateEmbedding(text);
    return `[${embedding.join(",")}]`;
  } catch (err) {
    console.warn("[chatbot:cache] embedding indisponible:", err);
    return null;
  }
}

/** Version de knowledge courante du tenant (max des chunks actifs, défaut 1). */
async function currentKnowledgeVersion(tenantId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ v: number }>>`
    SELECT COALESCE(MAX("version"), 1)::int AS v
    FROM "chat_kb_chunks"
    WHERE "tenant_id" = ${tenantId}::uuid AND "actif" = true
  `;
  return rows[0]?.v ?? 1;
}

/**
 * Cherche une réponse en cache pour une question proche (cosine ≥ seuil tenant),
 * à la version de knowledge courante. Incrémente `hits` sur hit. Renvoie null
 * (miss) si cache désactivé, embedding indisponible, ou aucune entrée assez proche.
 */
export async function lookupSemanticCache(
  tenantId: string,
  question: string,
  settings: TenantSettings,
): Promise<CachedAnswer | null> {
  if (!settings.cache.enabled) return null;

  const literal = await embedToLiteral(question);
  if (!literal) return null;

  const version = await currentKnowledgeVersion(tenantId);
  const rows = await prisma.$queryRaw<CacheRow[]>`
    SELECT "id", "reponse", "sources",
           (1 - ("question_embedding" <=> ${literal}::vector)) AS sim
    FROM "chat_semantic_cache"
    WHERE "tenant_id" = ${tenantId}::uuid
      AND "knowledge_version" = ${version}
      AND "question_embedding" IS NOT NULL
      AND ("valide_jusqu" IS NULL OR "valide_jusqu" > now())
    ORDER BY "question_embedding" <=> ${literal}::vector
    LIMIT 1
  `;

  const top = rows[0];
  if (!top || top.sim < settings.cache.similarityThreshold) return null;

  await prisma.$executeRaw`
    UPDATE "chat_semantic_cache" SET "hits" = "hits" + 1 WHERE "id" = ${top.id}::uuid
  `;

  const sources = Array.isArray(top.sources)
    ? (top.sources as Array<{ sourceType: string; sourceRef: string }>)
    : [];
  return { reponse: top.reponse, sources };
}

/**
 * Mémorise une réponse dans le cache sémantique (TTL tenant, version courante).
 * No-op si cache désactivé ou embedding indisponible.
 */
export async function writeSemanticCache(
  tenantId: string,
  question: string,
  answer: CachedAnswer,
  settings: TenantSettings,
): Promise<void> {
  if (!settings.cache.enabled) return;

  const literal = await embedToLiteral(question);
  if (!literal) return;

  const version = await currentKnowledgeVersion(tenantId);
  const valideJusqu = new Date(Date.now() + settings.cache.ttlHours * 3_600_000);
  const id = randomUUID();
  const sourcesJson = JSON.stringify(answer.sources);

  await prisma.$executeRaw`
    INSERT INTO "chat_semantic_cache"
      ("id", "tenant_id", "question", "question_embedding", "reponse", "sources",
       "valide_jusqu", "hits", "knowledge_version", "created_at")
    VALUES
      (${id}::uuid, ${tenantId}::uuid, ${question}, ${literal}::vector, ${answer.reponse},
       ${sourcesJson}::jsonb, ${valideJusqu}, 0, ${version}, now())
  `;
}

/**
 * Purge les entrées de cache d'une version de knowledge antérieure à la version
 * courante (T-27 — invalidation explicite, à appeler après une ré-ingestion).
 * Retourne le nombre de lignes supprimées.
 */
export async function invalidateStaleCache(tenantId: string): Promise<number> {
  const version = await currentKnowledgeVersion(tenantId);
  const deleted = await prisma.$executeRaw`
    DELETE FROM "chat_semantic_cache"
    WHERE "tenant_id" = ${tenantId}::uuid AND "knowledge_version" < ${version}
  `;
  return Number(deleted);
}
