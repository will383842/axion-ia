/**
 * Content Generator — Landing ville × verticale AUDITS (Sprint v7 Phase 5 commit 1).
 *
 * Module 2 Axion-IA : audit IA d'optimisation entreprise. Tarifs SSOT :
 *   TPE 290 € · PME 690 € · ETI 1290 € (à distance ; +200/300/700 € sur site).
 * Tone : analytique, ROI-focused, "diagnostic structuré avec délai adapté à votre situation".
 *
 * Migration depuis `landing-ville-templates.ts` variant `focus_audit`
 * (supprimé en Phase 5 commit 1).
 */

import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import {
  DOCTRINE_INTOUCHABLE,
  runLandingVilleByVerticalPipeline,
  type VerticalConfig,
} from "./landing-ville-shared";

const CONFIG: VerticalConfig = {
  slug: "audits",
  label: "Audits IA d'optimisation (Module 2)",
  systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Verticale landing-ville : AUDITS (Module 2).
Pivote sur le Module 2 Audit & optimisation entreprise. Les autres modules
sont mentionnés en cross-sell discret (footer rappel offre intervention).

KPIs centraux : gain de temps mesurable, économies cachées identifiées,
optimisation main-d'œuvre. Tarifs Audit (TPE 290 € · PME 690 € · ETI 1290 €
à distance ; +200/300/700 € sur site).

Tone : analytique, ROI-focused, "diagnostic structuré, délai adapté à votre situation".
Sub-prompt complet : prompts/landing-ville.md megapack (variant audits).`,
  userPromptFocusSection: `## Focus AUDITS (Module 2)
Pivote sur l'audit IA d'optimisation. Tone diagnostic, ROI, gain temps/argent.
Mention : grille 4 tailles entreprise × 2 modalités (à distance / sur site).
CTA principal : /audit (formulaire 5 étapes → rapport avec délai adapté à votre situation).
Sections obligatoires : Hero audit · 4 tailles entreprise · ROI estimé · FAQ
audit × 8 · CTA audit final.`,
  recommendedCtaHref: "/audit",
  recommendedCtaLabel: "Demander un audit IA",
};

export const landingVilleByVerticalAuditsGenerator: Generator = {
  contentType: "landing_ville",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    return runLandingVilleByVerticalPipeline(input, CONFIG);
  },
};

export const LANDING_VILLE_BY_VERTICAL_AUDITS_CONFIG = CONFIG;
