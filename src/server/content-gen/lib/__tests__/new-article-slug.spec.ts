import { describe, expect, it } from "vitest";
import { resolveNewArticleSlug } from "../new-article-slug";

describe("resolveNewArticleSlug — refus des doublons", () => {
  it("garde le slug quand il est libre", async () => {
    const taken = new Set<string>();
    await expect(
      resolveNewArticleSlug("formation-ia-dirigeants-pme", async (s) => taken.has(s)),
    ).resolves.toBe("formation-ia-dirigeants-pme");
  });

  it("refuse (null) un slug déjà publié au lieu de suffixer -2", async () => {
    const taken = new Set(["meilleures-certifications-ia-france-2026-comparatif"]);
    const tested: string[] = [];
    const result = await resolveNewArticleSlug(
      "meilleures-certifications-ia-france-2026-comparatif",
      async (s) => {
        tested.push(s);
        return taken.has(s);
      },
    );
    expect(result).toBeNull();
    // Aucune variante suffixée n'est même envisagée.
    expect(tested).toEqual(["meilleures-certifications-ia-france-2026-comparatif"]);
  });
});
