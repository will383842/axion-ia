/**
 * PR3 « contenu via Claude » : marquage de tous les générateurs de contenu.
 *  - chaque appel au routeur d'un générateur porte un `blogClaudeRole` ;
 *  - le chatbot (`qa_derived` non marqué) et les juges OpenAI ne sont JAMAIS marqués ;
 *  - tout éteint (sans interrupteur, ou type hors liste) : la requête qui atteint OpenAI
 *    est identique à celle d'avant (le champ `blogClaudeRole` n'y arrive jamais) ;
 *  - aucun modèle Haiku, aucun prompt de générateur ne parle de frais de déplacement.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

import { generate } from "../providers/provider-router";
import { MODELES } from "../providers/blog-claude";

const SRC = resolve(__dirname, "../..");
const lire = (p: string) => readFileSync(resolve(SRC, p), "utf8");

/** Découpe chaque `routerGenerate({ … })` / `expandOutlineChunked({ … })` d'un fichier. */
function appels(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(routerGenerate|expandOutlineChunked)\(\{/g)) {
    let prof = 1;
    let i = (m.index ?? 0) + m[0].length;
    const debut = i;
    while (i < source.length && prof > 0) {
      if (source[i] === "{") prof++;
      else if (source[i] === "}") prof--;
      i++;
    }
    out.push(source.slice(debut, i));
  }
  return out;
}

const GENERATEURS_MARQUES = [
  "content-gen/generators/landing-ville-cas-usage.ts",
  "content-gen/generators/landing-ville-ecosystem.ts",
  "content-gen/generators/landing-ville-faq-extended.ts",
  "content-gen/generators/landing-ville-secteurs.ts",
  "content-gen/generators/landing-ville-economic-data.ts",
  "content-gen/generators/ville-hub-copy.ts",
  "content-gen/generators/comparison.ts",
  "content-gen/generators/faq-standalone.ts",
  "content-gen/generators/guide-pilier.ts",
  "content-gen/generators/qa-derived.ts",
  "content-gen/generators/v7-phase8-shared.ts",
  "content-gen/generators/barometer-insight.ts",
  "queue/workers/content-gen-worker.ts",
];

describe("marquage des générateurs", () => {
  for (const f of GENERATEURS_MARQUES) {
    it(`${f} : tout appel au routeur est marqué`, () => {
      const liste = appels(lire(f));
      expect(liste.length).toBeGreaterThan(0);
      for (const a of liste) {
        expect(a).toMatch(/blogClaudeRole:\s*"(ecriture|relecture|court)"/);
      }
    });
  }

  it("comparison et barometer-insight marquent aussi l'expansion par sections", () => {
    for (const f of [
      "content-gen/generators/comparison.ts",
      "content-gen/generators/barometer-insight.ts",
    ]) {
      const exp = appels(lire(f)).filter((a) => a.includes("outline:"));
      expect(exp.length).toBeGreaterThan(0);
      for (const a of exp) expect(a).toContain('blogClaudeRole: "ecriture"');
    }
  });

  it("le chatbot et les juges / correcteurs OpenAI ne sont JAMAIS marqués", () => {
    for (const f of [
      "chatbot/generation/generate-stream.ts",
      "content-gen/quality/benefit-judge-llm.ts",
      "queue/workers/content-fact-check-worker.ts",
      "observatoire/analysis.ts",
    ]) {
      expect(lire(f)).not.toContain("blogClaudeRole");
    }
  });

  it("aucun modèle Haiku sur le chemin Claude ; juge = Opus", () => {
    expect(Object.values(MODELES).some((m) => /haiku/i.test(m))).toBe(false);
    expect(MODELES.relecture).toBe("claude-opus-5-5");
    const juge = lire("content-gen/reviewer/llm-judge.ts");
    expect(juge).toMatch(/"relecture"/);
    expect(juge).toMatch(/interrupteurBlogClaude\(\) && typeClaudeAutorise\(typeJuge\)/);
  });

  it("aucun générateur ne parle de frais de déplacement", () => {
    for (const f of [
      ...GENERATEURS_MARQUES,
      "content-gen/generators/blog-from-rss.ts",
      // positionnement.ts est exclu : depuis #2311 il cite les frais de déplacement
      // uniquement comme interdit (« jamais de prix, ni d'acompte, ni de frais de déplacement »).
    ]) {
      expect(lire(f)).not.toMatch(/frais\s+(de\s+)?d[ée]placement/i);
    }
  });
});

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

describe("routeur : comportement", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env["CONTENT_GEN_CLAUDE_TYPES"];
    openaiGen.mockReset().mockResolvedValue(reponse);
    claudeMock.mockReset().mockResolvedValue({ ...reponse, provider: "anthropic" });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("interrupteur éteint : un type marqué reste sur OpenAI, sans blogClaudeRole", async () => {
    await generate({ ...base, contentType: "comparison", blogClaudeRole: "ecriture" });
    expect(claudeMock).not.toHaveBeenCalled();
    expect(openaiGen).toHaveBeenCalledTimes(1);
    expect(openaiGen.mock.calls[0]?.[0]).not.toHaveProperty("blogClaudeRole");
  });

  it("interrupteur allumé, type hors liste : OpenAI", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    await generate({ ...base, contentType: "comparison", blogClaudeRole: "ecriture" });
    expect(claudeMock).not.toHaveBeenCalled();
    expect(openaiGen).toHaveBeenCalledTimes(1);
  });

  it("type listé + marqué : Claude, avec son rôle (dont « court »)", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "comparison,faq_standalone");
    await generate({ ...base, contentType: "faq_standalone", blogClaudeRole: "court" });
    expect(claudeMock).toHaveBeenCalledTimes(1);
    expect(claudeMock.mock.calls[0]?.[1]).toBe("court");
    expect(openaiGen).not.toHaveBeenCalled();
  });

  it("chatbot : qa_derived NON marqué reste sur OpenAI même avec « tous »", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    await generate({ ...base, contentType: "qa_derived" });
    expect(claudeMock).not.toHaveBeenCalled();
    expect(openaiGen).toHaveBeenCalledTimes(1);
  });
});

describe("garde-fous annexes", () => {
  it("le juge multi-avis (jobId synthétique) reste sur OpenAI", () => {
    expect(lire("content-gen/quality/multi-judge-ensemble.ts")).toContain("sansClaude: true");
  });
});
