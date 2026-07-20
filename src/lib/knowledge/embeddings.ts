/**
 * KB V4 — Wrapper embeddings pour dedup factory + recherche hybride.
 *
 * Provider default V4 (§17.6 prompt master) : **Voyage AI `voyage-3`**
 * (1024 dim via `output_dimension`, best cost/perf ratio).
 *
 * Refus dur (cf. confidentialités) : NE PAS envoyer à API externe les entries
 * `confidentiality IN ('confidential', 'secret')`.
 *
 * Prompt caching obligatoire (skill `claude-api` doctrine) sur LLM calls
 * adjacents — pour embeddings, le caching est géré côté provider.
 */

import type { KbConfidentiality } from "../../../prisma/generated/client";
import { isExternalApiAllowed } from "@/content/knowledge/confidentialities";

/**
 * Modèle embedding actif.
 * ⚠️ Fix 2026-06-14 : `voyage-3-lite` renvoie 512 dimensions par défaut, ce qui
 * ne correspond PAS à la colonne `vector(1024)` + index HNSW (erreur runtime
 * « dimension inattendue : 512 (attendu 1024) »). On bascule sur `voyage-3`
 * (1024 par défaut) ET on force `output_dimension: 1024` dans la requête API
 * (Matryoshka) — aucune migration DB nécessaire, la dimension reste 1024.
 * Pour rebasculer : update `EMBEDDING_MODEL_NAME` + `EMBEDDING_DIMENSION` (+ migration table/reindex si dim ≠ 1024).
 */
export const EMBEDDING_MODEL_NAME = "voyage-3" as const;
export const EMBEDDING_MODEL_VERSION = "2026-06" as const;
export const EMBEDDING_DIMENSION = 1024 as const;

export interface EmbeddingResult {
  readonly embedding: readonly number[];
  readonly model: string;
  readonly modelVersion: string;
  readonly dimensionality: number;
  readonly tokensUsed: number;
}

export class EmbeddingConfidentialityRefusal extends Error {
  constructor(public readonly confidentiality: KbConfidentiality) {
    super(
      `Refus dur : confidentialité '${confidentiality}' ne peut pas être envoyée à API externe (factory dedup).`,
    );
    this.name = "EmbeddingConfidentialityRefusal";
  }
}

/** Endpoint Voyage AI embeddings (T-04). */
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

/**
 * Stub déterministe (hash sha-256 → vecteur L2-normalisé). Utilisé quand
 * `VOYAGE_API_KEY` est absente (dev/test sans coût API) ; garde le dedup testable
 * (textes identiques = mêmes vecteurs).
 */
async function stubEmbedding(text: string): Promise<EmbeddingResult> {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(text).digest();
  const embedding: number[] = [];
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const byteIndex = i % 32;
    const byteValue = hash[byteIndex] ?? 0;
    const seed = (byteValue + i * 7) % 256;
    embedding.push((seed - 128) / 128); // [-1, 1]
  }
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1;
  const normalized = embedding.map((v) => v / norm);
  return {
    embedding: normalized,
    model: EMBEDDING_MODEL_NAME,
    modelVersion: `${EMBEDDING_MODEL_VERSION}-stub`,
    dimensionality: EMBEDDING_DIMENSION,
    tokensUsed: Math.ceil(text.length / 4),
  };
}

// 2026-06-14 — Alerte prod si la clé Voyage est invalide (401) ou les crédits
// épuisés (402). Sans ça, le RAG vectoriel retombe SILENCIEUSEMENT en FTS et on
// ne s'en rend compte que via une baisse de pertinence. Throttle 30 min pour ne
// pas spammer Telegram (un job de génération peut faire des dizaines d'embeddings).
let lastVoyageAuthAlertAt = 0;
const VOYAGE_AUTH_ALERT_THROTTLE_MS = 30 * 60 * 1000;

