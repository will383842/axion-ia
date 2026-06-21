/**
 * Seed BannedPhrase — doctrine éditoriale § 21 + § 25 master prompt + glossaire jargon § 1.1bis.
 *
 * 3 sévérités :
 * - `block` : doctrine-check rejette le contenu (SIREN/SIRET/RCS, etc.)
 * - `warn`  : doctrine-check log warning + applique pénalité qualityScore -5/phrase
 * - `info`  : warning UI admin uniquement (jargon non expliqué, à reformuler)
 *
 * Will peut éditer + ajouter via `/admin/content-gen/settings/banned-phrases`.
 *
 * City Domination 2026-05-18 P1-2 (décision Will Option A) — Lecture allégée
 * du lexique : "formation" / "formateur" / "former" passent de `block` à `warn`
 * (signal qualité éditoriale, pas rejet absolu). Le positionnement brand reste
 * "intervention" / "cabinet IA opérationnel" mais le LLM peut utiliser
 * "formation" en copy quand pertinent (descriptif sessions interventions
 * collectives). Schema.org `Course` activé sur `/interventions/collectives/*`
 * pour citation AEO "formation IA" sans dilution naming.
 */

import type { PrismaClient } from "../../generated/client";

type SeedBannedPhrase = { pattern: string; reason: string; severity: "block" | "warn" | "info" };

const BANNED_PHRASES: ReadonlyArray<SeedBannedPhrase> = [
  // ===== WARN — Doctrine lexicale assouplie 2026-05-18 P1-2 =====
  // Avant 2026-05-18 : `block` strict (le LLM ne pouvait pas écrire "formation").
  // Après : `warn` — le mot est autorisé en copy quand pertinent (sessions
  // interventions collectives = formations dans le fond), mais le naming brand
  // canonique reste "intervention". Le warn applique pénalité -5/occurrence
  // au qualityScore → décourage la sur-utilisation sans bloquer la sémantique.
  // Cohérent avec Course schema activé sur /interventions/collectives/* pour
  // citation AEO "formation IA".
  {
    pattern: "formation",
    reason:
      "Naming canonique = 'intervention'. Tolérer en copy descriptif, mais préférer 'intervention'",
    severity: "warn",
  },
  {
    pattern: "formateur",
    reason:
      "Naming canonique = 'intervenant'. Tolérer en copy descriptif, mais préférer 'intervenant'",
    severity: "warn",
  },
  {
    pattern: "former",
    reason: "Préférer 'accompagner' / 'faire monter en compétence' ; tolérer en copy descriptif",
    severity: "warn",
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
