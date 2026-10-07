/**
 * INT-T77-A — le courriel unique « convention + mandat OPCO ».
 *
 * Le TEXTE est celui de la juriste, mot pour mot (axion-apporteurs #782,
 * 6035018511). Ces témoins le figent :
 *   - aucun lien en clair dans le corps : les deux liens sont des `href` de boutons ;
 *   - la phrase du mandat est présente quand le mandat part, absente sinon ;
 *   - « vaut signature » n'y figure PAS (un lien n'est pas une signature) ;
 *   - « courriel », jamais « e-mail », dans le corps ;
 *   - l'objet est borné comme l'existant.
 */

import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "@react-email/render";

import {
  ConventionEtMandatOpcoEmail,
  conventionEtMandatOpcoSubject,
} from "../convention-et-mandat-opco";
import { OBJET_MAX } from "../../objet-email";

const URL_CONVENTION = "https://axion-ia.com/fr/portail/signer/JETON.CONVENTION.ABCDEF123456";
const URL_MANDAT = "https://axion-ia.com/fr/portail/signer/JETON.MANDAT.GHIJKL789012";

const PAYLOAD = {
  signataireNom: "Simone Blanc",
  clientNom: "INVEST SUN",
  titreFormation: "IA pour l'immobilier",
  numeroConvention: "AXI-DOC-2026-009",
  conventionUrl: URL_CONVENTION,
  numeroMandat: "AXI-DOC-2026-010",
  mandatUrl: URL_MANDAT,
};

async function html(payload: Record<string, unknown>): Promise<string> {
  return render(React.createElement(ConventionEtMandatOpcoEmail, { locale: "fr", payload }));
}

/** Le texte visible : balises retirées, entités décodées pour les apostrophes. */
function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ");
}

describe("ConventionEtMandatOpcoEmail — le texte de la juriste", () => {
  it("porte le signataire, le client, l'intitulé et les deux références", async () => {
    const t = texte(await html(PAYLOAD));
    expect(t).toContain("Bonjour Simone Blanc,");
    expect(t).toContain(
      "La convention de formation professionnelle relative à « IA pour l'immobilier », établie entre INVEST SUN et Axion-IA, et le mandat OPCO qui s'y rattache sont prêts à être signés.",
    );
    expect(t).toContain("Références : AXI-DOC-2026-009 · AXI-DOC-2026-010");
  });

  it("la phrase du mandat, EXACTE, est présente quand le mandat part", async () => {
    const t = texte(await html(PAYLOAD));
    expect(t).toContain(
      "Le mandat autorise seulement Axion-IA à déposer en votre nom, auprès de l'OPCO, la demande de prise en charge de cette formation ; vous pouvez le révoquer à tout moment, par écrit.",
    );
  });

  it("la phrase du mandat est ABSENTE quand un seul document part", async () => {
    const t = texte(await html({ ...PAYLOAD, mandatUrl: undefined, numeroMandat: undefined }));
    expect(t).not.toContain("Le mandat autorise");
    expect(t).not.toContain("mandat OPCO");
    expect(t).not.toContain("Signer le mandat");
    expect(t).toContain("Signer la convention");
  });

  it("les deux liens sont des href de boutons, JAMAIS du texte visible", async () => {
    const h = await html(PAYLOAD);
    expect(h).toContain(`href="${URL_CONVENTION}"`);
    expect(h).toContain(`href="${URL_MANDAT}"`);
    const t = texte(h);
    expect(t).toContain("Signer la convention");
    expect(t).toContain("Signer le mandat OPCO");
    expect(t).not.toContain("JETON.CONVENTION");
    expect(t).not.toContain("JETON.MANDAT");
    expect(t).not.toContain("https://");
  });

  it("dit que chaque lien « n'ouvre que sa pièce », et jamais qu'il « vaut signature »", async () => {
    const t = texte(await html(PAYLOAD));
    expect(t).toContain(
      "Les deux liens ci-dessous ouvrent chacun une pièce : vous pouvez la lire intégralement avant de la signer. La convention et le mandat se signent séparément. Chaque lien vous est personnel et n'ouvre que sa pièce : merci de ne pas le transférer.",
    );
    expect(t).not.toMatch(/vaut signature/i);
  });

  it("écrit « courriel », jamais « e-mail », ni rien sur le règlement ou la condition suspensive", async () => {
    const t = texte(await html(PAYLOAD));
    expect(t).toContain("répondez simplement à ce courriel.");
    // Le CORPS seulement : le pied de page commun du châssis dit « e-mail » et
    // n'est pas du ressort de ce texte.
    const corps = t.slice(t.indexOf("Bonjour"), t.indexOf("Bien cordialement"));
    expect(corps).not.toMatch(/e-?mail/i);
    expect(corps).not.toMatch(/condition suspensive|règlement|prix/i);
  });

  it("signe « L'équipe Axion-IA », jamais un nom propre", async () => {
    const t = texte(await html(PAYLOAD));
    expect(t).toContain("Bien cordialement, L'équipe Axion-IA");
    expect(t).not.toContain("Williams");
  });

  it("famille A : aucun réseau social, aucun désabonnement", async () => {
    const h = await html(PAYLOAD);
    expect(h).not.toContain("linkedin.com");
    expect(h).not.toContain("facebook.com");
  });
});

describe("conventionEtMandatOpcoSubject", () => {
  it("l'objet est celui de la juriste quand l'intitulé tient", () => {
    expect(conventionEtMandatOpcoSubject("fr", { ...PAYLOAD, titreFormation: "IA" })).toBe(
      "Convention et mandat OPCO à signer — IA",
    );
  });

  it("l'objet est BORNÉ comme l'existant, même avec un intitulé très long", () => {
    const sujet = conventionEtMandatOpcoSubject("fr", {
      ...PAYLOAD,
      titreFormation:
        "Intelligence artificielle appliquée à la gestion immobilière et patrimoniale",
    });
    expect(sujet.length).toBeLessThanOrEqual(OBJET_MAX);
    expect(sujet.startsWith("Convention et mandat OPCO à signer")).toBe(true);
  });

  it("sans mandat, l'objet est celui de la convention seule", () => {
    expect(
      conventionEtMandatOpcoSubject("fr", {
        ...PAYLOAD,
        mandatUrl: undefined,
        titreFormation: "IA",
      }),
    ).toBe("Convention à signer — IA");
  });
});
