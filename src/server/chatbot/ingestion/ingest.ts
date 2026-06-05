// Cœur d'ingestion RAG (T-05) — chunk → embed → upsert chat_kb_chunks.
//
// Stratégie idempotente : reconstruction complète par run (DELETE tenant chunks
// puis INSERT) → ré-ingestion = même résultat, zéro chunk périmé. La colonne
// `tsv` est GÉNÉRÉE (fr_unaccent) → non insérée. `embedding` inséré via vecteur
// paramétré ::vector (pas d'injection SQL). FR-only.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { embedChatbotText } from "@/server/chatbot/embeddings";
import { getDefaultTenant } from "@/server/chatbot/tenant";
import { chunkText } from "@/server/chatbot/ingestion/chunker";
import { gatherSources, type IngestSource } from "@/server/chatbot/ingestion/seed-sources";

export interface IngestStats {
  readonly tenantId: string;
  readonly sources: number;
  readonly chunks: number;
  readonly durationMs: number;
}

/** Insère les chunks d'une source (déjà chunkée + embeddée). */
async function insertChunk(
  tenantId: string,
  src: IngestSource,
  ref: string,
  contenu: string,
  contexte: string | null,
  embedding: readonly number[],
  version: number,
): Promise<void> {
  const vectorLiteral = `[${embedding.join(",")}]`;
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "chat_kb_chunks"
      ("id", "tenant_id", "source_type", "source_ref", "categorie", "priorite",
       "contenu", "contexte", "embedding", "version", "actif", "created_at", "updated_at")
    VALUES
      (${id}::uuid, ${tenantId}::uuid, ${src.sourceType}, ${ref}, ${src.categorie}, 'moyenne',
       ${contenu}, ${contexte}, ${vectorLiteral}::vector, ${version}, true, now(), now())
  `;
}

/**
 * Ingestion complète (reconstruction) pour le tenant par défaut.
 * `sourcesOverride` injectable pour les tests (sinon gatherSources()).
 */
export async function ingestAllSources(
  sourcesOverride?: ReadonlyArray<IngestSource>,
): Promise<IngestStats> {
  const start = Date.now();
  const tenant = await getDefaultTenant();
  if (!tenant) {
    throw new Error("[chatbot:ingest] tenant par défaut introuvable (seed T-03 requis).");
  }
  const sources = sourcesOverride ?? (await gatherSources());

  // Bump de version (T-27) : chaque reconstruction insère à une version > précédente.
  // Le cache sémantique ne matche que la version COURANTE (max des chunks actifs)
  // → les entrées de cache d'une version antérieure sont invalidées de facto après
  // une ré-ingestion (et purgées par la rétention). Sans ce bump, le cache pourrait
  // servir des réponses périmées jusqu'à expiration du TTL.
  const verRows = await prisma.$queryRaw<Array<{ v: number }>>`
    SELECT COALESCE(MAX("version"), 0)::int AS v
    FROM "chat_kb_chunks" WHERE "tenant_id" = ${tenant.id}::uuid
  `;
  const newVersion = (verRows[0]?.v ?? 0) + 1;

  // Reconstruction idempotente : on purge les chunks du tenant avant insert.
  await prisma.$executeRaw`DELETE FROM "chat_kb_chunks" WHERE "tenant_id" = ${tenant.id}::uuid`;

  let chunkCount = 0;
  for (const src of sources) {
    const chunks = chunkText(src.contenu, { contextLabel: src.contexte });
    for (const ch of chunks) {
      // Refus confidentialité géré dans embedChatbotText (et déjà filtré en amont).
      const { embedding } = await embedChatbotText(ch.contenu, src.confidentiality);
      const ref = chunks.length > 1 ? `${src.sourceRef}#${ch.index}` : src.sourceRef;
      await insertChunk(
        tenant.id,
        src,
        ref,
        ch.contenu,
        ch.contexte ?? null,
        embedding,
        newVersion,
      );
      chunkCount++;
    }
  }

  return {
    tenantId: tenant.id,
    sources: sources.length,
    chunks: chunkCount,
    durationMs: Date.now() - start,
  };
}
