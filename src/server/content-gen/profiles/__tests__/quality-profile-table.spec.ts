import { describe, it, expect } from "vitest";
import { ContentType, SearchIntent } from "../../../../../prisma/generated/client";
import {
  PROFILE_BY_CONTENT_TYPE,
  PROFILE_BY_CLI_GENERATOR,
  QUALITY_PROFILE_GATES,
  QUALITY_PROFILES,
  resolveQualityProfile,
  resolveCliGeneratorProfile,
  getProfileGates,
  type QualityProfile,
} from "../quality-profile-table";

const VALID_PROFILES = new Set<QualityProfile>(QUALITY_PROFILES);

describe("quality-profile-table (PH1)", () => {
  describe("exhaustivité", () => {
    it("mappe TOUS les ContentType de l'enum Prisma (garde anti-oubli)", () => {
      const enumValues = Object.values(ContentType).sort();
      const mappedKeys = Object.keys(PROFILE_BY_CONTENT_TYPE).sort();
      // Si un futur ContentType est ajouté à l'enum sans mapping → ce test échoue
      // (en plus de l'échec de compilation Record<ContentType, ...>).
      expect(mappedKeys).toEqual(enumValues);
    });

    it("chaque valeur mappée est un QualityProfile valide", () => {
      for (const p of Object.values(PROFILE_BY_CONTENT_TYPE)) {
        expect(VALID_PROFILES.has(p)).toBe(true);
      }
    });

    it("couvre exactement 22 ContentType", () => {
      // 21 (9 V1 + 12 Phase 8) + barometer_insight (Observatoire IA 2026).
      expect(Object.keys(PROFILE_BY_CONTENT_TYPE)).toHaveLength(22);
    });
  });

  describe("profils de base", () => {
    it("blog_article → informational_aeo", () => {
      expect(resolveQualityProfile("blog_article")).toBe("informational_aeo");
    });
    it("pain_point_solution → commercial", () => {
      expect(resolveQualityProfile("pain_point_solution")).toBe("commercial");
    });
    it("landing_ville → local", () => {
      expect(resolveQualityProfile("landing_ville")).toBe("local");
    });
    it("blog_from_rss → news", () => {
      expect(resolveQualityProfile("blog_from_rss")).toBe("news");
    });
    it("glossary_term/what_is_x/faq_standalone/qa_derived → informational_aeo (corpus AEO)", () => {
      for (const t of [
        "glossary_term",
        "what_is_x",
        "faq_standalone",
        "faq_geo",
        "qa_derived",
      ] as const) {
        expect(resolveQualityProfile(t)).toBe("informational_aeo");
      }
    });
  });

  describe("override par SearchIntent (réconciliation axe existant)", () => {
    it("commercial + intent informational → informational_aeo", () => {
      expect(resolveQualityProfile("pain_point_solution", "informational")).toBe(
        "informational_aeo",
      );
    });
    it("commercial + intent local → local", () => {
      expect(resolveQualityProfile("comparison", "local")).toBe("local");
    });
    it("informational_aeo + intent commercial_investigation → commercial", () => {
      expect(resolveQualityProfile("glossary_term", "commercial_investigation")).toBe("commercial");
    });
    it("informational_aeo + intent transactional → commercial", () => {
      expect(resolveQualityProfile("blog_article", "transactional")).toBe("commercial");
    });
    it("intents non-redirecteurs conservent la base (voice_search/ai_overview/featured_snippet/navigational)", () => {
      for (const intent of [
        "voice_search",
        "ai_overview",
        "featured_snippet",
        "navigational",
      ] as const) {
        expect(resolveQualityProfile("blog_article", intent)).toBe("informational_aeo");
        expect(resolveQualityProfile("pain_point_solution", intent)).toBe("commercial");
      }
    });
    it("searchIntent absent/null → base (déterministe)", () => {
      expect(resolveQualityProfile("blog_article", null)).toBe("informational_aeo");
      expect(resolveQualityProfile("blog_article", undefined)).toBe("informational_aeo");
    });
    it("est exhaustif sur les 8 SearchIntent sans throw", () => {
      for (const intent of Object.values(SearchIntent)) {
        const p = resolveQualityProfile("blog_article", intent);
        expect(VALID_PROFILES.has(p)).toBe(true);
      }
    });
  });

  describe("générateurs villes CLI", () => {
    it("les 6 générateurs villes → local", () => {
      for (const key of Object.keys(PROFILE_BY_CLI_GENERATOR)) {
        expect(resolveCliGeneratorProfile(key)).toBe("local");
      }
      expect(Object.keys(PROFILE_BY_CLI_GENERATOR)).toHaveLength(6);
    });
    it("générateur inconnu → null", () => {
      expect(resolveCliGeneratorProfile("inconnu")).toBeNull();
    });
  });

  describe("seuils par profil (DORMANTS — defaults rétro-compatibles)", () => {
    it("seul commercial a un benefitMin actif (70) ; les autres = null (inertes)", () => {
      expect(getProfileGates("commercial").benefitMin).toBe(70);
      for (const p of ["informational_aeo", "local", "news"] as const) {
        expect(getProfileGates(p).benefitMin).toBeNull();
      }
    });
    it("aucun profil n'autorise la mutation du tier des villes (log-only)", () => {
      for (const p of QUALITY_PROFILES) {
        expect(getProfileGates(p).mayMutateVilleTier).toBe(false);
      }
    });
    it("commercial utilise le mode 'max' (jamais sous le plancher global)", () => {
      expect(getProfileGates("commercial").qualityThresholdMode).toBe("max");
      for (const p of ["informational_aeo", "local", "news"] as const) {
        expect(getProfileGates(p).qualityThresholdMode).toBe("global");
      }
    });
    it("QUALITY_PROFILE_GATES couvre les 4 profils", () => {
      expect(Object.keys(QUALITY_PROFILE_GATES).sort()).toEqual([...QUALITY_PROFILES].sort());
    });
  });
});
