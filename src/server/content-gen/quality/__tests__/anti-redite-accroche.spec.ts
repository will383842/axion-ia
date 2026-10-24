/**
 * Tests — anti-redite de l'accroche (début de l'article comparé aux articles publiés).
 */

import { describe, expect, it } from "vitest";
import {
  ACCROCHE_SEUIL,
  premierParagraphe,
  verifierAccrocheTropProche,
} from "../anti-redite-accroche";

const OUVERTURE =
  "Une entreprise du bâtiment perd chaque semaine plusieurs heures à relancer ses devis à la main, alors qu'un simple suivi automatisé suffit pour ne plus rien oublier et gagner du temps.";

describe("premierParagraphe", () => {
  it("rend le texte du premier paragraphe sans balises", () => {
    expect(
      premierParagraphe("<h2>Titre</h2><p>Bonjour <strong>le</strong> monde</p><p>Autre</p>"),
    ).toBe("Bonjour le monde");
  });
  it("rend vide s'il n'y a aucun paragraphe", () => {
    expect(premierParagraphe("<h2>Titre</h2>")).toBe("");
  });
});

describe("verifierAccrocheTropProche", () => {
  const corpus = new Map<string, string>([
    ["article-existant", `${OUVERTURE} La suite de cet article diverge complètement.`],
    [
      "autre-sujet",
      "Le règlement européen sur l'intelligence artificielle impose des obligations de transparence aux fournisseurs de systèmes concernés.",
    ],
  ]);

  it("retient une accroche recopiée (réponse directe)", () => {
    const r = verifierAccrocheTropProche(
      {
        directAnswer: OUVERTURE,
        bodyHtml:
          "<p>Texte totalement différent sur un autre sujet précis et nouveau pour le lecteur attentif.</p>",
      },
      corpus,
    );
    expect(r.bloque).toBe(true);
    expect(r.slugProche).toBe("article-existant");
    expect(r.source).toBe("reponse-directe");
    expect(r.similarite).toBeGreaterThan(ACCROCHE_SEUIL);
  });

  it("retient un premier paragraphe recopié", () => {
    const r = verifierAccrocheTropProche(
      {
        directAnswer: "Réponse courte et neuve sur un sujet que personne n'a encore traité ici.",
        bodyHtml: `<p>${OUVERTURE}</p>`,
      },
      corpus,
    );
    expect(r.bloque).toBe(true);
    expect(r.source).toBe("premier-paragraphe");
  });

  it("laisse passer une accroche originale", () => {
    const r = verifierAccrocheTropProche(
      {
        directAnswer:
          "Automatiser l'envoi des factures réduit les retards de paiement dans une petite agence de communication.",
        bodyHtml:
          "<p>Les agences de communication relancent souvent leurs clients trop tard, faute d'un rappel fiable.</p>",
      },
      corpus,
    );
    expect(r.bloque).toBe(false);
  });

  it("ne bloque pas quand le corpus est vide ou l'accroche trop courte", () => {
    expect(
      verifierAccrocheTropProche({ directAnswer: OUVERTURE, bodyHtml: "" }, new Map()).bloque,
    ).toBe(false);
    expect(
      verifierAccrocheTropProche({ directAnswer: "Oui.", bodyHtml: "<p>Non.</p>" }, corpus).bloque,
    ).toBe(false);
  });
});
