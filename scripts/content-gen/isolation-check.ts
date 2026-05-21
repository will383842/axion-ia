#!/usr/bin/env tsx
/**
 * Content Generator — Isolation check CI (§ 4.1bis master prompt).
 *
 * Vérifie que tous les fichiers content-gen vivent EXCLUSIVEMENT dans les
 * 9 dossiers dédiés :
 *
 *  - src/server/content-gen/**
 *  - src/app/[locale]/(admin)/[adminPrefix]/content-gen/**
 *  - src/components/admin/content-gen/**
 *  - src/server/queue/workers/content-*-worker.ts
 *  - prisma/seeds/content-gen/**
 *  - prisma/migrations/*_content_gen_*  + *_add_content_gen_*
 *  - scripts/content-gen/**
 *  - tests/content-gen/**
 *  - docs/content-gen/**
 *  - public/illustrations/generated/content-gen/**
 *  - src/lib/seo-content-gen-factories.ts (exception explicite — extension seo.ts)
 *
 * Exit code 1 si violation détectée (CI fail).
 *
 * Usage : `pnpm content-gen:isolation-check` (script à ajouter package.json Day 6).
 */

import { execSync } from "node:child_process";
import path from "node:path";

const ALLOWED_PATTERNS: ReadonlyArray<RegExp> = [
  /^src\/server\/content-gen\//,
  /^src\/server\/actions\/content-gen\//,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/content-gen\//,
  /^src\/app\/api\/content-gen\//,
  /^src\/components\/admin\/content-gen\//,
  /^src\/server\/queue\/workers\/content-.*-worker\.ts$/,
  /^prisma\/seeds\/content-gen\//,
  /^prisma\/migrations\/\d+_(add_)?content_gen_/,
  /^scripts\/content-gen\//,
  /^tests\/content-gen\//,
  /^tests\/e2e\/content-gen\//,
  /^docs\/content-gen\//,
  /^public\/illustrations\/generated\/content-gen\//,
  // Exceptions explicites (extensions de fichiers SSOT existants)
  /^src\/lib\/seo-content-gen-factories(\.ts|\.spec\.ts|\.test\.ts)$/,
  /^src\/lib\/__tests__\/seo-content-gen-factories\.spec\.ts$/,
  // Admin layout — nav admin doit pouvoir référencer /content-gen.
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/layout\.tsx$/,
  // Routes publiques générées/consommées par content-gen (Pass B P0-2 + V1.0.1 + Sprint 8).
  // - /fr/actualites/[slug]   : NewsArticle RSS (§ 28)
  // - /fr/blog/[slug]         : Article DB-driven (Sprint 8 V2)
  // - /fr/equipe/[slug]       : Person Manon canonical (audit V1.0.1)
  // - /fr/faq/[slug]          : Q/R post-process auto (§ 29 Pass B P0-7)
  /^src\/app\/\[locale\]\/actualites\//,
  /^src\/app\/\[locale\]\/blog\//,
  /^src\/app\/\[locale\]\/equipe\//,
  /^src\/app\/\[locale\]\/faq\//,
  // Sitemap principal + exporter KB — référencent content-gen comme consommateur
  // dans des commentaires explicatifs (pré-existant Sprint S0bis).
  /^src\/app\/sitemap\.ts$/,
  /^src\/server\/exporters\/knowledge-sitemap\.ts$/,
  // Script anti-siren : exclut content-gen (doctrine code détecte SIREN patterns)
  /^scripts\/check-anti-siren\.sh$/,
  // Queue manager + worker entry — orchestrent les queues content-gen
  // (Sprint 6 audit correctif : content-orchestrator + content-publish wirés).
  /^src\/server\/queue\/queues\.ts$/,
  /^src\/server\/queue\/worker\.ts$/,
  // package.json — npm scripts content-gen:seed / content-gen:isolation-check
  /^package\.json$/,
  // AdminCommandPalette ⌘K — référence des routes /content-gen pour navigation
  // rapide admin (Audit final P0-4, commit `24e050e`).
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/AdminCommandPalette\.tsx$/,
  // KB readers — content-gen consomme la KB via getKnowledgeReadersForContentGen()
  // (lecture seule, Sprint 11.5 KB ingest URLs externes).
  /^src\/lib\/knowledge\/readers\.ts$/,
  // vitest.config — include/exclude patterns pour les tests content-gen
  // (séparation suites unit vs integration content-gen).
  /^vitest\.config\.ts$/,
  // RGPD / retention transverses (audit B5 commit `3b326a9`) — content-gen
  // est consommé en aval (purge + export DSAR + sous-processeurs IA). Sprint
  // S6.3 P1-4 (2026-05-15) : ces fichiers référencent explicitement les
  // tables content-gen dans un contexte conformité, pas violation isolation.
  /^src\/content\/subprocessors\.ts$/,
  /^src\/app\/api\/gdpr-export\/route\.ts$/,
  /^src\/server\/queue\/workers\/retention-purge-worker\.ts$/,
  /^scripts\/restore-postgres-test-r2\.sh$/,
  // seo.ts contient un garde-fou anti-fuite Manon (doctrine v2.1 — persona IA
  // n'a aucun réseau social). Le commentaire mentionne "content-gen" comme
  // contexte d'origine. Pas violation : c'est une exception explicite de
  // l'extension SSOT seo.ts (cf. seo-content-gen-factories.ts déjà whitelist).
  /^src\/lib\/seo\.ts$/,
  // Internal revalidate API (P1-E fix audit 2026-05-15) — endpoint appelé par
  // workers content-gen pour revalidatePath en contexte Next 16 valide.
  /^src\/app\/api\/internal\/revalidate\/route\.ts$/,
  // Exceptions ajoutées 2026-05-16 (audit V1 image-bank + S+1 securite-rgpd PRs #14/#15).
  // Ces fichiers mentionnent "content-gen" dans des commentaires/références
  // cross-module légitimes (consommation, sitemap, workflows CI, sister
  // isolation-check, KB transitions, etc.). Pas de violation isolation —
  // exceptions explicites doctrine §4.1bis.
  /^\.github\/workflows\/ci\.yml$/,
  /^\.github\/workflows\/gsc-crawl-stats-weekly\.yml$/,
  /^\.github\/workflows\/content-gen-seed\.yml$/,
  /^\.github\/workflows\/enable-openai-embeddings\.yml$/,
  /^prisma\/migrations\/\d+_add_service_sector\/migration\.sql$/,
  /^prisma\/seed\.ts$/,
  /^prisma\/seeds\/blog-fs-bootstrap\.ts$/,
  /^scripts\/image-bank\/isolation-check\.ts$/,
  /^scripts\/perf\/export-gsc-crawl-stats\.mjs$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/web-vitals\/page\.tsx$/,
  /^src\/app\/\[locale\]\/centre-aide\/\[slug\]\/page\.tsx$/,
  /^src\/app\/\[locale\]\/guides\/\[slug\]\/page\.tsx$/,
  /^src\/components\/content-gen\/Tombstone\.tsx$/,
  /^src\/features\/admin-blog\/actions\.ts$/,
  /^src\/i18n\/routing\.ts$/,
  /^src\/lib\/image-utils\.ts$/,
  /^src\/server\/actions\/knowledge\/_transition\.ts$/,
  /^src\/server\/actions\/knowledge\/delete-entry\.ts$/,
  /^src\/server\/actions\/knowledge\/update-entry\.ts$/,
  // Tests co-located workers content-* (__tests__/)
  /^src\/server\/queue\/workers\/__tests__\/content-.*\.spec\.ts$/,
  // Exceptions ajoutées 2026-05-18 (audit verif-fix-deploy refonte admin V2).
  // Ces fichiers mentionnent "content-gen" uniquement comme group/label dans
  // la nav SSOT v2 (`src/lib/admin-nav.ts` PR 9) ou comme placeholder loading
  // skeleton générique. Pas de couplage code réel — refs UI/screenshot/test
  // baseline uniquement.
  /^src\/lib\/admin-nav\.ts$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/loading\.tsx$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/web-vitals\/_v2\/WebVitalsV2\.tsx$/,
  /^src\/components\/admin\/ui\/AdminPageShell\.tsx$/,
  /^src\/components\/admin\/ui\/AdminSessionExpiryWarning\.tsx$/,
  /^src\/components\/admin\/ui\/AdminStatCard\.tsx$/,
  /^src\/components\/admin\/ui\/AdminSubmitButton\.tsx$/,
  /^tests\/e2e\/admin-baseline-screenshots\.spec\.ts$/,
  // Exceptions ajoutées 2026-05-20 (sessions city-quality + S+5 P2 + keywords + sentry).
  // Ces fichiers mentionnent "content-gen" uniquement dans des commentaires JSDoc
  // ou des commentaires de code (référence à un consommateur, contexte audit, URL
  // admin console) — aucun couplage code réel. Pas de violation isolation §4.1bis.
  /^src\/content\/villes\/index\.ts$/,
  /^src\/content\/glossary-extension\.ts$/,
  /^src\/content\/keywords\/master\.ts$/,
  /^src\/content\/keywords\/types\.ts$/,
  /^src\/lib\/geo\.ts$/,
  /^src\/lib\/same-origin\.ts$/,
  /^src\/server\/queue\/lib\/sanitize-job-data\.ts$/,
  /^src\/server\/queue\/lib\/sentry-worker\.ts$/,
  /^src\/server\/queue\/lib\/__tests__\/sentry-worker\.spec\.ts$/,
  /^src\/app\/\[locale\]\/guides\/page\.tsx$/,
  /^prisma\/migrations\/\d+_p1_audit_topic_fingerprint_and_audit_log\/migration\.sql$/,
  /^prisma\/migrations\/\d+_add_rss_source_table\/migration\.sql$/,
  // P4 Sprint correctif 2026-05-21 — migrations Manon qui referencent content-gen
  // dans des commentaires SQL (FK FK campaignId Article). Pas de violation isolation.
  /^prisma\/migrations\/\d+_add_article_campaign_id\/migration\.sql$/,
  // P1.5 B.4 — Routes API admin articles : RGPD art.17 (forget) + AI Act art.50 (provenance).
  // Consomment des données content-gen (purge cascade + trace LLM) mais sont des
  // endpoints admin transverses, pas du code content-gen core.
  /^src\/app\/api\/admin\/articles\/\[id\]\/forget\/route\.ts$/,
  /^src\/app\/api\/admin\/articles\/\[id\]\/provenance\/route\.ts$/,
];

