#!/usr/bin/env npx tsx
/**
 * P1-10 — Backfill OpenAI embeddings pour les articles publiés sans embedding.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx src/scripts/backfill-embeddings.ts
 *   OPENAI_API_KEY=sk-... npx tsx src/scripts/backfill-embeddings.ts --dry-run
 *   OPENAI_API_KEY=sk-... npx tsx src/scripts/backfill-embeddings.ts --limit=100
 *
 * Coût estimé : ~$0.09 pour 1 000 articles
 *   (text-embedding-3-large, dimensions=1536, ~695 tokens/article moyen)
 *
 * IMPORTANT : activer seulement si OPENAI_EMBEDDINGS_ENABLED=true en prod.
 * Sans ce backfill, le dedup cosine (couche 4 pipeline B.7 P1.5) est aveugle
 * sur le corpus historique et peut laisser passer des doublons sémantiques.
 *
 * Le champ cible est `articles.embedding` de type vector(1536) (pgvector).
 * Prisma expose ce type via `Unsupported("vector(1536)")` — les écritures
 * passent donc par `prisma.$executeRaw`.
 */

import { PrismaClient } from "../../prisma/generated/client";
import OpenAI from "openai";

interface ArticleRow {
  id: string;
  title: string;
  content: string | null;
}

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 20; // 20 articles par batch pour éviter OOM + rate limits
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1] ?? "0", 10) || undefined : undefined;

/** Tronque le texte pour éviter de dépasser ~8000 tokens OpenAI (~32k chars). */
function buildEmbeddingText(title: string, content: string | null): string {
  const body = content?.slice(0, 6000) ?? "";
  return `${title}\n\n${body}`;
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[backfill-embeddings] ERREUR : OPENAI_API_KEY manquante");
    process.exit(1);
  }

  console.log(
    `[backfill-embeddings] Démarrage${DRY_RUN ? " (DRY-RUN — aucune écriture DB)" : ""}${LIMIT ? ` — limite ${LIMIT} articles` : ""}`,
  );

  // Récupérer les articles publiés dont l'embedding est NULL.
  // Note : Prisma ne supporte pas le filtrage `embedding IS NULL` directement
  // sur un champ Unsupported() — on passe par $queryRawUnsafe pour ce select.
  // Le résultat est limité à LIMIT (ou sans limite si undefined).
  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : "LIMIT ALL";
  const articles = (await prisma.$queryRawUnsafe(
    `SELECT a.id, t.title, t.content
     FROM articles a
     LEFT JOIN article_translations t ON t.article_id = a.id AND t.locale = 'fr'
     WHERE a.status = 'published'
       AND a.embedding IS NULL
     ORDER BY a.published_at DESC NULLS LAST
     ${limitClause}`,
  )) as ArticleRow[];

  console.log(`[backfill-embeddings] ${articles.length} articles à traiter`);

  if (articles.length === 0) {
    console.log("[backfill-embeddings] Rien à faire — tous les articles ont déjà un embedding.");
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Traitement par batches pour respecter les rate limits OpenAI.
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchEnd = Math.min(i + BATCH_SIZE, articles.length);

    if (DRY_RUN) {
      console.log(
        `[backfill-embeddings] DRY-RUN batch ${i + 1}-${batchEnd}/${articles.length} (${batch.length} articles)`,
      );
      skipped += batch.length;
      continue;
    }

    try {
      // Filtrer les articles sans titre (traduction FR absente).
      const validBatch = batch.filter((a) => a.title?.trim());
      if (validBatch.length < batch.length) {
        console.warn(
          `[backfill-embeddings] ${batch.length - validBatch.length} articles sans titre FR ignorés dans ce batch`,
        );
        skipped += batch.length - validBatch.length;
      }
      if (validBatch.length === 0) continue;

      const texts = validBatch.map((a) => buildEmbeddingText(a.title, a.content));

      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: texts,
        // 1536 dims : cohérent avec le schéma `vector(1536)` + index IVFFlat
        // (HNSW limité à 2000 dims, mais on reste sous cette limite de toute façon).
        dimensions: 1536,
      });

      // Upsert embedding article par article via $executeRaw (champ Unsupported pgvector).
      for (let j = 0; j < validBatch.length; j++) {
        const article = validBatch[j];
        if (!article) continue;
        const embeddingVector = response.data[j]?.embedding;
        if (!embeddingVector) {
          console.warn(
            `[backfill-embeddings] Pas d'embedding retourne pour l'article ${article.id}`,
          );
          errors++;
          continue;
        }

        // pgvector attend le format `[0.1,0.2,...]` en string pour le cast ::vector.
        const vectorLiteral = `[${embeddingVector.join(",")}]`;

        await prisma.$executeRaw`
          UPDATE articles
          SET embedding = ${vectorLiteral}::vector
          WHERE id = ${article.id}::uuid
        `;
        processed++;
      }

      console.log(
        `[backfill-embeddings] Batch ${i + 1}-${batchEnd} OK — ${processed} traités au total`,
      );

      // Pause 1s entre batches pour respecter les rate limits OpenAI (3 000 RPM tier-1).
      if (i + BATCH_SIZE < articles.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`[backfill-embeddings] Erreur batch ${i + 1}-${batchEnd}:`, err);
      errors++;
    }
  }

  console.log(
    `[backfill-embeddings] Terminé — ${processed} embeddings écrits, ${skipped} ignorés, ${errors} erreurs`,
  );

  if (errors > 0) {
    console.warn(
      "[backfill-embeddings] Des erreurs ont été détectées. Relancer le script : les articles déjà traités (embedding non NULL) seront automatiquement skippés.",
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[backfill-embeddings] Erreur fatale:", err);
  void prisma.$disconnect();
  process.exit(1);
});
