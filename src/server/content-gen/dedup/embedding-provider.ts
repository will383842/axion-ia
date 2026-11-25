/**
 * Content Generator — choix du fournisseur d'embeddings des articles (PR4).
 *
 * `CONTENT_EMBEDDING_PROVIDER` :
 *  - `openai` (défaut, et toute valeur inconnue) : comportement historique inchangé,
 *    colonne `articles.embedding` (vector 1536).
 *  - `voyage` : Voyage AI voyage-3, colonne `articles.embedding_voyage` (vector 1024).
 *
 * Les deux espaces vectoriels ne sont JAMAIS comparables : chaque fournisseur a sa
 * colonne, son vecteur de référence de voix de marque et ses seuils.
 *
 * ⚠️ Les seuils Voyage ci-dessous sont PROVISOIRES (repris d'OpenAI faute de mesure).
 * Ils doivent être recalibrés après le rattrapage avec
 * `scripts/calibrer-seuils-voyage.ts`, puis posés par variables d'environnement
 * (voir docs/runbooks/R36-embeddings-voyage.md).
 */

export type EmbeddingProvider = "openai" | "voyage";

/** Noms de colonne EN DUR : seules ces constantes sont interpolées dans du SQL brut. */
export const ARTICLE_EMBEDDING_COLUMN = {
  openai: "embedding",
  voyage: "embedding_voyage",
} as const satisfies Record<EmbeddingProvider, string>;

export const BRAND_VOICE_REFERENCE_KEY = {
  openai: "brand_voice_reference_embedding",
  voyage: "brand_voice_reference_embedding_voyage",
} as const satisfies Record<EmbeddingProvider, string>;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (process.env["CONTENT_EMBEDDING_PROVIDER"]?.trim().toLowerCase() !== "voyage") {
    return "openai";
  }
  // Voyage demandé sans clé : on resterait sans vecteur ; repli sur OpenAI, avec avertissement.
  if (!process.env["VOYAGE_API_KEY"]?.trim()) {
    console.warn(
      "[embedding-provider] CONTENT_EMBEDDING_PROVIDER=voyage mais VOYAGE_API_KEY est absente ou vide : repli sur openai.",
    );
    return "openai";
  }
  return "voyage";
}

export interface DedupThresholds {
  readonly duplicateThreshold: number;
  readonly similarThreshold: number;
}

export interface DriftThresholds {
  readonly review: number;
  readonly warn: number;
}

const OPENAI_DEDUP: DedupThresholds = { duplicateThreshold: 0.85, similarThreshold: 0.8 };
const OPENAI_DRIFT: DriftThresholds = { review: 0.7, warn: 0.8 };
// PROVISOIRE — à recalibrer (scripts/calibrer-seuils-voyage.ts).
const VOYAGE_DEDUP_PROVISOIRE: DedupThresholds = {
  duplicateThreshold: 0.85,
  similarThreshold: 0.8,
};
const VOYAGE_DRIFT_PROVISOIRE: DriftThresholds = { review: 0.7, warn: 0.8 };

function lireSeuil(nom: string, defaut: number): number {
  const brut = process.env[nom];
  if (brut === undefined || brut.trim() === "") return defaut;
  const n = Number(brut);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : defaut;
}

export function getDedupThresholds(provider: EmbeddingProvider): DedupThresholds {
  if (provider === "openai") return OPENAI_DEDUP;
  const duplicateThreshold = lireSeuil(
    "CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE",
    VOYAGE_DEDUP_PROVISOIRE.duplicateThreshold,
  );
  const similarThreshold = Math.min(
    lireSeuil("CONTENT_DEDUP_SIMILAR_THRESHOLD_VOYAGE", VOYAGE_DEDUP_PROVISOIRE.similarThreshold),
    duplicateThreshold,
  );
  return { duplicateThreshold, similarThreshold };
}

export function getDriftThresholds(provider: EmbeddingProvider): DriftThresholds {
  if (provider === "openai") return OPENAI_DRIFT;
  const warn = lireSeuil("BRAND_VOICE_DRIFT_WARN_THRESHOLD_VOYAGE", VOYAGE_DRIFT_PROVISOIRE.warn);
  const review = Math.min(
    lireSeuil("BRAND_VOICE_DRIFT_REVIEW_THRESHOLD_VOYAGE", VOYAGE_DRIFT_PROVISOIRE.review),
    warn,
  );
  return { review, warn };
}
