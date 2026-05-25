/**
 * Seed KB — Villes françaises + AI Act + ROI IA
 *
 * 180 facts répartis en 3 catégories :
 *   - ville_economy (100) : données démographiques et écosystèmes tech des villes
 *   - ai_act (30)         : Règlement UE 2024/1689
 *   - roi_ia (50)         : études publiques McKinsey/Gartner/Forrester/BCG/IDC/OCDE
 *
 * Idempotent : upsert sur slug unique. Exécuter 2× = même résultat.
 *
 * Usage :
 *   pnpm tsx scripts/seed-kb-villes-facts.ts           # dry-run (défaut)
 *   pnpm tsx scripts/seed-kb-villes-facts.ts --commit  # écriture réelle
 */

import { PrismaClient } from "../prisma/generated/client";
import { KB_VILLES_ALL } from "../src/server/content-gen/kb/villes-facts";
import type { KbFact } from "../src/server/content-gen/kb/audits";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTranslationSlug(entrySlug: string): string {
  return `${entrySlug}-fr`;
}

function buildTitle(text: string): string {
  const truncated = text.slice(0, 120).replace(/[.…]$/, "");
  return truncated.endsWith("…") ? truncated : truncated + "…";
}

function buildBodyHtml(fact: KbFact): string {
  return `<p>${fact.text}</p><p><em>Source : <a href="${fact.sourceUrl}" rel="noopener noreferrer nofollow">${fact.source}</a> — Vérifié le ${fact.verifiedAt}.</em></p>`;
}

function buildBodyText(fact: KbFact): string {
  return `${fact.text} Source : ${fact.source}. Vérifié le ${fact.verifiedAt}.`;
}

/**
 * Résolution du type KnowledgeEntry selon la catégorie du fact id.
 * Tous les types doivent être des valeurs valides de l'enum KbType Prisma.
 *
 * - ville_economy  → industry_use_case (cas d'usage IA par secteur/ville)
 * - ai_act         → secteur_brief     (brief sectoriel réglementaire)
 * - roi_ia         → industry_use_case (études ROI par secteur)
 */
function resolveEntryType(factId: string): "industry_use_case" | "secteur_brief" {
  if (factId.startsWith("ai-act-")) return "secteur_brief";
  return "industry_use_case";
}

// ---------------------------------------------------------------------------
// Core upsert
// ---------------------------------------------------------------------------

interface UpsertResult {
  factId: string;
  slug: string;
  action: "would-create" | "would-update" | "created" | "updated" | "error";
  message?: string;
}

async function upsertFact(fact: KbFact, dryRun: boolean): Promise<UpsertResult> {
  const entrySlug = `kb-fact-${fact.id}`;
  const translationSlug = buildTranslationSlug(entrySlug);
  const title = buildTitle(fact.text);
  const bodyHtml = buildBodyHtml(fact);
  const bodyText = buildBodyText(fact);
  const entryType = resolveEntryType(fact.id);

  try {
    const existing = await prisma.knowledgeEntry.findUnique({
      where: { slug: entrySlug },
      select: { id: true },
    });

    if (dryRun) {
      return {
        factId: fact.id,
        slug: entrySlug,
        action: existing ? "would-update" : "would-create",
      };
    }

    const entry = await prisma.knowledgeEntry.upsert({
      where: { slug: entrySlug },
      update: {
        status: "published",
        pipelineStage: "published",
        audience: "public",
        publishedAt: new Date(fact.verifiedAt),
      },
      create: {
        slug: entrySlug,
        type: entryType,
        domain: "commercial",
        audience: "public",
        confidentiality: "public",
        status: "published",
        pipelineStage: "published",
        publishedAt: new Date(fact.verifiedAt),
      },
      select: { id: true },
    });

    await prisma.knowledgeTranslation.upsert({
      where: { locale_slug: { locale: "fr", slug: translationSlug } },
      update: {
        title,
        body: bodyHtml,
        bodyText,
        excerpt: fact.text.slice(0, 300),
        metaTitle: title.slice(0, 70),
        qualityScore: fact.confidence,
        wordCount: bodyText.split(/\s+/).length,
      },
      create: {
        entryId: entry.id,
        locale: "fr",
        slug: translationSlug,
        title,
        body: bodyHtml,
        bodyText,
        excerpt: fact.text.slice(0, 300),
        metaTitle: title.slice(0, 70),
        qualityScore: fact.confidence,
        wordCount: bodyText.split(/\s+/).length,
      },
    });

    return {
      factId: fact.id,
      slug: entrySlug,
      action: existing ? "updated" : "created",
    };
  } catch (err) {
    return {
      factId: fact.id,
      slug: entrySlug,
      action: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--commit");

  const facts = KB_VILLES_ALL;

  console.log(`[seed-kb-villes] mode=${dryRun ? "DRY-RUN (add --commit to persist)" : "COMMIT"}`);
  console.log(`[seed-kb-villes] facts à traiter : ${facts.length}`);

  // Breakdown par catégorie
  const villes = facts.filter((f) => f.id.startsWith("ville-"));
  const aiAct = facts.filter((f) => f.id.startsWith("ai-act-"));
  const roiIa = facts.filter((f) => f.id.startsWith("roi-ia-"));
  console.log(
    `[seed-kb-villes] breakdown : ville_economy=${villes.length}, ai_act=${aiAct.length}, roi_ia=${roiIa.length}`,
  );

  const results: UpsertResult[] = [];

  for (const fact of facts) {
    const result = await upsertFact(fact, dryRun);
    results.push(result);

    const icon =
      result.action === "error" ? "❌" : result.action.startsWith("would-") ? "🔍" : "✅";
    console.log(`  ${icon} [${result.action}] ${result.slug}`);
    if (result.message) {
      console.error(`      └─ ${result.message}`);
    }
  }

  // Résumé
  const counts = results.reduce(
    (acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log("\n[seed-kb-villes] ── RÉSUMÉ ──");
  for (const [action, count] of Object.entries(counts)) {
    console.log(`  ${action}: ${count}`);
  }

  const errors = results.filter((r) => r.action === "error");
  if (errors.length > 0) {
    console.error(`\n[seed-kb-villes] ⚠️  ${errors.length} erreur(s) :`);
    for (const e of errors) {
      console.error(`  - ${e.factId}: ${e.message}`);
    }
    process.exit(1);
  }

  if (dryRun) {
    console.log("\n[seed-kb-villes] Dry-run OK. Relancez avec --commit pour persister.");
  } else {
    console.log(
      `\n[seed-kb-villes] ✅ Seed terminé. ${counts["created"] ?? 0} créés, ${counts["updated"] ?? 0} mis à jour.`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[seed-kb-villes] FATAL", err);
  void prisma.$disconnect();
  process.exit(1);
});
