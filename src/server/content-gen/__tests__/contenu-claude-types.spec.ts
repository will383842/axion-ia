/**
 * PR2 « contenu via Claude » : types configurables (CONTENT_GEN_CLAUDE_TYPES).
 *  - routeur : type hors liste → OpenAI ; `tous` ; interrupteur seul = blog comme avant ;
 *    AUCUN secours OpenAI pour un type autorisé ; demande non marquée (chatbot `qa_derived`)
 *    jamais basculée, même avec « tous » ;
 *  - worker : erreur Anthropic / refus de plafond d'un type autorisé = UnrecoverableError.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { openaiGen, claudeMock } = vi.hoisted(() => ({ openaiGen: vi.fn(), claudeMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("../providers/openai", () => ({
  openaiProvider: { key: "openai", supportedRoles: ["text"], generate: openaiGen },
}));
vi.mock("../providers/anthropic", () => ({
  anthropicProvider: { key: "anthropic", supportedRoles: ["text"], generate: vi.fn() },
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
vi.mock("../providers/anthropic-credit-alert", () => ({ alerterBlogClaude: vi.fn() }));
vi.mock("../providers/blog-claude", async (orig) => {
  const real = await orig<typeof import("../providers/blog-claude")>();
  return { ...real, genererTexteBlogClaude: claudeMock };
});

import { UnrecoverableError } from "bullmq";
import { generate } from "../providers/provider-router";
import { ProviderError } from "../providers/IProvider";
import { BlogClaudeRefusError } from "../providers/blog-claude-ledger";

const reponse = {
  output: "x",
  tokensInput: 1,
  tokensOutput: 1,
  costUsd: 0.01,
  provider: "openai",
  model: "m",
};
const base = {
  jobId: "j1",
  role: "text" as const,
  systemPrompt: "sys",
  userPrompt: "usr",
  maxTokens: 100,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env["CONTENT_GEN_CLAUDE_TYPES"];
  openaiGen.mockReset().mockResolvedValue(reponse);
  claudeMock.mockReset().mockResolvedValue({ ...reponse, provider: "anthropic" });
});
afterEach(() => vi.unstubAllEnvs());

describe("routeur : types autorisés", () => {
  it("CONTENT_GEN_BLOG_CLAUDE seul : un type blog marqué va à Claude (comme avant)", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    await generate({ ...base, contentType: "blog_article", blogClaudeRole: "ecriture" });
    expect(claudeMock).toHaveBeenCalledTimes(1);
    expect(claudeMock.mock.calls[0]![1]).toBe("ecriture");
    expect(openaiGen).not.toHaveBeenCalled();
  });

  it("CONTENT_GEN_BLOG_CLAUDE seul : un type hors blog, même marqué, reste sur OpenAI", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    await generate({ ...base, contentType: "landing_ville", blogClaudeRole: "ecriture" });
    expect(claudeMock).not.toHaveBeenCalled();
    expect(openaiGen).toHaveBeenCalledTimes(1);
    expect("blogClaudeRole" in (openaiGen.mock.calls[0]![0] as object)).toBe(false);
  });

  it("liste explicite : type listé → Claude ; type hors liste → OpenAI", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "landing_ville,glossary_term");
    await generate({ ...base, contentType: "landing_ville", blogClaudeRole: "court" });
    expect(claudeMock).toHaveBeenCalledTimes(1);
    expect(claudeMock.mock.calls[0]![1]).toBe("court");
    await generate({ ...base, contentType: "comparison", blogClaudeRole: "ecriture" });
    expect(claudeMock).toHaveBeenCalledTimes(1);
    expect(openaiGen).toHaveBeenCalledTimes(1);
  });

  it("`tous` : tout type marqué va à Claude (les trois rôles)", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    for (const role of ["ecriture", "relecture", "court"] as const) {
      await generate({ ...base, contentType: "comparison", blogClaudeRole: role });
    }
    expect(claudeMock.mock.calls.map((c) => c[1])).toEqual(["ecriture", "relecture", "court"]);
    expect(openaiGen).not.toHaveBeenCalled();
  });

  it("interrupteur éteint + `tous` : rien ne change (OpenAI, sans marquage)", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "false");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    await generate({ ...base, contentType: "blog_article", blogClaudeRole: "ecriture" });
    expect(claudeMock).not.toHaveBeenCalled();
    expect(openaiGen).toHaveBeenCalledTimes(1);
  });

  it("chatbot : `qa_derived` NON marqué ne bascule jamais, même avec `tous`", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    const requete = { ...base, contentType: "qa_derived" };
    await generate(requete);
    expect(claudeMock).not.toHaveBeenCalled();
    expect(openaiGen.mock.calls[0]![0]).toBe(requete);
  });

  it("aucun secours OpenAI : un échec de Claude (type autorisé) remonte, OpenAI jamais appelé", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    for (const erreur of [
      new ProviderError("503", "down", "anthropic", true),
      new BlogClaudeRefusError("plafond", "plafond_jour"),
    ]) {
      claudeMock.mockReset().mockRejectedValue(erreur);
      await expect(
        generate({ ...base, contentType: "landing_ville", blogClaudeRole: "ecriture" }),
      ).rejects.toBe(erreur);
    }
    expect(openaiGen).not.toHaveBeenCalled();
  });
});

describe("refus de la porte = UnrecoverableError", () => {
  it("BlogClaudeRefusError en est une (aucun rejeu BullMQ, donc aucune régénération payante)", () => {
    expect(new BlogClaudeRefusError("x", "plafond_mois")).toBeInstanceOf(UnrecoverableError);
  });
});
