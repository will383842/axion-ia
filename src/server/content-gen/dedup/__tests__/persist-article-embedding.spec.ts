/**
 * Tests persist-article-embedding.ts — V-09 wiring 2026-05-22.
 *
 * Couvre :
 *  1. persistArticleEmbedding ne throw JAMAIS (best-effort post-publish).
 *  2. Retourne `{persisted: false, reason: 'disabled'}` quand flag OFF (default).
 *  3. Retourne `{persisted: true, reason: 'ok'}` + appel $executeRaw quand flag ON.
 *  4. Dimensions != 1536 → `{persisted: false, reason: 'no_embedding'}`.
 *  5. $executeRaw error → `{persisted: false, reason: 'exception'}` (no throw).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { persistArticleEmbedding } from "../persist-article-embedding";

const originalEnv = { ...process.env };

interface MockPrisma {
  $executeRaw: ReturnType<typeof vi.fn>;
}

function makeMockPrisma(executeImpl?: () => Promise<number>): MockPrisma {
  return {
    $executeRaw: vi.fn(executeImpl ?? (async () => 1)),
  };
}

beforeEach(() => {
  delete process.env["OPENAI_EMBEDDINGS_ENABLED"];
  delete process.env["OPENAI_API_KEY"];
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("persistArticleEmbedding — flag default OFF", () => {
  it("retourne disabled + ne call jamais Prisma quand flag absent", async () => {
    const prisma = makeMockPrisma();
    const result = await persistArticleEmbedding(prisma as never, {
      articleId: "00000000-0000-0000-0000-000000000001",
      title: "Audit IA pour PME : guide complet 2026",
      bodyText: "Body text article complet pour analyse de couverture.",
    });

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe("disabled");
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("retourne disabled quand flag='false' explicite", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "false";
    const prisma = makeMockPrisma();
    const result = await persistArticleEmbedding(prisma as never, {
      articleId: "00000000-0000-0000-0000-000000000002",
      title: "Test",
    });

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe("disabled");
  });
});

describe("persistArticleEmbedding — flag ON, succès", () => {
  it("appelle $executeRaw avec vecteur cast::vector quand API répond", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    process.env["OPENAI_API_KEY"] = "sk-test-fake";

    const fakeEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            data: [{ embedding: fakeEmbedding }],
            usage: { total_tokens: 250 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const prisma = makeMockPrisma();
    const result = await persistArticleEmbedding(prisma as never, {
      articleId: "00000000-0000-0000-0000-000000000003",
      title: "AI Act conformité audit 2026",
      metaDescription: "Comprendre la conformité AI Act pour PME.",
      bodyText: "Le règlement UE 2024/1689 impose des obligations spécifiques.",
    });

    expect(result.persisted).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.tokensUsed).toBe(250);
    expect(result.dimensions).toBe(1536);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe("persistArticleEmbedding — robustesse fail-soft", () => {
  it("retourne exception sans throw si $executeRaw échoue", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    process.env["OPENAI_API_KEY"] = "sk-test-fake";

    const fakeEmbedding = new Array(1536).fill(0.1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            data: [{ embedding: fakeEmbedding }],
            usage: { total_tokens: 100 },
          }),
          { status: 200 },
        );
      }),
    );

    const prisma = makeMockPrisma(async () => {
      throw new Error("simulated DB error");
    });

    const result = await persistArticleEmbedding(prisma as never, {
      articleId: "00000000-0000-0000-0000-000000000004",
      title: "Test DB error",
    });

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe("exception");
  });

  it("retourne disabled si embedding API retourne null (network error)", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    process.env["OPENAI_API_KEY"] = "sk-test-fake";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("Internal Server Error", { status: 500 });
      }),
    );

    const prisma = makeMockPrisma();
    const result = await persistArticleEmbedding(prisma as never, {
      articleId: "00000000-0000-0000-0000-000000000005",
      title: "Test 500",
    });

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe("disabled");
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
