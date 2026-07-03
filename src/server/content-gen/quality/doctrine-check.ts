/**
 * Content Generator — Doctrine check (§ 10 + § 21 master prompt + glossaire § 1.1bis).
 *
 * Vérifie qu'un contenu généré respecte la doctrine éditoriale Axion-IA :
 * 1. Anti-SIREN strict (regex SIREN/SIRET/RCS — block)
 * 2. Naming Axion-IA exact (jamais « AxionIA » ou « Axion IA »)
 * 3. Mot « formation » banni (cf. axionia-core §1)
 * 4. Banned phrases lookup table `BannedPhrase` (severity block/warn/info)
 * 5. Ratio ≥ 95 % AxionIA-centric (heuristic : présence systématique mots-clés
 *    méthodologie/audit/intervention/SSOT tarifs vs données INSEE génériques)
 */

import { prisma } from "@/lib/prisma";
import { findNonSsotPrices } from "./price-gate";

export interface DoctrineCheckResult {
  readonly passed: boolean;
  readonly blockingViolations: ReadonlyArray<DoctrineViolation>;
  readonly warnings: ReadonlyArray<DoctrineViolation>;
  readonly infos: ReadonlyArray<DoctrineViolation>;
  readonly axionIaCentricRatio: number;
}

export interface DoctrineViolation {
  readonly pattern: string;
  readonly severity: "block" | "warn" | "info";
  readonly reason: string;
  readonly occurrences: number;
}

const SIREN_REGEX = /\b\d{9}\b|\b\d{14}\b|RCS\s+[A-Z]/i;
const NAMING_INCORRECT_REGEX = /\b(AxionIA|Axion\s+IA)\b/g; // doit être Axion-IA

