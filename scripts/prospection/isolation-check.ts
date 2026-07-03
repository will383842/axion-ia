#!/usr/bin/env tsx
/**
 * Prospection — Isolation check CI (reference/01 §Cloisonnement).
 *
 * Pattern emprunté à `scripts/image-bank/isolation-check.ts` (déjà éprouvé).
 *
 * Vérifie que tous les fichiers du module « Prospection & Base Entreprises »
 * vivent EXCLUSIVEMENT dans les zones dédiées (sinon fuite / second système) :
 *
 *  - src/lib/prospection/**
 *  - src/server/prospection/**
 *  - src/server/actions/prospection/**
 *  - src/app/[locale]/(admin)/[adminPrefix]/prospection/**
 *  - src/components/admin/prospection/**
 *  - src/server/queue/workers/prospection-*-worker.ts
 *  - prisma/seeds/prospection/**
 *  - prisma/migrations/*_prospection_*
 *  - scripts/prospection/**
 *  - tests/prospection/**  /  tests/e2e/prospection/**  /  docs/prospection/**
 *
 * Détection double : path-based (ALLOWED_PATTERNS) + content-based (MARKERS :
 * fichier mentionnant un symbole prospection mais hors zone).
 *
 * Exit 1 si violation. Mode `--staged` (pre-commit) ou full scan (CI).
 * Usage : `pnpm prospection:isolation-check`.
 */

import { execSync } from "node:child_process";
import path from "node:path";

const ALLOWED_PATTERNS: ReadonlyArray<RegExp> = [
  /^src\/lib\/prospection\//,
  /^src\/server\/prospection\//,
  /^src\/server\/actions\/prospection\//,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/prospection\//,
  /^src\/app\/api\/prospection\//,
  /^src\/components\/admin\/prospection\//,
  /^src\/server\/queue\/workers\/prospection-.*-worker\.ts$/,
  /^prisma\/seeds\/prospection\//,
  /^prisma\/migrations\/\d+_prospection_/,
  /^scripts\/prospection\//,
  /^tests\/prospection\//,
  /^tests\/e2e\/prospection\//,
  /^docs\/prospection\//,

  // Exceptions explicites (fichiers SSOT partagés que le module DOIT toucher —
  // références de registre, pas de couplage logique) :
  /^src\/lib\/admin-nav\.ts$/, // pôle nav "Prospection"
  /^src\/server\/queue\/queues\.ts$/, // files prospection-*
  /^src\/server\/queue\/worker\.ts$/, // enregistrement workers
  /^src\/server\/queue\/lib\/sentry-worker\.ts$/, // union WorkerName (registre central)
  /^src\/server\/queue\/workers\/retention-purge-worker\.ts$/, // purge RGPD étendue (T8)
  /^prisma\/schema\.prisma$/, // modèles Prospection*
  /^package\.json$/, // npm scripts prospection:*
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/layout\.tsx$/, // nav admin
  /^vitest\.config\.ts$/,
  /^vitest\.integration\.config\.ts$/,
  /^lighthouserc\.json$/,
];

// Symboles spécifiques au module (n'apparaissent nulle part ailleurs légitimement).
const PROSPECTION_MARKERS: ReadonlyArray<string> = [
  "ProspectionCompany",
  "ProspectionEstablishment",
  "ProspectionPerson",
  "ProspectionCampaign",
  "ProspectionCoverageCell",
  "ProspectionSuppressionEntry",
  "ProspectionGeoCoverageStat",
  "getProspectionConfig",
  "@/lib/prospection",
  "@/server/prospection",
];

function isPathAllowed(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ALLOWED_PATTERNS.some((re) => re.test(normalized));
}

function looksLikeProspection(filePath: string, content: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (isPathAllowed(normalized)) return false;
  if (
    /^_AUDIT\//.test(normalized) ||
    /_PROSPECTION-BASE-ENTREPRISES\//.test(normalized) ||
    /\.md$/.test(normalized) ||
    /^CLAUDE\.md$/.test(normalized) ||
    /^README\.md$/.test(normalized) ||
    /^\.claude\//.test(normalized)
  ) {
    return false;
  }
  return PROSPECTION_MARKERS.some((m) => content.includes(m));
}

function listStagedFiles(): string[] {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", { encoding: "utf8" });
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
    if (isPathAllowed(f)) continue;
    try {
      const content = await import("node:fs").then((m) =>
        m.promises.readFile(path.join(process.cwd(), f), "utf8"),
      );
      if (looksLikeProspection(f, content)) {
        violations.push({
          file: f,
          reason: "Contient un marqueur prospection mais hors zones dédiées (reference/01)",
        });
      }
    } catch {
      // unreadable / binary → skip
    }
  }

  if (violations.length === 0) {
    console.log(
      `✅ [prospection:isolation-check] OK — ${files.length} fichiers scannés, 0 violation.`,
    );
    process.exit(0);
  }

  console.error(`❌ [prospection:isolation-check] ${violations.length} violations détectées :`);
  for (const v of violations) console.error(`  - ${v.file} : ${v.reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("[prospection:isolation-check] FATAL:", err);
  process.exit(2);
});
