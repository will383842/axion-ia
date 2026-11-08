/**
 * Lot R6 : contrôle simple du vouvoiement dans le texte généré.
 */
import { describe, it, expect } from "vitest";
import { detecterTutoiement } from "../vouvoiement";

describe("detecterTutoiement", () => {
  it("ne signale rien sur un texte au vouvoiement", () => {
    expect(
      detecterTutoiement("<p>Vous pouvez commencer par vos devis. Votre équipe gagne du temps.</p>"),
    ).toEqual({ tutoie: false, occurrences: 0, extrait: "" });
  });

  it.each([
    "Tu peux commencer par tes devis.",
    "Si tu veux gagner du temps, lance un audit.",
    "Cet outil est fait pour toi.",
    "Dis-moi si t'as besoin d'aide.",
    "Voici tes premières tâches à automatiser.",
    "<p>Alors, qu'est-ce que tu en penses ?</p>",
  ])("signale le tutoiement : %s", (texte) => {
    const r = detecterTutoiement(texte);
    expect(r.tutoie).toBe(true);
    expect(r.occurrences).toBeGreaterThanOrEqual(1);
    expect(r.extrait.length).toBeGreaterThan(0);
  });

  it("ne confond pas avec des mots qui contiennent « tu », « ton », « ta » ou « toi »", () => {
    expect(
      detecterTutoiement("Le ton de l'étude, la tuile, un tutoriel, la toile, un tuteur, une statue."),
    ).toMatchObject({ tutoie: false });
  });

  it("ignore les citations entre guillemets, les blocs de code et les citations HTML", () => {
    expect(
      detecterTutoiement(
        "<p>Un prompt type : « Tu es un assistant juridique » aide à cadrer.</p><pre>tu es</pre><blockquote>Tu verras</blockquote><code>tu</code>",
      ).tutoie,
    ).toBe(false);
  });

  it("compte les occurrences", () => {
    expect(detecterTutoiement("Tu sais que tu peux. Pour toi.").occurrences).toBe(3);
  });

  it("accepte un texte vide", () => {
    expect(detecterTutoiement("")).toEqual({ tutoie: false, occurrences: 0, extrait: "" });
  });
});
