#!/usr/bin/env tsx
/**
 * Image Bank — Isolation check CI (§ 7.1 spec maître).
 *
 * Pattern emprunté à `scripts/content-gen/isolation-check.ts` (déjà éprouvé).
 *
 * Vérifie que tous les fichiers image-bank vivent EXCLUSIVEMENT dans les
 * zones dédiées :
 *
 *  - src/server/image-bank/**
 *  - src/app/[locale]/(admin)/[adminPrefix]/image-bank/**
 *  - src/app/[locale]/galerie/**
 *  - src/app/[locale]/gallery/**
 *  - src/app/sitemaps/images-*.xml/route.ts
 *  - src/components/admin/image-bank/**
 *  - src/server/queue/workers/image-bank-*-worker.ts
 *  - prisma/seeds/image-bank/**
 *  - prisma/migrations/*_image_bank_*
 *  - prisma/migrations_fts/*_image_bank_fts.sql
 *  - scripts/image-bank/**
 *  - tests/image-bank/**
 *  - tests/e2e/image-bank/**
 *  - docs/image-bank/**
 *  - public/image-bank/**
 *
 * Détection double :
 *  - Path-based : ALLOWED_PATTERNS
 *  - Content-based : IMAGE_BANK_MARKERS (fichier *mentionne* image-bank mais hors zone)
 *
 * Exit code 1 si violation détectée (CI fail).
 * Mode `--staged` (pre-commit) ou full scan (CI).
 *
 * Usage : `pnpm image-bank:isolation-check` (à ajouter package.json).
 */

import { execSync } from "node:child_process";
import path from "node:path";

