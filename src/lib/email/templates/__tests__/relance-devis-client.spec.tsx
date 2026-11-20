// La relance d'un devis sait afficher le bouton de signature (fiche B3, 1/2).
// Le bloc libre ajouté par l'admin avant validation est échappé : jamais de HTML brut.

import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { CLOTURE_DEVIS_FR } from "../devis-envoi";
import { RelanceDevisClientEmail } from "../relance-devis-client";

const LIEN = "https://axion-ia.com/portail/signer/JETON123abc";
const BASE = { destinataireNom: "Claire Martin", numero: "AXI-DEV-2026-014" };

async function rendu(payload: Record<string, unknown>) {
  const el = <RelanceDevisClientEmail locale="fr" payload={payload} />;
  return { html: await render(el), text: await render(el, { plainText: true }) };
}

describe("relance-devis-client", () => {
  it("échappe le message personnalisé (aucun <script> dans le HTML)", async () => {
    const { html } = await rendu({ ...BASE, messagePersonnalise: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("T1 : signatureUrl valide → bouton « Signer le devis en ligne » portant le lien", async () => {
    const { html } = await rendu({ ...BASE, signatureUrl: LIEN });
    expect(html).toContain("Signer le devis en ligne");
    expect(html).toMatch(
      new RegExp(`<a[^>]*href="${LIEN}"[^>]*>[\\s\\S]*?Signer le devis en ligne`),
    );
    expect(html).toContain("avec le bouton ci-dessous");
  });

  it.each([
    ["absent", undefined],
    ["vide", ""],
    ["http", "http://axion-ia.com/portail/signer/abc"],
    ["javascript", "javascript:alert(1)"],
    ["autre chemin", "https://axion-ia.com/autre/signer/abc"],
    ["non chaîne", 42],
  ])("T2 : signatureUrl %s → ni bouton, ni phrase « signer »", async (_nom, valeur) => {
    const { html, text } = await rendu({ ...BASE, signatureUrl: valeur });
    for (const s of [html, text]) {
      expect(s).not.toContain("Signer le devis");
      expect(s).not.toContain("/portail/signer/");
      expect(s).not.toMatch(/signer en ligne/i);
    }
  });

  it("T3 : ctaSecret — l'URL n'est jamais imprimée en clair, une seule fois dans le HTML (href)", async () => {
    // Le texte brut (`text`) garde le lien du bouton, comme pour les autres gabarits `ctaSecret` :
    // c'est le rendu VISIBLE qui n'imprime pas l'adresse (pas de repli « copiez ce lien »).
    const { html } = await rendu({ ...BASE, signatureUrl: LIEN });
    const visible = html.replace(/<[^>]*>/g, " ");
    expect(visible).not.toContain(LIEN);
    expect(visible).not.toContain("/portail/signer/");
    expect(html.split(LIEN).length - 1).toBe(1);
  });

  it("T4 : salutation structurée → « Bonjour Monsieur Dupont, », jamais le nom complet", async () => {
    const { html } = await rendu({
      ...BASE,
      salutation: { civilite: "monsieur", nomFamille: "DUPONT" },
    });
    expect(html).toContain("Bonjour Monsieur Dupont,");
    expect(html).not.toContain("Claire Martin");
  });

  it("T4 : clé salutation absente → « Bonjour, », jamais destinataireNom", async () => {
    const { html } = await rendu(BASE);
    expect(html).toContain("Bonjour,");
    expect(html).not.toContain("Bonjour Claire Martin");
  });

  it("ancien payload (sans signatureUrl ni salutation) : rendu sans bouton", async () => {
    const { html } = await rendu({ ...BASE, dateEnvoi: "01/11/2026" });
    expect(html).toContain("AXI-DEV-2026-014");
    expect(html).not.toContain("Signer le devis");
  });

  it("la phrase « PDF joint » n'apparaît que si pieceJointe vaut true", async () => {
    expect((await rendu(BASE)).html).not.toContain("joint à cet e-mail");
    expect((await rendu({ ...BASE, pieceJointe: true })).html).toContain("joint à cet e-mail");
  });

  it("T5 : clôture identique à celle du premier envoi, aucun montant", async () => {
    const { html } = await rendu({ ...BASE, signatureUrl: LIEN, pieceJointe: true });
    for (const ligne of CLOTURE_DEVIS_FR.split("\n")) expect(html).toContain(ligne);
    expect(html).not.toMatch(/\d\s?€|\bHT\b|\bTTC\b/);
  });
});
