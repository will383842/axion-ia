import { describe, expect, it } from "vitest";
import { nombresDe } from "./nombres";
import { hrefsDe } from "./commun";

const notable = (t: string) => nombresDe(t).some((n) => n.notable);

describe("nombresDe : statistiques en lettres et décomptes", () => {
  it.each([
    "Les PME équipées sont trois fois plus productives.",
    "Elles gagnent dix heures par semaine.",
    "Deux millions de PME utilisent l'IA.",
    "Huit PME sur dix gagnent du temps.",
    "La moitié des dirigeants hésitent.",
    "Environ 3 dirigeants sur 10 hésitent.",
  ])("%s", (t) => expect(notable(t)).toBe(true));

  it("laisse passer les formulations sans statistique", () => {
    expect(notable("Un an plus tard, une semaine suffit.")).toBe(false);
    expect(notable("Voici 3 étapes.")).toBe(false);
  });
});

describe("hrefsDe : le vrai attribut href", () => {
  it("ne se laisse pas leurrer par data-href ni xlink:href", () => {
    expect(hrefsDe('<a data-href="https://src.fr/a" href="/fr/appel">x</a>')).toEqual([
      "/fr/appel",
    ]);
    expect(hrefsDe('<a xlink:href="/fr/blog" href="https://calendly.com/x">x</a>')).toEqual([
      "https://calendly.com/x",
    ]);
    expect(hrefsDe("<a href='/fr/contact'>x</a>")).toEqual(["/fr/contact"]);
  });
});
