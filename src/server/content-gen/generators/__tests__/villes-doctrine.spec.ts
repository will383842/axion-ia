/**
 * Les 4 générateurs de sections de page ville ne rendent jamais un texte qui
 * porte une faute dure de doctrine (audit blog/RAG du 24/10/2026, option B).
 * L'appel IA est simulé : aucun appel payant.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const generateMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("../../providers/provider-router", () => ({
  generate: (...args: unknown[]) => generateMock(...args),
}));
vi.mock("../../kb-client", () => ({ retrieve: async () => [] }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { generateVilleCasUsage } from "../landing-ville-cas-usage";
import { generateVilleEcosystem } from "../landing-ville-ecosystem";
import { generateVilleFaqExtended } from "../landing-ville-faq-extended";
import { generateVilleSecteurs } from "../landing-ville-secteurs";

const TEXTE_SAIN =
  "Lyon abrite de nombreuses petites entreprises de services, de commerce et de santé qui cherchent à gagner du temps.";
const TEXTE_FAUTIF = `${TEXTE_SAIN} Axion-IA y est certifiée Qualiopi.`;

function reponse(payload: unknown) {
  return {
    output: JSON.stringify(payload),
    costUsd: 0.001,
    model: "test",
    tokensInput: 1,
    tokensOutput: 1,
  };
}

const PARAMS_VILLE = {
  ville: { nameFr: "Lyon", regionFr: "Auvergne-Rhône-Alpes" },
  verticale: "audits",
};
const PARAMS_PLATS = {
  villeSlug: "lyon",
  villeName: "Lyon",
  regionName: "Auvergne-Rhône-Alpes",
  verticale: "audits",
};

const faqs = (a: string) =>
  Array.from({ length: 5 }, (_, i) => ({
    q: `Question numéro ${i} sur Lyon ?`,
    a: i === 0 ? a : "Réponse courte et factuelle.",
    speakable_selector: ".speakable-faq-1",
  }));
const cas = (d: string) =>
  Array.from({ length: 3 }, (_, i) => ({
    title: `Cas d'usage numéro ${i}`,
    description: i === 0 ? d : TEXTE_SAIN,
    benefit: "Bénéfice mesurable: 3 heures/semaine récupérées.",
    speakable_selector: ".speakable-cas-usage",
  }));

const CAS = [
  {
    nom: "écosystème",
    appel: () => generateVilleEcosystem(PARAMS_VILLE),
    sain: { content: TEXTE_SAIN, speakable_selectors: [".s"] },
    fautif: { content: TEXTE_FAUTIF, speakable_selectors: [".s"] },
  },
  {
    nom: "secteurs",
    appel: () => generateVilleSecteurs(PARAMS_VILLE),
    sain: { content: TEXTE_SAIN, speakable_selectors: [".s"] },
    fautif: { content: TEXTE_FAUTIF, speakable_selectors: [".s"] },
  },
  {
    nom: "FAQ étendue",
    appel: () => generateVilleFaqExtended(PARAMS_PLATS),
    sain: { faqs: faqs("Oui, partout en France.") },
    fautif: { faqs: faqs("Oui, nous avons le label Qualiopi.") },
  },
  {
    nom: "cas d'usage",
    appel: () => generateVilleCasUsage(PARAMS_PLATS),
    sain: { cases: cas(TEXTE_SAIN) },
    fautif: { cases: cas(TEXTE_FAUTIF) },
  },
];

beforeEach(() => {
  generateMock.mockReset();
});

describe.each(CAS)("générateur $nom", ({ appel, sain, fautif }) => {
  it("rend le texte sain", async () => {
    generateMock.mockResolvedValue(reponse(sain));
    expect(await appel()).not.toBeNull();
  });

  it("ne rend jamais un texte avec une faute dure (Qualiopi)", async () => {
    generateMock.mockResolvedValue(reponse(fautif));
    expect(await appel()).toBeNull();
  });
});
