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
