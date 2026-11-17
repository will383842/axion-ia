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

describe("devis-envoi : salutation (L12)", () => {
  const nu = { numero: "N" };
  const premiereLigne = async (locale: "fr" | "en", payload: Record<string, unknown>) => {
    const r = await renderEmailTemplate("devis-envoi", locale, payload);
    return r.text;
  };
  it("civilité + nom : « Bonjour Monsieur Dupont, »", async () => {
    const t = await premiereLigne("fr", {
      ...nu,
      clientNom: "",
      salutation: { civilite: "monsieur", prenom: "Michel", nomFamille: "Dupont" },
    });
    expect(t).toContain("Bonjour Monsieur Dupont,");
    expect(t).not.toContain("Michel");
  });
  it("prénom seul : « Bonjour Michel, »", async () => {
    const t = await premiereLigne("fr", { ...nu, salutation: { prenom: "Michel" } });
    expect(t).toContain("Bonjour Michel,");
  });
  it("clé vide : « Bonjour, » et jamais clientNom", async () => {
    const t = await premiereLigne("fr", { ...nu, clientNom: "Acme SAS", salutation: {} });
    expect(t).toContain("Bonjour,");
    expect(t).not.toContain("Acme");
  });
  it("ancien payload sans clé : clientNom vide → « Bonjour, »", async () => {
    expect(await premiereLigne("fr", { ...nu, clientNom: "" })).toContain("Bonjour,");
  });
  it("ancien payload sans clé : clientNom rempli → rendu d'avant", async () => {
    expect(await premiereLigne("fr", { ...nu, clientNom: "Acme" })).toContain("Bonjour Acme,");
  });
  it("anglais : civilité + nom, prénom seul, ancien payload", async () => {
    expect(await premiereLigne("en", { ...nu, salutation: { civilite: "madame" } })).toContain(
      "Hello,",
    );
    expect(
      await premiereLigne("en", {
        ...nu,
        salutation: { civilite: "madame", prenom: "Lea", nomFamille: "Dupont" },
      }),
    ).toContain("Hello Ms Dupont,");
    expect(await premiereLigne("en", { ...nu, salutation: { prenom: "Lea" } })).toContain(
      "Hello Lea,",
    );
    expect(await premiereLigne("en", { ...nu, clientNom: "Acme" })).toContain("Hello Acme,");
  });
  it("salutation null : « Bonjour, » et jamais le nom complet", async () => {
    const t = await premiereLigne("fr", { ...nu, clientNom: "Michel Dupont", salutation: null });
    expect(t).toContain("Bonjour,");
    expect(t).not.toContain("Dupont");
  });
  it("salutation chaîne : « Bonjour, » et jamais le nom complet", async () => {
    const t = await premiereLigne("fr", { ...nu, clientNom: "Michel Dupont", salutation: "x" });
    expect(t).toContain("Bonjour,");
    expect(t).not.toContain("Dupont");
  });
  it("salutation tableau : « Bonjour, » et jamais le nom complet", async () => {
    const t = await premiereLigne("fr", { ...nu, clientNom: "Michel Dupont", salutation: [] });
    expect(t).toContain("Bonjour,");
    expect(t).not.toContain("Dupont");
  });
  it("valeurs non-chaînes dans la salutation : « Bonjour, »", async () => {
    const t = await premiereLigne("fr", {
      ...nu,
      clientNom: "Michel Dupont",
      salutation: { civilite: 1, nomFamille: ["x"] },
    });
    expect(t).toContain("Bonjour,");
    expect(t).not.toContain("Dupont");
  });
  it("le HTML porte « Bonjour Monsieur Dupont, »", async () => {
    const r = await renderEmailTemplate("devis-envoi", "fr", {
      ...nu,
      salutation: { civilite: "monsieur", nomFamille: "Dupont" },
    });
    expect(r.html).toContain("Bonjour Monsieur Dupont,");
  });
  it("le nom de famille est échappé dans le HTML", async () => {
    const r = await renderEmailTemplate("devis-envoi", "fr", {
      ...nu,
      salutation: { civilite: "monsieur", nomFamille: "<b>&" },
    });
    expect(r.html).toContain("&lt;b&gt;&amp;");
    expect(r.html).not.toContain("<b>&");
  });
});
