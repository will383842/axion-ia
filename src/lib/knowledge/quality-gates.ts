/**
 * KB V4 — Quality gates heuristiques (§17.3 prompt master).
 *
 * Bloquant immédiat (rejet → audience='team' + Telegram alerte) :
 * - Mot « formation » présent (banned-words gate, alongside)
 * - Longueur body < min_word_count par type (sauf faq/glossary_term)
 * - Aucun H2 dans le body HTML
 * - Liens externes non-https
 * - Embeds iframe non whitelistés (KB-12 sanitize gère déjà)
 *
 * LLM scoring (Claude Haiku 4.5 cached) → KB-13 V4 réel (stub V1 actuel).
 */

import type { KbType } from "../../../prisma/generated/client";
import { getMinWordCount } from "@/content/knowledge/quality-thresholds";

export interface QualityGateResult {
  readonly valid: boolean;
  readonly violations: ReadonlyArray<{ readonly gate: string; readonly detail: string }>;
}

const ALLOWED_EMBED_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "vimeo.com",
  "player.vimeo.com",
  "loom.com",
  "www.loom.com",
]);

const SHORT_TEXT_TYPES = new Set<KbType>([
  "faq",
  "glossary_term",
  "prompt_pattern",
  "competence_boost",
]);

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasH2(bodyHtml: string): boolean {
  return /<h2\b[^>]*>/i.test(bodyHtml);
}

function findNonHttpsLinks(bodyHtml: string): string[] {
  const violations: string[] = [];
  const linkRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(bodyHtml)) !== null) {
    const href = match[1] ?? "";
    if (
      href.startsWith("http://") ||
      (href.startsWith("//") && !href.startsWith("//www.")) // protocol-relative non-secure
    ) {
      violations.push(href);
    }
  }
  return violations;
}

function findNonWhitelistedEmbeds(bodyHtml: string): string[] {
  const violations: string[] = [];
  const iframeRegex = /<iframe\s+[^>]*src\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = iframeRegex.exec(bodyHtml)) !== null) {
    const src = match[1] ?? "";
    try {
      const url = new URL(src);
      if (!ALLOWED_EMBED_DOMAINS.has(url.host.toLowerCase())) {
        violations.push(src);
      }
    } catch {
      violations.push(src); // URL invalide = reject
    }
  }
  return violations;
}

export interface QualityGateInput {
  readonly type: KbType;
  readonly title: string;
  readonly body: string;
  readonly bodyText?: string | null;
}

/**
 * Exécute les gates heuristiques.
 * Banned words gate appliquée SÉPARÉMENT (cf. checkTranslationBannedWords).
 */
export function runHeuristicGates(input: QualityGateInput): QualityGateResult {
  const violations: { gate: string; detail: string }[] = [];

  // Gate 1 : longueur min words (sauf types short autorisés)
  if (!SHORT_TEXT_TYPES.has(input.type)) {
    const text = input.bodyText ?? stripHtml(input.body);
    const wc = countWords(text);
    const min = getMinWordCount(input.type);
    if (wc < min) {
      violations.push({
        gate: "min_word_count",
        detail: `${wc} mots < min ${min} pour type=${input.type}`,
      });
    }
  }

  // Gate 2 : H2 requis (sauf types short)
  if (!SHORT_TEXT_TYPES.has(input.type) && !hasH2(input.body)) {
    violations.push({
      gate: "no_h2_heading",
      detail: "Body sans aucun <h2> — structure requise pour types long-form",
    });
  }

  // Gate 3 : liens externes non-https
  const nonHttps = findNonHttpsLinks(input.body);
  if (nonHttps.length > 0) {
    violations.push({
      gate: "non_https_links",
      detail: `${nonHttps.length} lien(s) non-https : ${nonHttps.slice(0, 3).join(", ")}`,
    });
  }

  // Gate 4 : embeds iframe non whitelistés
  const badEmbeds = findNonWhitelistedEmbeds(input.body);
  if (badEmbeds.length > 0) {
    violations.push({
      gate: "non_whitelisted_embed",
      detail: `${badEmbeds.length} embed(s) non whitelisté(s) : ${badEmbeds.slice(0, 3).join(", ")}`,
    });
  }

  return { valid: violations.length === 0, violations };
}
