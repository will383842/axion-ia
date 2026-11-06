import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";

const BASE = {
  clientNom: "Acme",
  numero: "AXI-DEV-2026-014",
  signatureUrl: "https://x.test/s/abc",
};

describe("devis-envoi : le texte de signature dit le vrai parcours (CGV 6.2)", () => {
  it("ne promet plus « en un clic » et décrit CGV puis signature puis contresignature", async () => {
    const r = await renderEmailTemplate("devis-envoi", "fr", BASE);
    expect(r.text).not.toMatch(/en un clic/i);
    expect(r.text).toContain("cochez l'acceptation des conditions générales de vente, puis signez");
    expect(r.text).toContain("Le contrat est formé lorsque Axion-IA a contresigné");
    expect(r.text).not.toContain("choisissez votre formule");
  });
  it("devis à formules : mentionne le choix de la formule", async () => {
    const r = await renderEmailTemplate("devis-envoi", "fr", { ...BASE, nbFormules: 2 });
    expect(r.text).toContain("choisissez votre formule");
  });
  it("sans lien de signature : pas de paragraphe de signature", async () => {
    const r = await renderEmailTemplate("devis-envoi", "fr", { clientNom: "A", numero: "N" });
    expect(r.text).not.toContain("conditions générales de vente");
  });
  it("aucun mot interdit dans le gabarit ni dans son rendu", async () => {
    const source = readFileSync(join(__dirname, "devis-envoi.tsx"), "utf8");
    expect(source).not.toMatch(/grenoble|aucun gain garanti|en un clic|one click/i);
    for (const locale of ["fr", "en"] as const) {
      const r = await renderEmailTemplate("devis-envoi", locale, BASE);
      expect(r.text).not.toMatch(/aucun gain garanti|en un clic|one click/i);
    }
  });
});
