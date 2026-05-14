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
  /^src\/components\/admin\/content-gen\//,
  /^src\/server\/queue\/workers\/content-.*-worker\.ts$/,
  /^prisma\/seeds\/content-gen\//,
  /^prisma\/migrations\/\d+_(add_)?content_gen_/,
  /^scripts\/content-gen\//,
  /^tests\/content-gen\//,
  /^docs\/content-gen\//,
  /^public\/illustrations\/generated\/content-gen\//,
  // Exceptions explicites (extensions de fichiers SSOT existants)
  /^src\/lib\/seo-content-gen-factories(\.ts|\.spec\.ts)$/,
  /^src\/lib\/__tests__\/seo-content-gen-factories\.spec\.ts$/,
  // Admin layout — nav admin doit pouvoir référencer /content-gen.
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/layout\.tsx$/,
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
