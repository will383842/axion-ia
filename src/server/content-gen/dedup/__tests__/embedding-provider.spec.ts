import { describe, it, expect, afterEach, vi } from "vitest";
import {
  ARTICLE_EMBEDDING_COLUMN,
  BRAND_VOICE_REFERENCE_KEY,
  getDedupThresholds,
  getDriftThresholds,
  getEmbeddingProvider,
} from "../embedding-provider";

afterEach(() => {
  delete process.env["CONTENT_EMBEDDING_PROVIDER"];
  delete process.env["VOYAGE_API_KEY"];
  vi.restoreAllMocks();
  delete process.env["CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE"];
  delete process.env["CONTENT_DEDUP_SIMILAR_THRESHOLD_VOYAGE"];
  delete process.env["BRAND_VOICE_DRIFT_REVIEW_THRESHOLD_VOYAGE"];
});

describe("sélection du fournisseur", () => {
  it("openai par défaut (variable absente, vide ou inconnue)", () => {
    expect(getEmbeddingProvider()).toBe("openai");
    process.env["CONTENT_EMBEDDING_PROVIDER"] = "";
    expect(getEmbeddingProvider()).toBe("openai");
    process.env["CONTENT_EMBEDDING_PROVIDER"] = "cohere";
    expect(getEmbeddingProvider()).toBe("openai");
  });
  it("voyage sans clé → openai, avec un avertissement sans clé", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env["CONTENT_EMBEDDING_PROVIDER"] = "voyage";
    expect(getEmbeddingProvider()).toBe("openai");
    process.env["VOYAGE_API_KEY"] = "   ";
    expect(getEmbeddingProvider()).toBe("openai");
    expect(warn).toHaveBeenCalled();
  });
  it("voyage quand demandé avec une clé (casse et espaces tolérés)", () => {
    process.env["VOYAGE_API_KEY"] = "cle-de-test";
    process.env["CONTENT_EMBEDDING_PROVIDER"] = " Voyage ";
    expect(getEmbeddingProvider()).toBe("voyage");
  });
  it("une colonne et une clé de référence par fournisseur, distinctes", () => {
    expect(ARTICLE_EMBEDDING_COLUMN).toEqual({ openai: "embedding", voyage: "embedding_voyage" });
    expect(BRAND_VOICE_REFERENCE_KEY.openai).toBe("brand_voice_reference_embedding");
    expect(BRAND_VOICE_REFERENCE_KEY.voyage).not.toBe(BRAND_VOICE_REFERENCE_KEY.openai);
  });
});

describe("seuils par fournisseur", () => {
  it("OpenAI inchangés", () => {
    expect(getDedupThresholds("openai")).toEqual({
      duplicateThreshold: 0.85,
      similarThreshold: 0.8,
    });
    expect(getDriftThresholds("openai")).toEqual({ review: 0.7, warn: 0.8 });
  });
  it("Voyage configurables par variables d'environnement", () => {
    process.env["CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE"] = "0.93";
    process.env["CONTENT_DEDUP_SIMILAR_THRESHOLD_VOYAGE"] = "0.88";
    process.env["BRAND_VOICE_DRIFT_REVIEW_THRESHOLD_VOYAGE"] = "0.6";
    expect(getDedupThresholds("voyage")).toEqual({
      duplicateThreshold: 0.93,
      similarThreshold: 0.88,
    });
    expect(getDriftThresholds("voyage").review).toBe(0.6);
    expect(getDedupThresholds("openai").duplicateThreshold).toBe(0.85);
  });
  it("valeur invalide : repli sur le défaut ; similar jamais au-dessus de duplicate", () => {
    process.env["CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE"] = "abc";
    expect(getDedupThresholds("voyage").duplicateThreshold).toBe(0.85);
    process.env["CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE"] = "0.7";
    expect(getDedupThresholds("voyage").similarThreshold).toBe(0.7);
  });
});

describe("lecture des seuils", () => {
  it("accepte la virgule décimale", () => {
    process.env["CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE"] = "0,9";
    expect(getDedupThresholds("voyage").duplicateThreshold).toBe(0.9);
  });
  it("journalise toute valeur rejetée et garde le défaut", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env["CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE"] = "1,5";
    expect(getDedupThresholds("voyage").duplicateThreshold).toBe(0.85);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE");
  });
});