function alertVoyageAuthFailure(status: number, detail: string): void {
  // Prod réelle uniquement — jamais au build/SSG (stub) ni en dev/test.
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return;
  const now = Date.now();
  if (now - lastVoyageAuthAlertAt < VOYAGE_AUTH_ALERT_THROTTLE_MS) return;
  lastVoyageAuthAlertAt = now;
  const reason =
    status === 402
      ? "crédits Voyage épuisés (402)"
      : "clé Voyage invalide / révoquée (401) — vérifier VOYAGE_API_KEY";
  void (async () => {
    try {
      const { sendTelegram } = await import("@/lib/telegram");
      // 2026-07-20 : rétrogradé INCIDENT → MONITORING. La recherche vectorielle
      // tombe mais le système continue en recherche lexicale (repli automatique)
      // → dégradation, pas panne serveur ; « 🔴 Incident » réservé aux vraies pannes.
      await sendTelegram({
        tag: "MONITORING",
        body:
          `*[⚠️ RECHERCHE VECTORIELLE HORS SERVICE]* Voyage ${status} — ${reason}.\n` +
          `Repli automatique sur la recherche lexicale : dégradé mais fonctionnel.\n` +
          `Action : vérifier VOYAGE_API_KEY (Coolify web+worker) + crédits sur dash.voyageai.com.\n` +
          `Détail : ${detail.slice(0, 200)}`,
      });
    } catch {
      // best-effort — l'alerte ne doit jamais casser le pipeline d'embedding.
    }
  })();
}

/**
 * Appel réel Voyage AI `voyage-3` (1024-dim via output_dimension). Lève en cas d'erreur HTTP ou
 * de dimension inattendue (pas de fallback dimension-incompatible : OpenAI = 1536
 * ≠ 1024 → poisonnerait l'index vector(1024) ; le worker BullMQ retente).
 */
async function embedWithVoyage(text: string, apiKey: string): Promise<EmbeddingResult> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: EMBEDDING_MODEL_NAME,
      input_type: "document",
      // Force la dimension de sortie à 1024 (Matryoshka) pour matcher la colonne
      // pgvector(1024) + l'index HNSW, quel que soit le défaut du modèle.
      output_dimension: EMBEDDING_DIMENSION,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 402) {
      alertVoyageAuthFailure(res.status, detail);
    }
    throw new Error(`[embeddings] Voyage HTTP ${res.status} ${res.statusText} ${detail}`.trim());
  }
  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
    usage?: { total_tokens?: number };
  };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `[embeddings] Voyage dimension inattendue : ${embedding?.length ?? "absent"} (attendu ${EMBEDDING_DIMENSION})`,
    );
  }
  return {
    embedding,
    model: EMBEDDING_MODEL_NAME,
    modelVersion: EMBEDDING_MODEL_VERSION,
    dimensionality: EMBEDDING_DIMENSION,
    tokensUsed: json.usage?.total_tokens ?? Math.ceil(text.length / 4),
  };
}

/**
 * Génère un embedding 1024-dim pour un texte (KB dedup + RAG chatbot).
 *
 * - `VOYAGE_API_KEY` présente → appel réel `voyage-3` (T-04) ;
 * - sinon → stub déterministe (dev/test sans clé → KB tests inchangés).
 *
 * Refus dur : ne JAMAIS envoyer une entrée `confidential`/`secret` à l'API externe.
 */
