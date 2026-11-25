import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { persistArticleEmbedding } from "../persist-article-embedding";

const input = {
  articleId: "00000000-0000-0000-0000-000000000001",
  title: "Titre",
  bodyText: "Corps",
};
const vec = (n: number) => Array.from({ length: n }, () => 0.1);

beforeEach(() => {
  process.env["CONTENT_EMBEDDING_PROVIDER"] = "voyage";
  process.env["VOYAGE_API_KEY"] = "pa-test";
});
afterEach(() => {
  delete process.env["CONTENT_EMBEDDING_PROVIDER"];
  delete process.env["VOYAGE_API_KEY"];
  delete process.env["OPENAI_EMBEDDINGS_ENABLED"];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("persistArticleEmbedding — fournisseur voyage", () => {
  it("écrit embedding_voyage (pas embedding) et n'appelle jamais OpenAI", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [{ index: 0, embedding: vec(1024) }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const exec = vi.fn(async () => 1);
    const r = await persistArticleEmbedding({ $executeRaw: exec } as never, input);
    expect(r).toMatchObject({ persisted: true, reason: "ok", dimensions: 1024 });
    const sql = (exec.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?");
    expect(sql).toContain("embedding_voyage");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("voyageai.com");
  });

  it("panne Voyage (429) : ne lève pas, rien écrit, publication non bloquée", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x", { status: 429 })),
    );
    const exec = vi.fn(async () => 1);
    const r = await persistArticleEmbedding({ $executeRaw: exec } as never, input);
    expect(r.persisted).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it("clé absente : no-op, aucun appel réseau, aucune écriture", async () => {
    delete process.env["VOYAGE_API_KEY"];
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const exec = vi.fn(async () => 1);
    const r = await persistArticleEmbedding({ $executeRaw: exec } as never, input);
    expect(r).toEqual({ persisted: false, reason: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
  });

  it("écriture en base en échec : ne lève pas", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ index: 0, embedding: vec(1024) }] })),
    );
    const r = await persistArticleEmbedding(
      {
        $executeRaw: vi.fn(async () => {
          throw new Error("db");
        }),
      } as never,
      input,
    );
    expect(r).toEqual({ persisted: false, reason: "exception" });
  });

  it("fournisseur openai (défaut) : jamais d'appel Voyage", async () => {
    delete process.env["CONTENT_EMBEDDING_PROVIDER"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await persistArticleEmbedding({ $executeRaw: vi.fn() } as never, input);
    expect(r.reason).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
