/**
 * Bloc de positionnement : répartition des angles d'entrée, déterminisme,
 * taille du bloc, absence de slogan, et protection du chatbot.
 */
import { describe, it, expect } from "vitest";
import {
  ANGLES_ENTREE,
  BLOC_POSITIONNEMENT,
  BLOC_POSITIONNEMENT_ACTUALITE,
  MARQUEUR_POSITIONNEMENT,
  choisirAngleEntree,
  consigneAngle,
} from "../positionnement";
import { getBrandVoiceForContentType, injectBrandVoiceForType } from "../brand-voice";

/** Étiquette interdite : TPE et PME accolées, sous toute graphie. */
const ETIQUETTE_TPE_PME = /\bTPE\s*(\/|,|-|et)\s*PME\b/i;

describe("angles d'entrée", () => {
  it("a 8 angles", () => {
    expect(ANGLES_ENTREE).toHaveLength(8);
  });

  it("répartit 800 graines entre 70 et 130 par angle", () => {
    const compte = new Array<number>(ANGLES_ENTREE.length).fill(0);
    for (let i = 0; i < 800; i++) compte[choisirAngleEntree(`seed-${i}`)]++;
    for (const n of compte) {
      expect(n).toBeGreaterThanOrEqual(70);
      expect(n).toBeLessThanOrEqual(130);
    }
  });

  it("est déterministe", () => {
    expect(choisirAngleEntree("job-abc")).toBe(choisirAngleEntree("job-abc"));
    expect(consigneAngle("job-abc")).toBe(consigneAngle("job-abc"));
  });

  it("renvoie un indice valide et une consigne lisible", () => {
    const i = choisirAngleEntree("job-xyz");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(8);
    expect(consigneAngle("job-xyz")).toContain("ANGLE D'ENTRÉE POUR CET ARTICLE : ");
  });
});

describe("bloc de positionnement", () => {
  it("fait 15 lignes au plus", () => {
    expect(BLOC_POSITIONNEMENT.split("\n").length).toBeLessThanOrEqual(15);
  });

  it("ne contient ni l'étiquette « TPE/PME » ni la phrase-slogan entière", () => {
    for (const bloc of [BLOC_POSITIONNEMENT, BLOC_POSITIONNEMENT_ACTUALITE]) {
      expect(bloc).not.toMatch(ETIQUETTE_TPE_PME);
      expect(bloc).not.toContain("nous si.");
      expect(bloc.toLowerCase()).not.toContain("aucun gain garanti");
    }
  });

  it("porte le marqueur d'idempotence", () => {
    expect(BLOC_POSITIONNEMENT).toContain(MARQUEUR_POSITIONNEMENT);
    expect(BLOC_POSITIONNEMENT_ACTUALITE).toContain(MARQUEUR_POSITIONNEMENT);
  });
});

describe("brand-voice et positionnement", () => {
  it("qa_derived (chatbot) ne reçoit PAS le bloc", () => {
    expect(injectBrandVoiceForType("x", "qa_derived")).not.toContain(MARQUEUR_POSITIONNEMENT);
  });

  it("blog_article reçoit le bloc", () => {
    expect(injectBrandVoiceForType("x", "blog_article")).toContain(MARQUEUR_POSITIONNEMENT);
  });

  it("guide_pilier et comparison reçoivent le bloc complet", () => {
    expect(getBrandVoiceForContentType("guide_pilier")).toContain(BLOC_POSITIONNEMENT);
    expect(getBrandVoiceForContentType("comparison")).toContain(BLOC_POSITIONNEMENT);
  });

  it("blog_from_rss reçoit la version actualité", () => {
    const voix = getBrandVoiceForContentType("blog_from_rss");
    expect(voix).toContain(BLOC_POSITIONNEMENT_ACTUALITE);
    expect(voix).not.toContain(BLOC_POSITIONNEMENT);
  });

  it("la voix complète n'emploie jamais l'étiquette « TPE/PME »", () => {
    for (const t of ["blog_article", "guide_pilier", "comparison", "blog_from_rss"]) {
      expect(getBrandVoiceForContentType(t)).not.toMatch(ETIQUETTE_TPE_PME);
    }
  });
});
