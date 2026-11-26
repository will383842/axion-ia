/**
 * Tests — relecture humaine obligatoire des contenus qui parlent de la Journée IA.
 */

import { describe, expect, it } from "vitest";
import {
  barriereJourneeIA,
  exigeRelectureHumaine,
  mentionneJourneeIA,
} from "../relecture-journee-ia";

describe("mentionneJourneeIA", () => {
  it.each([
    "Découvrez la Journée IA",
    "la JOURNÉE IA de votre équipe",
    "journee ia",
    "Journée d'IA en entreprise",
    "Journée d’IA en entreprise",
    "journée de l'IA",
    "Journées IA",
    "voir /fr/journee-ia",
    "https://axion-ia.com/fr/journee-ia#tarif",
    "Journée IA",
    "journée-IA",
  ])("détecte « %s »", (t) => {
    expect(mentionneJourneeIA(t)).toBe(true);
  });

  it.each([
    "Une journée de formation à l'IA générative",
    "Journée mondiale",
    "La journée iacobine",
    "Audit IA pour PME",
    "",
  ])("ne détecte pas « %s »", (t) => {
    expect(mentionneJourneeIA(t)).toBe(false);
  });

  it("détecte le prix et la garantie de l'offre", () => {
    expect(mentionneJourneeIA("Pour 1 490 € HT, une journée")).toBe(true);
    expect(mentionneJourneeIA("tarif 1490€ HT")).toBe(true);
    expect(mentionneJourneeIA("Satisfait ou remboursé, sans condition")).toBe(true);
  });
});

describe("exigeRelectureHumaine", () => {
  it("vrai si le corps de l'article mentionne la Journée IA", () => {
    expect(
      exigeRelectureHumaine({
        output: { title: "Titre", bodyHtml: "<p>Réservez la Journée IA.</p>" },
      }),
    ).toBe(true);
  });

  it("vrai si la FAQ, les tags ou l'entrée du job la mentionnent", () => {
    expect(
      exigeRelectureHumaine({
        output: { faq: [{ question: "Q", answer: "Voir la journée d'IA" }] },
      }),
    ).toBe(true);
    expect(exigeRelectureHumaine({ output: { tags: ["journee-ia"] } })).toBe(true);
    expect(
      exigeRelectureHumaine({ output: {}, inputPayload: { topic: "Journée IA : prix" } }),
    ).toBe(true);
  });

  it("vrai si la campagne rattachée est une campagne Journée IA", () => {
    expect(exigeRelectureHumaine({ output: {}, campaignName: "Campagne Journée IA - Lyon" })).toBe(
      true,
    );
  });

  it("faux sans aucune mention (comportement inchangé)", () => {
    expect(
      exigeRelectureHumaine({
        output: { title: "Audit IA", bodyHtml: "<p>Automatiser la facturation.</p>", faq: [] },
        inputPayload: { keyword: "automatisation" },
        campaignName: "Campagne Lyon",
      }),
    ).toBe(false);
  });

  it("tolère une sortie absente ou mal formée", () => {
    expect(exigeRelectureHumaine({ output: null })).toBe(false);
    expect(exigeRelectureHumaine({ output: "texte" })).toBe(false);
    expect(exigeRelectureHumaine({ output: { faq: "x", tags: 3 } })).toBe(false);
  });
});

describe("barriereJourneeIA", () => {
  it("rend une barrière de relecture quand le contenu parle de la Journée IA", () => {
    const b = barriereJourneeIA({ output: { bodyHtml: "<p>La Journée IA</p>" } });
    expect(b?.code).toBe("journee-ia");
    expect(b?.libelle).toMatch(/Journée IA/);
  });

  it("rend null sinon", () => {
    expect(barriereJourneeIA({ output: { bodyHtml: "<p>Rien</p>" } })).toBeNull();
  });
});
