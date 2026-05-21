/**
 * B.8 P0-3 — Tests llm-judge.ts (parsing + verdict derivation)
 *
 * Couvre :
 * 1. parseJudgeResponse : JSON valide → struct correcte.
 * 2. parseJudgeResponse : strip markdown ```json fences.
 * 3. parseJudgeResponse : JSON invalide → throw.
 * 4. parseJudgeResponse : scores clampes [0, 10].
 * 5. parseJudgeResponse : missing dimensions → 0 default.
 * 6. parseJudgeResponse : verdict derive de scores + issues (anti-hallucination).
 * 7. Verdict publish : globalScore >= 8.5 ET 0 P0.
 * 8. Verdict improve : 7 <= globalScore < 8.5 OU >=1 P1.
 * 9. Verdict reject : globalScore < 7 OU >=1 P0.
 * 10. issues : severity P0/P1/P2 + default fallback.
 * 11. reviewArticle : appelle anthropicProvider avec systemPrompt + userPrompt.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const generateMock = vi.fn<(...args: unknown[]) => Promise<{ output: string }>>();

vi.mock("@/server/content-gen/providers/anthropic", () => ({
  anthropicProvider: {
    key: "anthropic",
    supportedRoles: ["text"],
    generate: (...args: unknown[]) => generateMock(...args),
  },
}));

import {
  parseJudgeResponse,
  reviewArticle,
  JUDGE_THRESHOLDS,
  JUDGE_SYSTEM_PROMPT,
} from "../llm-judge";

function makeRawJudgeJson(opts: {
  scores: Partial<{
    factualAccuracy: number;
    depth: number;
    originality: number;
    readability: number;
    seoCompleteness: number;
    valueToReader: number;
    toneAxioniaAlignment: number;
  }>;
  issues?: Array<{ severity: string; section: string; issue: string; suggestedFix: string }>;
  reasoning?: string;
}): string {
  const dims = {
    factualAccuracy: { score: opts.scores.factualAccuracy ?? 8, comment: "ok" },
    depth: { score: opts.scores.depth ?? 8, comment: "ok" },
    originality: { score: opts.scores.originality ?? 8, comment: "ok" },
    readability: { score: opts.scores.readability ?? 8, comment: "ok" },
    seoCompleteness: { score: opts.scores.seoCompleteness ?? 8, comment: "ok" },
    valueToReader: { score: opts.scores.valueToReader ?? 8, comment: "ok" },
    toneAxioniaAlignment: { score: opts.scores.toneAxioniaAlignment ?? 8, comment: "ok" },
  };
  return JSON.stringify({
    verdict: "publish",
    globalScore: 8,
    dimensions: dims,
    issues: opts.issues ?? [],
    reasoning: opts.reasoning ?? "looks good",
  });
}

beforeEach(() => {
  generateMock.mockReset();
});

describe("parseJudgeResponse — valid JSON", () => {
  it("parses well-formed JSON output", () => {
    const raw = makeRawJudgeJson({ scores: { factualAccuracy: 9, depth: 9, originality: 9 } });
    const result = parseJudgeResponse(raw);
    expect(result.dimensions.factualAccuracy.score).toBe(9);
    expect(result.dimensions.depth.score).toBe(9);
    expect(result.reasoning).toBe("looks good");
  });

  it("computes globalScore as arithmetic mean of 7 dimensions", () => {
    const raw = makeRawJudgeJson({
      scores: {
        factualAccuracy: 7,
        depth: 7,
        originality: 7,
        readability: 7,
        seoCompleteness: 7,
        valueToReader: 7,
        toneAxioniaAlignment: 7,
      },
    });
    expect(parseJudgeResponse(raw).globalScore).toBe(7);
  });

  it("clamps scores > 10 to 10 and < 0 to 0", () => {
    const raw = makeRawJudgeJson({ scores: { factualAccuracy: 99, depth: -5 } });
    const result = parseJudgeResponse(raw);
    expect(result.dimensions.factualAccuracy.score).toBe(10);
    expect(result.dimensions.depth.score).toBe(0);
  });

  it("defaults missing dimension to 0", () => {
    const raw = JSON.stringify({ dimensions: { factualAccuracy: { score: 8, comment: "" } } });
    const result = parseJudgeResponse(raw);
    expect(result.dimensions.depth.score).toBe(0);
  });
});

describe("parseJudgeResponse — markdown fences", () => {
  it("strips ```json fences", () => {
    const raw = "```json\n" + makeRawJudgeJson({ scores: { factualAccuracy: 9 } }) + "\n```";
    const result = parseJudgeResponse(raw);
    expect(result.dimensions.factualAccuracy.score).toBe(9);
  });

  it("strips bare ``` fences", () => {
    const raw = "```\n" + makeRawJudgeJson({ scores: {} }) + "\n```";
    expect(() => parseJudgeResponse(raw)).not.toThrow();
  });
});

describe("parseJudgeResponse — invalid input", () => {
  it("throws on non-JSON", () => {
    expect(() => parseJudgeResponse("not a json at all")).toThrow(/invalid JSON/);
  });

  it("throws on truncated JSON", () => {
    expect(() => parseJudgeResponse('{"verdict": "publish", "globalScore"')).toThrow(
      /invalid JSON/,
    );
  });
});

describe("parseJudgeResponse — verdict derivation (anti-hallucination)", () => {
  it("verdict=publish for globalScore >= 8.5 + 0 P0/P1", () => {
    const raw = makeRawJudgeJson({
      scores: {
        factualAccuracy: 9,
        depth: 9,
        originality: 9,
        readability: 9,
        seoCompleteness: 9,
        valueToReader: 8.5,
        toneAxioniaAlignment: 8.5,
      },
    });
    expect(parseJudgeResponse(raw).verdict).toBe("publish");
  });

  it("verdict=improve for globalScore in [7, 8.5)", () => {
    const raw = makeRawJudgeJson({
      scores: {
        factualAccuracy: 8,
        depth: 8,
        originality: 8,
        readability: 8,
        seoCompleteness: 8,
        valueToReader: 8,
        toneAxioniaAlignment: 8,
      },
    });
    expect(parseJudgeResponse(raw).verdict).toBe("improve");
  });

  it("verdict=improve when >=1 P1 issue (even if score >= 8.5)", () => {
    const raw = makeRawJudgeJson({
      scores: {
        factualAccuracy: 9,
        depth: 9,
        originality: 9,
        readability: 9,
        seoCompleteness: 9,
        valueToReader: 9,
        toneAxioniaAlignment: 9,
      },
      issues: [
        { severity: "P1", section: "meta", issue: "title too long", suggestedFix: "shorten" },
      ],
    });
    expect(parseJudgeResponse(raw).verdict).toBe("improve");
  });

  it("verdict=reject for globalScore < 7", () => {
    const raw = makeRawJudgeJson({
      scores: {
        factualAccuracy: 5,
        depth: 5,
        originality: 5,
        readability: 5,
        seoCompleteness: 5,
        valueToReader: 5,
        toneAxioniaAlignment: 5,
      },
    });
    expect(parseJudgeResponse(raw).verdict).toBe("reject");
  });

  it("verdict=reject when >=1 P0 (even high score)", () => {
    const raw = makeRawJudgeJson({
      scores: {
        factualAccuracy: 10,
        depth: 10,
        originality: 10,
        readability: 10,
        seoCompleteness: 10,
        valueToReader: 10,
        toneAxioniaAlignment: 10,
      },
      issues: [
        {
          severity: "P0",
          section: "body",
          issue: "Cite SIREN forbidden",
          suggestedFix: "remove SIREN",
        },
      ],
    });
    expect(parseJudgeResponse(raw).verdict).toBe("reject");
  });

  it("ignores LLM-provided verdict (recomputes deterministically)", () => {
    // LLM says "publish" mais scores derivent reject (5/10 avg).
    const raw = JSON.stringify({
      verdict: "publish",
      globalScore: 9,
      dimensions: {
        factualAccuracy: { score: 5, comment: "" },
        depth: { score: 5, comment: "" },
        originality: { score: 5, comment: "" },
        readability: { score: 5, comment: "" },
        seoCompleteness: { score: 5, comment: "" },
        valueToReader: { score: 5, comment: "" },
        toneAxioniaAlignment: { score: 5, comment: "" },
      },
      issues: [],
      reasoning: "",
    });
    expect(parseJudgeResponse(raw).verdict).toBe("reject");
  });
});

describe("parseJudgeResponse — issues", () => {
  it("preserves P0/P1/P2 severities", () => {
    const raw = makeRawJudgeJson({
      scores: {},
      issues: [
        { severity: "P0", section: "a", issue: "x", suggestedFix: "y" },
        { severity: "P1", section: "b", issue: "x", suggestedFix: "y" },
        { severity: "P2", section: "c", issue: "x", suggestedFix: "y" },
      ],
    });
    const result = parseJudgeResponse(raw);
    expect(result.issues).toHaveLength(3);
    expect(result.issues.map((i) => i.severity)).toEqual(["P0", "P1", "P2"]);
  });

  it("falls back to P2 for unknown severity", () => {
    const raw = makeRawJudgeJson({
      scores: {},
      issues: [{ severity: "CRITICAL", section: "x", issue: "y", suggestedFix: "z" }],
    });
    expect(parseJudgeResponse(raw).issues[0]?.severity).toBe("P2");
  });

  it("filters non-object issues", () => {
    const raw = JSON.stringify({
      verdict: "publish",
      globalScore: 8,
      dimensions: {
        factualAccuracy: { score: 8, comment: "" },
        depth: { score: 8, comment: "" },
        originality: { score: 8, comment: "" },
        readability: { score: 8, comment: "" },
        seoCompleteness: { score: 8, comment: "" },
        valueToReader: { score: 8, comment: "" },
        toneAxioniaAlignment: { score: 8, comment: "" },
      },
      issues: ["not an object", null, 42],
      reasoning: "",
    });
    expect(parseJudgeResponse(raw).issues).toHaveLength(0);
  });
});

describe("reviewArticle — integration with anthropic provider", () => {
  it("calls anthropicProvider.generate with system + user prompts", async () => {
    const raw = makeRawJudgeJson({
      scores: {
        factualAccuracy: 9,
        depth: 9,
        originality: 9,
        readability: 9,
        seoCompleteness: 9,
        valueToReader: 9,
        toneAxioniaAlignment: 9,
      },
    });
    generateMock.mockResolvedValueOnce({ output: raw });

    const result = await reviewArticle({
      jobId: "job-test-1",
      title: "Audit IA conformite RGPD pour PME",
      bodyHtml: "<h2>Pourquoi</h2><p>...</p>",
      primaryKeyword: "audit IA conformite",
    });

    expect(result.verdict).toBe("publish");
    expect(generateMock).toHaveBeenCalledTimes(1);
    const callArgs = generateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs["model"]).toBe("claude-sonnet-4-6");
    expect(callArgs["systemPrompt"]).toBe(JUDGE_SYSTEM_PROMPT);
    expect(callArgs["userPrompt"]).toContain("audit IA conformite");
    expect(callArgs["userPrompt"]).toContain("Audit IA conformite RGPD pour PME");
  });

  it("includes FAQ in userPrompt when present", async () => {
    const raw = makeRawJudgeJson({ scores: {} });
    generateMock.mockResolvedValueOnce({ output: raw });
    await reviewArticle({
      jobId: "job-test-2",
      title: "T",
      bodyHtml: "<p>x</p>",
      faq: [{ question: "Q1?", answer: "A1." }],
    });
    const callArgs = generateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs["userPrompt"]).toContain("Q1?");
    expect(callArgs["userPrompt"]).toContain("A1.");
  });
});

describe("Thresholds exposed", () => {
  it("PUBLISH_MIN = 8.5", () => {
    expect(JUDGE_THRESHOLDS.PUBLISH_MIN).toBe(8.5);
  });

  it("IMPROVE_MIN = 7.0", () => {
    expect(JUDGE_THRESHOLDS.IMPROVE_MIN).toBe(7.0);
  });
});
