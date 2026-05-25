/**
 * Test réel — génère VilleHubCopy pour Paris + auto-approve si quality ≥ 70.
 *
 * Usage:
 *   pnpm tsx src/scripts/test-ville-hub-copy-paris.ts
 *
 * Pré-requis :
 *   - paris.ts backupé en paris.ts.bak-auto-test (sinon static prend priorité)
 *   - ANTHROPIC_API_KEY ou OPENAI_API_KEY dans .env.local
 *   - DATABASE_URL accessible
 *
 * Sortie :
 *   - GeneratedVilleCopy row upsert sur Paris (status=approved si auto-approve)
 *   - Stats console : score, coût, tokens, issues
 */
import { generateVilleHubCopy } from "@/server/content-gen/generators/ville-hub-copy";
import { prisma } from "@/lib/prisma";

const VILLE_SLUG = "paris";
const AUTO_APPROVE_THRESHOLD = 70;

async function main(): Promise<void> {
  console.log(`\n[test-ville-hub-copy-paris] starting…\n`);

  const t0 = Date.now();
  const result = await generateVilleHubCopy({ villeSlug: VILLE_SLUG });
  const durationMs = Date.now() - t0;

  console.log(`\n[result]`);
  console.log(`  villeSlug      : ${result.villeSlug}`);
  console.log(`  qualityScore   : ${result.qualityScore}/100`);
  console.log(`  modelUsed      : ${result.modelUsed}`);
  console.log(`  totalCostUsd   : $${result.totalCostUsd.toFixed(4)}`);
  console.log(`  tokensInput    : ${result.tokensInput}`);
  console.log(`  tokensOutput   : ${result.tokensOutput}`);
  console.log(`  durationMs     : ${durationMs} ms`);
  console.log(`  KB facts used  : ${result.kbContextUsed.length}`);

  console.log(`\n[output preview]`);
  console.log(`  pitchFr        : "${result.output.pitchFr}"`);
  console.log(`  directAnswerFr : "${result.output.directAnswerFr}"`);
  console.log(`  ecosystemFr    : "${result.output.ecosystemFr}"`);
  console.log(`  distancesFr    : "${result.output.distancesFr}"`);
  console.log(`  topSectorsNaf  : ${JSON.stringify(result.output.topSectorsNaf)}`);
  console.log(`  servicesContext.audit.fr        : "${result.output.servicesContext.audit.fr}"`);
  console.log(
    `  servicesContext.interventions.fr: "${result.output.servicesContext.interventions.fr}"`,
  );
  console.log(
    `  servicesContext.implementation.fr: "${result.output.servicesContext.implementation.fr}"`,
  );
  console.log(`  servicesContext.unAUn.fr        : "${result.output.servicesContext.unAUn.fr}"`);
  console.log(`  faqGeolocalisee count : ${result.output.faqGeolocalisee.length}`);
  result.output.faqGeolocalisee.forEach((f, i) => {
    console.log(`    [${i}] Q: ${f.q}`);
    console.log(`        A: ${f.a}`);
  });
  if (result.output.heroSchema) {
    console.log(`  heroSchema     : ${result.output.heroSchema.satellites.length} satellites`);
    console.log(`  centerSubLabel : ${result.output.heroSchema.centerSubLabel ?? "(absent)"}`);
  }

  // Auto-approve si score ≥ threshold
  if (result.qualityScore >= AUTO_APPROVE_THRESHOLD) {
    await prisma.generatedVilleCopy.update({
      where: { villeSlug: VILLE_SLUG },
      data: {
        status: "approved",
        reviewedBy: "auto:test-script",
        reviewedAt: new Date(),
        reviewNotes: `Auto-approved (score ${result.qualityScore} >= ${AUTO_APPROVE_THRESHOLD}) — test-ville-hub-copy-paris.ts`,
      },
    });
    console.log(`\n✅ Auto-approved (score ${result.qualityScore} >= ${AUTO_APPROVE_THRESHOLD})`);
    console.log(
      `   La page hub /fr/implantations/ile-de-france/paris doit maintenant rendre le contenu auto-généré.`,
    );
  } else {
    console.log(
      `\n⚠️  Score ${result.qualityScore} < ${AUTO_APPROVE_THRESHOLD} — laissé en status=generated`,
    );
    console.log(
      `   Approve manuellement : UPDATE generated_ville_copies SET status='approved' WHERE ville_slug='paris';`,
    );
  }

  console.log(`\n[test-ville-hub-copy-paris] DONE\n`);
}

main()
  .catch((err) => {
    console.error("\n[FATAL]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