/**
 * Marqueurs textuels qui suggèrent que le fichier est content-gen
 * (au-delà du chemin). Détection complémentaire.
 */
const CONTENT_GEN_MARKERS: ReadonlyArray<string> = [
  "content-gen",
  "ContentGenJob",
  "ContentGenConfig",
  "ContentTemplate",
  "CoverageCampaign",
];

function isPathAllowed(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ALLOWED_PATTERNS.some((re) => re.test(normalized));
}

function looksLikeContentGen(filePath: string, content: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  // Skip déjà-allowed paths
  if (isPathAllowed(normalized)) return false;
  // Skip docs/_AUDIT/seeds-templates/CLAUDE.md/etc. (commentaires textuels OK)
  if (
    /^_AUDIT\//.test(normalized) ||
    /\.md$/.test(normalized) ||
    /^CLAUDE\.md$/.test(normalized) ||
    /^README\.md$/.test(normalized) ||
    /^\.claude\//.test(normalized) ||
    /^AxionIA_Dossier/.test(normalized)
  ) {
    return false;
  }
  // Skip schema.prisma (les modèles content-gen sont attendus dedans)
  if (normalized === "prisma/schema.prisma") return false;
  // Skip src/env.ts (env vars content-gen sont attendus)
  if (normalized === "src/env.ts") return false;
  return CONTENT_GEN_MARKERS.some((m) => content.includes(m));
}

