/**
 * image-attribute-validator.service.ts — GAP-10 + GAP-20 perfection 2026
 *
 * Valide tous les attributs générés par Claude Sonnet 4.6 vision (alt, caption,
 * description, metaTitle, metaDescription, ogTitle, ogDescription, aiSummary).
 *
 * Formules contraintes : cf. §2.5bis du prompt v1.1 audit autopilote.
 * Si validation échoue → reroll Claude max 2 fois, sinon flag requiresHumanReview.
 *
 * @see axionia/_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md §2.5bis
 */

import type { ImageAsset, ImageAssetTranslation } from "../../../../prisma/generated/client";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type ValidationCheck = {
  name: string;
  ok: boolean;
  message?: string;
};

export type ValidationResult = {
  ok: boolean;
  checks: ValidationCheck[];
};

export type ValidationReport = {
  ok: boolean;
  alt: ValidationResult;
  caption: ValidationResult;
  description: ValidationResult;
  metaTitle: ValidationResult;
  metaDescription: ValidationResult;
  ogTitle: ValidationResult;
  ogDescription: ValidationResult;
  aiSummary: ValidationResult;
  similarity: ValidationResult; // alt vs caption Jaccard < 0.6
};

// ──────────────────────────────────────────────────────────
// Regex banks
// ──────────────────────────────────────────────────────────