export async function generateEmbedding(
  text: string,
  confidentiality: KbConfidentiality = "public",
): Promise<EmbeddingResult> {
  // Refus dur (Agent 10 §10.5 + Agent 9 §9.10 audit Phase A V3) — AVANT tout appel réseau.
  if (!isExternalApiAllowed(confidentiality)) {
    throw new EmbeddingConfidentialityRefusal(confidentiality);
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (apiKey) {
    return embedWithVoyage(text, apiKey);
  }
  return stubEmbedding(text);
}

/**
 * Résultat d'un health-check du provider d'embeddings (observabilité RAG P1).
 * Ne throw jamais : destiné à un endpoint admin de diagnostic.
 */
export interface EmbeddingHealth {
  readonly ok: boolean;
  readonly provider: "voyage" | "stub";
  readonly model: string;
  readonly dimension: number;
  /** true = clé absente OU build stub (stub.invalid) → embedding non sémantique. */
  readonly stub: boolean;
  readonly latencyMs: number;
  readonly error?: string;
}

/**
 * Health-check du provider d'embeddings (P1 observabilité RAG).
 *
 * Fait un appel d'embedding réel minimal (1 court texte) avec timeout court pour
 * vérifier que Voyage répond et renvoie la bonne dimension. Réutilise
 * `generateEmbedding` (pas de réimplémentation de l'appel Voyage).
 *
 * - `VOYAGE_API_KEY` absente OU build stub (`stub.invalid`) → `{ ok:false, stub:true }`
 *   sans throw (l'embedding renvoyé serait le stub SHA-256, non sémantique).
 * - Appel réussi avec dimension correcte → `{ ok:true, stub:false }`.
 * - Erreur réseau / HTTP / timeout → `{ ok:false, stub:false, error }`.
 */
export async function checkEmbeddingHealth(timeoutMs = 5000): Promise<EmbeddingHealth> {
  const startedAt = Date.now();
  const base = {
    model: EMBEDDING_MODEL_NAME,
    dimension: EMBEDDING_DIMENSION,
  } as const;

  const isBuildStub = process.env.DATABASE_URL?.includes("stub.invalid") ?? false;
  const hasKey = Boolean(process.env.VOYAGE_API_KEY);

  // Clé absente ou contexte build (stub.invalid) → stub déterministe, non sémantique.
  if (!hasKey || isBuildStub) {
    return {
      ...base,
      ok: false,
      provider: "stub",
      stub: true,
      latencyMs: Date.now() - startedAt,
      error: isBuildStub
        ? "build stub (stub.invalid) — appel Voyage volontairement court-circuité"
        : "VOYAGE_API_KEY absente — RAG vectoriel dégradé en FTS (lexical)",
    };
  }

  // Timeout court : on ne veut pas que le diagnostic hang sur un Voyage lent/down.
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`timeout après ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    const result = (await Promise.race([generateEmbedding("ping"), timeout])) as EmbeddingResult;
    const isStub = result.modelVersion.endsWith("-stub");
    const dimOk = result.dimensionality === EMBEDDING_DIMENSION;
    return {
      model: result.model,
      dimension: result.dimensionality,
      ok: !isStub && dimOk,
      provider: isStub ? "stub" : "voyage",
      stub: isStub,
      latencyMs: Date.now() - startedAt,
      ...(dimOk
        ? {}
        : {
            error: `dimension inattendue : ${result.dimensionality} (attendu ${EMBEDDING_DIMENSION})`,
          }),
    };
  } catch (err) {
    return {
      ...base,
      ok: false,
      provider: "voyage",
      stub: false,
      latencyMs: Date.now() - startedAt,
      error: (err as Error).message,
    };
  }
}

/**
 * Calcule la similarité cosine entre 2 vecteurs (assumés L2-normalisés).
 * Pour vecteurs non normalisés : retourne le produit scalaire / (norm1 * norm2).
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity : dimension mismatch ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB) || 1;
  return dot / denom;
}

/**
 * Prépare le texte à embedder depuis title + excerpt + 500 premiers mots body.
 * Cf. §17.3 prompt master.
 */
export function buildEmbeddingInput(input: {
  readonly title: string;
  readonly excerpt?: string | null;
  readonly bodyText?: string | null;
}): string {
  const parts: string[] = [input.title];
  if (input.excerpt) parts.push(input.excerpt);
  if (input.bodyText) {
    const words = input.bodyText.split(/\s+/).slice(0, 500);
    parts.push(words.join(" "));
  }
  return parts.join("\n\n");
}
