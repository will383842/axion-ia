/**
 * Content Generator — Voyage embedder (PR4).
 *
 * Embeddings des articles via Voyage AI (`voyage-3`, 1024 dimensions) : le dirigeant
 * ne veut plus d'OpenAI pour le contenu, et Anthropic n'a pas d'API d'embedding.
 *
 * Garanties :
 *  - Ne lève JAMAIS : toute panne rend un résultat d'échec (la publication d'un
 *    article ne dépend jamais de ce module).
 *  - `VOYAGE_API_KEY` absente → `{ ok: false, reason: "no_key" }` / `null`, sans appel réseau.
 *  - Délai maximum (30 s) sur chaque appel.
 *  - Aucune clé dans les erreurs ni les journaux (le message est purgé de la clé).
 */

import type { EmbedResult } from "./openai-embedder";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
export const VOYAGE_EMBEDDING_MODEL = "voyage-3";
export const VOYAGE_EMBEDDING_DIMENSION = 1024 as const;
export const VOYAGE_TIMEOUT_MS = 30_000;

export type VoyageFailureReason =
  "no_key" | "rate_limited" | "timeout" | "http_error" | "bad_response" | "exception";

export type VoyageBatchOutcome =
  | {
      readonly ok: true;
      readonly embeddings: ReadonlyArray<readonly number[]>;
      readonly tokensUsed: number;
      readonly model: string;
    }
  | { readonly ok: false; readonly reason: VoyageFailureReason; readonly status?: number };

/** Retire toute occurrence de la clé d'un texte destiné à un journal. */
function purger(texte: string, apiKey: string): string {
  return apiKey ? texte.split(apiKey).join("[clé masquée]").slice(0, 200) : texte.slice(0, 200);
}

function journaliser(event: string, apiKey: string, extra: Record<string, unknown>): void {
  const propre: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    propre[k] = typeof v === "string" ? purger(v, apiKey) : v;
  }
  console.warn(JSON.stringify({ event, ...propre }));
}

/** Embed un lot de textes (≤ 128) en une requête. Ne lève jamais. */
export async function embedVoyageBatch(texts: readonly string[]): Promise<VoyageBatchOutcome> {
  const apiKey = process.env["VOYAGE_API_KEY"];
  if (!apiKey) return { ok: false, reason: "no_key" };
  if (texts.length === 0) {
    return { ok: true, embeddings: [], tokensUsed: 0, model: VOYAGE_EMBEDDING_MODEL };
  }

  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: VOYAGE_EMBEDDING_MODEL,
        input: texts,
        input_type: "document",
      }),
      signal: AbortSignal.timeout(VOYAGE_TIMEOUT_MS),
    });

    if (!response.ok) {
      const corps = await response.text().catch(() => response.statusText);
      const reason: VoyageFailureReason = response.status === 429 ? "rate_limited" : "http_error";
      journaliser("voyage_embeddings_error", apiKey, {
        status: response.status,
        reason,
        error: corps,
      });
      return { ok: false, reason, status: response.status };
    }

    const data = (await response.json()) as {
      data?: ReadonlyArray<{ embedding?: number[]; index?: number }>;
      usage?: { total_tokens?: number };
    };
    const rows = [...(data.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const valides =
      rows.length === texts.length &&
      rows.every(
        (r) => Array.isArray(r.embedding) && r.embedding.length === VOYAGE_EMBEDDING_DIMENSION,
      );
    if (!valides) {
      journaliser("voyage_embeddings_bad_response", apiKey, {
        received: rows.length,
        expected: texts.length,
        expectedDim: VOYAGE_EMBEDDING_DIMENSION,
      });
      return { ok: false, reason: "bad_response" };
    }

    return {
      ok: true,
      embeddings: rows.map((r) => r.embedding as number[]),
      tokensUsed: data.usage?.total_tokens ?? 0,
      model: VOYAGE_EMBEDDING_MODEL,
    };
  } catch (err) {
    const nom = (err as { name?: unknown } | null)?.name;
    const reason: VoyageFailureReason =
      nom === "TimeoutError" || nom === "AbortError" ? "timeout" : "exception";
    journaliser("voyage_embeddings_exception", apiKey, {
      reason,
      error: (err as { message?: unknown } | null)?.message
        ? String((err as { message: unknown }).message)
        : String(err),
    });
    return { ok: false, reason };
  }
}

/** Embed un seul texte. `null` si clé absente ou si Voyage est en panne. */
export async function embedVoyage(text: string): Promise<EmbedResult | null> {
  const out = await embedVoyageBatch([text]);
  if (!out.ok) return null;
  const embedding = out.embeddings[0];
  if (!embedding) return null;
  return { embedding, tokensUsed: out.tokensUsed, model: out.model };
}
