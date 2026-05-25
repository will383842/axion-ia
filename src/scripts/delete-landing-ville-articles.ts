/**
 * Script de cleanup — supprime tous les Articles `landing_ville` en DB
 * + leurs ContentGenJob associés + ReviewQueue/GenerationLog (cascade).
 *
 * Usage:
 *   pnpm tsx src/scripts/delete-landing-ville-articles.ts
 *   pnpm tsx src/scripts/delete-landing-ville-articles.ts --dry-run
 *
 * Cascade :
 *   - Article.id supprimé → ArticleTranslation cascade (onDelete: Cascade)
 *   - ContentGenJob.id supprimé → ReviewQueue + GenerationLog + ContentCitation cascade
 *
 * Anti-régression : les fichiers statiques `src/content/villes/copy/*.ts`
 * NE SONT PAS touchés (manuel curatié).
 */
import { prisma } from "@/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  console.log(`\n[delete-landing-ville-articles] mode: ${DRY_RUN ? "DRY-RUN" : "REAL DELETE"}\n`);

  // 1. Trouver tous les ContentGenJob landing_ville
  const jobs = await prisma.contentGenJob.findMany({
    where: { contentType: "landing_ville" },
    select: {
      id: true,
      idempotencyKey: true,
      anchorVilleSlug: true,
      status: true,
      outputBlogPostId: true,
      createdAt: true,
    },
  });

  console.log(`Found ${jobs.length} ContentGenJob with contentType=landing_ville`);

  if (jobs.length === 0) {
    console.log("No ContentGenJob to delete. Checking orphan Articles…");
  }

  // Group by ville pour rapport
  const byVille = new Map<string, number>();
  for (const j of jobs) {
    const key = j.anchorVilleSlug ?? "(no-ville)";
    byVille.set(key, (byVille.get(key) ?? 0) + 1);
  }
  if (byVille.size > 0) {
    console.log("\nBreakdown (ville → count):");
    for (const [k, v] of [...byVille.entries()].sort()) {
      console.log(`  ${k.padEnd(40, " ")} ${v}`);
    }
  }

  // 2. Récupérer les Article.id à supprimer
  // Source A : outputBlogPostId sur les jobs landing_ville
  // Source B : tous les Articles avec generatedByJobId pointant vers nos jobs
  // Source C (NEW) : tous les Articles avec templateVariant in [interventions, audits, …]
  //   (fallback si jobs déjà supprimés mais Articles orphelins restent)
  const articleIdsFromJobs = jobs
    .map((j) => j.outputBlogPostId)
    .filter((id): id is string => id !== null);
  const jobIds = jobs.map((j) => j.id);
  const articlesByGenerated =
    jobIds.length > 0
      ? await prisma.article.findMany({
          where: { generatedByJobId: { in: jobIds } },
          select: { id: true },
        })
      : [];
  const VERTICAL_VARIANTS = [
    "interventions",
    "audits",
    "implementations",
    "un-a-un",
    "sites-web-ia",
  ];
  const articlesByVertical = await prisma.article.findMany({
    where: { templateVariant: { in: VERTICAL_VARIANTS } },
    select: { id: true, templateVariant: true },
  });
  const articleIdsFromBack = articlesByGenerated.map((a) => a.id);
  const articleIdsFromVertical = articlesByVertical.map((a) => a.id);
  const allArticleIds = [
    ...new Set([...articleIdsFromJobs, ...articleIdsFromBack, ...articleIdsFromVertical]),
  ];

  console.log(`\nArticles to delete: ${allArticleIds.length}`);
  console.log(`  via Job.outputBlogPostId:                    ${articleIdsFromJobs.length}`);
  console.log(`  via Article.generatedByJobId:                ${articleIdsFromBack.length}`);
  console.log(`  via Article.templateVariant in [vertical]:   ${articleIdsFromVertical.length}`);
  console.log(`  (deduped union:                              ${allArticleIds.length})`);

  if (allArticleIds.length === 0 && jobs.length === 0) {
    console.log("\nNothing to delete. Exiting clean.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] No deletion performed. Re-run without --dry-run to apply.");
    return;
  }

  // 3. Suppression dans une transaction
  await prisma.$transaction(async (tx) => {
    // 3a. Articles (cascade → ArticleTranslation, ArticleSlugHistory, etc.)
    if (allArticleIds.length > 0) {
      // Supprimer d'abord les FK manuelles (non-cascade)
      await tx.generationProvenance.deleteMany({
        where: { articleId: { in: allArticleIds } },
      });
      await tx.factCheckClaim.deleteMany({
        where: { articleId: { in: allArticleIds } },
      });
      await tx.articleFeedback.deleteMany({
        where: { articleId: { in: allArticleIds } },
      });
      const articleDel = await tx.article.deleteMany({
        where: { id: { in: allArticleIds } },
      });
      console.log(`  Deleted ${articleDel.count} Article (cascade translations)`);
    }

    // 3b. ContentGenJob (cascade → ReviewQueue, GenerationLog, ContentCitation)
    const jobDel = await tx.contentGenJob.deleteMany({
      where: { contentType: "landing_ville" },
    });
    console.log(`  Deleted ${jobDel.count} ContentGenJob (cascade RQ/GL/CC)`);
  });

  console.log("\n[delete-landing-ville-articles] DONE\n");
}

main()
  .catch((err) => {
    console.error("\n[FATAL]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
