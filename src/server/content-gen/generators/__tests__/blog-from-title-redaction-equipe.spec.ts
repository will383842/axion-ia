/**
 * Rédacteur « pas de chiffre sans preuve » (PR 6) : la consigne n'entre dans la consigne
 * d'expansion que si CONTENT_EQUIPE_EDITORIALE vaut « true » ; éteint = prompt identique à avant.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { routerGenerate } = vi.hoisted(() => ({ routerGenerate: vi.fn() }));
vi.mock("../../providers/provider-router", () => ({ generate: routerGenerate }));
vi.mock("../../kb-client", () => ({ retrieve: vi.fn(async () => []) }));

import { blogFromTitleGenerator } from "../blog-from-title";
import type { GeneratorBaseInput } from "../types";

const plan = {
  title: "T",
  metaTitle: "automatisation comptable : guide pratique PME",
  metaDescription: "d",
  slug: "t",
  directAnswer: "r",
  faq: [],
  tags: [],
  keyTakeaway: "k",
  expertTake: "e",
  outline: [
    { h2: "Premier point", brief: "b1" },
    { h2: "Second point", brief: "b2" },
  ],
};
const input = {
  jobId: "job-test",
  contentType: "blog_from_title",
  targetSearchIntent: "informational",
  targetAudienceSize: "PME",
  primaryKeyword: "automatisation comptable",
  dossierPreuves: {
    preuves: [
      {
        affirmation: "Gain de temps",
        chiffre: "37 %",
        url: "https://exemple.fr/e",
        titreSource: "E",
        extrait: "37 % des PME ont gagné du temps.",
        consulteLe: "2026-11-01",
        expireLe: "2027-01-30",
      },
    ],
    refusees: 0,
    recherches: 1,
    coutUsd: 0,
    sources: [],
  },
} as unknown as GeneratorBaseInput;

async function promptsExpansion(): Promise<string[]> {
  routerGenerate.mockReset();
  routerGenerate.mockResolvedValueOnce({
    output: JSON.stringify(plan),
    costUsd: 0,
    tokensInput: 1,
    tokensOutput: 1,
  });
  routerGenerate.mockResolvedValue({
    output: JSON.stringify({ bodyHtml: "<h2>Premier point</h2><p>Texte.</p>" }),
    costUsd: 0,
    tokensInput: 1,
    tokensOutput: 1,
  });
  await blogFromTitleGenerator.generate(input).catch(() => undefined);
  return routerGenerate.mock.calls
    .map(([req]) => String(req.userPrompt))
    .filter((p) => p.startsWith("Rédige le CORPS"));
}

beforeEach(() => routerGenerate.mockReset());
afterEach(() => {
  delete process.env["CONTENT_EQUIPE_EDITORIALE"];
});

describe("blog_from_title : consigne de rédaction de l'équipe", () => {
  it("éteint : aucune consigne, même avec un dossier fourni", async () => {
    const prompts = await promptsExpansion();
    expect(prompts.length).toBeGreaterThan(0);
    for (const p of prompts) {
      expect(p).not.toContain("pas de chiffre sans preuve");
      expect(p).toContain("## Output attendu (JSON)\n{ bodyHtml }");
    }
  });

  it("allumé : la consigne porte le plan et le dossier", async () => {
    process.env["CONTENT_EQUIPE_EDITORIALE"] = "true";
    const prompts = await promptsExpansion();
    expect(prompts.length).toBeGreaterThan(0);
    for (const p of prompts) {
      expect(p).toContain("pas de chiffre sans preuve");
      expect(p).toContain("37 %");
      expect(p).toContain("Second point");
    }
  });

  it("éteint = identique à un prompt sans dossier", async () => {
    const [avec] = await promptsExpansion();
    delete (input as { dossierPreuves?: unknown }).dossierPreuves;
    const [sans] = await promptsExpansion();
    expect(avec).toBe(sans);
  });
});
