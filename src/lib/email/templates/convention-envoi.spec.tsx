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
  // au nom de l'organisme, et un client répond à une équipe.
  //
  // 🔑 2026-08-31 — ce contrôle est devenu PLUS STRICT, et c'est la refonte
  // éditoriale qui l'a permis. Il bornait sa lecture au corps, « avant le
  // footer », parce que la rangée sociale commune glissait « et Williams, son
  // fondateur » dans TOUS les e-mails (demande Will 2026-08-04). La convention
  // est désormais de FAMILLE A : ni réseaux sociaux, ni partage, ni bandeau de
  // confiance (référentiel §2.5). Il n'y a donc plus de zone à exclure — on
  // vérifie le document ENTIER, ce que la version bornée ne pouvait pas faire.
  it("signe « L'équipe Axion-IA », jamais un nom propre — dans tout le message", async () => {
    const h = await html(PAYLOAD);
    expect(h).toContain("L&#x27;équipe Axion-IA");
    expect(h).not.toContain("Williams");
  });

  // Famille A — la sobriété est ici une fonction de SÉCURITÉ : c'est le message
  // que le hameçonnage imite le plus, et un e-mail chargé de liens sociaux
  // détruit le repère qu'on apprend aux gens (« un vrai e-mail de signature est
  // sobre »). Cette garde rougit si quelqu'un rebascule le gabarit en famille B.
  it("famille A : aucun réseau social, aucun partage, aucun désabonnement", async () => {
    const h = await html(PAYLOAD);
    expect(h).not.toContain("linkedin.com");
    expect(h).not.toContain("facebook.com");
    expect(h).not.toContain("Partager sur LinkedIn");
    expect(h).not.toContain("Se désabonner");
  });

  // §6.3 — le pied réduit reste une mention légale COMPLÈTE : la LCEN art. 1-1
  // impose la dénomination, l'adresse du siège et l'identifiant. Ce pied lisait
  // ces valeurs dans `process.env.COMPANY_*`, dont le repli était la CHAÎNE VIDE
  // — un e-mail rendu sans ces variables (le worker est une app Coolify à part,
  // avec son propre environnement) partait sans adresse ni SIREN, en silence.
  it("porte l'identité légale complète, complément d'adresse SIRENE inclus", async () => {
    const h = await html(PAYLOAD);
    expect(h).toContain("AXION IA SAS");
    expect(h).toContain("ELITE BUREAUX - boîte 53");
    expect(h).toContain("108018631");
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
