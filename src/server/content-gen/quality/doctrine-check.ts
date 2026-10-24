/**
 * Content Generator — Doctrine check (§ 10 + § 21 master prompt + glossaire § 1.1bis).
 *
 * Vérifie qu'un contenu généré respecte la doctrine éditoriale Axion-IA :
 * 1. Anti-SIREN strict (regex SIREN/SIRET/RCS — block)
 * 1bis. Interdits de publication (Qualiopi, CPF, financement, partenariats…) :
 *    module pur `@/lib/contenu/interdits-publication`
 * 2. Naming Axion-IA exact (jamais « AxionIA » ou « Axion IA »)
 * 3. Mot « formation » banni (cf. axionia-core §1)
 * 4. Banned phrases lookup table `BannedPhrase` (severity block/warn/info)
 * 5. Ratio ≥ 95 % AxionIA-centric (heuristic : présence systématique mots-clés
 *    méthodologie/audit/intervention/SSOT tarifs vs données INSEE génériques)
 */

import { prisma } from "@/lib/prisma";
import { findNonSsotPrices } from "./price-gate";
import {
  detecterInterdits,
  normaliserPourControle,
  raisonInterdit,
  type CodeInterdit,
  type OptionsInterdits,
} from "@/lib/contenu/interdits-publication";
import { financementPublicCitable } from "@/server/qualiopi/config/financing";

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
  /** Champ de la sortie où la violation a été trouvée (contrôle de surface). */
  readonly champ?: string;
  /** `phrase-base` = phrase de la table BannedPhrase ; absent = règle du code. */
  readonly origine?: "phrase-base";
}

const SIREN_REGEX = /\b\d{9}\b|\b\d{14}\b|RCS\s+[A-Z]/i;
const NAMING_INCORRECT_REGEX = /\b(AxionIA|Axion\s+IA)\b/g; // doit être Axion-IA

// Les motifs « stat fabriquée », financement, CPF, partenariat, etc. vivent
// désormais dans `@/lib/contenu/interdits-publication` (module pur, texte
// normalisé, bornes de mot explicites). Ici on ne garde que les NOMS de motif
// historiques, utilisés par les journaux et les tests.
const PATTERN_PAR_CODE: Readonly<Record<CodeInterdit, string>> = {
  qualiopi: "financement-interdit",
  cpf: "financement-interdit",
  "financement-100": "financement-interdit",
  "financement-public": "financement-interdit",
  "numero-legal": "financement-interdit",
  partenariat: "partenariat-fabriqué",
  "stat-axion": "stat-fabriquée-Axion-IA",
  "temoignage-axion": "temoignage-axion",
  "citation-temoin": "citation-temoin",
  grenoble: "grenoble",
  "ancrage-local": "ancrage-local",
  "promesse-garantie": "promesse-garantie",
  "faites-le-vous-meme": "faites-le-vous-meme",
  "etiquette-tpe-pme": "etiquette-tpe-pme",
  "slogan-recopie": "slogan-recopie",
  "reservation-paiement": "reservation-paiement",
  "tva-non-facturee": "tva-non-facturee",
  "texte-admin": "texte-admin",
};

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
export async function checkDoctrine(
  text: string,
  options: Partial<OptionsInterdits> = {},
): Promise<DoctrineCheckResult> {
  const optsInterdits: OptionsInterdits = {
    actualite: options.actualite ?? false,
    financementPublicAutorise: options.financementPublicAutorise ?? financementPublicCitable(),
  };
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

  // 2bis. Interdits de publication (stats fabriquées, Qualiopi, CPF, financement,
  // partenariats, Grenoble, « garanti »…). Un seul module pur, texte normalisé.
  for (const d of detecterInterdits(text, optsInterdits)) {
    const reason = raisonInterdit(d.code);
    blocking.push({
      pattern: PATTERN_PAR_CODE[d.code],
      severity: "block",
      reason,
      occurrences: d.occurrences,
    });
    // Le CPF garde aussi son nom historique (journaux et anciens tests).
    if (d.code === "cpf") {
      blocking.push({
        pattern: "CPF-non-autorise",
        severity: "block",
        reason,
        occurrences: d.occurrences,
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
        // Règles « formation / formateur / former » RETIRÉES le 2026-08-10
        // (décision Will). Elles dégradaient encore ces mots en `warn` alors que
        // le site vend 21 formations au catalogue, expose « Formations IA » en
        // navigation et indexe `/formations/*`. Le générateur signalait donc
        // comme suspect le vocabulaire officiel de l'offre.
        // Ne pas les réintroduire.
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
    { pattern: "unique", allowedRegex: /(?<![a-z0-9])angle unique par ville(?![a-z0-9])/ },
  ];

  // Texte et motif normalisés (accents retirés) avec bornes de mot explicites :
  // `\b` ne voit pas « é » comme une lettre de mot, donc « instantané » ne
  // pouvait jamais être trouvé.
  const lower = normaliserPourControle(text);
  for (const phrase of bannedPhrases) {
    const motif = normaliserPourControle(phrase.pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!motif) continue;
    const re = new RegExp(`(?<![a-z0-9])${motif}(?![a-z0-9])`, "g");
    const matches = lower.match(re);
    if (!matches) continue;

    // Soustraction des occurrences couvertes par une exception doctrinaire.
    let occurrences = matches.length;
    const exception = DOCTRINE_EXCEPTIONS.find(
      (e) => e.pattern.toLowerCase() === phrase.pattern.toLowerCase(),
    );
    if (exception) {
      const exemptMatches = lower.match(new RegExp(exception.allowedRegex.source, "g"));
      if (exemptMatches) occurrences = Math.max(0, occurrences - exemptMatches.length);
    }
    if (occurrences === 0) continue;

    const violation: DoctrineViolation = {
      pattern: phrase.pattern,
      severity: phrase.severity as "block" | "warn" | "info",
      reason: phrase.reason ?? "Phrase doctrine",
      occurrences,
      origine: "phrase-base",
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
