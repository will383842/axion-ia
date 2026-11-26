import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { embedVoyage, embedVoyageBatch, VOYAGE_EMBEDDING_DIMENSION } from "../voyage-embedder";

const CLE = "pa-secret-cle-de-test-1234567890";
const vec = (v = 0.1) => Array.from({ length: VOYAGE_EMBEDDING_DIMENSION }, () => v);

beforeEach(() => {
  process.env["VOYAGE_API_KEY"] = CLE;
});
afterEach(() => {
  delete process.env["VOYAGE_API_KEY"];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function logsConcatenes(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
}

describe("voyage-embedder", () => {
  it("succès : appelle voyage-3 en input_type document et renvoie 1024 dim", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [{ index: 0, embedding: vec() }], usage: { total_tokens: 42 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await embedVoyage("bonjour");
    expect(r?.embedding).toHaveLength(1024);
    expect(r?.tokensUsed).toBe(42);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.voyageai.com/v1/embeddings");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: "voyage-3", input_type: "document", input: ["bonjour"] });
    expect(init.signal).toBeDefined();
  });

  it("clé absente : null, aucun appel réseau", async () => {
    delete process.env["VOYAGE_API_KEY"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await embedVoyage("x")).toBeNull();
    expect(await embedVoyageBatch(["x"])).toEqual({ ok: false, reason: "no_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("429 : échec rate_limited, ne lève pas, sans clé dans le journal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(`trop de requêtes pour ${CLE}`, { status: 429 })),
    );
    const out = await embedVoyageBatch(["x"]);
    expect(out).toEqual({ ok: false, reason: "rate_limited", status: 429 });
    expect(await embedVoyage("x")).toBeNull();
    expect(logsConcatenes(warn)).not.toContain(CLE);
  });

  it("délai dépassé : échec timeout, sans clé dans le journal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException(`aborted ${CLE}`, "TimeoutError");
      }),
    );
    const out = await embedVoyageBatch(["x"]);
    expect(out).toEqual({ ok: false, reason: "timeout" });
    expect(logsConcatenes(warn)).not.toContain(CLE);
  });

  it("erreur réseau contenant la clé : purgée du journal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(`boom Authorization: Bearer ${CLE}`);
      }),
    );
    const out = await embedVoyageBatch(["x"]);
    expect(out.ok).toBe(false);
    expect(JSON.stringify(out)).not.toContain(CLE);
    expect(logsConcatenes(warn)).not.toContain(CLE);
  });

  it("mauvaise dimension : bad_response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ index: 0, embedding: [1, 2, 3] }] })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await embedVoyageBatch(["x"])).toEqual({ ok: false, reason: "bad_response" });
  });

  it("lot : remet les vecteurs dans l'ordre des entrées", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            { index: 1, embedding: vec(0.2) },
            { index: 0, embedding: vec(0.1) },
          ],
        }),
      ),
    );
    const out = await embedVoyageBatch(["a", "b"]);
    expect(out.ok && out.embeddings[0]?.[0]).toBe(0.1);
    expect(out.ok && out.embeddings[1]?.[0]).toBe(0.2);
  });
});