function listStagedFiles(): string[] {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf8",
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

function listAllTrackedFiles(): string[] {
  try {
    const out = execSync("git ls-files", { encoding: "utf8" });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--staged") ? "staged" : "all";
  const files = mode === "staged" ? listStagedFiles() : listAllTrackedFiles();

  const violations: Array<{ file: string; reason: string }> = [];

  for (const f of files) {
    // Skip allowed paths (rapide)
    if (isPathAllowed(f)) continue;
    // Lookup marqueurs content-gen dans le contenu
    try {
      const content = await import("node:fs").then((m) =>
        m.promises.readFile(path.join(process.cwd(), f), "utf8"),
      );
      if (looksLikeContentGen(f, content)) {
        violations.push({
          file: f,
          reason: "Contient marqueur content-gen mais hors zones dédiées (§ 4.1bis)",
        });
      }
    } catch {
      // unreadable / binary → skip
    }
  }

  if (violations.length === 0) {
    console.log(`✅ [isolation-check] OK — ${files.length} fichiers scannés, 0 violation.`);
    process.exit(0);
  }

  console.error(`❌ [isolation-check] ${violations.length} violations détectées :`);
  for (const v of violations) {
    console.error(`  - ${v.file} : ${v.reason}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("[isolation-check] FATAL:", err);
  process.exit(2);
});
