/**
 * Content Generator — Persist Article Embedding (V-09 wiring 2026-05-22).
 *
 * Wraps `embed()` du OpenAI embedder et écrit le vecteur 1536 dim dans
 * `articles.embedding` via $executeRaw (champ Unsupported pgvector).
 *
 * Best-effort post-publish : appelé en fire-and-forget après création article.
 *  - Si `OPENAI_EMBEDDINGS_ENABLED` != "true" → no-op silent (default OFF).
 *  - Si daily cap atteint OU erreur API → no-op log warn (publish continue).
 *  - Aucun throw : ne JAMAIS bloquer la publication article sur cet appel.
 *
 * Cost cap : ~$0.13/1M tokens via text-embedding-3-large (cf openai-embedder.ts).
 *
 * Activation V-09 prod :
 *  1. `OPENAI_EMBEDDINGS_ENABLED=true` Coolify env vars
 *  2. Lancer backfill historique : `pnpm tsx src/scripts/backfill-embeddings.ts`
 *  3. À partir de là, chaque nouvel article publié sera embedded automatiquement
 *     → couche 4 dedup (cosine similarity) opérationnelle pour futures comparaisons.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import { embed, buildEmbeddingInput, OPENAI_EMBEDDING_DIMENSION } from "./openai-embedder";
import { embedVoyage, VOYAGE_EMBEDDING_DIMENSION } from "./voyage-embedder";
import { getEmbeddingProvider } from "./embedding-provider";

export interface PersistArticleEmbeddingInput {
  readonly articleId: string;
  readonly title: string;
  readonly metaDescription?: string;
  readonly bodyText?: string;
}

export interface PersistArticleEmbeddingResult {
  readonly persisted: boolean;
  readonly reason: "ok" | "disabled" | "no_embedding" | "db_error" | "exception";
  readonly tokensUsed?: number;
  readonly dimensions?: number;
}

/**
 * Calcule l'embedding du contenu article et persiste dans articles.embedding.
 *
 * Le fournisseur vient de `CONTENT_EMBEDDING_PROVIDER` (PR4) :
 *  - `openai` (défaut) : comportement historique, colonne `embedding` (1536).
 *  - `voyage` : Voyage voyage-3, colonne `embedding_voyage` (1024). Clé absente ou
 *    panne Voyage → warning journalisé, colonne laissée NULL (rattrapée par le worker),
 *    la publication continue.
 *
 * Garantit : ne throw JAMAIS. Retourne un résultat structuré pour logging.
 * Le caller doit traiter `persisted=false` comme non-bloquant.
 */
export async function persistArticleEmbedding(
  prisma: PrismaClient,
  input: PersistArticleEmbeddingInput,
): Promise<PersistArticleEmbeddingResult> {
  try {
    const text = buildEmbeddingInput({
      title: input.title,
      ...(input.metaDescription ? { metaDescription: input.metaDescription } : {}),
      ...(input.bodyText ? { bodyText: input.bodyText } : {}),
    });

    const provider = getEmbeddingProvider();
    const result = provider === "voyage" ? await embedVoyage(text) : await embed(text);
    if (result === null) {
      if (provider === "voyage") {
        console.warn(
          JSON.stringify({
            event: "persist_article_embedding_voyage_unavailable",
            articleId: input.articleId,
            note: "embedding_voyage laissé NULL, rattrapage par le worker",
          }),
        );
      }
      return { persisted: false, reason: "disabled" };
    }

    if (provider === "voyage") {
      if (result.embedding.length !== VOYAGE_EMBEDDING_DIMENSION) {
        return { persisted: false, reason: "no_embedding", dimensions: result.embedding.length };
      }
      const voyageLiteral = `[${result.embedding.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE articles
        SET embedding_voyage = ${voyageLiteral}::vector
        WHERE id = ${input.articleId}::uuid
      `;
      return {
        persisted: true,
        reason: "ok",
        tokensUsed: result.tokensUsed,
        dimensions: result.embedding.length,
      };
    }

    if (result.embedding.length !== OPENAI_EMBEDDING_DIMENSION) {
      return {
        persisted: false,
        reason: "no_embedding",
        dimensions: result.embedding.length,
      };
    }

    // pgvector attend `[0.1,0.2,...]` en string + cast ::vector.
    const vectorLiteral = `[${result.embedding.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE articles
      SET embedding = ${vectorLiteral}::vector
      WHERE id = ${input.articleId}::uuid
    `;

    return {
      persisted: true,
      reason: "ok",
      tokensUsed: result.tokensUsed,
      dimensions: result.embedding.length,
    };
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "persist_article_embedding_error",
        articleId: input.articleId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { persisted: false, reason: "exception" };
  }
}
