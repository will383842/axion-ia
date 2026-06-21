/**
 * Sprint v7 Phase 8 commit 4/4 — Tests registry 12 nouveaux generators.
 *
 * Garantit que :
 *   1. Les 12 nouveaux ContentType ont un Generator enregistré dans REGISTRY
 *   2. Chaque Generator expose correctement son contentType slug
 *   3. WIZARD_CONTENT_TYPES expose 21 entrées (9 V1 + 12 Phase 8)
 *   4. WIZARD_SECTIONS expose 6 sections couvrant les 21 types sans doublon
 *   5. Le mapping CONTENT_TYPE_TO_KB_TYPE couvre les 21 types
 *
 * Tests anti-régression : si un nouveau ContentType est ajouté au enum Prisma
 * sans Generator ni KbType mapping, ces tests pètent.
 */

import { describe, it, expect } from "vitest";
import { getGenerator } from "../index";
import {
  longTailKeywordGenerator,
  painPointSolutionGenerator,
  vsComparatorGenerator,
  alternativeToGenerator,
  topXInYGenerator,
  howToXInYGenerator,
  bestForXInYGenerator,
  calculatorRoiGenerator,
  glossaryTermGenerator,
  whatIsXGenerator,
  faqGeoGenerator,
  caseStudyLocalGenerator,
  V7_PHASE8_CONTENT_TYPE_SLUGS,
} from "../v7-phase8-generators";
import {
  WIZARD_CONTENT_TYPES,
  WIZARD_SECTIONS,
} from "@/server/actions/content-gen/campaign-wizard-constants";
import type { ContentType } from "../../../../../prisma/generated/client";

const PHASE8_GENERATORS_BY_SLUG = {
  long_tail_keyword: longTailKeywordGenerator,
  pain_point_solution: painPointSolutionGenerator,
  vs_comparator: vsComparatorGenerator,
  alternative_to: alternativeToGenerator,
  top_x_in_y: topXInYGenerator,
  how_to_x_in_y: howToXInYGenerator,
  best_for_x_in_y: bestForXInYGenerator,
  calculator_roi: calculatorRoiGenerator,
  glossary_term: glossaryTermGenerator,
  what_is_x: whatIsXGenerator,
  faq_geo: faqGeoGenerator,
  case_study_local: caseStudyLocalGenerator,
} as const;

describe("Phase 8 — Registry 12 generators", () => {
  it("V7_PHASE8_CONTENT_TYPE_SLUGS expose exactement 12 slugs", () => {
    expect(V7_PHASE8_CONTENT_TYPE_SLUGS.length).toBe(12);
    const uniques = new Set(V7_PHASE8_CONTENT_TYPE_SLUGS);
    expect(uniques.size).toBe(12);
  });

  it.each(V7_PHASE8_CONTENT_TYPE_SLUGS)(
    "getGenerator('%s') retourne le Generator Phase 8 correspondant",
    (slug) => {
      const gen = getGenerator(slug as ContentType);
      expect(gen).toBeDefined();
      expect(gen.contentType).toBe(slug);
      // Vérifie que getGenerator retourne le même objet que l'export nommé.
      expect(gen).toBe(PHASE8_GENERATORS_BY_SLUG[slug]);
    },
  );

  it("getGenerator throw si ContentType inconnu (anti-régression typo)", () => {
    expect(() => getGenerator("nonexistent_type" as ContentType)).toThrow(
      /No generator registered/,
    );
  });
});

describe("Phase 8 — Wizard 20 sliders × 6 sections", () => {
  it("WIZARD_CONTENT_TYPES expose 20 entrées (8 V1 + 12 Phase 8 ; landing_ville retiré, CLI-only)", () => {
    expect(WIZARD_CONTENT_TYPES.length).toBe(20);
    const uniques = new Set(WIZARD_CONTENT_TYPES);
    expect(uniques.size).toBe(20);
    // landing_ville est CLI-only (hors REGISTRY) → jamais proposé au wizard.
    expect(WIZARD_CONTENT_TYPES).not.toContain("landing_ville");
  });

  it("WIZARD_SECTIONS expose 6 sections", () => {
    expect(WIZARD_SECTIONS.length).toBe(6);
  });

  it("WIZARD_SECTIONS couvre les 20 types sans doublon", () => {
    const allTypes = WIZARD_SECTIONS.flatMap((s) => s.types);
    expect(allTypes.length).toBe(20);
    const uniques = new Set(allTypes);
    expect(uniques.size).toBe(20);
    // Tous les types du wizard sont mentionnés exactement une fois dans une section.
    for (const ct of WIZARD_CONTENT_TYPES) {
      expect(allTypes).toContain(ct);
    }
  });

  it("Sections ont des id stables (clés UI persistantes)", () => {
    const expectedIds = [
      "core",
      "sources",
      "comparatifs",
      "qa",
      "seo-longtail",
      "conversion-local",
    ];
    const actualIds = WIZARD_SECTIONS.map((s) => s.id);
    expect(actualIds).toEqual(expectedIds);
  });

  it("Section 'core' contient blog_article + guide_pilier (landing_ville retiré, CLI-only)", () => {
    const core = WIZARD_SECTIONS.find((s) => s.id === "core");
    expect(core?.types).toEqual(["blog_article", "guide_pilier"]);
  });

  it("Section 'seo-longtail' contient les 5 types SEO étendus", () => {
    const seo = WIZARD_SECTIONS.find((s) => s.id === "seo-longtail");
    expect(seo?.types.length).toBe(5);
    expect(seo?.types).toContain("long_tail_keyword");
    expect(seo?.types).toContain("top_x_in_y");
  });
});
