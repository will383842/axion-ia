/**
 * image-taxonomy-detector.service.ts — GAP-01 perfection 2026
 *
 * Auto-classe une image dans la taxonomie métier Axion-IA :
 *   - module: "interventions" | "audits" | "implementations"
 *   - subModule: slug sous-page canonique (cf. taxonomy.ts SSOT)
 *   - targetEntity: slug = subModule par défaut
 *   - targetCity, targetRegion, targetSize, targetPersona, targetSector, targetTechno, targetFormat, targetDuration
 *
 * Stratégie :
 *   1. Pattern matching déterministe (keywords + translations) — confiance ≥ 0.7
 *   2. Fallback Claude Sonnet 4.6 vision si confiance < 0.7
 *   3. Si Claude < 0.7 confiance également → flag `requiresHumanTaxonomy: true`
 *
 * @see axionia/_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md §3 + §4.3
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";
import {
  MODULES,
  SUB_MODULES_BY_MODULE,
  type Module,
  type SubModule,
} from "@/server/image-bank/taxonomy";
import type { ImageAsset, ImageAssetTranslation } from "../../../../prisma/generated/client";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type TaxonomyDetectionResult = {
  module: Module | null;
  subModule: string | null;
  targetEntity: string | null;
  targetCity: string | null;
  targetRegion: string | null;
  targetSize: "tpe" | "pme" | "eti" | "grande-entreprise" | null;
  targetPersona: string | null;
  targetSector: string | null;
  targetTechno: string | null;
  targetFormat: "presentiel" | "distanciel" | "hybride" | "replay" | "livrable" | null;
  targetDuration: string | null;
  confidence: number; // 0-1
  source: "pattern" | "claude" | "human-required";
  reasoning: string;
};

// ──────────────────────────────────────────────────────────
// Pattern matching déterministe
// ──────────────────────────────────────────────────────────

const MODULE_KEYWORDS: Record<Module, RegExp[]> = {
  interventions: [
    /intervention/i,
    /atelier/i,
    /formation/i,
    /coaching/i,
    /conférence/i,
    /conference/i,
    /accompagnement/i,
    /workshop/i,
    /training/i,
  ],
  audits: [
    /\baudit/i,
    /diagnostic/i,
    /analyse/i,
    /évaluation/i,
    /assessment/i,
    /flash/i,
    /stratégique/i,
  ],
  implementations: [
    /implémentation/i,
    /implementation/i,
    /déploiement/i,
    /chatbot/i,
    /agent/i,
    /automatisation/i,
    /crm/i,
    /erp/i,
    /no-code/i,
    /intégration/i,
    /custom/i,
  ],
  // Modules image-bank complémentaires — pas de pattern matching auto (valeur figée par seed)
  "un-a-un": [],
  graphique: [],
  logo: [],
  proposition: [],
  ville: [],
};

const PERSONA_KEYWORDS: Record<string, RegExp[]> = {
  dirigeant: [/dirigeant/i, /pdg/i, /ceo/i, /président/i],
  "direction-marketing": [/direction.{0,15}marketing/i, /cmo/i, /marketing.{0,5}director/i],
  "direction-rh": [/direction.{0,15}rh/i, /chro/i, /hr.{0,5}director/i],
  "direction-financiere": [/direction.{0,15}financière/i, /cfo/i, /finance.{0,5}director/i],
  "direction-it": [/direction.{0,15}it/i, /cto/i, /cio/i],
  operationnel: [/opérationnel/i, /équipe.{0,10}terrain/i, /agent/i],
  equipe: [/équipe/i, /team/i, /collaborateurs/i],
};

const SECTOR_KEYWORDS: Record<string, RegExp[]> = {
  industrie: [/industri/i, /usine/i, /manufactur/i, /production/i],
  services: [/services/i, /conseil/i, /consulting/i],
  commerce: [/commerce/i, /retail/i, /distribution/i],
  sante: [/santé/i, /clinique/i, /hôpital/i, /medical/i],
  juridique: [/juridique/i, /cabinet.{0,10}avocat/i, /legal/i],
  immobilier: [/immobilier/i, /real.{0,5}estate/i],
  formation: [/formation/i, /école/i, /university/i],
  tech: [/tech/i, /startup/i, /saas/i, /software/i],
};

const TECHNO_KEYWORDS: Record<string, RegExp[]> = {
  claude: [/claude/i, /anthropic/i],
  gpt: [/gpt/i, /openai/i, /chatgpt/i],
  gemini: [/gemini/i, /google\s+ai/i],
  mistral: [/mistral/i],
  llama: [/llama/i],
  n8n: [/\bn8n\b/i],
  zapier: [/zapier/i],
  make: [/\bmake\b/i, /integromat/i],
  notion: [/notion/i],
  airtable: [/airtable/i],
  python: [/python/i],
  "no-code": [/no.{0,5}code/i, /nocode/i],
};

const FORMAT_KEYWORDS: Record<string, RegExp[]> = {
  presentiel: [/présentiel/i, /sur.{0,5}site/i, /in.{0,5}person/i, /onsite/i],
  distanciel: [/distanciel/i, /à.{0,5}distance/i, /remote/i, /online/i, /visio/i, /zoom/i],
  hybride: [/hybride/i, /hybrid/i],
  replay: [/replay/i, /enregistrement/i],
  livrable: [/livrable/i, /deliverable/i, /rapport/i],
};

// ──────────────────────────────────────────────────────────
// Detector pipeline
// ──────────────────────────────────────────────────────────

function buildSearchText(image: ImageAsset, translations: ImageAssetTranslation[]): string {
  const parts: string[] = [];
  parts.push(image.keywordsPrimary ?? "");
  const secondary = image.keywordsSecondary as unknown;
  if (Array.isArray(secondary)) {
    parts.push(...secondary.map((s) => String(s)));
  }
  parts.push(image.geoPlacename ?? "");
  parts.push(image.geoRegion ?? "");
  for (const t of translations) {
    parts.push(t.title ?? "", t.alt ?? "", t.caption ?? "", t.description ?? "");
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function detectModule(text: string): { module: Module | null; confidence: number } {
  const coreModules = ["interventions", "audits", "implementations"] as const;
  const scores: Record<string, number> = { interventions: 0, audits: 0, implementations: 0 };
  for (const mod of coreModules) {
    for (const pattern of MODULE_KEYWORDS[mod]) {
      if (pattern.test(text)) scores[mod] = (scores[mod] ?? 0) + 1;
    }
  }
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const second = Object.entries(scores).sort((a, b) => b[1] - a[1])[1];
  if (!top || top[1] === 0) return { module: null, confidence: 0 };
  const gap = top[1] - (second?.[1] ?? 0);
  const confidence = Math.min(1, top[1] * 0.25 + gap * 0.25);
  return { module: top[0] as Module, confidence };
}

function detectSubModule(
  text: string,
  module: Module,
): { subModule: string | null; confidence: number } {
  const candidates = SUB_MODULES_BY_MODULE[module];
  let bestMatch: { sub: string | null; score: number } = { sub: null, score: 0 };
  for (const sub of candidates) {
    // Match exact du slug ou variantes hyphen/space
    const variants = [sub, sub.replace(/-/g, " "), sub.replace(/-/g, "")];
    let score = 0;
    for (const v of variants) {
      const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text)) score += 1;
    }
    if (score > bestMatch.score) bestMatch = { sub, score };
  }
  if (bestMatch.score === 0) return { subModule: null, confidence: 0 };
  return { subModule: bestMatch.sub, confidence: Math.min(1, bestMatch.score * 0.4) };
}

function detectFirstMatch<T extends string>(text: string, bank: Record<T, RegExp[]>): T | null {
  for (const [key, patterns] of Object.entries(bank) as [T, RegExp[]][]) {
    for (const re of patterns) {
      if (re.test(text)) return key;
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// Claude vision fallback
// ──────────────────────────────────────────────────────────

const CLAUDE_TAXONOMY_PROMPT = `Tu es un classifieur métier Axion-IA. Analyse l'image fournie et les translations FR/EN.

Réponds en JSON strict suivant ce schéma :
{
  "module": "interventions" | "audits" | "implementations" | null,
  "subModule": <slug parmi liste fournie> | null,
  "targetPersona": "dirigeant" | "direction-marketing" | "direction-rh" | "direction-financiere" | "direction-it" | "operationnel" | "equipe" | null,
  "targetSector": "industrie" | "services" | "commerce" | "sante" | "juridique" | "immobilier" | "formation" | "tech" | "b2b-generique" | null,
  "targetTechno": "claude" | "gpt" | "gemini" | "mistral" | "llama" | "n8n" | "zapier" | "make" | "notion" | "airtable" | "python" | "no-code" | "agnostic" | null,
  "targetFormat": "presentiel" | "distanciel" | "hybride" | "replay" | "livrable" | null,
  "confidence": 0.0-1.0,
  "reasoning": "<1 phrase factuelle expliquant ta classification>"
}

Tolérance : si l'image ne permet pas de trancher → confidence < 0.7 et expliquer dans reasoning.

NE PAS inventer. Si tu ne sais pas → null + confidence basse.`;

async function detectViaClaudeVision(args: {
  image: ImageAsset;
  translations: ImageAssetTranslation[];
  cdnUrl: string;
}): Promise<Partial<TaxonomyDetectionResult>> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const imageUrl = `${args.cdnUrl}/image-bank/${args.image.id}/image-md.webp`;

  const translationContext = args.translations
    .map(
      (t) =>
        `[${t.languageCode}] title="${t.title ?? ""}" alt="${t.alt ?? ""}" caption="${t.caption ?? ""}"`,
    )
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: `${CLAUDE_TAXONOMY_PROMPT}\n\nTranslations:\n${translationContext}`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { confidence: 0, source: "claude", reasoning: "Claude response empty" };
  }

  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      module: parsed.module ?? null,
      subModule: parsed.subModule ?? null,
      targetPersona: parsed.targetPersona ?? null,
      targetSector: parsed.targetSector ?? null,
      targetTechno: parsed.targetTechno ?? null,
      targetFormat: parsed.targetFormat ?? null,
      confidence: parsed.confidence ?? 0,
      source: "claude",
      reasoning: parsed.reasoning ?? "",
    };
  } catch (err) {
    return { confidence: 0, source: "claude", reasoning: `Parse error: ${(err as Error).message}` };
  }
}

// ──────────────────────────────────────────────────────────
// Detector public
// ──────────────────────────────────────────────────────────

export async function detectTaxonomy(args: {
  image: ImageAsset;
  translations: ImageAssetTranslation[];
  cdnUrl: string;
}): Promise<TaxonomyDetectionResult> {
  const text = buildSearchText(args.image, args.translations);

  const moduleResult = detectModule(text);
  let subModuleResult: { subModule: string | null; confidence: number } = {
    subModule: null,
    confidence: 0,
  };
  if (moduleResult.module) {
    subModuleResult = detectSubModule(text, moduleResult.module);
  }

  const targetPersona = detectFirstMatch(text, PERSONA_KEYWORDS);
  const targetSector = detectFirstMatch(text, SECTOR_KEYWORDS);
  const targetTechno = detectFirstMatch(text, TECHNO_KEYWORDS);
  const targetFormat = detectFirstMatch(
    text,
    FORMAT_KEYWORDS,
  ) as TaxonomyDetectionResult["targetFormat"];

  // Confidence combinée
  const totalConfidence = (moduleResult.confidence + subModuleResult.confidence) / 2;
  let source: TaxonomyDetectionResult["source"] = "pattern";
  let reasoning = `Pattern: module=${moduleResult.module} (${moduleResult.confidence.toFixed(2)}), subModule=${subModuleResult.subModule} (${subModuleResult.confidence.toFixed(2)})`;

  // Si pattern trop faible → Claude fallback
  if (totalConfidence < 0.7) {
    const claudeResult = await detectViaClaudeVision(args);
    if ((claudeResult.confidence ?? 0) > totalConfidence) {
      return {
        module: claudeResult.module ?? moduleResult.module ?? null,
        subModule: claudeResult.subModule ?? subModuleResult.subModule ?? null,
        targetEntity: claudeResult.subModule ?? subModuleResult.subModule ?? null,
        targetCity: args.image.geoPlacename ?? null,
        targetRegion: args.image.geoRegion ?? null,
        targetSize: null, // requires explicit data, not inferrable
        targetPersona: claudeResult.targetPersona ?? targetPersona,
        targetSector: claudeResult.targetSector ?? targetSector,
        targetTechno: claudeResult.targetTechno ?? targetTechno,
        targetFormat: claudeResult.targetFormat ?? targetFormat,
        targetDuration: null,
        confidence: claudeResult.confidence ?? 0,
        source: "claude",
        reasoning: `Pattern weak (${totalConfidence.toFixed(2)}), Claude: ${claudeResult.reasoning}`,
      };
    }
  }

  // Si toujours < 0.7 après Claude → human required
  if (totalConfidence < 0.7) {
    source = "human-required";
    reasoning += " — confidence too low, flag requiresHumanTaxonomy=true";
  }

  return {
    module: moduleResult.module,
    subModule: subModuleResult.subModule,
    targetEntity: subModuleResult.subModule,
    targetCity: args.image.geoPlacename ?? null,
    targetRegion: args.image.geoRegion ?? null,
    targetSize: null,
    targetPersona,
    targetSector,
    targetTechno,
    targetFormat,
    targetDuration: null,
    confidence: totalConfidence,
    source,
    reasoning,
  };
}

/**
 * Dérive l'URL canonique de la page métier liée à l'image (subjectOfUrl GAP-02).
 */
export function deriveSubjectOfUrl(args: {
  module: Module | null;
  subModule: string | null;
  targetCity: string | null;
  siteUrl: string;
}): string | null {
  if (!args.module) return null;

  if (args.targetCity && args.subModule === "par-ville") {
    return `${args.siteUrl}/fr/${args.module}/par-ville/${args.targetCity}`;
  }

  if (args.subModule) {
    return `${args.siteUrl}/fr/${args.module}/${args.subModule}`;
  }

  return `${args.siteUrl}/fr/${args.module}`;
}

/**
 * Type Service/Course/Article/Event selon module + subModule (cf. §2.6.1).
 */
export function deriveSubjectOfType(args: {
  module: Module | null;
  subModule: string | null;
}): "Service" | "Course" | "Article" | "Event" {
  if (!args.module) return "Article";
  if (args.module === "audits") return "Service";
  if (args.module === "implementations") return "Service";
  if (args.module === "interventions") {
    if (args.subModule && /formation|atelier|coaching/.test(args.subModule)) return "Course";
    if (args.subModule && /conference/.test(args.subModule)) return "Event";
  }
  return "Service";
}
