/**
 * Tests — une tranche dont le JSON est illisible est journalisée puis relancée une fois.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const generateMock = vi.fn();
const logStepMock = vi.fn();

vi.mock("../../providers/provider-router", () => ({
  generate: (args: unknown) => generateMock(args),
}));
vi.mock("../generation-log", () => ({
  logStep: (...args: unknown[]) => logStepMock(...args),
}));

import { expandOutlineChunked } from "../expand-outline-chunked";

const reponse = (output: string) => ({ output, costUsd: 0.01, tokensInput: 10, tokensOutput: 20 });

const OPTS = {
  jobId: "job-1",
  contentType: "blog_article",
  outline: [
    { h2: "A", brief: "a" },
    { h2: "B", brief: "b" },
  ],
  chunkSize: 1,
  expandSystem: "sys",
  buildUserPrompt: () => "prompt",
};

describe("expandOutlineChunked", () => {
  beforeEach(() => {
    generateMock.mockReset();
    logStepMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("assemble les tranches lisibles sans relance", async () => {
    generateMock
      .mockResolvedValueOnce(reponse('{"bodyHtml":"<h2>A</h2>"}'))
      .mockResolvedValueOnce(reponse('{"bodyHtml":"<h2>B</h2>"}'));
    const r = await expandOutlineChunked(OPTS);
    expect(r.bodyHtml).toBe("<h2>A</h2>\n<h2>B</h2>");
    expect(r.calls).toBe(2);
    expect(logStepMock).not.toHaveBeenCalled();
  });

  it("relance UNE fois une tranche illisible, journalise, et garde le résultat", async () => {
    generateMock
      .mockResolvedValueOnce(reponse("pas du json"))
      .mockResolvedValueOnce(reponse('{"bodyHtml":"<h2>A</h2>"}'))
      .mockResolvedValueOnce(reponse('{"bodyHtml":"<h2>B</h2>"}'));
    const r = await expandOutlineChunked(OPTS);
    expect(r.bodyHtml).toBe("<h2>A</h2>\n<h2>B</h2>");
    expect(r.calls).toBe(3);
    expect(r.costUsd).toBeCloseTo(0.03);
    expect(logStepMock).toHaveBeenCalledTimes(1);
  });

  it("abandonne la tranche après deux échecs, sans boucler", async () => {
    generateMock
      .mockResolvedValueOnce(reponse("x"))
      .mockResolvedValueOnce(reponse("y"))
      .mockResolvedValueOnce(reponse('{"bodyHtml":"<h2>B</h2>"}'));
    const r = await expandOutlineChunked(OPTS);
    expect(r.bodyHtml).toBe("<h2>B</h2>");
    expect(r.calls).toBe(3);
    expect(logStepMock).toHaveBeenCalledTimes(2);
  });
});