const ALLOWED_PATTERNS: ReadonlyArray<RegExp> = [
  /^src\/server\/image-bank\//,
  /^src\/server\/actions\/image-bank\//,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/image-bank\//,
  /^src\/app\/\[locale\]\/galerie\//,
  /^src\/app\/\[locale\]\/gallery\//,
  /^src\/app\/api\/image-bank\//,
  /^src\/app\/sitemaps\/images-/,
  /^src\/components\/admin\/image-bank\//,
  /^src\/components\/galerie\//,
  /^src\/server\/queue\/workers\/image-bank-.*-worker\.ts$/,
  /^prisma\/seeds\/image-bank\//,
  /^prisma\/migrations\/\d+_(add_)?image_bank_/,
  /^prisma\/migrations\/\d+_create_country/,
  /^prisma\/migrations_fts\/.*_image_bank_/,
  /^scripts\/image-bank\//,
  /^tests\/image-bank\//,
  /^tests\/e2e\/image-bank\//,
  /^docs\/image-bank\//,
  /^public\/image-bank\//,

  // Exceptions explicites (références internes inter-modules)
  // Layout admin — nav admin doit pouvoir référencer /image-bank
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/layout\.tsx$/,
  // AdminCommandPalette ⌘K — référence routes /image-bank pour navigation rapide
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/AdminCommandPalette\.tsx$/,
  // Sitemap principal — référence sub-sitemaps images-*.xml
  /^src\/app\/sitemap\.ts$/,
  // Sitemap-index racine — référence sub-sitemaps images-{fr,en}.xml
  /^src\/app\/sitemap-index\.xml\/route\.ts$/,
  // Routing i18n — déclare pathnames /galerie et /gallery
  /^src\/i18n\/routing\.ts$/,
  // Footer — lien "Banque d'images" / "Image bank"
  /^src\/components\/nav\/Footer\.tsx$/,
  // Queue manager + worker entry — orchestrent les queues image-bank
  /^src\/server\/queue\/queues\.ts$/,
  /^src\/server\/queue\/worker\.ts$/,
  /^src\/server\/queue\/connection\.ts$/,
  // package.json — npm scripts image-bank:seed / image-bank:isolation-check
  /^package\.json$/,
  // schema.prisma — modèles image-bank attendus dedans
  /^prisma\/schema\.prisma$/,
  // env.ts — env vars IP_HASH_SALT attendues
  /^src\/env\.ts$/,
  // IndexNow ping — patché pour collectImageBankUrls
  /^scripts\/indexnow-ping\.ts$/,
  // RGPD / retention — purge image_usage_logs
  /^src\/server\/queue\/workers\/retention-purge-worker\.ts$/,
  /^src\/app\/api\/gdpr-export\/route\.ts$/,
  // vitest.config — patterns include/exclude image-bank
  /^vitest\.config\.ts$/,
  /^vitest\.integration\.config\.ts$/,
  // lighthouserc — URLs /galerie ajoutées
  /^lighthouserc\.json$/,
  // size-limit — bundle gates
  /^\.size-limit\.json$/,
  // Content-gen consomme image-bank en lecture seule
  /^src\/server\/content-gen\/images\/image-optimizer\.ts$/,
  // B.6 P0-4 P1.5 — Content-gen pick hero image depuis image-bank (read-only via prisma).
  /^src\/server\/content-gen\/images\/assign-hero-image\.ts$/,
  /^src\/server\/content-gen\/images\/__tests__\/assign-hero-image\.spec\.ts$/,
  // B.6 P0-4 P1.5 — Workers content-gen/publish consomment hero image-bank en read-only.
  /^src\/server\/queue\/workers\/content-gen-worker\.ts$/,
  /^src\/server\/queue\/workers\/content-publish-worker\.ts$/,
  // Shared Sharp helpers (extracted to lib for content-gen + image-bank reuse)
  /^src\/lib\/image-utils\.ts$/,
  // Page presse — section "Banque d'images" (lien promotion héritage SOS-Expat)
  /^src\/app\/\[locale\]\/presse\/page\.tsx$/,
  /^src\/components\/sections\/PressImageBank\.tsx$/,
  // GH Actions workflow — peut mentionner image-bank (build commits, etc.)
  /^\.github\/workflows\//,
  // Exceptions ajoutées 2026-05-18 (audit verif-fix-deploy refonte admin V2).
  // Nav SSOT v2 (`src/lib/admin-nav.ts` PR 9) référence le groupe "image-bank"
  // comme label, loading.tsx skeleton générique, .env.ci.example liste env vars,
  // tests baseline screenshots, et le sister isolation-check content-gen.
  // Pas de couplage code réel.
  /^src\/lib\/admin-nav\.ts$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/loading\.tsx$/,
  /^\.env\.ci\.example$/,
  /^scripts\/content-gen\/isolation-check\.ts$/,
  /^tests\/e2e\/admin-baseline-screenshots\.spec\.ts$/,
  // Exceptions ajoutées 2026-06-03 (audit footer) — références TEXTUELLES
  // légitimes (commentaires/prose/registre), aucun couplage code réel :
  //  - sentry-worker.ts : registre central des noms de workers (inclut les
  //    identifiants `image-bank-*` des workers image-bank, type union SSOT).
  //  - slug.ts : commentaire de doc listant les modules consommateurs.
  //  - loader.ts : commentaire CGU Unsplash référence `ImageAsset` (lookup read-only).
  //  - j-presse.ts : `note` descriptive mentionnant le pipeline image-bank.
  /^src\/server\/queue\/lib\/sentry-worker\.ts$/,
  /^src\/lib\/slug\.ts$/,
  /^src\/server\/content-gen\/blog\/loader\.ts$/,
  /^src\/content\/keywords\/j-presse\.ts$/,
  // Routes sitemaps images — DOIVENT vivre à la racine `app/` pour le routing
  // Next.js (URL = /sitemap-images-*.xml). Zone image-bank légitime ; le pattern
  // `sitemaps/images-` (l.46) ne matchait pas le nom réel `sitemap-images-*`.
  /^src\/app\/sitemap-images-.*\.xml\/route\.ts$/,
  // Scripts infra image-bank/sitemaps images (génération, conversion, seed) —
  // vivent dans scripts/ racine (référencés par leur chemin actuel ailleurs).
  /^scripts\/image-bank-convert-all\.mjs$/,
  /^scripts\/convert-images-batch\.mjs$/,
  /^scripts\/generate-image-sitemap-t3-t4\.ts$/,
  /^scripts\/extract-service-sitemap-data\.ts$/,
  /^scripts\/seed-images\.cjs$/,
  // Exceptions 2026-06-06 (audit Qualiopi end-to-end). Fichiers mentionnant
  // "image-bank" hors zone de façon légitime : script de backup R2 dédié,
  // KB readers consommés en lecture, spec loader blog (référence cross-module).
  // Pas de logique image-bank dupliquée.
  /^scripts\/backup-image-bank-r2\.sh$/,
  /^src\/lib\/knowledge\/readers\.ts$/,
  /^src\/server\/content-gen\/blog\/__tests__\/loader\.spec\.ts$/,
];

const IMAGE_BANK_MARKERS: ReadonlyArray<string> = [
  "image-bank",
  "ImageAsset",
  "ImageAssetTranslation",
  "ImageCategory",
  "ImageTag",
  "ImageUsageLog",
  "imageBankService",
  "ImageBankService",
];

function isPathAllowed(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ALLOWED_PATTERNS.some((re) => re.test(normalized));
}

function looksLikeImageBank(filePath: string, content: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (isPathAllowed(normalized)) return false;
  // Skip docs/_AUDIT/CLAUDE.md/README/.claude/ (commentaires textuels OK)
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
  return IMAGE_BANK_MARKERS.some((m) => content.includes(m));
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
    if (isPathAllowed(f)) continue;
    try {
      const content = await import("node:fs").then((m) =>
        m.promises.readFile(path.join(process.cwd(), f), "utf8"),
      );
      if (looksLikeImageBank(f, content)) {
        violations.push({
          file: f,
          reason: "Contient marqueur image-bank mais hors zones dédiées (§ 7.1)",
        });
      }
    } catch {
      // unreadable / binary → skip
    }
  }

  if (violations.length === 0) {
    console.log(
      `✅ [image-bank:isolation-check] OK — ${files.length} fichiers scannés, 0 violation.`,
    );
    process.exit(0);
  }

  console.error(`❌ [image-bank:isolation-check] ${violations.length} violations détectées :`);
  for (const v of violations) {
    console.error(`  - ${v.file} : ${v.reason}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("[image-bank:isolation-check] FATAL:", err);
  process.exit(2);
});
