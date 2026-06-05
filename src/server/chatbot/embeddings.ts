// Embeddings du chatbot (T-04) — module DÉDIÉ au RAG chatbot, distinct de la KB.
//
// Pourquoi un module chatbot-owned et pas `@/lib/knowledge/embeddings` directement ?
//   - La clé Voyage du projet est invalide (401) ; décision Will 2026-06-05 :
//     basculer le chatbot sur OpenAI `text-embedding-3-small` (dimensions=1024,
//     pour rester compatible avec l'index `vector(1024)` de chat_kb_chunks).
//   - On NE touche PAS au provider de la KB (knowledge_embeddings, Voyage 1024) :
//     un switch global casserait la recherche KB (espaces vectoriels différents).
//   - L'ingestion ET la requête DOIVENT utiliser le MÊME espace → ce module est
//     l'unique source d'embedding pour `ingest.ts`, `hybrid-search.ts`, `cache.ts`.
//
// Provider via `CHATBOT_EMBEDDINGS_PROVIDER` (défaut "openai") :
//   - "openai" + OPENAI_API_KEY → text-embedding-3-small, dimensions=1024 ;
//   - sinon → délègue au module partagé (Voyage réel si clé valide, sinon STUB).
//
// Le `modelVersion` renvoyé n'est JAMAIS suffixé "-stub" pour OpenAI/Voyage réels
// → les gardes anti-stub de hybrid-search (D-1) et cache (D-3) utilisent le vecteur.

import {
  generateEmbedding as sharedGenerateEmbedding,
  EmbeddingConfidentialityRefusal,
  type EmbeddingResult,
} from "@/lib/knowledge/embeddings";
import { isExternalApiAllowed } from "@/content/knowledge/confidentialities";
import type { KbConfidentiality } from "../../../prisma/generated/client";

export const CHATBOT_EMBEDDING_DIMENSION = 1024 as const;
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";

/** Appel réel OpenAI text-embedding-3-small en 1024 dims (compatible index vector(1024)). */
async function embedWithOpenAi(text: string, apiKey: string): Promise<EmbeddingResult> {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
      dimensions: CHATBOT_EMBEDDING_DIMENSION,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `[chatbot:embeddings] OpenAI HTTP ${res.status} ${res.statusText} ${detail}`.trim(),
    );
  }
  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
    usage?: { total_tokens?: number };
  };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || embedding.length !== CHATBOT_EMBEDDING_DIMENSION) {
    throw new Error(
      `[chatbot:embeddings] OpenAI dimension inattendue : ${embedding?.length ?? "absent"} (attendu ${CHATBOT_EMBEDDING_DIMENSION})`,
    );
  }
  return {
    embedding,
    model: OPENAI_EMBEDDING_MODEL,
    modelVersion: "2026-06-openai-1024",
    dimensionality: CHATBOT_EMBEDDING_DIMENSION,
    tokensUsed: json.usage?.total_tokens ?? Math.ceil(text.length / 4),
  };
}

/**
 * Embed un texte pour le RAG chatbot. Refus dur des confidentialités
 * `confidential`/`secret` (jamais envoyées à une API externe), comme le module KB.
 */
export async function embedChatbotText(
  text: string,
  confidentiality: KbConfidentiality = "public",
): Promise<EmbeddingResult> {
  if (!isExternalApiAllowed(confidentiality)) {
    throw new EmbeddingConfidentialityRefusal(confidentiality);
  }
  const provider = process.env.CHATBOT_EMBEDDINGS_PROVIDER ?? "openai";
  const openaiKey = process.env.OPENAI_API_KEY;
  if (provider === "openai" && openaiKey) {
    return embedWithOpenAi(text, openaiKey);
  }
  // Repli : module partagé (Voyage réel si clé valide, sinon STUB tagué "-stub").
  return sharedGenerateEmbedding(text, confidentiality);
}
