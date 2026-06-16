import { describe, it, expect, vi, beforeEach } from "vitest";

const generateMock = vi.fn();
vi.mock("@/server/content-gen/providers/provider-router", () => ({
  generate: (...args: unknown[]) => generateMock(...args),
}));

import { judgeBenefitConcreteness } from "../benefit-judge-llm";

const ctx = { painStatement: "X", benefitMeasured: "Y", sectorLexicon: ["liasse", "FEC"] };

describe("benefit-judge-llm (PH3)", () => {
  beforeEach(() => generateMock.mockReset());

  it("parse un verdict JSON 'pass'", async () => {
    generateMock.mockResolvedValue({ output: '{"total":85,"passed":true,"feedback_court":"ok"}' });
    const r = await judgeBenefitConcreteness({
      content: "...",
      context: ctx,
      jobId: "j1",
      contentType: "pain_point_solution",
    });
    expect(r?.passed).toBe(true);
    expect(r?.score).toBe(85);
  });

  it("passe par provider-router (COST-TRACKÉ), role text + anthropic, jamais new Anthropic", async () => {
    generateMock.mockResolvedValue({
      output: '{"total":50,"passed":false,"feedback_court":"faible"}',
    });
    await judgeBenefitConcreteness({
      content: "c",
      context: ctx,
      jobId: "j2",
      contentType: "comparison",
    });
    expect(generateMock).toHaveBeenCalledOnce();
    const arg = generateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.role).toBe("text");
    expect(arg.preferredProvider).toBe("anthropic");
    expect(arg.jobId).toBe("j2");
    expect(arg.contentType).toBe("comparison");
  });

  it("fail-open : réponse provider malformée (sans output) → null", async () => {
    generateMock.mockResolvedValue({});
    const r = await judgeBenefitConcreteness({
      content: "c",
      context: ctx,
      jobId: "j",
      contentType: "x",
    });
    expect(r).toBeNull();
  });

  it("fail-open : sortie non-JSON → null", async () => {
    generateMock.mockResolvedValue({ output: "pas du json du tout" });
    const r = await judgeBenefitConcreteness({
      content: "c",
      context: ctx,
      jobId: "j",
      contentType: "x",
    });
    expect(r).toBeNull();
  });

  it("score borné 0-100", async () => {
    generateMock.mockResolvedValue({ output: '{"total":150,"passed":true}' });
    const r = await judgeBenefitConcreteness({
      content: "c",
      context: ctx,
      jobId: "j",
      contentType: "x",
    });
    expect(r?.score).toBe(100);
  });
});
