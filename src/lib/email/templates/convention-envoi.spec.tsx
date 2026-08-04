/**
 * Tests — e-mail d'envoi du lien de signature d'une convention.
 *
 * L'enjeu principal n'est pas le rendu : c'est que **l'URL du lien n'apparaisse
 * jamais en texte** dans le corps. Le lien vaut signature ; le montrer en clair
 * le rend copiable, transférable, et donne un e-mail qu'un client ne distingue
 * pas d'un hameçonnage. Il doit être porté par le bouton, et seulement lui.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@react-email/render";

import { ConventionEnvoiEmail, conventionEnvoiSubject } from "./convention-envoi";

const URL_SIGNATURE = "https://axion-ia.com/fr/portail/signer/JETON.SIGNE.ABCDEF123456";

const PAYLOAD = {
  signataireNom: "Simone Blanc",
  clientNom: "INVEST SUN",
  numero: "AXI-DOC-2026-009",
  titreFormation: "IA pour l'immobilier",
  signatureUrl: URL_SIGNATURE,
};

async function html(payload: Record<string, unknown>): Promise<string> {
  return render(React.createElement(ConventionEnvoiEmail, { locale: "fr", payload }));
}

describe("ConventionEnvoiEmail", () => {
  it("porte le nom du signataire, le client, l'intitulé et le n° de pièce", async () => {
    const h = await html(PAYLOAD);
    expect(h).toContain("Simone Blanc");
    expect(h).toContain("INVEST SUN");
    expect(h).toContain("IA pour l&#x27;immobilier");
    expect(h).toContain("AXI-DOC-2026-009");
  });

  it("le lien est un href de bouton, jamais du texte visible", async () => {
    const h = await html(PAYLOAD);
    // Présent comme cible…
    expect(h).toContain(`href="${URL_SIGNATURE}"`);
    // …et le libellé cliquable est une phrase, pas l'URL.
    expect(h).toContain("Signer la convention");
    // Le jeton ne doit apparaître QUE dans des attributs href, jamais entre
    // deux balises comme contenu lisible.
    const texteVisible = h.replace(/<[^>]+>/g, " ");
    expect(texteVisible).not.toContain("JETON.SIGNE");
  });

  it("avertit que le lien est personnel et vaut signature", async () => {
    const h = await html(PAYLOAD);
    expect(h).toContain("vaut signature");
    expect(h).toMatch(/ne pas le transférer|ne pas le transf/);
  });

  // Signature institutionnelle, pas le nom d'une personne : ces e-mails partent
  // au nom de l'organisme, et un client répond à une équipe. Le footer social
  // commun (« et Williams, son fondateur » — demande Will 2026-08-04) est
  // hors-signature : on borne donc le contrôle au CORPS, avant le footer.
  it("signe « L'équipe Axion-IA », jamais un nom propre dans le corps", async () => {
    const h = await html(PAYLOAD);
    expect(h).toContain("L&#x27;équipe Axion-IA");
    const marqueurFooter = h.indexOf("Suivez l&#x27;aventure Axion-IA");
    expect(marqueurFooter).toBeGreaterThan(-1);
    const corps = h.slice(0, marqueurFooter);
    expect(corps).not.toContain("Williams");
  });

  it("insère le message libre de l'admin quand il existe", async () => {
    const h = await html({ ...PAYLOAD, messagePersonnalise: "Merci pour cette journée." });
    expect(h).toContain("Merci pour cette journée.");
  });

  it("sujet non vide et portant l'intitulé", () => {
    const s = conventionEnvoiSubject("fr", PAYLOAD);
    expect(s.length).toBeGreaterThan(10);
    expect(s).toContain("IA pour l'immobilier");
  });

  // Ne devrait pas arriver (l'action refuse), mais un gabarit ne doit jamais
  // casser sur un champ manquant : il rend sans bouton plutôt que d'exploser.
  it("sans lien : rend quand même, sans bouton", async () => {
    const h = await html({ ...PAYLOAD, signatureUrl: "" });
    expect(h).toContain("Simone Blanc");
    expect(h).not.toContain("portail/signer");
  });
});
