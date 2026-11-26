import { describe, it, expect, vi, beforeEach } from "vitest";

const embedVoyage = vi.fn();
const embedVoyageBatch = vi.fn();
vi.mock("../voyage-embedder", async (orig) => ({
  ...(await orig<typeof import("../voyage-embedder")>()),
  embedVoyage: (...a: unknown[]) => embedVoyage(...a),
  embedVoyageBatch: (...a: unknown[]) => embedVoyageBatch(...a),
}));
const queryRawUnsafe = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a), $executeRaw: vi.fn() },
}));
vi.mock("@/server/content-gen/config-store", () => ({
  readKillSwitchFailSafe: async () => ({ active: false }),
}));

import { buildVoyageEmbeddingText, htmlVersTexte } from "../texte-a-vectoriser";
import { persistArticleEmbedding } from "../persist-article-embedding";
import { rattraperEmbeddingsVoyage } from "@/server/queue/workers/embeddings-backfill-worker";

describe("texte à vectoriser (Voyage)", () => {
  it("jamais de HTML : balises retirées quand body_text est vide", () => {
    const t = buildVoyageEmbeddingText({
      title: "Titre",
      bodyText: "",
      bodyHtml: "<p>Un <strong>texte</strong></p><script>x()</script>",
    });
    expect(t).toBe("Titre\n\nUn texte");
    expect(htmlVersTexte("<h1>A</h1>  <p>B</p>")).toBe("A B");
  });
  it("body_text prioritaire sur le HTML", () => {
    expect(
      buildVoyageEmbeddingText({ title: "T", bodyText: "brut", bodyHtml: "<p>html</p>" }),
    ).toBe("T\n\nbrut");
  });
});

describe("publication et rattrapage donnent le même texte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["CONTENT_EMBEDDING_PROVIDER"] = "voyage";
    process.env["VOYAGE_API_KEY"] = "cle-de-test";
    process.env["VOYAGE_ARTICLES_BACKFILL_ENABLED"] = "true";
  });
  it("même article → même texte envoyé à Voyage", async () => {
    const vec = new Array(1024).fill(0.1);
    embedVoyage.mockResolvedValue({ embedding: vec, tokensUsed: 5 });
    embedVoyageBatch.mockResolvedValue({ ok: true, embeddings: [vec] });
    const article = {
      id: "00000000-0000-0000-0000-000000000001",
      title: "Mon titre",
      meta_description: "Une méta",
      body_text: "",
      body: "<p>Le <em>corps</em> de l'article</p>",
    };
    queryRawUnsafe.mockResolvedValue([article]);

    await rattraperEmbeddingsVoyage();
    const texteRattrapage = (embedVoyageBatch.mock.calls[0]?.[0] as string[])[0];

    await persistArticleEmbedding({ $executeRaw: vi.fn() } as never, {
      articleId: article.id,
      title: article.title,
      metaDescription: article.meta_description,
      bodyText: "Le corps de l'article",
    });
    const textePublication = embedVoyage.mock.calls[0]?.[0] as string;

    expect(texteRattrapage).toBe(textePublication);
    expect(texteRattrapage).not.toContain("<");
  });
});
