/**
 * M4 : chemin Claude du blog — une sortie JSON coupée par max_tokens au 1er essai du PLAN
 * est un échec de plan : le générateur fait un 2e essai (comme pour un JSON illisible chez
 * OpenAI), au lieu de remonter l'erreur tout de suite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { routerGenerate } = vi.hoisted(() => ({ routerGenerate: vi.fn() }));

vi.mock("../../providers/provider-router", () => ({ generate: routerGenerate }));
vi.mock("../../kb-client", () => ({ retrieve: vi.fn(async () => []) }));

import { ProviderError, MARQUE_JSON_TRONQUE } from "../../providers/IProvider";
import { blogArticleGenerator } from "../blog-article";
import type { GeneratorBaseInput } from "../types";

const INPUT = {
  jobId: "job-test",
  contentType: "blog_article",
  targetSearchIntent: "informational",
  targetAudienceSize: "PME",
  primaryKeyword: "automatisation comptable",
} as unknown as GeneratorBaseInput;

const tronque = () =>
  new ProviderError(`Anthropic : ${MARQUE_JSON_TRONQUE}`, "invalid_response", "anthropic", false);

beforeEach(() => routerGenerate.mockReset());

describe("M4 : JSON tronqué au plan", () => {
  it("1er essai tronqué => 2e essai du plan (puis échec de plan classique si le 2e est illisible)", async () => {
    routerGenerate.mockRejectedValueOnce(tronque()).mockResolvedValueOnce({
      output: "pas du json",
      costUsd: 0,
      tokensInput: 1,
      tokensOutput: 1,
    });
    await expect(blogArticleGenerator.generate(INPUT)).rejects.toThrow(
      /plan invalide après 2 tentatives/,
    );
    expect(routerGenerate).toHaveBeenCalledTimes(2);
  });

  it("une autre erreur du fournisseur n'est PAS rejouée par la boucle de plan", async () => {
    routerGenerate.mockRejectedValueOnce(
      new ProviderError("coupé", "invalid_response", "anthropic", false),
    );
    await expect(blogArticleGenerator.generate(INPUT)).rejects.toThrow(/coupé/);
    expect(routerGenerate).toHaveBeenCalledTimes(1);
  });
});
