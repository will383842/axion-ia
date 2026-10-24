/**
 * Lot L6 — filtre de statuts des recherches (fiches dépréciées) et type d'entrée Voyage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const queryRawUnsafeMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafeMock(...a) },
}));

import { clauseStatuts, searchKnowledge } from "../search-fts";
import { searchKnowledgeVector } from "../search-vector";
import { EMBEDDING_DIMENSION, generateEmbedding } from "../embeddings";

describe("clauseStatuts", () => {
  it("défaut = publiées et dépréciées (comportement historique inchangé)", () => {
    expect(clauseStatuts()).toBe("ke.status IN ('published', 'deprecated')");
    expect(clauseStatuts([])).toBe("ke.status IN ('published', 'deprecated')");
  });

  it("publiées seules = fiche dépréciée exclue", () => {
    expect(clauseStatuts(["published"])).toBe("ke.status IN ('published')");
  });

  it("ne laisse passer aucune valeur hors liste blanche", () => {
    const sql = clauseStatuts(["published'; DROP TABLE x; --" as never]);
    expect(sql).toBe("ke.status IN ('published', 'deprecated')");
  });
});

describe("recherches : statuts transmis au SQL", () => {
  beforeEach(() => {
    queryRawUnsafeMock.mockReset();
  });

  it("vectoriel : par défaut inchangé, avec statuts=['published'] la dépréciée est exclue", async () => {
    queryRawUnsafeMock.mockResolvedValue([]);
    await searchKnowledgeVector({ queryEmbedding: [0.1, 0.2], locale: "fr" });
    expect(String(queryRawUnsafeMock.mock.calls[0]?.[0])).toContain(
      "ke.status IN ('published', 'deprecated')",
    );
    queryRawUnsafeMock.mockClear();
    await searchKnowledgeVector({
      queryEmbedding: [0.1, 0.2],
      locale: "fr",
      statuts: ["published"],
    });
    const sql = String(queryRawUnsafeMock.mock.calls[0]?.[0]);
    expect(sql).toContain("ke.status IN ('published')");
    expect(sql).not.toContain("deprecated");
  });

  it("lexical : les deux requêtes (résultats et total) excluent la dépréciée", async () => {
    queryRawUnsafeMock.mockResolvedValue([]);
    await searchKnowledge({ query: "audit", locale: "fr", statuts: ["published"] });
    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(2);
    for (const call of queryRawUnsafeMock.mock.calls) {
      expect(String(call[0])).toContain("ke.status IN ('published')");
      expect(String(call[0])).not.toContain("deprecated");
    }
  });
});

describe("generateEmbedding : type d'entrée Voyage", () => {
  const savedKey = process.env.VOYAGE_API_KEY;

  beforeEach(() => {
    process.env.VOYAGE_API_KEY = "test-key";
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.VOYAGE_API_KEY;
    else process.env.VOYAGE_API_KEY = savedKey;
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const vector = Array.from({ length: EMBEDDING_DIMENSION }, () => 0.01);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: vector }], usage: { total_tokens: 3 } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function inputTypeEnvoye(fetchMock: ReturnType<typeof stubFetch>): string {
    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return (JSON.parse(String(opts.body)) as { input_type: string }).input_type;
  }

  it("par défaut : document", async () => {
    const f = stubFetch();
    await generateEmbedding("texte");
    expect(inputTypeEnvoye(f)).toBe("document");
  });

  it("recherche : query est transmis à Voyage", async () => {
    const f = stubFetch();
    await generateEmbedding("question", "public", "query");
    expect(inputTypeEnvoye(f)).toBe("query");
  });
});
