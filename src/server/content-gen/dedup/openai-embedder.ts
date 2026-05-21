/**
 * Content Generator — OpenAI Embedder (B.7 P0-6 P1.5).
 *
 * Couche 4 du systeme dedup 4-couches : OpenAI text-embedding-3-large
 * (3072 dim, decision Will D-W4 2026-05-21).
 *
 * Pourquoi OpenAI (et pas Voyage AI deja utilise pour la KB) ?
 *   - Decision Will : la cle OPENAI_API_KEY est deja en env Coolify (partagee
 *     avec Axion CRM Pro). Pas de nouveau provider a setup.
 *   - text-embedding-3-large : 3072 dim, $0.13/1M tokens, top tier MTEB.
 *   - Distinct du provider KB (Voyage 1024 dim) intentionnellement : les 2
 *     systemes ont des contraintes I/O differentes (KB = retrieval RAG vs
 *     content-gen = dedup cosine).
 *
 * Activation prod : `OPENAI_EMBEDDINGS_ENABLED=true` env var Coolify.
 *   - Default : false → embed() retourne null (no-op silent, pas de cost).
 *   - Si true mais OPENAI_API_KEY absente : throw au runtime (fail-fast).
 *
 * Cost cap : env var `OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY` (default 1M).
 *   - 1M tokens = ~$0.13/jour @ scale 1000 articles avec 1k tokens chacun.
 *   - Compteur in-memory simple (reset au boot worker). V2 : Redis-backed.
 *
 * RGPD : pas de PII (titre + body publics indexables → public). Pas de DPA
 *   requis pour OpenAI sur ce usage (consent implicite Will + scope public).
 */

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-large";
export const OPENAI_EMBEDDING_DIMENSION = 3072 as const;

// In-memory compteur tokens consommes par jour (reset boot).
const tokenCounter = new Map<string, number>();

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDailyCap(): number {
  const raw = process.env["OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY"];
  if (!raw) return 1_000_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1_000_000;
}

export interface EmbedResult {
  readonly embedding: readonly number[];
  readonly tokensUsed: number;
  readonly model: string;
}

/**
 * Embed un texte via OpenAI text-embedding-3-large.
 *
 * Retourne null si :
 *  - `OPENAI_EMBEDDINGS_ENABLED` != "true" (default OFF — pas de cost imprevu)
 *  - Daily cap depasse (cost cap)
 *  - Erreur API (network, rate limit, etc.) — fail-soft pour ne pas bloquer publish
 *
 * Throw uniquement si flag enabled mais OPENAI_API_KEY absente (config error).
 */
export async function embed(text: string): Promise<EmbedResult | null> {
  if (process.env["OPENAI_EMBEDDINGS_ENABLED"] !== "true") return null;

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "OPENAI_EMBEDDINGS_ENABLED=true but OPENAI_API_KEY missing — configuration error",
    );
  }

  // Daily cap check.
  const dayKey = getTodayKey();
  const used = tokenCounter.get(dayKey) ?? 0;
  const cap = getDailyCap();
  // Estimation grossiere : ~4 chars per token (FR moyenne).
  const estTokens = Math.ceil(text.length / 4);
  if (used + estTokens > cap) {
    console.warn(
      JSON.stringify({
        event: "openai_embeddings_throttled",
        reason: "daily_cap_reached",
        used,
        cap,
        estTokens,
      }),
    );
    return null;
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
        // 3072 default — pas besoin d'override dimensions.
      }),
      signal: AbortSignal.timeout(30_000), // 30s max
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      console.warn(
        JSON.stringify({
          event: "openai_embeddings_error",
          status: response.status,
          error: err.slice(0, 200),
        }),
      );
      return null;
    }

    const data = (await response.json()) as {
      data?: ReadonlyArray<{ embedding?: number[] }>;
      usage?: { total_tokens?: number };
    };

    const embedding = data.data?.[0]?.embedding;
    if (!embedding || embedding.length !== OPENAI_EMBEDDING_DIMENSION) {
      console.warn(
        JSON.stringify({
          event: "openai_embeddings_bad_response",
          dim: embedding?.length ?? 0,
          expected: OPENAI_EMBEDDING_DIMENSION,
        }),
      );
      return null;
    }

    const tokensUsed = data.usage?.total_tokens ?? estTokens;
    tokenCounter.set(dayKey, used + tokensUsed);

    return { embedding, tokensUsed, model: EMBEDDING_MODEL };
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "openai_embeddings_exception",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

/**
 * Construit l'input texte a embed depuis title + meta + extrait body (500 mots).
 * Cap a ~8000 tokens (~32k chars) pour rester en dessous de la limite OpenAI 8191.
 */
export function buildEmbeddingInput(input: {
  readonly title: string;
  readonly metaDescription?: string;
  readonly bodyText?: string;
}): string {
  const parts: string[] = [input.title];
  if (input.metaDescription) parts.push(input.metaDescription);
  if (input.bodyText) {
    const words = input.bodyText.split(/\s+/).slice(0, 500);
    parts.push(words.join(" "));
  }
  return parts.join("\n\n").slice(0, 32_000);
}

/** Reset compteur tokens — test-only. */
export function __resetTokenCounter(): void {
  tokenCounter.clear();
}
