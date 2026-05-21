/**
 * Content Generator — Outline SimHash 64-bit (B.7 P0-6 P1.5).
 *
 * Couche 3 du systeme dedup 4-couches (cf master prompt §25.5) :
 *   - A.1 Levenshtein 0.85 vs titres ✅ (dedup-guard.ts)
 *   - A.2 KW+ville+window 90j ✅ (dedup-guard.ts)
 *   - A.3 Outline SimHash (CETTE COUCHE) ✅
 *   - A.4 OpenAI embeddings cosine ✅ (openai-embedder.ts + check pre-publish)
 *
 * Pourquoi un SimHash d'outline ?
 *   - Detecte les templates editoriaux repetes : meme structure h2/h3 ordre,
 *     meme decoupage, meme rythme narratif — meme avec mots differents.
 *   - Google HCU 2024-2026 penalise les "doorway pages" (template clones).
 *   - 100 articles SEO programmatiques sur ville x service avec structure
 *     identique h2 "Pourquoi X ?" > h2 "Comment ca marche" > h2 "Combien ça coute"
 *     reste detectable meme avec variation lexicale.
 *
 * SimHash :
 *   - Tokenise la sequence h2/h3 (normalise lowercase + strip stopwords FR)
 *   - Pondere par TF (term frequency) — tres simple, sans IDF (corpus interne)
 *   - Projete chaque feature sur 64 bits via SHA-256 (16 hex chars)
 *   - Resultat : 16 hex chars stable, comparable via Hamming distance
 *
 * Seuils :
 *   - Hamming distance <= 4 / 64 (6.25% bits) = duplicate_template (BLOCK)
 *   - Hamming distance 5-8 / 64 = similar (WARN review)
 *   - > 8 = pass
 */

import { createHash } from "node:crypto";

// Stopwords FR + EN minimaux (pour eviter de polluer les features).
const STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "de",
  "des",
  "du",
  "un",
  "une",
  "et",
  "ou",
  "que",
  "qui",
  "quoi",
  "comment",
  "pourquoi",
  "quand",
  "ou",
  "a",
  "au",
  "aux",
  "en",
  "dans",
  "sur",
  "sous",
  "pour",
  "par",
  "avec",
  "sans",
  "se",
  "ce",
  "ces",
  "son",
  "sa",
  "ses",
  "the",
  "of",
  "and",
  "or",
  "to",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
]);

/**
 * Extrait la sequence h2/h3 (texte) depuis du HTML body.
 * Ordre preserve. Si plusieurs niveaux, garde h2 + h3 dans l'ordre du document.
 */
export function extractOutline(bodyHtml: string): string[] {
  const out: string[] = [];
  const regex = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(bodyHtml)) !== null) {
    const inner = match[2] ?? "";
    // Strip nested HTML tags + normalize whitespace.
    const text = inner
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0) out.push(text);
  }
  return out;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(headings: ReadonlyArray<string>): string[] {
  const tokens: string[] = [];
  for (const h of headings) {
    const norm = normalize(h);
    for (const t of norm.split(/\s+/)) {
      if (t.length >= 2 && !STOPWORDS.has(t)) tokens.push(t);
    }
  }
  return tokens;
}

/**
 * SimHash 64-bit canonique (Charikar 2002) :
 *   1. Pour chaque token, calculer sha256 → prendre 64 premiers bits.
 *   2. Sommer +1/-1 par bit selon que le bit est 1 ou 0, ponderé par TF.
 *   3. Signature = bit 1 si somme > 0 sinon 0.
 */
function simhash64(tokens: ReadonlyArray<string>): bigint {
  if (tokens.length === 0) return 0n;

  // TF pondere.
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  const v = new Array<number>(64).fill(0);

  for (const [token, weight] of tf) {
    const hash = createHash("sha256").update(token).digest();
    // Premiers 8 octets = 64 bits.
    for (let bit = 0; bit < 64; bit++) {
      const byteIdx = Math.floor(bit / 8);
      const bitInByte = bit % 8;
      const isOne = ((hash[byteIdx]! >> bitInByte) & 1) === 1;
      v[bit] = (v[bit] ?? 0) + (isOne ? weight : -weight);
    }
  }

  let sig = 0n;
  for (let i = 0; i < 64; i++) {
    if ((v[i] ?? 0) > 0) sig |= 1n << BigInt(i);
  }
  return sig;
}

function bigintToHex16(n: bigint): string {
  const h = n.toString(16);
  return h.length >= 16 ? h.slice(-16) : h.padStart(16, "0");
}

/**
 * Calcule le SimHash 64-bit (hex 16 chars) du outline d'un article.
 * Retourne null si pas de h2/h3 detecte (article trop court / mal structure).
 */
export function computeOutlineSimhash(bodyHtml: string): string | null {
  const outline = extractOutline(bodyHtml);
  if (outline.length === 0) return null;
  const tokens = tokenize(outline);
  if (tokens.length === 0) return null;
  return bigintToHex16(simhash64(tokens));
}

/**
 * Distance de Hamming entre 2 SimHash hex 16 chars.
 * Retourne -1 si format invalide.
 */
export function outlineHammingDistance(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return -1;
  if (!/^[0-9a-fA-F]+$/.test(a) || !/^[0-9a-fA-F]+$/.test(b)) return -1;
  let distance = 0;
  for (let i = 0; i < 16; i++) {
    let xor = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

export type OutlineDedupVerdict = "ok" | "similar" | "duplicate_template";

export interface OutlineDedupVerdictResult {
  readonly verdict: OutlineDedupVerdict;
  readonly distance: number;
  readonly reason: string;
}

export const OUTLINE_DEDUP_THRESHOLDS = {
  DUPLICATE: 4,
  SIMILAR: 8,
} as const;

/**
 * Classifie un verdict dedup d'apres la distance Hamming minimum vs corpus.
 */
export function classifyOutlineDedup(minDistance: number): OutlineDedupVerdictResult {
  if (minDistance < 0) {
    return {
      verdict: "ok",
      distance: -1,
      reason: "invalid fingerprint format (skipped)",
    };
  }
  if (minDistance <= OUTLINE_DEDUP_THRESHOLDS.DUPLICATE) {
    return {
      verdict: "duplicate_template",
      distance: minDistance,
      reason: `Hamming ${minDistance}/64 <= ${OUTLINE_DEDUP_THRESHOLDS.DUPLICATE} (template duplique)`,
    };
  }
  if (minDistance <= OUTLINE_DEDUP_THRESHOLDS.SIMILAR) {
    return {
      verdict: "similar",
      distance: minDistance,
      reason: `Hamming ${minDistance}/64 in (${OUTLINE_DEDUP_THRESHOLDS.DUPLICATE}, ${OUTLINE_DEDUP_THRESHOLDS.SIMILAR}] (template similaire — review)`,
    };
  }
  return {
    verdict: "ok",
    distance: minDistance,
    reason: `Hamming ${minDistance}/64 > ${OUTLINE_DEDUP_THRESHOLDS.SIMILAR} (template distinct)`,
  };
}
