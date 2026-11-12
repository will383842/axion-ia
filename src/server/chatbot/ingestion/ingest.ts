// Cœur d'ingestion RAG (T-05) — chunk → embed → upsert chat_kb_chunks.
//
// Stratégie idempotente : reconstruction complète par run → ré-ingestion = même
// résultat, zéro chunk périmé. « Jamais de base vide » : on chunke et on embedde
// TOUT d'abord (appels API, hors transaction), puis une seule transaction
// remplace les chunks du tenant (DELETE + INSERT atomiques). Une panne
// d'embedding laisse donc la base existante intacte. La colonne
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

type Executeur = Pick<typeof prisma, "$executeRaw">;

interface ChunkPrepare {
  readonly src: IngestSource;
  readonly ref: string;
  readonly contenu: string;
  readonly contexte: string | null;
  readonly embedding: readonly number[];
}

/** Insère les chunks d'une source (déjà chunkée + embeddée). */
async function insertChunk(
  db: Executeur,
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
  await db.$executeRaw`
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

  // Phase 1 — tout préparer (chunk + embedding) SANS toucher à la base.
  const prepares: ChunkPrepare[] = [];
  for (const src of sources) {
    const chunks = chunkText(src.contenu, { contextLabel: src.contexte });
    for (const ch of chunks) {
      // Refus confidentialité géré dans embedChatbotText (et déjà filtré en amont).
      const emb = await embedChatbotText(ch.contenu, src.confidentiality);
      // Un vecteur de repli factice (« -stub ») ne doit jamais remplacer la base réelle.
      if (process.env.NODE_ENV !== "test" && emb.modelVersion?.endsWith("-stub")) {
        throw new Error(
          "[chatbot:ingest] embedding de repli (-stub) : reconstruction refusée, base conservée.",
        );
      }
      const { embedding } = emb;
      const ref = chunks.length > 1 ? `${src.sourceRef}#${ch.index}` : src.sourceRef;
      prepares.push({ src, ref, contenu: ch.contenu, contexte: ch.contexte ?? null, embedding });
    }
  }
  if (prepares.length === 0) {
    throw new Error("[chatbot:ingest] aucun chunk à écrire : la base existante est conservée.");
  }

  // Phase 2 — remplacement atomique : si une insertion échoue, la transaction
  // est annulée et les anciens chunks restent en place.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`DELETE FROM "chat_kb_chunks" WHERE "tenant_id" = ${tenant.id}::uuid`;
      for (const p of prepares) {
        await insertChunk(
          tx,
          tenant.id,
          p.src,
          p.ref,
          p.contenu,
          p.contexte,
          p.embedding,
          newVersion,
        );
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  const chunkCount = prepares.length;

  return {
    tenantId: tenant.id,
    sources: sources.length,
    chunks: chunkCount,
    durationMs: Date.now() - start,
  };
}
