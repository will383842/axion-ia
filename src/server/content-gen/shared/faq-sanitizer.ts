/**
 * Content Generator — FAQ sanitizer (Sprint S+5 P2-8 + P2-9, 2026-05-20).
 *
 * Pourquoi un sanitizer dédié aux FAQ (et pas réutiliser `html-sanitizer.ts`) :
 *
 * - **Whitelist plus stricte** : les réponses FAQ sont des micro-contenus
 *   structurés (≤ 5 phrases). Pas de h2/h3/tableaux/iframe/img — uniquement
 *   du texte enrichi minimal pour la lisibilité (`p, strong, em, a, ul, ol,
 *   li, br`). Plus la whitelist est restreinte, plus la surface d'attaque XSS
 *   est réduite (défense en profondeur).
 *
 * - **Détection placeholder traduction EN** (P2-9) : si la réponse contient
 *   `[TBD]`, `TODO`, `Lorem ipsum`, `placeholder`, `XXX` ou similaire, on
 *   considère que la traduction n'existe pas réellement et on **refuse**
 *   l'insertion (skip avec log). Évite de polluer la DB avec du contenu
 *   bouchon visible côté frontend public.
 *
 * Doctrine d'usage :
 *   - À appeler sur TOUTE réponse FAQ avant insert/upsert DB.
 *   - Retourne `{ html: string; skip: boolean; reason?: string }` pour que
 *     l'appelant puisse logger la raison du skip et alerter Sentry si
 *     volumétrie anormale.
 *
 * Vecteurs OWASP couverts : voir tests `faq-sanitizer.test.ts`.
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Whitelist FAQ — TRÈS restreinte (≤ 8 tags) alignée P2-8 instructions.
 *
 * Pas de h*, table, img, figure, section, article, blockquote, code, pre,
 * details, summary : les réponses FAQ doivent rester du paragraphe simple.
 */
const ALLOWED_TAGS = ["p", "strong", "em", "a", "ul", "ol", "li", "br"];

const ALLOWED_ATTR = ["href", "title", "rel", "target"];

/**
 * Patterns placeholder traduction non-faite. Insensibles à la casse pour
 * certains, littéraux pour les patterns non-alphabétiques (les word
 * boundaries `\b` ne s'appliquent pas autour de `?` ou autres chars
 * non-word, on doit donc utiliser des séparateurs explicites).
 *
 * Si un de ces patterns est détecté dans la réponse → skip insert.
 */
const PLACEHOLDER_PATTERNS: ReadonlyArray<RegExp> = [
  /\[TBD\]/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bTBD\b/,
  /\bN\/A\b/,
  /\bplaceholder\b/i,
  /\blorem\s+ipsum\b/i,
  /\bX{3,}\b/, // "XXX", "XXXX"… (X est un word char, \b OK)
  /\?{3,}/, // "???" ou plus — pas de \b car `?` est non-word
  /<!--\s*TODO/i,
];

export interface FaqSanitizationResult {
  /** HTML sanitizé prêt à insérer en DB. Vide si `skip=true`. */
  readonly html: string;
  /** Si true, l'appelant DOIT skip l'insert et log la raison. */
  readonly skip: boolean;
  /** Raison du skip (placeholder détecté, contenu vide, etc.). */
  readonly reason?: string;
}

/**
 * Sanitize une réponse FAQ (HTML LLM output) + détecte les placeholders.
 *
 * @param answer — Réponse brute du generator (peut contenir HTML LLM).
 * @returns `{ html, skip, reason? }`. Si skip=true → log + skip insert DB.
 */
export function sanitizeFaqAnswer(answer: string | null | undefined): FaqSanitizationResult {
  if (typeof answer !== "string" || answer.trim().length === 0) {
    return { html: "", skip: true, reason: "empty_answer" };
  }

  // P2-9 — Détection placeholder AVANT sanitization (les patterns peuvent
  // contenir des chars `<`/`>` strippés sinon). Strip les balises HTML pour
  // la détection pure-texte.
  const plainText = answer
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(plainText)) {
      return {
        html: "",
        skip: true,
        reason: `placeholder_detected:${pattern.source}`,
      };
    }
  }

  // P2-8 — Pré-marquage : DOMPurify peut strip `target=_blank` selon la
  // version JSDOM/browser. On encode l'attribut pour le préserver via le
  // sanitize, puis on le re-décode en post-process avec rel="noopener
  // noreferrer" forcé (reverse-tabnabbing prevention).
  const TARGET_BLANK_MARKER = "data-x-target-blank-marker";
  const preProcessed = answer.replace(
    /<a\b([^>]*?)\starget=["']_blank["']/gi,
    `<a$1 ${TARGET_BLANK_MARKER}="1"`,
  );

  const sanitized = DOMPurify.sanitize(preProcessed, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [...ALLOWED_ATTR, TARGET_BLANK_MARKER],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style", "svg", "img"],
    FORBID_ATTR: ["style", "srcdoc", "onerror", "onload", "onclick"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[/#?])/i,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });

  // Décodage marker → target="_blank" rel="noopener noreferrer" (toujours
  // appliqué, idempotent : si un attribut rel existait déjà côté input, il
  // a été conservé/strippé selon ALLOWED_ATTR avant cette étape).
  const finalHtml = sanitized.replace(
    new RegExp(`\\s*${TARGET_BLANK_MARKER}=["']1["']`, "gi"),
    ' target="_blank" rel="noopener noreferrer"',
  );

  // Si la sanitization a tout strippé (HTML 100% malicieux) → skip.
  if (finalHtml.trim().length === 0) {
    return { html: "", skip: true, reason: "fully_stripped" };
  }

  return { html: finalHtml, skip: false };
}

/**
 * Variante "question" — accepte uniquement du texte plain (les questions
 * sont des labels courts). Strippe tout HTML.
 */
export function sanitizeFaqQuestion(question: string | null | undefined): FaqSanitizationResult {
  if (typeof question !== "string" || question.trim().length === 0) {
    return { html: "", skip: true, reason: "empty_question" };
  }

  // Détection placeholder (cf. P2-9).
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(question)) {
      return {
        html: "",
        skip: true,
        reason: `placeholder_detected:${pattern.source}`,
      };
    }
  }

  // Strip tout HTML — une question = label.
  const plain = DOMPurify.sanitize(question, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM: false,
  })
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length === 0) {
    return { html: "", skip: true, reason: "fully_stripped" };
  }

  return { html: plain, skip: false };
}
