import { describe, expect, it } from "vitest";
import { mesurerEquilibre } from "./equilibre-sections";

const mots = (n: number, base: string) =>
  Array.from({ length: n }, (_, i) => `${base}${i}`).join(" ");
const sec = (titre: string, corps: string) => `<h2>${titre}</h2><p>${corps}</p>`;

describe("mesurerEquilibre (addendum § 7.4)", () => {
  it("ne signale rien sur un corps équilibré", () => {
    const body = [1, 2, 3, 4].map((i) => sec(`Titre ${i} ici ?`, mots(100, `s${i}x`))).join("");
    expect(
      mesurerEquilibre(body, ["informatif", "informatif", "informatif", "informatif"], "analyse"),
    ).toEqual([]);
  });

  it("L-1 : une section informative de moins de 80 mots", () => {
    const body = [
      sec("Titre un ici ?", mots(100, "a")),
      sec("Titre deux ici ?", mots(30, "b")),
      sec("Titre trois ici ?", mots(100, "c")),
      sec("Titre quatre ici ?", mots(100, "d")),
    ].join("");
    const r = mesurerEquilibre(
      body,
      ["informatif", "informatif", "informatif", "informatif"],
      "analyse",
    );
    expect(r).toContainEqual(
      expect.objectContaining({ section: 1, probleme: "section_trop_courte" }),
    );
  });

  it("L-1 : une étape courte est permise", () => {
    const body = [
      sec("Titre un ici ?", mots(100, "a")),
      sec("Titre deux ici ?", mots(30, "b")),
      sec("Titre trois ici ?", mots(100, "c")),
    ].join("");
    expect(mesurerEquilibre(body, ["informatif", "etape", "informatif"], "guide")).toEqual([]);
  });

  it("L-2 : une section de plus de 35 % (4 H2 ou plus), 50 % en dessous", () => {
    const body = [
      sec("Titre un ici ?", mots(400, "a")),
      sec("Titre deux ici ?", mots(100, "b")),
      sec("Titre trois ici ?", mots(100, "c")),
      sec("Titre quatre ici ?", mots(100, "d")),
    ].join("");
    const r = mesurerEquilibre(
      body,
      ["informatif", "informatif", "informatif", "informatif"],
      "analyse",
    );
    expect(r).toContainEqual(
      expect.objectContaining({ section: 0, probleme: "section_dominante" }),
    );
    const trois = [
      sec("Titre un ici ?", mots(200, "a")),
      sec("Titre deux ici ?", mots(100, "b")),
      sec("Titre trois ici ?", mots(100, "c")),
    ].join("");
    expect(mesurerEquilibre(trois, ["informatif", "informatif", "informatif"], "analyse")).toEqual(
      [],
    );
  });

  it("L-2 ne s'applique ni au guide pilier ni à l'actualité", () => {
    const body = [
      sec("Titre un ici ?", mots(400, "a")),
      sec("Titre deux ici ?", mots(100, "b")),
      sec("Titre trois ici ?", mots(100, "c")),
      sec("Titre quatre ici ?", mots(100, "d")),
    ].join("");
    const t = ["informatif", "informatif", "informatif", "informatif"] as const;
    expect(mesurerEquilibre(body, t, "guide-pilier")).toEqual([]);
    expect(mesurerEquilibre(body, t, "actualite")).toEqual([]);
  });

  it("L-3 : redite quand 20 % des 5-grammes de la plus courte se retrouvent dans l'autre", () => {
    const commun = mots(40, "meme");
    const body = [
      sec("Titre un ici ?", `${commun} ${mots(60, "a")}`),
      sec("Titre deux ici ?", `${commun} ${mots(120, "b")}`),
      sec("Titre trois ici ?", mots(100, "c")),
    ].join("");
    const r = mesurerEquilibre(body, ["informatif", "informatif", "informatif"], "analyse");
    expect(r).toContainEqual(expect.objectContaining({ probleme: "redite" }));
  });
});
