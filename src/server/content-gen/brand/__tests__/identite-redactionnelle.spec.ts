/**
 * Lot R6 (audit d'harmonie du 08/11/2026, décisions n°16 et vouvoiement) :
 *  - « Manon » est une PLUME IA DÉCLARÉE (assistance IA générative supervisée),
 *    jamais « experte IA chez Axion-IA », jamais une personne de l'équipe ;
 *  - le texte écrit pour le lecteur est au VOUVOIEMENT.
 */
import { describe, it, expect } from "vitest";
import {
  BRAND_VOICE_AXION_IA,
  getBrandVoiceForContentType,
  injectBrandVoice,
} from "../brand-voice";
import { INTERNAL_EXPERTS, buildExpertQuote } from "../expert-bank";

const TYPES = [
  "blog_article",
  "blog_from_rss",
  "comparison",
  "qa_derived",
  "guide_pilier",
  "type_inconnu",
];

describe("Manon : plume IA déclarée", () => {
  it.each(TYPES)("%s : le bloc ne présente jamais Manon comme une experte de l'équipe", (t) => {
    const bloc = getBrandVoiceForContentType(t);
    // La seule occurrence permise est l'interdiction elle-même.
    expect(bloc.replace("« experte IA chez Axion-IA »", "")).not.toMatch(/experte/i);
    expect(bloc).toMatch(/plume IA/i);
    expect(bloc).toMatch(/assistance IA générative/i);
    expect(bloc).toMatch(/supervisée par l'équipe Axion-IA/);
  });

  it("le bloc par défaut interdit explicitement « experte IA chez Axion-IA »", () => {
    const bloc = injectBrandVoice("x");
    expect(bloc).toMatch(/JAMAIS[^\n]*« experte IA chez Axion-IA »/);
    expect(bloc).toMatch(/prime sur toute formulation précédente/);
  });

  it("la persona exportée déclare l'IA et ne dit plus « experte »", () => {
    expect(BRAND_VOICE_AXION_IA.persona).toMatch(/Manon/);
    expect(BRAND_VOICE_AXION_IA.persona).toMatch(/plume IA/);
    expect(BRAND_VOICE_AXION_IA.persona).not.toMatch(/experte/i);
    expect(BRAND_VOICE_AXION_IA.compliance.plumeIaDeclaree).toBe(true);
  });

  it("l'avis d'expert de Manon porte un titre qui déclare l'IA", () => {
    const manon = INTERNAL_EXPERTS.find((e) => e.key === "manon");
    expect(manon).toBeDefined();
    expect(manon!.title).not.toMatch(/experte/i);
    expect(manon!.title).toMatch(/IA/);
    expect(manon!.title).toMatch(/supervis/i);
    expect(buildExpertQuote(manon!, "Un avis.")?.title).toBe(manon!.title);
  });
});

describe("Vouvoiement imposé dans les prompts de génération", () => {
  it.each(TYPES)("%s : la consigne de vouvoiement est dans le bloc", (t) => {
    const bloc = getBrandVoiceForContentType(t);
    expect(bloc).toMatch(/VOUVOIEMENT/);
    expect(bloc).toMatch(/jamais « tu »/);
  });

  it("la persona exportée impose le vouvoiement (plus de « ni vouvoiement distant »)", () => {
    expect(BRAND_VOICE_AXION_IA.tone.formalLevel).toMatch(/vouvoiement/i);
    expect(BRAND_VOICE_AXION_IA.tone.formalLevel).not.toMatch(/ni vouvoiement/i);
    expect(BRAND_VOICE_AXION_IA.compliance.vouvoiement).toBe(true);
  });
});
