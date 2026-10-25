/**
 * Avis d'expert (lot L3, audit du 24/10/2026) : la signature n'est JAMAIS une
 * personne. Le texte est écrit par un modèle de langage : le mettre dans la
 * bouche de Williams ou de Manon serait une fausse preuve.
 */
import { describe, it, expect } from "vitest";
import {
  INTERNAL_EXPERTS,
  SIGNATURE_AVIS,
  buildExpertQuote,
  pickInternalExpert,
} from "../expert-bank";

describe("buildExpertQuote — signature de marque", () => {
  it("signe « Point de vue d'Axion-IA » quel que soit l'expert choisi", () => {
    for (const expert of INTERNAL_EXPERTS) {
      const q = buildExpertQuote(expert, "Une prise de position utile pour un dirigeant.");
      expect(q).toBeDefined();
      expect(q?.name).toBe("Axion-IA");
      expect(q?.title).toBe("Point de vue d'Axion-IA");
    }
  });

  it("le nom n'est jamais celui d'une personne de la banque", () => {
    const noms = INTERNAL_EXPERTS.flatMap((e) => [e.name, e.displayName]);
    for (const expert of INTERNAL_EXPERTS) {
      const q = buildExpertQuote(expert, "Texte.");
      expect(noms).not.toContain(q?.name);
      expect(q?.title).not.toMatch(/fondateur|experte?/i);
    }
  });

  it("reprend le texte rogné, et renvoie undefined si le texte est vide", () => {
    const expert = pickInternalExpert({ topic: "audit stratégie dirigeant" });
    expect(buildExpertQuote(expert, "  Un avis.  ")?.text).toBe("Un avis.");
    expect(buildExpertQuote(expert, "   ")).toBeUndefined();
    expect(buildExpertQuote(expert, null)).toBeUndefined();
    expect(buildExpertQuote(expert, undefined)).toBeUndefined();
  });

  it("la constante de signature est celle que le rendu affiche", () => {
    expect(SIGNATURE_AVIS.name).toBe("Axion-IA");
    expect(SIGNATURE_AVIS.title).toBe("Point de vue d'Axion-IA");
  });
});

describe("pickInternalExpert — routage du sujet inchangé", () => {
  it("garde Williams pour la stratégie et Manon par défaut", () => {
    expect(pickInternalExpert({ topic: "audit stratégie dirigeant" }).key).toBe("williams");
    expect(pickInternalExpert({ topic: "automatiser ses mails" }).key).toBe("manon");
  });
});
