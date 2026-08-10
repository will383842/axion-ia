#!/usr/bin/env tsx
/**
 * Qualiopi — Isolation check CI (miroir des autres checks d'isolation du repo).
 *
 * Garantit que tout le code Formation Engine + Qualiopi Manager vit
 * EXCLUSIVEMENT dans ses zones dédiées (cloisonnement, skill `reference/01` §2) :
 *
 *  - src/server/qualiopi/**
 *  - src/server/actions/qualiopi/**
 *  - src/app/[locale]/(admin)/[adminPrefix]/qualiopi/**
 *  - src/app/[locale]/(admin)/[adminPrefix]/formations/**
 *  - src/app/[locale]/formations/**          (fiches publiques, flag-gated)
 *  - src/app/[locale]/portail/**             (portail stagiaire)
 *  - src/app/api/qualiopi/**                 (route SSE alertes T15)
 *  - src/components/admin/qualiopi/**
 *  - src/server/queue/workers/qualiopi-*-worker.ts
 *  - prisma/seeds/qualiopi/**  ·  prisma/migrations/*_qualiopi_*
 *  - scripts/qualiopi/**  ·  tests/qualiopi/**  ·  tests/e2e/qualiopi/**
 *  - docs/qualiopi/**  ·  src/types/qualiopi*
 *
 * + exceptions explicites (SSOT transverses qui RÉFÉRENCENT qualiopi).
 * Exit 1 si un fichier hors zone utilise un symbole exporté du module.
 *
 * Usage : `pnpm qualiopi:isolation-check` (câblé dans verify:all + pre-push).
 */

import { execSync } from "node:child_process";
import path from "node:path";

const ALLOWED_PATTERNS: ReadonlyArray<RegExp> = [
  /^src\/server\/qualiopi\//,
  /^src\/server\/actions\/qualiopi\//,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/qualiopi\//,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/formations\//,
  /^src\/app\/\[locale\]\/formations\//,
  /^src\/app\/\[locale\]\/portail\//,
  // Espace formateur collectif (étapes B et C du chantier émargement) : le
  // formateur consulte ses sessions de formation et recueille les signatures
  // des stagiaires sans téléphone, sur son propre poste. C'est un consommateur
  // ASSUMÉ du domaine qualiopi, au même titre que le portail stagiaire — pas
  // une fuite. Il n'importe que des lectures et l'action de signature ; la
  // politique de champs stagiaire (jamais d'e-mail, jamais de détail handicap)
  // est portée par `src/server/formateur/collectif-queries.ts`.
  // Restreint aux SESSIONS : c'est le seul usage réel. Ouvrir tout l'espace
  // formateur au domaine qualiopi serait plus large que nécessaire.
  /^src\/app\/\[locale\]\/espace-formateur\/sessions\//,
  /^src\/components\/espace-formateur\/Emargement/,
  /^src\/app\/\[locale\]\/verifier-attestation\//,
  /^src\/app\/api\/qualiopi\//,
  /^src\/components\/admin\/qualiopi\//,
  // Composants PUBLICS Qualiopi (badge, bandeau, section mentions légales) —
  // surfaces de divulgation Phase B, flag-gated. Importés par le layout/footer/
  // mentions-légales QUI n'importent QUE depuis `@/components/qualiopi/`.
  /^src\/components\/qualiopi\//,
  /^src\/server\/queue\/workers\/qualiopi-.*-worker(\.spec)?\.ts$/,
  /^src\/server\/queue\/workers\/__tests__\/qualiopi-.*\.(spec|test)\.ts$/,
  /^prisma\/seeds\/qualiopi\//,
  /^prisma\/migrations\/\d+_(add_)?qualiopi_/,
  /^scripts\/qualiopi\//,
  /^tests\/qualiopi\//,
  /^tests\/e2e\/qualiopi\//,
  /^docs\/qualiopi\//,
  /^src\/types\/qualiopi/,
  // ── Exceptions explicites (SSOT transverses référençant qualiopi) ──
  // Nav admin SSOT — référence le groupe + routes /qualiopi & /formations.
  /^src\/lib\/admin-nav\.ts$/,
  // package.json — scripts qualiopi:seed / qualiopi:isolation-check.
  /^package\.json$/,
  // Workflow de seed prod Qualiopi (docker exec → prisma db execute des SQL boot).
  /^\.github\/workflows\/qualiopi-seed\.yml$/,
  // Layout admin + ⌘K — référencent les routes admin qualiopi.
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/layout\.tsx$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/AdminCommandPalette\.tsx$/,
  // Queues + worker entry — orchestrent les queues qualiopi (T6/T15).
  /^src\/server\/queue\/queues\.ts$/,
  /^src\/server\/queue\/worker\.ts$/,
  // Seed principal — peut importer le seed qualiopi.
  /^prisma\/seed\.ts$/,
  // Instrumentation Next — hook de boot qui déclenche le seed auto du référentiel qualiopi.
  /^src\/instrumentation\.ts$/,
  // Routing i18n — pathnames /formations (Phase B).
  /^src\/i18n\/routing\.ts$/,
  // ── Références transverses légitimes (coaching 1-to-1 + handicap) ──
  // Coaching 1-to-1 (conseil) : l'admin coaching consomme la couche qualiopi
  // coaching-1to1 (heures, facturation). Surfaces métier, pas une fuite.
  // (2026-08-10 : le module AFEST `coaching-afest/**` a été supprimé — décision Will.)
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/coaching\//,
  /^src\/components\/admin\/coaching\//,
  // Page publique d'accessibilité — référence le SSOT `HANDICAP_PARTENAIRES`
  // (relais handicap, indicateur 26), exposé par `qualiopi/legal/legal-mentions`.
  /^src\/app\/\[locale\]\/accessibilite\//,
];

