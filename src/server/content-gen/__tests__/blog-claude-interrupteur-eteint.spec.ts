/**
 * Branchement « texte du blog via Claude » (C3) : INERTE tant que
 * `CONTENT_GEN_BLOG_CLAUDE` n'est pas exactement "true".
 *
 * Variable absente : routeur, expansion par tranches et juge appellent OpenAI avec
 * la MÊME requête qu'avant (sans `blogClaudeRole`) ; Anthropic n'est jamais appelé.
 * Variable allumée : un échec de Claude fait échouer l'appel sans passer par OpenAI.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { openaiGen, anthropicGen, claudeMock, reponse } = vi.hoisted(() => {
  const reponse = {
    output: '{"bodyHtml":"<h2>x</h2>"}',
    tokensInput: 1,
    tokensOutput: 1,
    costUsd: 0.01,
    provider: "openai",
    model: "m",
  };
  return {
    reponse,
    openaiGen: vi.fn(),
    anthropicGen: vi.fn(),
    claudeMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("../providers/openai", () => ({
  openaiProvider: { key: "openai", supportedRoles: ["text"], generate: openaiGen },
}));
vi.mock("../providers/anthropic", () => ({
  anthropicProvider: { key: "anthropic", supportedRoles: ["text"], generate: anthropicGen },
  computeCost: () => 0,
}));
vi.mock("../providers/perplexity", () => ({
  perplexityProvider: { key: "perplexity", supportedRoles: ["data"], generate: vi.fn() },
}));
vi.mock("../providers/unsplash", () => ({
  unsplashProvider: { key: "unsplash", supportedRoles: ["stock_image"], generate: vi.fn() },
}));
vi.mock("../providers/quota-guard", () => ({
  clearProviderFailureStreak: vi.fn(async () => undefined),
  recordPermanentProviderFailure: vi.fn(async () => undefined),
}));
vi.mock("../providers/blog-claude-ledger", async () => {
  const { UnrecoverableError } = await import("bullmq");
  class BlogClaudeRefusError extends UnrecoverableError {
    constructor(
      message: string,
      public readonly code: string,
    ) {
      super(message);
    }
  }
  return {
    BLOG_TYPES: new Set(["blog_article", "blog_from_keywords", "blog_from_title", "blog_from_rss"]),
    BORNE_DURE_JOUR_USD: 20,
    BORNE_DURE_MOIS_USD: 300,
    BlogClaudeRefusError,
    jourParis: () => "2026-01-01",
    reserverCout: vi.fn(),
    solderReservation: vi.fn(),
  };
});
vi.mock("../providers/anthropic-credit-alert", () => ({ alerterBlogClaude: vi.fn() }));
vi.mock("../providers/blog-claude", async (orig) => {
  const real = await orig<typeof import("../providers/blog-claude")>();
  return { ...real, genererTexteBlogClaude: claudeMock };
});
vi.mock("../shared/generation-log", () => ({ logStep: vi.fn(async () => undefined) }));

import { generate as routerGenerate } from "../providers/provider-router";
import { expandOutlineChunked } from "../shared/expand-outline-chunked";
import { reviewArticle } from "../reviewer/llm-judge";

const JUGE_JSON = JSON.stringify({
  dimensions: {},
  issues: [],
  reasoning: "ok",
});

const requeteEcriture = {
  jobId: "j1",
  contentType: "blog_article",
  role: "text" as const,
  systemPrompt: "sys",
  userPrompt: "usr",
  maxTokens: 100,
  temperature: 0.7,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  openaiGen.mockReset().mockResolvedValue({ ...reponse, output: JUGE_JSON });
  anthropicGen.mockReset();
  claudeMock
    .mockReset()
    .mockResolvedValue({ ...reponse, provider: "anthropic", output: JUGE_JSON });
});
afterEach(() => vi.unstubAllEnvs());

describe.each([[undefined], ["TRUE"], ["1"], ["yes"], [""]])(
  "interrupteur éteint (valeur %j)",
  (valeur) => {
    beforeEach(() => {
      if (valeur !== undefined) vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", valeur);
      else delete process.env["CONTENT_GEN_BLOG_CLAUDE"];
    });

    it("routeur : OpenAI reçoit la requête d'avant (sans blogClaudeRole), Claude jamais", async () => {
      await routerGenerate({ ...requeteEcriture, blogClaudeRole: "ecriture" });
      expect(openaiGen).toHaveBeenCalledTimes(1);
      expect(openaiGen.mock.calls[0]![0]).toEqual(requeteEcriture);
      expect("blogClaudeRole" in (openaiGen.mock.calls[0]![0] as object)).toBe(false);
      expect(claudeMock).not.toHaveBeenCalled();
      expect(anthropicGen).not.toHaveBeenCalled();
    });

    it("routeur : requête sans blogClaudeRole transmise telle quelle", async () => {
      await routerGenerate(requeteEcriture);
      expect(openaiGen.mock.calls[0]![0]).toBe(requeteEcriture);
    });

    it("expansion par tranches : même requête OpenAI qu'avant", async () => {
      await expandOutlineChunked({
        jobId: "j1",
        contentType: "blog_article",
        outline: [{ h2: "A", brief: "b" }],
        chunkSize: 4,
        expandSystem: "sys",
        buildUserPrompt: () => "usr",
        blogClaudeRole: "ecriture",
      });
      expect(openaiGen.mock.calls[0]![0]).toEqual({
        jobId: "j1",
        contentType: "blog_article",
        role: "text",
        systemPrompt: "sys",
        userPrompt: "usr",
        maxTokens: 5000,
        temperature: 0.7,
      });
      expect(claudeMock).not.toHaveBeenCalled();
      expect(anthropicGen).not.toHaveBeenCalled();
    });

    it("juge : requête OpenAI identique à l'ancienne, même pour un type de blog", async () => {
      await reviewArticle({ jobId: "j1", title: "t", bodyHtml: "<p>x</p>" }, undefined, {
        typeBlog: "blog_article",
      });
      const req = openaiGen.mock.calls[0]![0] as Record<string, unknown>;
      expect(req["contentType"]).toBe("editorial_review");
      expect(req["model"]).toBe("gpt-4o");
      expect(req["temperature"]).toBe(0.2);
      expect(claudeMock).not.toHaveBeenCalled();
      expect(anthropicGen).not.toHaveBeenCalled();
    });
  },
);

describe("interrupteur allumé", () => {
  beforeEach(() => vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true"));

  it("routeur : écriture → porte Claude, OpenAI jamais appelé", async () => {
    await routerGenerate({ ...requeteEcriture, blogClaudeRole: "ecriture" });
    expect(claudeMock).toHaveBeenCalledWith(
      expect.objectContaining({ blogClaudeRole: "ecriture" }),
      "ecriture",
    );
    expect(openaiGen).not.toHaveBeenCalled();
  });

  it("routeur : échec de Claude = échec de l'appel, sans secours OpenAI", async () => {
    claudeMock.mockRejectedValue(new Error("refus"));
    await expect(
      routerGenerate({ ...requeteEcriture, blogClaudeRole: "ecriture" }),
    ).rejects.toThrow("refus");
    expect(openaiGen).not.toHaveBeenCalled();
  });

  it("routeur : un appel sans blogClaudeRole reste sur OpenAI et n'appelle jamais Claude", async () => {
    openaiGen.mockRejectedValue(new Error("panne openai"));
    await expect(routerGenerate(requeteEcriture)).rejects.toThrow();
    expect(claudeMock).not.toHaveBeenCalled();
    expect(anthropicGen).not.toHaveBeenCalled();
  });

  it("juge : type de blog → relecture par Claude, OpenAI jamais appelé", async () => {
    await reviewArticle({ jobId: "j1", title: "t", bodyHtml: "<p>x</p>" }, undefined, {
      typeBlog: "blog_article",
    });
    expect(claudeMock).toHaveBeenCalledTimes(1);
    expect(claudeMock.mock.calls[0]![1]).toBe("relecture");
    const req = claudeMock.mock.calls[0]![0] as Record<string, unknown>;
    expect("temperature" in req).toBe(false);
    expect("model" in req).toBe(false);
    expect(openaiGen).not.toHaveBeenCalled();
  });

  it("juge : type hors blog ou inconnu → OpenAI inchangé", async () => {
    await reviewArticle({ jobId: "j1", title: "t", bodyHtml: "<p>x</p>" }, undefined, {
      typeBlog: "faq_standalone",
    });
    await reviewArticle({ jobId: "j1", title: "t", bodyHtml: "<p>x</p>" });
    expect(openaiGen).toHaveBeenCalledTimes(2);
    expect(claudeMock).not.toHaveBeenCalled();
  });

  it("juge : échec de Claude = erreur remontée, sans secours OpenAI", async () => {
    claudeMock.mockRejectedValue(new Error("refus"));
    await expect(
      reviewArticle({ jobId: "j1", title: "t", bodyHtml: "<p>x</p>" }, undefined, {
        typeBlog: "blog_from_rss",
      }),
    ).rejects.toThrow("refus");
    expect(openaiGen).not.toHaveBeenCalled();
  });
});

describe("branchement des générateurs de blog (garde statique)", () => {
  const DIR = join(__dirname, "..", "generators");
  it.each([
    ["blog-article.ts", 2],
    ["blog-from-keywords.ts", 2],
    ["blog-from-title.ts", 2],
    ["blog-from-rss.ts", 1],
  ])("%s signale blogClaudeRole écriture (%i appels)", (fichier, attendu) => {
    const src = readFileSync(join(DIR, fichier), "utf8");
    expect(src.match(/blogClaudeRole: "ecriture"/g)?.length).toBe(attendu);
  });

  it("les autres générateurs ne signalent jamais le rôle", () => {
    for (const f of [
      "comparison.ts",
      "barometer-insight.ts",
      "guide-pilier.ts",
      "faq-standalone.ts",
    ]) {
      expect(readFileSync(join(DIR, f), "utf8")).not.toContain("blogClaudeRole");
    }
  });
});
