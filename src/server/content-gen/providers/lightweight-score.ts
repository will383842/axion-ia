/**
 * Content Generator — Lightweight scoring (Sprint 11.5 V2).
 *
 * Score rapide d'une `GenerationResponse` LLM brute, AVANT le pipeline
 * complet de parsing/sanitize/readability/computeSeoScore. Sert uniquement
 * au compete mode pour départager 2 outputs LLM rapidement.
 *
 * Critères simples (pas d'I/O, pas d'embeddings) :
 *   - Output parsable JSON                       : +20
 *   - title 30-70 chars (sweet spot Google SERP) : +15
 *   - metaDescription 50-160 chars              : +15
 *   - bodyHtml présent et > 1500 chars          : +20
 *   - FAQ count ≥ 5                              : +15
 *   - directAnswer 40-100 mots (AEO)            : +15
 *
 * Score max théorique : 100. Score type d'un bon output : 70-90.
 *
 * Pure function : testable.
 */

import type { GenerationResponse } from "./IProvider";

interface ParsedOutput {
  title?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
  bodyHtml?: unknown;
  directAnswer?: unknown;
  faq?: unknown;
}

function tryParseJson(raw: string): ParsedOutput | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(raw.slice(start, end + 1)) as ParsedOutput;
  } catch {
    return null;
  }
}

export function lightweightSeoScore(response: GenerationResponse): number {
  const parsed = tryParseJson(response.output);
  if (!parsed) return 0;

  let score = 20; // base = JSON parsable

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  if (title.length >= 30 && title.length <= 70) score += 15;

  const metaDescription =
    typeof parsed.metaDescription === "string" ? parsed.metaDescription.trim() : "";
  if (metaDescription.length >= 50 && metaDescription.length <= 160) score += 15;

  const bodyHtml = typeof parsed.bodyHtml === "string" ? parsed.bodyHtml : "";
  if (bodyHtml.length > 1500) score += 20;

  const faq = Array.isArray(parsed.faq) ? parsed.faq : [];
  if (faq.length >= 5) score += 15;

  const directAnswer = typeof parsed.directAnswer === "string" ? parsed.directAnswer.trim() : "";
  const directWordCount = directAnswer.split(/\s+/).filter((w) => w.length > 0).length;
  if (directWordCount >= 40 && directWordCount <= 100) score += 15;

  return score;
}
