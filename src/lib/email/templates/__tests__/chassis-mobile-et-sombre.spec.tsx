// Le châssis sur un téléphone, et en mode sombre — lot 4 (2026-09-02).
//
// Gardé : la balise viewport existe ; le mode sombre couvre le CORPS des
// gabarits (descendants de la carte) et non seulement le châssis ; le bouton
// reste blanc sur terracotta ; une règle de largeur resserre la carte et le
// titre sous 600 px ; le gabarit qui tutoie n'est pas vouvoyé par son châssis.

import { describe, it, expect } from "vitest";

import { renderEmailTemplate } from "../index";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

async function html(name: Parameters<typeof renderEmailTemplate>[0]): Promise<string> {
  return (await renderEmailTemplate(name, "fr", PAYLOAD_EXEMPLE)).html;
}

describe("châssis — mobile", () => {
  it("🔴 pose la balise viewport que React Email n'ajoute pas", async () => {
    const h = await html("contact-confirmed");
    expect(h).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1"/);
  });

  it("resserre la carte et le titre sous 600 px", async () => {
    const h = await html("contact-confirmed");
    expect(h).toMatch(/@media only screen and \(max-width: ?600px\)/);
    expect(h).toMatch(/\.ax-card\s*\{[^}]*padding: 24px 18px !important/);
    expect(h).toMatch(/\.ax-title\s*\{[^}]*font-size: 22px !important/);
    expect(h).toMatch(/class="ax-heading ax-title"/);
  });
});

describe("châssis — mode sombre", () => {
  it("🔴 couvre le corps des gabarits par les descendants de la carte, pas seulement le châssis", async () => {
    const h = await html("contact-confirmed");
    expect(h).toMatch(/\.ax-card p,[^{]*\{\s*color: #f6efe3 !important/);
    expect(h).toMatch(/\.ax-card h1,[^{]*\{\s*color: #fdf7ec !important/);
    expect(h).toMatch(/\.ax-card a\s*\{\s*color: #f0a070 !important/);
  });

  it("le bouton garde son texte blanc — sa classe le remet à part", async () => {
    const h = await html("contact-confirmed");
    expect(h).toMatch(/\.ax-card a\.ax-cta[^{]*\{\s*color: #ffffff !important/);
    expect(h).toMatch(/class="[^"]*ax-cta[^"]*"/);
  });

  it("les deux boutons de « documents-nouvelle-version » portent la classe", async () => {
    const { html: h } = await renderEmailTemplate("documents-nouvelle-version", "fr", {
      ...PAYLOAD_EXEMPLE,
      sourceUrl: "https://axion-ia.com/doc",
      pdfUrl: "https://axion-ia.com/doc.pdf",
    });
    expect(h.match(/class="[^"]*ax-cta[^"]*"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("châssis — personne grammaticale", () => {
  it("🔴 le gabarit qui tutoie n'est pas vouvoyé par son châssis", async () => {
    const h = await html("candidature-commercial-confirmee");
    expect(h).toContain("Réponds simplement à cet e-mail");
    expect(h).not.toContain("Répondez simplement");
    expect(h).not.toContain("chez vous");
  });

  it("les autres gabarits gardent le vouvoiement", async () => {
    const h = await html("contact-confirmed");
    expect(h).toContain("Répondez simplement à cet e-mail");
    expect(h).not.toContain("Réponds simplement");
  });
});
