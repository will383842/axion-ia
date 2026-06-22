import { describe, it, expect } from "vitest";
import { titlePhrases, linkPhraseInBody } from "./inject-deep-links";

describe("inject-deep-links", () => {
  it("titlePhrases extrait des bigrammes de mots de contenu", () => {
    const phrases = titlePhrases("Audit IA pour les cabinets comptables en 2026");
    // "les" est stopword ; "IA"/"en"/"2026" trop courts ou non-lettres filtrés.
    expect(phrases).toContain("cabinets comptables");
  });

  it("titlePhrases ignore les mots vides et trop courts", () => {
    const phrases = titlePhrases("Comment automatiser avec des outils");
    expect(phrases.every((p) => !p.includes("avec"))).toBe(true);
  });

  it("linkPhraseInBody lie la phrase si présente hors balise", () => {
    const body = "<p>Les cabinets comptables gagnent du temps.</p>";
    const out = linkPhraseInBody(body, "cabinets comptables", "/blog/audit-ia-comptables");
    expect(out).toBe(
      '<p>Les <a href="/blog/audit-ia-comptables">cabinets comptables</a> gagnent du temps.</p>',
    );
  });

  it("linkPhraseInBody retourne null si la phrase est absente", () => {
    const body = "<p>Texte sans correspondance.</p>";
    expect(linkPhraseInBody(body, "cabinets comptables", "/blog/x")).toBeNull();
  });

  it("linkPhraseInBody ne lie pas à l'intérieur d'une balise/attribut", () => {
    // La phrase apparaît dans un attribut href -> ne doit pas être reliée.
    const body = '<a href="/cabinets comptables">déjà un lien</a>';
    expect(linkPhraseInBody(body, "cabinets comptables", "/blog/x")).toBeNull();
  });
});
