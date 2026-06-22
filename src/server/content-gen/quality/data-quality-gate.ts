/**
 * Gate de complétude qualité (P0 perfection 2026).
 *
 * Avant ce gate, `content-publish-worker` coerçait keyTakeaway / expertQuote /
 * faqJson / directAnswer vers `null` puis publiait QUAND MÊME → des articles
 * « à trous » (sans synthèse citable, sans FAQPage ≥4 Q/R, sans réponse directe,
 * sans sources) partaient en prod et étaient indexés. Or sans ces briques :
 * aucune Position 0 / AI Overview / citation LLM (Claude / Perplexity / SGE).
 *
 * Ce module est PUR (aucune dépendance DB) → testable en isolation et appelable
 * par le worker. La décision « bloquer vs juste loguer » appartient à l'appelant
 * (flag `CONTENT_QUALITY_GATE_ENABLED`, cf. content-publish-worker).
 *
 * Exigences PAR TYPE de contenu :
 *   - Tous : directAnswer ≥ 40 mots, FAQ ≥ 4 items valides, ≥ 2 citations.
 *   - blog / guides (PAS la veille `blog_from_rss`) : + keyTakeaway ≥ 5 mots
 *     + citation expert (nom + texte ≥ 15 mots). La veille RSS est curative et
 *     n'embarque pas toujours d'avis d'expert interne → on n'exige que le socle.
 */

import { parseFaqItems } from "@/server/content-gen/shared/faq-items";

export interface DataQualityInput {
  /** ContentGenJob.contentType (ex. "blog", "guides", "blog_from_rss"). */
  readonly contentType: string;
  readonly keyTakeaway: string | null;
  readonly expertQuote: { readonly name: string; readonly text: string } | null;
  /** Json libre `Article.faqJson` (validé en interne via parseFaqItems strict). */
  readonly faqJson: unknown;
  readonly directAnswer: string | null;
  /** Nombre de liens externes RÉELS détectés dans le corps (detection.valid). */
  readonly citationCount: number;
}

export interface DataQualityResult {
  readonly ok: boolean;
  readonly reasons: ReadonlyArray<string>;
}

const MIN_DIRECT_ANSWER_WORDS = 40;
const MIN_KEY_TAKEAWAY_WORDS = 5;
const MIN_EXPERT_QUOTE_WORDS = 15;
const MIN_FAQ_ITEMS = 4;
const MIN_CITATIONS = 2;

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

export function validateDataQuality(input: DataQualityInput): DataQualityResult {
  const reasons: string[] = [];
  const isNews = input.contentType === "blog_from_rss";

  // Réponse directe citable (Position 0 / AI Overview) — tous types.
  if (!input.directAnswer || wordCount(input.directAnswer) < MIN_DIRECT_ANSWER_WORDS) {
    reasons.push(`directAnswer absent ou < ${MIN_DIRECT_ANSWER_WORDS} mots`);
  }

  // FAQPage rich result — ≥ 4 Q/R valides (validation stricte anti-placeholder).
  const validFaq = parseFaqItems(input.faqJson, { strict: true });
  if (validFaq.length < MIN_FAQ_ITEMS) {
    reasons.push(`FAQ valide insuffisante (${validFaq.length}/${MIN_FAQ_ITEMS})`);
  }

  // Sources / E-E-A-T — ≥ 2 citations externes réelles.
  if (input.citationCount < MIN_CITATIONS) {
    reasons.push(`citations externes insuffisantes (${input.citationCount}/${MIN_CITATIONS})`);
  }

  // Point clé + avis d'expert : exigés pour blog/guides (pas la veille RSS).
  if (!isNews) {
    if (!input.keyTakeaway || wordCount(input.keyTakeaway) < MIN_KEY_TAKEAWAY_WORDS) {
      reasons.push(`point clé (keyTakeaway) absent ou < ${MIN_KEY_TAKEAWAY_WORDS} mots`);
    }
    if (
      !input.expertQuote ||
      input.expertQuote.name.trim().length === 0 ||
      wordCount(input.expertQuote.text) < MIN_EXPERT_QUOTE_WORDS
    ) {
      reasons.push(`citation expert absente ou < ${MIN_EXPERT_QUOTE_WORDS} mots`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
