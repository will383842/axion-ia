import { describe, it, expect, vi, afterEach } from "vitest";
import { findNearestArticles, verdictPourVoisinLePlusProche } from "../nearest-articles";

const ID = "00000000-0000-0000-0000-000000000001";
afterEach(() => {
  delete process.env["CONTENT_EMBEDDING_PROVIDER"];
  delete process.env["CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE"];
});

describe("détection des doublons — colonne selon le fournisseur", () => {
  it("openai (défaut) : lit la colonne embedding, jamais embedding_voyage", async () => {
    const q = vi.fn(async () => [{ id: "a", similarity: 0.9 }]);
    await findNearestArticles({ $queryRawUnsafe: q } as never, { articleId: ID });
    const sql = String((q.mock.calls[0] as unknown[])[0]);
    expect(sql).toContain('"embedding"');
    expect(sql).not.toContain("embedding_voyage");
  });
  it("voyage : lit embedding_voyage, jamais la colonne OpenAI", async () => {
    process.env["CONTENT_EMBEDDING_PROVIDER"] = "voyage";
    const q = vi.fn(async () => []);
    await findNearestArticles({ $queryRawUnsafe: q } as never, { articleId: ID, limit: 3 });
    const call = q.mock.calls[0] as unknown[];
    const sql = String(call[0]);
    expect(sql).toContain('"embedding_voyage"');
    expect(sql).not.toMatch(/"embedding"(?!_)/);
    expect(call.slice(1)).toEqual([ID, 3]);
  });
  it("le verdict utilise les seuils du fournisseur", () => {
    const voisins = [{ id: "a", similarity: 0.9 }];
    expect(verdictPourVoisinLePlusProche(voisins, "openai")?.verdict).toBe("duplicate");
    process.env["CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE"] = "0.95";
    expect(verdictPourVoisinLePlusProche(voisins, "voyage")?.verdict).toBe("similar");
    expect(verdictPourVoisinLePlusProche([], "voyage")).toBeNull();
  });
});
