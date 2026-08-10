/**
 * KB V4 — Lint banned words pour KB (FR uniquement V1).
 *
 * 🔓 2026-08-10 (décision Will) — le mot « formation » N'EST PLUS BANNI.
 * Le site vend 21 formations au catalogue, expose « Formations IA » en
 * navigation et indexe `/formations/*` : proscrire le mot dans la base de
 * connaissance revenait à interdire au corpus de nommer l'offre.
 *
 * La liste de motifs est donc vide et ce lint passe systématiquement. Le script
 * est conservé comme point d'entrée si un mot devait être proscrit un jour —
 * mais jamais « formation ».
 *
 * ⚠️ La protection Qualiopi ne reposait PAS sur ce lint : la garde primaire est
 * le drapeau `isQualiopiPublicDisclosureEnabled()`, inchangé.
 *
 * Usage CI :
 *   pnpm knowledge:check-banned-words
 *
 * Exit code 0 si OK, 1 si occurrence détectée.
 */

import { PrismaClient } from "../prisma/generated/client";

const prisma = new PrismaClient();

const BANNED_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [];

interface Violation {
  readonly entryId: string;
  readonly translationId: string;
  readonly locale: string;
  readonly field: string;
  readonly snippet: string;
  readonly reason: string;
}

export function detectBannedWords(text: string | null): string[] {
  if (!text) return [];
  const reasons: string[] = [];
  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(reason);
    }
  }
  return reasons;
}

async function main() {
  console.warn("[kb-banned-words] scanning knowledge_translations…");

  const translations = await prisma.knowledgeTranslation.findMany({
    select: {
      id: true,
      entryId: true,
      locale: true,
      title: true,
      excerpt: true,
      body: true,
      bodyText: true,
      metaTitle: true,
      metaDescription: true,
    },
  });

  const violations: Violation[] = [];
  for (const t of translations) {
    const fields: Array<[string, string | null]> = [
      ["title", t.title],
      ["excerpt", t.excerpt],
      ["bodyText", t.bodyText ?? t.body], // bodyText prioritaire, sinon body HTML
      ["metaTitle", t.metaTitle],
      ["metaDescription", t.metaDescription],
    ];
    for (const [field, value] of fields) {
      const reasons = detectBannedWords(value);
      for (const reason of reasons) {
        violations.push({
          entryId: t.entryId,
          translationId: t.id,
          locale: t.locale,
          field,
          snippet: (value ?? "").slice(0, 100),
          reason,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.warn(
      `[kb-banned-words] OK — ${translations.length} translations scannées, 0 violation.`,
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  console.error(`[kb-banned-words] ❌ ${violations.length} violation(s) détectée(s) :`);
  for (const v of violations) {
    console.error(
      `  - entry=${v.entryId} translation=${v.translationId} locale=${v.locale} field=${v.field}`,
    );
    console.error(`    raison : ${v.reason}`);
    console.error(`    snippet : "${v.snippet}"`);
  }
  await prisma.$disconnect();
  process.exit(1);
}

// Run main() uniquement si exécuté en CLI (pas en import test).
if (process.argv[1]?.endsWith("check-knowledge-banned-words.ts")) {
  main().catch((err) => {
    console.error("[kb-banned-words] FATAL", err);
    process.exit(1);
  });
}
