// @vitest-environment node
// G3 — rendu RÉEL (@react-pdf) : un PDF valide, reproductible, sans image, borné en pages.
import { describe, it, expect } from "vitest";
import { rendreGuidePdf } from "../guide-pdf";
import { pagesDuPdf, empreinteTexte, validerContenu, type ContenuGuide } from "../fabrique-pdf";
import { createHash } from "node:crypto";

const contenu: ContenuGuide = {
  code: "gde-essai-01",
  version: 1,
  titre: "Le plan en trois étapes",
  sections: [
    {
      titre: "Pourquoi",
      paragraphes: ["Un premier paragraphe, avec des accents é è à."],
      puces: ["Une puce", "Une autre"],
    },
    { titre: "Comment", paragraphes: ["Un second paragraphe."], puces: [] },
  ],
};

describe("rendu du guide", () => {
  it("produit un PDF valide, en quelques pages, sans image", async () => {
    const pdf = await rendreGuidePdf(contenu);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = pagesDuPdf(pdf);
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(pages).toBeLessThanOrEqual(5);
    expect(pdf.toString("latin1")).not.toMatch(/\/Subtype\s*\/Image/);
    expect(pdf.length).toBeLessThan(5 * 1024 * 1024);
  }, 30_000);
  it("le texte le plus long permis tient dans 30 pages", async () => {
    const sections = Array.from({ length: 20 }, (_, i) => ({
      titre: `Partie ${i + 1}`,
      paragraphes: Array(15).fill("mot ".repeat(Math.floor(1500 / 4) - 1).trim()),
      puces: [],
    }));
    const max: ContenuGuide = { ...contenu, sections };
    // Le total de 40 000 caractères coupe avant : on rend ce qui est ACCEPTÉ, au plus près de la borne.
    const accepte: ContenuGuide = { ...contenu, sections: [] };
    let total = 0;
    for (const s of max.sections) {
      const t = s.paragraphes.reduce((n, p) => n + p.length, 0) + s.titre.length;
      if (total + t > 39_000) break;
      accepte.sections.push(s);
      total += t;
    }
    expect(validerContenu({ ...accepte, sha256Texte: empreinteTexte(accepte) }).ok).toBe(true);
    expect(pagesDuPdf(await rendreGuidePdf(accepte))).toBeLessThanOrEqual(30);
  }, 60_000);
  it("reproductible : même texte, même PDF (date de création fixe)", async () => {
    const h = async () =>
      createHash("sha256")
        .update(await rendreGuidePdf(contenu))
        .digest("hex");
    expect(await h()).toBe(await h());
  }, 30_000);
});
