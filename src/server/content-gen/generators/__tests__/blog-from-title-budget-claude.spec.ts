/**
 * blog_from_title via Claude : le plan et l'expansion reçoivent le budget de sortie élargi
 * (la réflexion compte dans max_tokens) ; sans Claude, les anciennes valeurs d'OpenAI restent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { routerGenerate } = vi.hoisted(() => ({ routerGenerate: vi.fn() }));

vi.mock("../../providers/provider-router", () => ({ generate: routerGenerate }));
vi.mock("../../kb-client", () => ({ retrieve: vi.fn(async () => []) }));

import {
  MAX_TOKENS_EXPANSION_CLAUDE,
  MAX_TOKENS_PLAN_CLAUDE,
} from "../../providers/blog-claude-budgets";
import { blogFromTitleGenerator } from "../blog-from-title";
import type { GeneratorBaseInput } from "../types";

const input = {
  jobId: "job-test",
  contentType: "blog_from_title",
  targetSearchIntent: "informational",
  targetAudienceSize: "PME",
  primaryKeyword: "automatisation comptable",
} as unknown as GeneratorBaseInput;

const illisible = { output: "pas du json", costUsd: 0, tokensInput: 1, tokensOutput: 1 };

beforeEach(() => {
  routerGenerate.mockReset();
  routerGenerate.mockResolvedValue(illisible);
});
afterEach(() => {
  delete process.env["CONTENT_GEN_BLOG_CLAUDE"];
});

describe("blog_from_title : budget de sortie", () => {
  it("les budgets Claude sont assez larges pour un article JSON complet", () => {
    expect(MAX_TOKENS_PLAN_CLAUDE).toBeGreaterThanOrEqual(8_000);
    expect(MAX_TOKENS_EXPANSION_CLAUDE).toBeGreaterThanOrEqual(MAX_TOKENS_PLAN_CLAUDE);
  });

  it("via Claude : le plan reçoit MAX_TOKENS_PLAN_CLAUDE", async () => {
    process.env["CONTENT_GEN_BLOG_CLAUDE"] = "true";
    await blogFromTitleGenerator.generate(input).catch(() => undefined);
    expect(routerGenerate).toHaveBeenCalled();
    for (const [req] of routerGenerate.mock.calls) {
      expect(req.maxTokens).toBe(MAX_TOKENS_PLAN_CLAUDE);
    }
  });

  it("sans Claude : l'ancien budget du plan (2600) est conservé", async () => {
    await blogFromTitleGenerator.generate(input).catch(() => undefined);
    expect(routerGenerate.mock.calls[0]![0].maxTokens).toBe(2600);
  });
});
