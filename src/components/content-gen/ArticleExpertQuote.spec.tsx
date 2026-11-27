/**
 * « Point de vue d'Axion-IA » (lot L3, audit du 24/10/2026) : le rendu ne
 * nomme jamais une personne et n'émet jamais de nœud `Person`, y compris pour
 * les anciennes lignes signées Williams ou Manon (la base reste inchangée).
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleExpertQuote } from "./ArticleExpertQuote";

const TEXTE = "Commencer par un usage simple et mesurable évite de disperser l'équipe.";

function rendre(quote: Parameters<typeof ArticleExpertQuote>[0]["quote"]): string {
  return renderToStaticMarkup(<ArticleExpertQuote quote={quote} locale="fr" />);
}

describe("ArticleExpertQuote", () => {
  it("ancienne ligne signée Williams : affiche Axion-IA, jamais le nom ni le titre", () => {
    const html = rendre({ name: "Williams Jullin", title: "Fondateur d'Axion-IA", text: TEXTE });
    expect(html).toMatch(/Point de vue d(&#x27;|')Axion-IA/);
    expect(html).toContain("Commencer par un usage simple");
    expect(html).not.toContain("Williams");
    expect(html).not.toContain("Fondateur");
  });

  it("ancienne ligne signée Manon : même rendu", () => {
    const html = rendre({ name: "Manon", title: "Experte IA chez Axion-IA", text: TEXTE });
    expect(html).not.toContain("Manon");
    expect(html).not.toContain("Experte");
    expect(html).toMatch(/Point de vue d(&#x27;|')Axion-IA/);
  });

  it("n'émet aucun nœud Person, seulement une Organization", () => {
    const html = rendre({ name: "Williams", title: null, text: TEXTE });
    expect(html).not.toMatch(/"@type":\s*"Person"/);
    expect(html).not.toContain("/equipe/");
    expect(html).toMatch(/"@type":"Organization"/);
    expect(html).toContain("#organization");
  });

  it("un nom vide ne masque plus l'avis (le texte seul compte)", () => {
    const html = rendre({ name: "", title: null, text: TEXTE });
    expect(html).toContain("Commencer par un usage simple");
  });

  it("ne rend rien sans texte, ni sans citation", () => {
    expect(rendre(null)).toBe("");
    expect(rendre(undefined)).toBe("");
    expect(rendre({ name: "Manon", title: null, text: "   " })).toBe("");
  });

  it("ne rend rien si le texte contient un interdit de publication", () => {
    const interdits = [
      "Nous sommes certifiés Qualiopi et vous accompagnons partout.",
      "Votre formation peut être financée à 100 % par votre OPCO.",
      "Notre équipe de Grenoble vous répond.",
      "Résultats garantis dès le premier mois.",
    ];
    for (const text of interdits) {
      expect(rendre({ name: "Williams", title: null, text }), text).toBe("");
    }
  });
});