const PLEONASM_FR_RE =
  /^(image|photo|photographie|illustration|illustrasi|picture|graphic|cliché)\s+(de|d'|du|des|montrant|représentant)\s+/i;
const PLEONASM_EN_RE =
  /^(image|photo|photograph|illustration|picture|graphic)\s+(of|showing|representing|depicting)\s+/i;

const NAMING_BAD_RE = /(axionia|axion\s+ia|axion-IA-OÜ|axion ia oü)/i;
const NAMING_GOOD_RE = /Axion-IA/;

const SUPERLATIVE_FR_RE = /\b(meilleur|plus\s+grand|leader|n[°o]\s*1|premier|champion)\b/i;
const SUPERLATIVE_EN_RE = /\b(best|biggest|leading|top\s*1|number\s*one|winner)\b/i;

const ANGLICISM_IN_FR_RE = /\b(team|meeting|workshop|brainstorming|brand|skill)\b/i;
const FRENCH_IN_EN_RE = /\b(équipe|réunion|atelier|méthode)\b/i;

const _SEPARATOR_BAD_RE = /[–\-](?!\w)/g; // pas de "–" en-dash ni "-" simple comme séparateur titre (réservé pour validators futurs)

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
  const tokensB = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function countOccurrences(text: string, keyword: string): number {
  if (!keyword) return 0;
  const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (text.match(re) ?? []).length;
}

// ──────────────────────────────────────────────────────────
// Validators individuels
// ──────────────────────────────────────────────────────────

export function validateAlt(
  alt: string,
  options: { locale: "fr" | "en"; keywordsPrimary?: string },
): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: "length_30_125",
      ok: alt.length >= 30 && alt.length <= 125,
      message: `length=${alt.length}, expected 30-125`,
    },
    {
      name: "no_pleonasm",
      ok: !(options.locale === "fr" ? PLEONASM_FR_RE : PLEONASM_EN_RE).test(alt),
      message: "starts with pleonasm pattern (image/photo de...)",
    },
    {
      name: "axion_naming_correct",
      ok: !NAMING_BAD_RE.test(alt) || NAMING_GOOD_RE.test(alt),
      message: "Axion-IA naming must be exact (no spaces, no 'AxionIA')",
    },
    {
      name: "no_keyword_stuffing",
      ok: !options.keywordsPrimary || countOccurrences(alt, options.keywordsPrimary) <= 1,
      message: `keyword '${options.keywordsPrimary}' appears > 1 time`,
    },
    {
      name: "no_superlative",
      ok: !(options.locale === "fr" ? SUPERLATIVE_FR_RE : SUPERLATIVE_EN_RE).test(alt),
      message: "contains superlative (meilleur, leader, best, etc.)",
    },
    {
      name: "locale_strict",
      ok: options.locale === "en" ? !FRENCH_IN_EN_RE.test(alt) : !ANGLICISM_IN_FR_RE.test(alt),
      message: `locale ${options.locale} contains foreign words`,
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export function validateCaption(caption: string, options: { alt: string }): ValidationResult {
  const similarity = jaccardSimilarity(caption, options.alt);
  const checks: ValidationCheck[] = [
    {
      name: "length_80_200",
      ok: caption.length >= 80 && caption.length <= 200,
      message: `length=${caption.length}, expected 80-200`,
    },
    {
      name: "differs_from_alt",
      ok: similarity < 0.6,
      message: `Jaccard similarity vs alt = ${similarity.toFixed(2)} (must be < 0.6)`,
    },
    {
      name: "ends_with_period",
      ok: /\.\s*$/.test(caption),
      message: "caption must end with a period",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export function validateDescription(description: string): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: "length_200_600",
      ok: description.length >= 200 && description.length <= 600,
      message: `length=${description.length}, expected 200-600`,
    },
    {
      name: "first_sentence_citable",
      ok: /^[A-Z].{20,180}\./.test(description),
      message: "first sentence must start with capital + ≥ 20 chars + end period",
    },
    {
      name: "no_html",
      ok: !/<[^>]+>/.test(description),
      message: "description must not contain HTML tags (Markdown only)",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export function validateMetaTitle(
  metaTitle: string,
  options: { locale: "fr" | "en" },
): ValidationResult {
  const endsWithBrand =
    options.locale === "fr"
      ? /\|\s*Axion-IA\s*$/.test(metaTitle)
      : /\|\s*Axion-IA\s*$/.test(metaTitle);

  const checks: ValidationCheck[] = [
    {
      name: "length_50_60",
      ok: metaTitle.length >= 50 && metaTitle.length <= 60,
      message: `length=${metaTitle.length}, expected 50-60 (Google ~580px ~ 60 char)`,
    },
    {
      name: "separator_pipe_or_emdash",
      ok: /\s\|\s|—/.test(metaTitle),
      message: "must contain pipe '|' or em-dash '—' as separator",
    },
    {
      name: "ends_with_brand",
      ok: endsWithBrand,
      message: "must end with '| Axion-IA'",
    },
    {
      name: "no_simple_dash",
      ok: !/\s-\s/.test(metaTitle),
      message: "use em-dash '—' or pipe '|', not simple dash '-'",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export function validateMetaDescription(metaDescription: string): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: "length_140_160",
      ok: metaDescription.length >= 140 && metaDescription.length <= 160,
      message: `length=${metaDescription.length}, expected 140-160 (Google truncation limit)`,
    },
    {
      name: "ends_with_period",
      ok: /\.\s*$/.test(metaDescription),
      message: "must end with a period",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export function validateOgTitle(ogTitle: string): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: "length_max_95",
      ok: ogTitle.length <= 95,
      message: `length=${ogTitle.length}, max 95 (LinkedIn truncation 90)`,
    },
    {
      name: "no_pipe_separator",
      ok: !/\s\|\s/.test(ogTitle),
      message: "pipe '|' perceived spammy by LinkedIn — use em-dash '—'",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export function validateOgDescription(ogDescription: string): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: "length_140_200",
      ok: ogDescription.length >= 140 && ogDescription.length <= 200,
      message: `length=${ogDescription.length}, expected 140-200`,
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export function validateAiSummary(aiSummary: string): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: "length_240_280",
      ok: aiSummary.length >= 240 && aiSummary.length <= 280,
      message: `length=${aiSummary.length}, expected 240-280 (1 phrase citable LLM)`,
    },
    {
      name: "single_sentence",
      ok: (aiSummary.match(/\./g) ?? []).length === 1 && /^[A-Z]/.test(aiSummary),
      message: "must be a single sentence starting with capital + ending with period",
    },
    {
      name: "no_superlative",
      ok: !SUPERLATIVE_FR_RE.test(aiSummary) && !SUPERLATIVE_EN_RE.test(aiSummary),
      message: "contains superlative (meilleur, leader, best, etc.)",
    },
    {
      name: "no_pleonasm_image",
      ok: !PLEONASM_FR_RE.test(aiSummary) && !PLEONASM_EN_RE.test(aiSummary),
      message: "starts with 'image of/photo de' pleonasm",
    },
    {
      name: "mentions_axion_or_module",
      ok: /Axion-IA|audit|intervention|implémentation|formation/i.test(aiSummary),
      message: "must mention Axion-IA or business module",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

// ──────────────────────────────────────────────────────────
// Validator global
// ──────────────────────────────────────────────────────────

export function validateAllAttributes(args: {
  translation: ImageAssetTranslation;
  image: ImageAsset;
  locale: "fr" | "en";
}): ValidationReport {
  const altOpts: { locale: "fr" | "en"; keywordsPrimary?: string } = { locale: args.locale };
  if (args.image.keywordsPrimary) altOpts.keywordsPrimary = args.image.keywordsPrimary;
  const altResult = validateAlt(args.translation.alt ?? "", altOpts);
  const captionResult = validateCaption(args.translation.caption ?? "", {
    alt: args.translation.alt ?? "",
  });
  const descriptionResult = validateDescription(args.translation.description ?? "");
  const metaTitleResult = validateMetaTitle(args.translation.metaTitle ?? "", {
    locale: args.locale,
  });
  const metaDescriptionResult = validateMetaDescription(args.translation.metaDescription ?? "");
  const ogTitleResult = validateOgTitle(
    args.translation.ogTitle ?? args.translation.metaTitle ?? "",
  );
  const ogDescriptionResult = validateOgDescription(
    args.translation.ogDescription ?? args.translation.metaDescription ?? "",
  );
  const aiSummaryResult = validateAiSummary(args.translation.aiSummary ?? "");

  const similarity = jaccardSimilarity(args.translation.alt ?? "", args.translation.caption ?? "");
  const similarityResult: ValidationResult = {
    ok: similarity < 0.6,
    checks: [
      {
        name: "alt_caption_jaccard_lt_0.6",
        ok: similarity < 0.6,
        message: `Jaccard = ${similarity.toFixed(2)}`,
      },
    ],
  };

  const ok =
    altResult.ok &&
    captionResult.ok &&
    descriptionResult.ok &&
    metaTitleResult.ok &&
    metaDescriptionResult.ok &&
    ogTitleResult.ok &&
    ogDescriptionResult.ok &&
    aiSummaryResult.ok &&
    similarityResult.ok;

  return {
    ok,
    alt: altResult,
    caption: captionResult,
    description: descriptionResult,
    metaTitle: metaTitleResult,
    metaDescription: metaDescriptionResult,
    ogTitle: ogTitleResult,
    ogDescription: ogDescriptionResult,
    aiSummary: aiSummaryResult,
    similarity: similarityResult,
  };
}

/**
 * Génère un prompt de correction Claude pour rerun, basé sur les checks échoués.
 * Utilisé par `image-bank-enrich-worker.ts` pour reroll max 2 fois.
 */
export function buildRerollPromptCorrection(report: ValidationReport): string {
  const failedChecks: string[] = [];
  for (const [attr, result] of Object.entries(report)) {
    if (attr === "ok" || typeof result !== "object" || !("checks" in result)) continue;
    for (const check of result.checks) {
      if (!check.ok) {
        failedChecks.push(`- ${attr}.${check.name}: ${check.message ?? "failed"}`);
      }
    }
  }
  return `Les attributs générés ne respectent pas les contraintes suivantes :\n${failedChecks.join("\n")}\n\nRégénère uniquement les attributs en cause, en corrigeant ces problèmes spécifiques. Conserve les attributs corrects identiques.`;
}