/**
 * Marqueurs = symboles exportés UNIQUES du module qualiopi. S'ils apparaissent
 * hors zone, c'est une vraie fuite (pas un faux positif sur le mot « formation »
 * qui est omniprésent dans le repo). On NE marque PAS sur "qualiopi"/"formation"
 * génériques.
 */
const QUALIOPI_MARKERS: ReadonlyArray<string> = [
  "getQualiopiConfig",
  "setQualiopiConfig",
  "getAllQualiopiConfig",
  "logQualiopiActivity",
  "isQualiopiPublicDisclosureEnabled",
  "QUALIOPI_BRAND_COLORS",
  "QUALIOPI_CONFIG_REGISTRY",
  "QUALIOPI_BRAND_FONTS",
  "@/server/qualiopi/",
  "@/server/actions/qualiopi/",
];

function isPathAllowed(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ALLOWED_PATTERNS.some((re) => re.test(normalized));
}

function looksLikeQualiopi(filePath: string, content: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (isPathAllowed(normalized)) return false;
  // Docs / audit / skill / markdown : commentaires textuels OK.
  if (/^_AUDIT\//.test(normalized) || /\.md$/.test(normalized) || /^\.claude\//.test(normalized)) {
    return false;
  }
  // Modèles qualiopi attendus dans le schéma ; env vars qualiopi gérées à part.
  if (normalized === "prisma/schema.prisma") return false;
  if (normalized === "src/env.ts") return false;
  return QUALIOPI_MARKERS.some((m) => content.includes(m));
}

function listFiles(mode: "staged" | "all"): string[] {
  const cmd =
    mode === "staged" ? "git diff --cached --name-only --diff-filter=ACMR" : "git ls-files";
  try {
    return execSync(cmd, { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--staged") ? "staged" : "all";
  const files = listFiles(mode);
  const violations: Array<{ file: string; reason: string }> = [];

  for (const f of files) {
    if (isPathAllowed(f)) continue;
    try {
      const content = await import("node:fs").then((m) =>
        m.promises.readFile(path.join(process.cwd(), f), "utf8"),
      );
      if (looksLikeQualiopi(f, content)) {
        violations.push({
          file: f,
          reason: "Utilise un symbole qualiopi hors des zones dédiées (cloisonnement).",
        });
      }
    } catch {
      // binaire / illisible → skip
    }
  }

  if (violations.length === 0) {
    console.log(
      `✅ [qualiopi:isolation-check] OK — ${files.length} fichiers scannés, 0 violation.`,
    );
    process.exit(0);
  }
  console.error(`❌ [qualiopi:isolation-check] ${violations.length} violation(s) :`);
  for (const v of violations) console.error(`  - ${v.file} : ${v.reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("[qualiopi:isolation-check] FATAL:", err);
  process.exit(2);
});
