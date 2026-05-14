/**
 * KB V4 (Sprint KB-20) — Tests cross-validation coverage KB.
 *
 * Vérifie que toutes les sources de vérité (KB_TYPES, KB_TYPE_META,
 * KB_TYPE_TO_JSONLD, DEFAULT_REVIEW_WINDOW_MONTHS, templates, thresholds)
 * couvrent les 28 valeurs KbType sans drift.
 *
 * Tout ajout d'un nouveau KbType doit faire péter ces tests jusqu'à mise
 * à jour cohérente partout.
 */

import { describe, expect, it } from "vitest";
import { KB_TYPES, KB_TYPE_META, KB_TYPE_TO_JSONLD } from "../../content/knowledge/types";
import { DEFAULT_REVIEW_WINDOW_MONTHS } from "../../content/knowledge/review-windows";
import {
  DEFAULT_QUALITY_THRESHOLDS,
  DEFAULT_MIN_WORD_COUNT,
} from "../../content/knowledge/quality-thresholds";
import { getTemplateForType } from "../../content/knowledge/editor-templates";

describe("KB V4 cross-validation coverage", () => {
  it("KB_TYPES contient exactement 28 valeurs (16 V3 + 12 V4)", () => {
    expect(KB_TYPES).toHaveLength(28);
  });

  it("chaque KbType est dans KB_TYPE_META", () => {
    for (const type of KB_TYPES) {
      expect(KB_TYPE_META[type]).toBeDefined();
      expect(KB_TYPE_META[type].value).toBe(type);
    }
  });

  it("chaque KbType est dans KB_TYPE_TO_JSONLD", () => {
    for (const type of KB_TYPES) {
      expect(KB_TYPE_TO_JSONLD[type]).toBeDefined();
      expect(typeof KB_TYPE_TO_JSONLD[type]).toBe("string");
    }
  });

  it("chaque KbType a une fenêtre de revue dans DEFAULT_REVIEW_WINDOW_MONTHS", () => {
    for (const type of KB_TYPES) {
      const window = DEFAULT_REVIEW_WINDOW_MONTHS[type];
      expect(window).toBeGreaterThan(0);
      expect(window).toBeLessThanOrEqual(60);
    }
  });

  it("chaque KbType a un min_word_count dans DEFAULT_MIN_WORD_COUNT", () => {
    for (const type of KB_TYPES) {
      const min = DEFAULT_MIN_WORD_COUNT[type];
      expect(min).toBeDefined();
      expect(min).toBeGreaterThanOrEqual(0);
    }
  });

  it("chaque KbType expose un template (fallback inclus)", () => {
    for (const type of KB_TYPES) {
      const tpl = getTemplateForType(type);
      expect(tpl.html.length).toBeGreaterThan(0);
      expect(tpl.html).toMatch(/<h2/i);
    }
  });

  it("Quality thresholds par type couvrent tous les KbType", () => {
    for (const type of KB_TYPES) {
      const t = DEFAULT_QUALITY_THRESHOLDS[type];
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(100);
    }
  });

  it("V4 factory types ont jsonLd cohérent", () => {
    const v4Mapping: Record<string, string> = {
      automation_recipe: "HowTo",
      tool_review: "Review",
      industry_use_case: "Article",
      comparison: "Article",
      implementation_playbook: "HowTo",
      prompt_pattern: "Article",
      roi_calculator_template: "Article",
      intervention_module: "Course",
      competence_boost: "LearningResource",
      secteur_brief: "Article",
      dept_brief: "Article",
      metier_brief: "Article",
    };
    for (const [type, expected] of Object.entries(v4Mapping)) {
      expect(KB_TYPE_TO_JSONLD[type as keyof typeof KB_TYPE_TO_JSONLD]).toBe(expected);
    }
  });
});
