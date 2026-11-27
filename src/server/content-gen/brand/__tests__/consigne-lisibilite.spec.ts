import { describe, expect, it } from "vitest";
import {
  avecConsigneLisibiliteV2,
  consigneLisibiliteV2,
  ENCADRES_LISIBILITE,
  MARQUEUR_LISIBILITE_V2,
  TYPES_AVEC_CONSIGNE_SPECIFIQUE,
} from "../consigne-lisibilite";
import { getBrandVoiceForContentType, injectBrandVoice } from "../brand-voice";

/** Les 22 valeurs de `enum ContentType` (prisma/schema.prisma). */
const TOUS_LES_TYPES = [
  "landing_ville",
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
  "long_tail_keyword",
  "pain_point_solution",
  "vs_comparator",
  "alternative_to",
  "top_x_in_y",
  "how_to_x_in_y",
  "best_for_x_in_y",
  "calculator_roi",
  "glossary_term",
  "what_is_x",
  "faq_geo",
  "case_study_local",
  "barometer_insight",
];

const ON = { CONTENU_LISIBILITE_V2: "true" };

describe("interrupteur CONTENU_LISIBILITE_V2 : éteint = consignes actuelles identiques", () => {
  it.each([undefined, "", "false", "1", "TRUE", "true "])("valeur %j : bloc vide", (v) => {
    for (const t of TOUS_LES_TYPES) {
      expect(consigneLisibiliteV2(t, { CONTENU_LISIBILITE_V2: v })).toBe("");
    }
  });

  it("éteint : le prompt est rendu tel quel, au caractère près", () => {
    const base = "Prompt de base";
    for (const t of [...TOUS_LES_TYPES, undefined]) {
      expect(avecConsigneLisibiliteV2(base, t, {})).toBe(base);
    }
  });

  it("éteint (environnement du processus) : injectBrandVoice n'ajoute rien", () => {
    delete process.env.CONTENU_LISIBILITE_V2;
    const base = "Prompt de base";
    for (const t of TOUS_LES_TYPES) {
      expect(injectBrandVoice(base, t)).toBe(injectBrandVoice(base));
      expect(injectBrandVoice(base, t)).toBe(`${base}\n\n${getBrandVoiceForContentType("")}`);
      expect(injectBrandVoice(base, t)).not.toContain(MARQUEUR_LISIBILITE_V2);
    }
  });

  it("le bloc de persona n'est jamais modifié, allumé ou éteint", () => {
    process.env.CONTENU_LISIBILITE_V2 = "true";
    try {
      for (const t of TOUS_LES_TYPES) {
        expect(getBrandVoiceForContentType(t)).not.toContain(MARQUEUR_LISIBILITE_V2);
      }
    } finally {
      delete process.env.CONTENU_LISIBILITE_V2;
    }
  });
});

describe("allumé", () => {
  it("couvre les 22 types, chacun avec un bloc spécifique", () => {
    expect([...TYPES_AVEC_CONSIGNE_SPECIFIQUE].sort()).toEqual([...TOUS_LES_TYPES].sort());
  });

  it("le bloc commun porte toutes les consignes demandées", () => {
    const c = consigneLisibiliteV2("blog_article", ON);
    expect(c).toContain(MARQUEUR_LISIBILITE_V2);
    for (const attendu of [
      "RÉPONSE D'ABORD",
      "2 phrases",
      "20 mots en moyenne",
      "JARGON EXPLIQUÉ",
      "UN EXEMPLE CONCRET PAR SECTION",
      "INTERTITRES EN QUESTIONS",
      "À retenir",
      "En bref",
      "Exemple",
      "Chiffre clé",
      "TRANSITIONS",
      "3 actions concrètes",
      "Journée IA",
      "Diagnostic IA",
      "45 minutes",
    ]) {
      expect(c).toContain(attendu);
    }
  });

  it("les balisages documentés sont dans la consigne", () => {
    const c = consigneLisibiliteV2("guide_pilier", ON);
    for (const html of Object.values(ENCADRES_LISIBILITE)) expect(c).toContain(html);
  });

  it("spécificités : actualité courte, comparatif en tableau, guide en étapes, FAQ directe", () => {
    expect(consigneLisibiliteV2("blog_from_rss", ON)).toMatch(/COURTE et FACTUELLE/);
    expect(consigneLisibiliteV2("comparison", ON)).toMatch(/TABLEAU/);
    expect(consigneLisibiliteV2("guide_pilier", ON)).toMatch(/ÉTAPES numérotées/);
    expect(consigneLisibiliteV2("faq_standalone", ON)).toMatch(/commence par la réponse/);
    expect(consigneLisibiliteV2("case_study_local", ON)).toMatch(/AUCUN témoignage/);
  });

  it("est idempotent", () => {
    const une = avecConsigneLisibiliteV2("Base", "comparison", ON);
    expect(avecConsigneLisibiliteV2(une, "comparison", ON)).toBe(une);
    expect(une.split(MARQUEUR_LISIBILITE_V2)).toHaveLength(2);
  });

  it("injectBrandVoice ajoute le bloc, y compris quand la persona est déjà là", () => {
    process.env.CONTENU_LISIBILITE_V2 = "true";
    try {
      const a = injectBrandVoice("Base", "blog_article");
      expect(a).toContain("PERSONA & BRAND VOICE");
      expect(a).toContain(MARQUEUR_LISIBILITE_V2);
      expect(injectBrandVoice(a, "blog_article")).toBe(a);
    } finally {
      delete process.env.CONTENU_LISIBILITE_V2;
    }
  });
});

describe("interdits absolus : jamais dans la consigne", () => {
  it.each(TOUS_LES_TYPES)("%s : ni prix, ni Grenoble, ni promesse de gain, ni tutoiement", (t) => {
    const c = consigneLisibiliteV2(t, ON);
    expect(c).not.toMatch(/Grenoble/i);
    expect(c).not.toMatch(/Aucun gain garanti/i);
    expect(c).not.toMatch(/\d\s?(€|EUR|euros?)/i);
    expect(c).not.toMatch(/(?<!\p{L})(tu|toi|ton|ta|tes)(?!\p{L})/iu);
    expect(c).not.toMatch(/garanti/i);
  });

  it("n'autorise ni prix ni frais de déplacement ni chiffre inventé", () => {
    const c = consigneLisibiliteV2("blog_article", ON);
    expect(c).toMatch(/Jamais de prix, de frais de déplacement/);
    expect(c).toMatch(/aucun chiffre sans source/);
    expect(c).toMatch(/faux témoignage/);
  });
});
