// Chunking RAG (T-05, doc 05 §9.3, cahier §9).
//
// Découpe un document en chunks de ~300-600 tokens avec ~15 % d'overlap, et
// attache une phrase de CONTEXTUALISATION (catégorie/sujet) à chaque chunk
// (améliore le retrieval + le ranking FTS, poids B). Tokens estimés ≈ chars/4
// (même heuristique que embeddings.ts). Pur & déterministe.

export interface Chunk {
  /** Texte du chunk (sans le préfixe de contexte — stocké à part). */
  readonly contenu: string;
  /** Phrase de contextualisation (catégorie/module/source). */
  readonly contexte?: string;
  /** Index ordinal dans le document. */
  readonly index: number;
}

export interface ChunkOptions {
  /** Phrase de contextualisation appliquée à tous les chunks du document. */
  readonly contextLabel?: string;
  readonly minTokens?: number;
  readonly maxTokens?: number;
  readonly overlapRatio?: number;
}

const CHARS_PER_TOKEN = 4;

/** Estime le nombre de tokens d'un texte (heuristique chars/4). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Découpe `text` en chunks. Un texte court (≤ maxTokens) → 1 seul chunk.
 * Sinon fenêtre glissante par mots avec overlap (~15 %).
 */
export function chunkText(text: string, opts: ChunkOptions = {}): Chunk[] {
  const minTokens = opts.minTokens ?? 300;
  const maxTokens = opts.maxTokens ?? 600;
  const overlapRatio = opts.overlapRatio ?? 0.15;
  const contextLabel = opts.contextLabel?.trim() || undefined;

  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return [];

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = Math.floor(maxChars * overlapRatio);
  void minTokens; // cible douce : un dernier chunk court est acceptable.

  const mk = (contenu: string, index: number): Chunk =>
    contextLabel ? { contenu, contexte: contextLabel, index } : { contenu, index };

  // Document court → 1 chunk.
  if (clean.length <= maxChars) {
    return [mk(clean, 0)];
  }

  // Fenêtre glissante par mots : chaque chunk ≤ maxChars, overlap par backtrack,
  // progression garantie (nextStart > start).
  const words = clean.split(" ");
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < words.length) {
    let end = start;
    let chars = 0;
    while (end < words.length && chars + words[end]!.length + 1 <= maxChars) {
      chars += words[end]!.length + 1;
      end++;
    }
    if (end === start) end = start + 1; // mot unique plus long que maxChars
    chunks.push(mk(words.slice(start, end).join(" "), index++));
    if (end >= words.length) break;
    // Recul d'overlap (~overlapRatio) sans jamais revenir avant start+1.
    let nextStart = end;
    let oChars = 0;
    while (nextStart > start + 1 && oChars < overlapChars) {
      nextStart--;
      oChars += words[nextStart]!.length + 1;
    }
    start = nextStart;
  }

  return chunks;
}
