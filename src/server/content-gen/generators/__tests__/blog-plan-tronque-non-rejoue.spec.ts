/**
 * G2quater I-a / I-b : chemin Claude — deux plans tronqués (max_tokens) lèvent une
 * UnrecoverableError (BullMQ ne rejoue pas : chaque essai est facturé) ; un plan tronqué
 * puis un plan valide réussit au 2e essai ; le coût du plan tronqué compte dans le cumul.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UnrecoverableError } from "bullmq";

const { routerGenerate } = vi.hoisted(() => ({ routerGenerate: vi.fn() }));

vi.mock("../../providers/provider-router", () => ({ generate: routerGenerate }));
vi.mock("../../kb-client", () => ({ retrieve: vi.fn(async () => []) }));

import { ProviderError, MARQUE_JSON_TRONQUE } from "../../providers/IProvider";
import { blogArticleGenerator } from "../blog-article";
import { blogFromKeywordsGenerator } from "../blog-from-keywords";
import { blogFromTitleGenerator } from "../blog-from-title";
import type { GeneratorBaseInput } from "../types";

const base = {
  jobId: "job-test",
  targetSearchIntent: "informational",
  targetAudienceSize: "PME",
  primaryKeyword: "automatisation comptable",
};

const CAS = [
  ["blog-article", blogArticleGenerator, "blog_article"],
  ["blog-from-keywords", blogFromKeywordsGenerator, "blog_from_keywords"],
  ["blog-from-title", blogFromTitleGenerator, "blog_from_title"],
] as const;

const tronque = (cout = 0) => {
  const e = new ProviderError(
    `Anthropic : ${MARQUE_JSON_TRONQUE}`,
    "invalid_response",
    "anthropic",
    false,
  );
  e.costUsd = cout;
  return e;
};

beforeEach(() => routerGenerate.mockReset());

describe.each(CAS)("%s : plan tronqué", (_nom, generateur, contentType) => {
  const input = { ...base, contentType } as unknown as GeneratorBaseInput;

  it("deux essais tronqués => UnrecoverableError (pas de rejeu BullMQ)", async () => {
    routerGenerate.mockRejectedValueOnce(tronque(0.01)).mockRejectedValueOnce(tronque(0.01));
    const err = await generateur.generate(input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnrecoverableError);
    expect(routerGenerate).toHaveBeenCalledTimes(2);
  });

  const illisible = {
    output: "pas du json",
    costUsd: 0,
    tokensInput: 1,
    tokensOutput: 1,
  };

  describe("chemin Claude actif", () => {
    beforeEach(() => {
      process.env["CONTENT_GEN_BLOG_CLAUDE"] = "true";
    });
    afterEach(() => {
      delete process.env["CONTENT_GEN_BLOG_CLAUDE"];
    });

    it("tronqué puis illisible => UnrecoverableError", async () => {
      routerGenerate.mockRejectedValueOnce(tronque(0.01)).mockResolvedValueOnce(illisible);
      const err = await generateur.generate(input).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnrecoverableError);
      expect(routerGenerate).toHaveBeenCalledTimes(2);
    });

    it("illisible puis illisible => UnrecoverableError", async () => {
      routerGenerate.mockResolvedValue(illisible);
      const err = await generateur.generate(input).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnrecoverableError);
      expect(routerGenerate).toHaveBeenCalledTimes(2);
    });
  });

  it("hors chemin Claude : plans illisibles => erreur ordinaire (non-régression)", async () => {
    routerGenerate.mockResolvedValue(illisible);
    const err = await generateur.generate(input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(UnrecoverableError);
    expect(routerGenerate).toHaveBeenCalledTimes(2);
  });
});

describe("coût du plan tronqué (I-b)", () => {
  it("l'erreur tronquée porte le coût réel, ajouté au cumul du job", async () => {
    const { coutErreurTronquee } = await import("../../providers/IProvider");
    expect(coutErreurTronquee(tronque(0.0123))).toBeCloseTo(0.0123);
    expect(coutErreurTronquee(tronque())).toBe(0);
    expect(coutErreurTronquee(new Error("x"))).toBe(0);
  });
});
