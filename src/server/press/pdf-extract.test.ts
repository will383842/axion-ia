import { describe, it, expect } from "vitest";

import { cleanPdfText } from "./pdf-extract";

describe("cleanPdfText", () => {
  it("renvoie '' pour une entrée vide", () => {
    expect(cleanPdfText("")).toBe("");
  });

  it("recolle les césures de fin de ligne", () => {
    const out = cleanPdfText("Axion-IA annonce le lance-\nment de sa plateforme.");
    expect(out).toContain("lancement");
    expect(out).not.toContain("lance-");
  });

  it("fusionne les retours à la ligne internes d'un paragraphe", () => {
    const out = cleanPdfText("Les équipes\nsont prêtes\naujourd'hui.");
    expect(out).toBe("Les équipes sont prêtes aujourd'hui.");
  });

  it("sépare les paragraphes sur les lignes vides", () => {
    const out = cleanPdfText("Premier paragraphe.\n\nSecond paragraphe.");
    expect(out.split("\n\n")).toEqual(["Premier paragraphe.", "Second paragraphe."]);
  });

  it("filtre le bruit (blocs ultra-courts isolés, ex. numéros de page)", () => {
    const out = cleanPdfText("Vrai contenu du communiqué.\n\n3");
    expect(out).toBe("Vrai contenu du communiqué.");
  });

  it("normalise les CRLF et espaces multiples", () => {
    const out = cleanPdfText("Mot   espacé\r\net   ligne.");
    expect(out).toBe("Mot espacé et ligne.");
  });
});
