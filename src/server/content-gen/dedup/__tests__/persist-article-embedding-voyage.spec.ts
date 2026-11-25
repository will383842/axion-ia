import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
const killSwitchMock = vi.fn();
vi.mock("@/server/content-gen/config-store", () => ({
  readKillSwitchFailSafe: (...a: unknown[]) => killSwitchMock(...a),
}));
import { __resetVoyageTokenCounter } from "../voyage-embedder";
import { persistArticleEmbedding } from "../persist-article-embedding";

const input = {
  articleId: "00000000-0000-0000-0000-000000000001",
  title: "Titre",
  bodyText: "Corps",
};
const vec = (n: number) => Array.from({ length: n }, () => 0.1);

beforeEach(() => {
  killSwitchMock.mockResolvedValue({ active: false });
  __resetVoyageTokenCounter();
  process.env["CONTENT_EMBEDDING_PROVIDER"] = "voyage";
  process.env["VOYAGE_API_KEY"] = "pa-test";
});
afterEach(() => {
  delete process.env["CONTENT_EMBEDDING_PROVIDER"];
  delete process.env["VOYAGE_API_KEY"];
  delete process.env["OPENAI_EMBEDDINGS_ENABLED"];
  delete process.env["VOYAGE_EMBEDDINGS_MAX_TOKENS_PER_DAY"];
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

  it("bodyText vide + bodyHtml : même texte que le rattrapage (HTML nettoyé)", async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) =>
      Response.json({ data: [{ index: 0, embedding: vec(1024) }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const exec = vi.fn(async () => 1);
    await persistArticleEmbedding({ $executeRaw: exec } as never, {
      articleId: input.articleId,
      title: "Titre",
      bodyText: "",
      bodyHtml: "<p>Corps <b>HTML</b></p>",
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as { body: string }).body));
    expect(JSON.stringify(body.input)).toContain("Corps HTML");
    expect(JSON.stringify(body.input)).not.toContain("<p>");
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
    expect(exec).toHaveBeenCalledTimes(1);
    expect((exec.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?")).toContain(
      "= NULL",
    );
  });

  it("panne Voyage : remet embedding_voyage à NULL (pas de vecteur périmé)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x", { status: 500 })),
    );
    const exec = vi.fn(async () => 1);
    await persistArticleEmbedding({ $executeRaw: exec } as never, input);
    const sql = (exec.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?");
    expect(sql).toContain("embedding_voyage = NULL");
  });

  it("coupure d'urgence active : aucun appel Voyage, rien écrit", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    killSwitchMock.mockResolvedValue({ active: true, reason: "test" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const exec = vi.fn(async () => 1);
    const r = await persistArticleEmbedding({ $executeRaw: exec } as never, input);
    expect(r.persisted).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledTimes(1);
    expect((exec.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?")).toContain(
      "= NULL",
    );
  });

  it("plafond quotidien de tokens atteint : aucun appel Voyage, rien écrit", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env["VOYAGE_EMBEDDINGS_MAX_TOKENS_PER_DAY"] = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const exec = vi.fn(async () => 1);
    const r = await persistArticleEmbedding({ $executeRaw: exec } as never, input);
    expect(r.persisted).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledTimes(1);
    expect((exec.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?")).toContain(
      "= NULL",
    );
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
