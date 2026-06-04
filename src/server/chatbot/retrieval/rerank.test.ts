import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rerankChunks } from "./rerank";
import type { RetrievedChunk } from "./hybrid-search";

function chunk(id: string, contenu: string, score: number): RetrievedChunk {
  return {
    id,
    sourceType: "kb_fact",
    sourceRef: id,
    categorie: "audit",
    contenu,
    contexte: null,
    score,
  };
}

// Ordre RRF initial : a > b > c > d (par score décroissant).
const candidates: RetrievedChunk[] = [
  chunk("a", "doc A", 0.9),
  chunk("b", "doc B", 0.8),
  chunk("c", "doc C", 0.7),
  chunk("d", "doc D", 0.6),
];

function voyageRerank(
  data: Array<{ index: number; relevance_score: number }>,
  status = 200,
): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ORIGINAL_KEY = process.env.VOYAGE_API_KEY;

beforeEach(() => {
  process.env.VOYAGE_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_KEY === undefined) delete process.env.VOYAGE_API_KEY;
  else process.env.VOYAGE_API_KEY = ORIGINAL_KEY;
});

describe("rerankChunks — réordonnancement", () => {
  it("re-classe selon le relevance_score Voyage et tronque à top-N", async () => {
    // Voyage juge c et a les plus pertinents (inverse partiel de l'ordre RRF).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        voyageRerank([
          { index: 2, relevance_score: 0.95 }, // c
          { index: 0, relevance_score: 0.9 }, // a
          { index: 3, relevance_score: 0.4 }, // d
          { index: 1, relevance_score: 0.2 }, // b
        ]),
      ),
    );
    const out = await rerankChunks("audit PME", candidates, { topN: 2 });
    expect(out.map((c) => c.id)).toEqual(["c", "a"]);
  });

  it("trie défensivement même si Voyage renvoie non trié", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        voyageRerank([
          { index: 1, relevance_score: 0.3 },
          { index: 3, relevance_score: 0.99 }, // d = meilleur
          { index: 0, relevance_score: 0.5 },
        ]),
      ),
    );
    const out = await rerankChunks("q", candidates, { topN: 3 });
    expect(out[0]?.id).toBe("d");
  });

  it("ignore les index hors borne (réponse incohérente)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        voyageRerank([
          { index: 99, relevance_score: 0.99 }, // hors borne → filtré
          { index: 1, relevance_score: 0.5 },
        ]),
      ),
    );
    const out = await rerankChunks("q", candidates, { topN: 5 });
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });
});

describe("rerankChunks — repli sans rerank (robustesse T-10)", () => {
  it("replie sur l'ordre RRF si la clé Voyage est absente", async () => {
    delete process.env.VOYAGE_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await rerankChunks("q", candidates, { topN: 3 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("replie sur l'ordre RRF si Voyage répond 503", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(voyageRerank([], 503)));
    const out = await rerankChunks("q", candidates, { topN: 2 });
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("replie sur l'ordre RRF si Voyage répond 401 (clé invalide)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(voyageRerank([], 401)));
    const out = await rerankChunks("q", candidates, { topN: 4 });
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("replie sur l'ordre RRF si le réseau échoue (throw)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const out = await rerankChunks("q", candidates, { topN: 2 });
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("replie si data est vide / malformée", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(voyageRerank([])));
    const out = await rerankChunks("q", candidates, { topN: 2 });
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("ne rappelle pas Voyage pour 0 ou 1 chunk", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await rerankChunks("q", [], { topN: 5 })).toEqual([]);
    expect((await rerankChunks("q", [candidates[0]!], { topN: 5 })).map((c) => c.id)).toEqual([
      "a",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