// Stats « propriétaires » fabriquées (audit blog 2026-07-03). Le LLM inventait
// des statistiques auto-attribuées présentées comme des faits (« 89 % … données
// Axion-IA, évaluations 2024-2025 », « étude interne Axion-IA, n=87 dirigeants »).
// Invérifiables → risque E-E-A-T. On BLOQUE : aucun chiffre ne doit être attribué
// à des données internes Axion-IA. `\b` ancré pour ne PAS matcher « ressources
// Axion-IA » (source ⊂ ressource) ni les mentions brand légitimes.
const FABRICATED_STAT_PATTERNS: ReadonlyArray<{ re: RegExp; reason: string }> = [
  {
    re: /\b(?:données|mesures|chiffres|statistiques?)\s+(?:internes?\s+)?(?:d['’]\s*)?Axion-?IA/gi,
    reason:
      "Statistique auto-attribuée à des « données internes Axion-IA » (invérifiable, E-E-A-T). Citer une source publique vérifiable OU formuler qualitativement, sans chiffre inventé.",
  },
  {
    re: /\bsource\s+interne\s+Axion-?IA/gi,
    reason:
      "Attribution « source interne Axion-IA » d'une donnée fabriquée. Retirer ou sourcer publiquement.",
  },
  {
    re: /\bétude\s+interne\b/gi,
    reason:
      "Renvoi à une « étude interne » (propriétaire, invérifiable). Interdit sauf source publique.",
  },
  {
    re: /\bn\s*=\s*\d{1,5}\b/g,
    reason:
      "Taille d'échantillon (« n=87 ») d'une étude interne fabriquée. Retirer ou sourcer publiquement.",
  },
  {
    re: /\bévaluations?\s+20\d{2}(?:\s*[-–]\s*20\d{2})?/gi,
    reason: "Attribution « évaluations 20XX » d'une étude propriétaire fabriquée.",
  },
];

const AXIONIA_KEYWORDS = [
  "axion-ia",
  "méthodologie",
  "audit",
  "intervention",
  "implémentation",
  "cabinet",
  "opérationnel",
];

const INSEE_KEYWORDS = ["population", "habitants", "insee", "pib", "communes voisines"];

/**
 * Calcule le ratio AxionIA-centric : présence/densité keywords brand vs INSEE.
 * Cible ≥ 0.95 (doctrine § 1.2). V1 = heuristic simple word frequency.
 */
function computeAxionIaRatio(text: string): number {
  const lower = text.toLowerCase();
  let axionCount = 0;
  let inseeCount = 0;
  for (const kw of AXIONIA_KEYWORDS) {
    const matches = lower.match(new RegExp(`\\b${kw}\\b`, "g"));
    if (matches) axionCount += matches.length;
  }
  for (const kw of INSEE_KEYWORDS) {
    const matches = lower.match(new RegExp(`\\b${kw}\\b`, "g"));
    if (matches) inseeCount += matches.length;
  }
  const total = axionCount + inseeCount;
  return total === 0 ? 1 : axionCount / total;
}

/**
 * Lance le doctrine-check complet sur un texte.
 * Lit BannedPhrase DB si disponible (fallback hardcoded list si P2021).
 */
export async function checkDoctrine(text: string): Promise<DoctrineCheckResult> {
  const blocking: DoctrineViolation[] = [];
  const warnings: DoctrineViolation[] = [];
  const infos: DoctrineViolation[] = [];

  // 1. Anti-SIREN
  const sirenMatches = text.match(SIREN_REGEX);
  if (sirenMatches) {
    blocking.push({
      pattern: "SIREN/SIRET/RCS",
      severity: "block",
      reason:
        "SIREN non encore disponible — utiliser le placeholder [SIREN à compléter] jusqu'à réception du numéro définitif",
      occurrences: sirenMatches.length,
    });
  }

  // 2. Naming Axion-IA strict
  const namingMatches = text.match(NAMING_INCORRECT_REGEX);
  if (namingMatches) {
    blocking.push({
      pattern: "AxionIA / Axion IA",
      severity: "block",
      reason: "Naming brand : utiliser 'Axion-IA' exactement (avec tiret)",
      occurrences: namingMatches.length,
    });
  }

  // 2bis. Stats « propriétaires » fabriquées (auto-attribuées à Axion-IA).
  for (const { re, reason } of FABRICATED_STAT_PATTERNS) {
    const matches = text.match(re);
    if (matches) {
      blocking.push({
        pattern: "stat-fabriquée-Axion-IA",
        severity: "block",
        reason,
        occurrences: matches.length,
      });
    }
  }

  // 3. Banned phrases (DB ou fallback)
  let bannedPhrases: ReadonlyArray<{
    pattern: string;
    reason: string | null;
    severity: string;
  }> = [];
  try {
    bannedPhrases = await prisma.bannedPhrase.findMany({
      where: { isActive: true },
      select: { pattern: true, reason: true, severity: true },
    });
  } catch (err) {
    // P2021 / PrismaClientInitializationError → fallback liste hardcoded minimale
    if (
      err instanceof Error &&
      (("code" in err && (err as { code: string }).code === "P2021") ||
        err.constructor.name === "PrismaClientInitializationError")
    ) {
      // Audit 2026-05-15 P1-18 : fallback étendu ≥10 phrases pour tenir la
      // doctrine §21 même quand DB indisponible (premier deploy avant seed,
      // ou panne Postgres). Mirrors a representative subset of the seed
      // BannedPhrase corpus (54 phrases prod) avec les bloquants critiques.
      bannedPhrases = [
        // City Domination 2026-05-18 P1-2 (décision Will Option A) — Lecture
        // allégée : "formation" / "formateur" / "former" passent de `block`
        // à `warn` (cohérent avec seed banned-phrases.ts:44-60). Le naming
        // brand reste "intervention" / "cabinet IA opérationnel" mais le mot
        // "formation" est tolérée en copy quand pertinent (descriptif sessions
        // interventions collectives). Schema.org `Course` activé sur
        // /interventions/collectives/* pour citation AEO sans dilution naming.
        {
          pattern: "formation",
          reason: "Naming canonique = 'intervention'. Tolérer en copy descriptif",
          severity: "warn",
        },
        {
          pattern: "formations",
          reason: "Naming canonique = 'interventions'. Tolérer en copy descriptif",
          severity: "warn",
        },
        {
          pattern: "formateur",
          reason: "Naming canonique = 'intervenant'. Tolérer en copy descriptif",
          severity: "warn",
        },
        {
          pattern: "formatrice",
          reason: "Naming canonique = 'intervenante'. Tolérer en copy descriptif",
          severity: "warn",
        },
        {
          pattern: "former",
          reason: "Préférer 'accompagner' / 'faire monter en compétence' ; tolérer en copy",
          severity: "warn",
        },
        // Marketing-hype §21 (warn)
        { pattern: "le meilleur", reason: "Marketing-hype", severity: "warn" },
        { pattern: "la meilleure", reason: "Marketing-hype", severity: "warn" },
        { pattern: "révolutionnaire", reason: "Marketing-hype", severity: "warn" },
        { pattern: "révolutionner", reason: "Marketing-hype", severity: "warn" },
        { pattern: "incroyable", reason: "Marketing-hype", severity: "warn" },
        { pattern: "exceptionnel", reason: "Marketing-hype", severity: "warn" },
        {
          pattern: "unique",
          reason: "Marketing-hype (sauf 'angle unique par ville')",
          severity: "warn",
        },
        { pattern: "garanti", reason: "Marketing-hype (promesse non tenable)", severity: "warn" },
        {
          pattern: "sans risque",
          reason: "Marketing-hype (promesse non tenable)",
          severity: "warn",
        },
        { pattern: "instantané", reason: "Marketing-hype (promesse temporelle)", severity: "warn" },
      ];
    } else {
      throw err;
    }
  }

  // Exceptions doctrinaires SEO légitimes (Pass B P1-1) — patterns banned-phrases
  // tolérés dans des contextes anti-doorway HCU explicites.
  // Ex: "angle unique par ville" justifie le mot « unique » (différenciation
  // sémantique pour échapper aux doorway pages massivement clonées).
  const DOCTRINE_EXCEPTIONS: ReadonlyArray<{ pattern: string; allowedRegex: RegExp }> = [
    { pattern: "unique", allowedRegex: /\bangle\s+unique\s+par\s+ville\b/i },
  ];

  const lower = text.toLowerCase();
  for (const phrase of bannedPhrases) {
    const re = new RegExp(
      `\\b${phrase.pattern.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "g",
    );
    const matches = lower.match(re);
    if (!matches) continue;

    // Soustraction des occurrences couvertes par une exception doctrinaire.
    let occurrences = matches.length;
    const exception = DOCTRINE_EXCEPTIONS.find(
      (e) => e.pattern.toLowerCase() === phrase.pattern.toLowerCase(),
    );
    if (exception) {
      const exemptMatches = text.match(new RegExp(exception.allowedRegex.source, "gi"));
      if (exemptMatches) occurrences = Math.max(0, occurrences - exemptMatches.length);
    }
    if (occurrences === 0) continue;

    const violation: DoctrineViolation = {
      pattern: phrase.pattern,
      severity: phrase.severity as "block" | "warn" | "info",
      reason: phrase.reason ?? "Phrase doctrine",
      occurrences,
    };
    if (phrase.severity === "block") blocking.push(violation);
    else if (phrase.severity === "warn") warnings.push(violation);
    else infos.push(violation);
  }

  // 3bis. Price-gate SSOT — bloque tout montant € absent de pricing.ts (les
  // tokens {{price:…}} n'ont pas de « € » littéral → jamais flaggés). Force le
  // contenu généré à n'utiliser que des tarifs SSOT ou des tokens.
  for (const pv of findNonSsotPrices(text)) {
    blocking.push({
      pattern: `prix-non-SSOT:${pv.amount}`,
      severity: "block",
      reason: `Montant « ${pv.amount} » absent de pricing.ts (SSOT). Utiliser un token {{price:<tierId>}} ou un tarif de la grille.`,
      occurrences: 1,
    });
  }

  // 4. Ratio AxionIA-centric
  const ratio = computeAxionIaRatio(text);
  if (ratio < 0.6) {
    blocking.push({
      pattern: "axionia_centric_ratio",
      severity: "block",
      reason: `Ratio AxionIA-centric ${(ratio * 100).toFixed(0)}% < 60% — contenu trop INSEE-centric (doctrine § 1.2 anti-doorway)`,
      occurrences: 1,
    });
  } else if (ratio < 0.95) {
    warnings.push({
      pattern: "axionia_centric_ratio",
      severity: "warn",
      reason: `Ratio AxionIA-centric ${(ratio * 100).toFixed(0)}% < 95% cible`,
      occurrences: 1,
    });
  }

  return {
    passed: blocking.length === 0,
    blockingViolations: blocking,
    warnings,
    infos,
    axionIaCentricRatio: ratio,
  };
}
