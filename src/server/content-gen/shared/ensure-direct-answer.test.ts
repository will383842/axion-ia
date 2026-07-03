import { describe, it, expect, vi } from "vitest";
import {
  ensureDirectAnswer,
  MIN_DIRECT_ANSWER_WORDS,
  MAX_DIRECT_ANSWER_WORDS,
} from "./ensure-direct-answer";

const words = (n: number): string => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ");

describe("ensureDirectAnswer", () => {
  it("aligne le plancher/plafond sur la règle canonique (40/80)", () => {
    expect(MIN_DIRECT_ANSWER_WORDS).toBe(40);
    expect(MAX_DIRECT_ANSWER_WORDS).toBe(80);
  });

  it("no-op quand le directAnswer est déjà ≥ 40 mots (aucun appel LLM)", async () => {
    const generate = vi.fn();
    const current = words(45);
    const res = await ensureDirectAnswer({
      current,
      title: "Former ses équipes à l'IA",
      bodyText: "corps",
      generate,
    });
    expect(res.repaired).toBe(false);
    expect(res.directAnswer).toBe(current);
    expect(res.costUsd).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it("répare quand le directAnswer est trop court et le candidat atteint le plancher", async () => {
    const candidate = words(50);
    const generate = vi.fn().mockResolvedValue({ output: candidate, costUsd: 0.0021 });
    const res = await ensureDirectAnswer({
      current: words(10),
      title: "Former ses équipes à l'IA",
      bodyText: "corps de l'article",
      generate,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(res.repaired).toBe(true);
    expect(res.directAnswer).toBe(candidate);
    expect(res.costUsd).toBeCloseTo(0.0021);
  });

  it("répare aussi quand le directAnswer est absent (null/vide)", async () => {
    const candidate = words(41);
    const generate = vi.fn().mockResolvedValue({ output: candidate, costUsd: 0.001 });
    const res = await ensureDirectAnswer({
      current: null,
      title: "Sujet",
      bodyText: "",
      generate,
    });
    expect(res.repaired).toBe(true);
    expect(res.directAnswer).toBe(candidate);
  });

  it("NON-RÉGRESSIF : si le candidat reste sous le plancher, conserve l'original", async () => {
    const current = words(12);
    const generate = vi.fn().mockResolvedValue({ output: words(20), costUsd: 0.0005 });
    const res = await ensureDirectAnswer({
      current,
      title: "Sujet",
      bodyText: "corps",
      generate,
    });
    expect(res.repaired).toBe(false);
    expect(res.directAnswer).toBe(current);
    // coût quand même remonté (l'appel a bien eu lieu).
    expect(res.costUsd).toBeCloseTo(0.0005);
  });

  it("FAIL-OPEN : si l'appel LLM throw, conserve l'original sans propager", async () => {
    const current = words(5);
    const generate = vi.fn().mockRejectedValue(new Error("Anthropic 400 credit"));
    const res = await ensureDirectAnswer({
      current,
      title: "Sujet",
      bodyText: "corps",
      generate,
    });
    expect(res.repaired).toBe(false);
    expect(res.directAnswer).toBe(current);
    expect(res.costUsd).toBe(0);
  });

  it("n'appelle pas le LLM si le sujet (title) est vide → pas de réparation fiable", async () => {
    const generate = vi.fn();
    const res = await ensureDirectAnswer({
      current: words(3),
      title: "   ",
      bodyText: "corps",
      generate,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(res.repaired).toBe(false);
    expect(res.directAnswer).toBe(words(3));
  });
});
