import { describe, expect, it } from "vitest";
import { hrefsDe } from "./commun";
import { nombresDe } from "./nombres";

describe("hrefsDe : lecture comme un navigateur", () => {
  it("voit un href précédé d'un espace dans la valeur", () => {
    expect(hrefsDe('<a href=" https://evil.example/">x</a>')).toEqual(["https://evil.example/"]);
  });
  it("ne se laisse pas leurrer par un faux href dans un autre attribut", () => {
    expect(hrefsDe(`<a data-x=' href=/fr/ok' href="https://evil.example/">x</a>`)).toEqual([
      "https://evil.example/",
    ]);
    expect(hrefsDe('<a data-href="https://ok" href="https://evil">x</a>')).toEqual([
      "https://evil",
    ]);
  });
});

describe("nombresDe : nombres composés en lettres", () => {
  const cle = (t: string) => nombresDe(t).map((n) => n.cle);
  it("distingue vingt-cinq, quarante-cinq et soixante-dix pour cent", () => {
    const a = cle("vingt-cinq pour cent des PME");
    const b = cle("quarante-cinq pour cent des PME");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toEqual(b);
    expect(cle("soixante-dix pour cent")).not.toEqual(cle("dix pour cent"));
  });
});

describe("tour 2 : guillemets non appariés, composés avec espace, entités", () => {
  it("voit un lien dont la valeur sans guillemets contient une apostrophe", () => {
    expect(hrefsDe("<p>L'outil</p><a href=https://evil.example/x'>g</a>")).toEqual([
      "https://evil.example/x'",
    ]);
  });
  it("échoue fermé sur une balise a jamais fermée", () => {
    expect(hrefsDe("<a href=javascript:alert(1)//")).toContain("#balise-illisible");
  });
  it("lit un « = » dans une valeur sans guillemets", () => {
    expect(hrefsDe("<a href=https://insee.fr=@evil.com>x</a>")).toEqual([
      "https://insee.fr=@evil.com",
    ]);
  });
  it("ne réduit pas « deux mille » ou « cent vingt » à leur dernier mot", () => {
    const cle = (t: string) => nombresDe(t).map((n) => n.cle);
    expect(cle("deux mille salariés")).not.toEqual(cle("mille salariés"));
    expect(cle("cent vingt salariés")).not.toEqual(cle("vingt salariés"));
    expect(cle("seize pour cent").length).toBeGreaterThan(0);
    expect(cle("quatre-vingts pour cent").length).toBeGreaterThan(0);
    expect(cle("soixante-dix %").length).toBeGreaterThan(0);
  });
});

describe("tour 3 : blancs ASCII et chiffres non ASCII", () => {
  it("ne coupe pas une valeur sans guillemets sur une espace insécable", () => {
    expect(hrefsDe("<a href=/fr/contact\u00a0/../appel>x</a>")).toEqual([
      "/fr/contact\u00a0/../appel",
    ]);
  });
  it("relève les chiffres pleine chasse et arabes-indiens", () => {
    expect(nombresDe("８０ % des PME").length).toBeGreaterThan(0);
    expect(nombresDe("٨٠ % des PME").length).toBeGreaterThan(0);
  });
});
