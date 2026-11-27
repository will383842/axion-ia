import { describe, expect, it } from "vitest";
import { EFFORT, calculerPriorite, classer } from "../score";

describe("score", () => {
  it("efforts du plan", () => {
    expect(EFFORT).toMatchObject({
      titre_meta: 1,
      lien_interne: 1,
      faq: 2,
      mise_a_jour: 3,
      nouvelle_page: 5,
    });
  });
  it("priorité = gain × confiance / effort", () => {
    expect(calculerPriorite(100, 0.5, "mise_a_jour")).toBeCloseTo(100 / 6);
  });
  it("gain négatif ou confiance hors bornes : borné", () => {
    expect(calculerPriorite(-5, 0.5, "faq")).toBe(0);
    expect(calculerPriorite(10, 2, "titre_meta")).toBe(10);
  });
  it("classement décroissant et stable", () => {
    const mk = (url: string, priorite: number) => ({ url, priorite, requete: "q" }) as never;
    const r = classer([mk("b", 1), mk("a", 1), mk("c", 3)]) as unknown as { url: string }[];
    expect(r.map((x) => x.url)).toEqual(["c", "a", "b"]);
  });
});
