/**
 * Seed BannedPhrase — doctrine éditoriale § 21 + § 25 master prompt + glossaire jargon § 1.1bis.
 *
 * 3 sévérités :
 * - `block` : doctrine-check rejette le contenu (SIREN/SIRET/RCS, formation, etc.)
 * - `warn`  : doctrine-check log warning + applique pénalité qualityScore -5/phrase
 * - `info`  : warning UI admin uniquement (jargon non expliqué, à reformuler)
 *
 * Will peut éditer + ajouter via `/admin/content-gen/settings/banned-phrases`.
 */

import type { PrismaClient } from "../../generated/client";

type SeedBannedPhrase = { pattern: string; reason: string; severity: "block" | "warn" | "info" };

const BANNED_PHRASES: ReadonlyArray<SeedBannedPhrase> = [
  // ===== BLOCK — Identité juridique (OÜ estonienne, jamais FR) =====
  { pattern: "SIREN", reason: "Numéro français interdit (OÜ estonienne)", severity: "block" },
  { pattern: "SIRET", reason: "Numéro français interdit (OÜ estonienne)", severity: "block" },
  { pattern: "RCS", reason: "Registre français interdit (OÜ estonienne)", severity: "block" },
  {
    pattern: "Registre du Commerce",
    reason: "Concept français — utiliser Estonian Business Register",
    severity: "block",
  },
  { pattern: "URSSAF", reason: "Cotisations FR — pas applicable OÜ estonienne", severity: "block" },

  // ===== BLOCK — Doctrine lexicale (mots bannis projet — cf. axionia-core) =====
  {
    pattern: "formation",
    reason: "Mot BANNI partout (cf. axionia-core §1). Utiliser 'intervention'",
    severity: "block",
  },
  { pattern: "formateur", reason: "Mot BANNI. Utiliser 'intervenant'", severity: "block" },
  {
    pattern: "former",
    reason: "Mot BANNI. Utiliser 'accompagner' / 'faire monter en compétence'",
    severity: "block",
  },

  // ===== BLOCK — Phrases interdites doctrine § 21 master prompt =====
  {
    pattern: "pas de plan sur-mesure",
    reason: "Phrase interdite doctrine § 21",
    severity: "block",
  },
  {
    pattern: "½ journée",
    reason: "Phrase interdite doctrine § 21 (utiliser durée explicite)",
    severity: "block",
  },
  {
    pattern: "basé en UE",
    reason: "Phrase interdite doctrine § 21 (préférer 'OÜ estonienne')",
    severity: "block",
  },

  // ===== WARN — Naming concurrent / agence =====
  {
    pattern: "agence",
    reason: "Naming brand — utiliser 'cabinet IA opérationnel' (sauf comparatifs)",
    severity: "warn",
  },
  {
    pattern: "studio",
    reason: "Naming brand — utiliser 'cabinet IA opérationnel'",
    severity: "warn",
  },
  {
    pattern: "atelier",
    reason: "Naming brand — utiliser 'cabinet IA opérationnel'",
    severity: "warn",
  },

  // ===== BLOCK — Phrases-hype interdites doctrine § 21 (Pass B P1-1) =====
  // « unique » est BLOCK avec exception SEO doctrinaire « angle unique par
  // ville » (cf. landing-ville.ts:28 — anti-doorway HCU sémantique). Le
  // doctrine-check applique l'exception via regex.
  { pattern: "unique", reason: "Marketing-hype interdit (doctrine § 21)", severity: "block" },
  { pattern: "le meilleur", reason: "Marketing-hype interdit (doctrine § 21)", severity: "block" },
  {
    pattern: "révolutionnaire",
    reason: "Marketing-hype interdit (doctrine § 21)",
    severity: "block",
  },
  { pattern: "incontournable", reason: "Marketing-hype interdit", severity: "warn" },
  { pattern: "leader", reason: "Marketing-hype non vérifiable", severity: "warn" },
  { pattern: "innovant", reason: "Marketing-hype creux", severity: "warn" },
  { pattern: "disruption", reason: "Buzzword gratuit (doctrine § 1.1bis)", severity: "warn" },
  { pattern: "disruptif", reason: "Buzzword gratuit", severity: "warn" },
  { pattern: "scalable", reason: "Anglicisme buzzword", severity: "warn" },
  { pattern: "synergie", reason: "Buzzword vide", severity: "warn" },
  { pattern: "game changer", reason: "Marketing-hype anglicisme", severity: "warn" },
  {
    pattern: "ADN",
    reason: "Métaphore creuse interdite (cabinet IA opérationnel = ROI, pas ADN)",
    severity: "warn",
  },
  { pattern: "écosystème", reason: "Buzzword sur-utilisé", severity: "warn" },
  { pattern: "next level", reason: "Anglicisme marketing", severity: "warn" },
  { pattern: "game-changer", reason: "Anglicisme marketing", severity: "warn" },

  // ===== INFO — Jargon technique non expliqué (§ 1.1bis cibles non-tech) =====
  {
    pattern: "LLM",
    reason: "Jargon tech — définir lors de la 1ère mention (cf. § 1.1bis)",
    severity: "info",
  },
  { pattern: "RAG", reason: "Jargon tech — définir lors de la 1ère mention", severity: "info" },
  {
    pattern: "embedding",
    reason: "Jargon tech — utiliser 'indexation par sens'",
    severity: "info",
  },
  {
    pattern: "fine-tuning",
    reason: "Jargon tech — utiliser 'personnalisation de l'IA sur votre métier'",
    severity: "info",
  },
  {
    pattern: "MCP",
    reason: "Jargon tech extrême — ne pas mentionner si cible non-tech",
    severity: "info",
  },
  {
    pattern: "transformer",
    reason: "Jargon tech extrême — ne pas mentionner sauf cible tech",
    severity: "info",
  },
  {
    pattern: "tokenization",
    reason: "Jargon tech — utiliser 'découpage texte unitaire'",
    severity: "info",
  },
  {
    pattern: "vector database",
    reason: "Jargon tech — utiliser 'moteur de recherche par sens'",
    severity: "info",
  },
  {
    pattern: "hallucination",
    reason: "Jargon tech — utiliser 'réponse erronée de l'IA' à la 1ère mention",
    severity: "info",
  },

  // ===== WARN — Anti-doorway HCU 2024 =====
  {
    pattern: "des centaines de",
    reason: "Hype quantitatif vague (HCU AI-generated signal)",
    severity: "warn",
  },
  {
    pattern: "des milliers de",
    reason: "Hype quantitatif vague (HCU AI-generated signal)",
    severity: "warn",
  },
  { pattern: "en quelques clics", reason: "Cliché marketing creux", severity: "warn" },
  { pattern: "boostez votre", reason: "Cliché marketing", severity: "warn" },
  { pattern: "révéler tout le potentiel", reason: "Cliché marketing", severity: "warn" },
];

export async function seedBannedPhrases(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const phrase of BANNED_PHRASES) {
    await prisma.bannedPhrase.upsert({
      where: { pattern: phrase.pattern },
      create: {
        pattern: phrase.pattern,
        reason: phrase.reason,
        severity: phrase.severity,
        isActive: true,
      },
      update: {
        // Synchronise reason + severity (SSOT doctrine).
        reason: phrase.reason,
        severity: phrase.severity,
      },
    });
    count++;
  }
  return count;
}
