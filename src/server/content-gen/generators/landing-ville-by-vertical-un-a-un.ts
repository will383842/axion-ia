/**
 * Content Generator — Landing ville × verticale UN-A-UN (Sprint v7 Phase 5 commit 1).
 *
 * Module 4 Axion-IA : accompagnement individuel 1-to-1 (dirigeants, fondateurs,
 * cadres) pour montée en compétence IA personnelle. Sessions individuelles,
 * agenda flexible, confidentialité (NDA optionnel). Pricing à la séance ou
 * forfait trimestriel.
 *
 * Nouveau generator Phase 5 — aucun équivalent variant dans l'ancien
 * `landing-ville-templates.ts`. Aligné sur le positionnement 5 verticales métier
 * (cf. brand.ts + memory `axionia_positionnement_4_verticales`).
 */

import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import {
  DOCTRINE_INTOUCHABLE,
  runLandingVilleByVerticalPipeline,
  type VerticalConfig,
} from "./landing-ville-shared";

const CONFIG: VerticalConfig = {
  slug: "un-a-un",
  label: "Accompagnement 1-to-1 (Module 4)",
  systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Verticale landing-ville : UN-A-UN (Module 4).
Pivote sur l'accompagnement individuel 1-to-1 (dirigeants, fondateurs, cadres
décisionnaires). Sessions individuelles confidentielles, agenda flexible,
adaptation 100 % au profil et aux enjeux métier du bénéficiaire.

KPIs centraux : transfert de compétences durable, autonomie IA personnelle,
confidentialité stratégique (NDA possible). Pricing : à la séance ou forfait
trimestriel (cf. /1-to-1 SSOT tarifs — placeholder en attente validation Will).

Tone : confidentiel, sur-mesure, "votre IA opérationnelle, à votre rythme".
Mention systématique : disponibilité visio + présentiel sur site dirigeant.
Sub-prompt complet : prompts/landing-ville.md megapack (variant un-a-un).`,
  userPromptFocusSection: `## Focus UN-A-UN (Module 4)
Pivote sur l'accompagnement individuel 1-to-1. Tone confidentiel sur-mesure.
Présente le format : sessions individuelles (visio ou présentiel), agenda
flexible, confidentialité stratégique, transfert compétences durable.
CTA principal : /1-to-1 (formulaire profil → proposition personnalisée).
Sections obligatoires : Hero 1-to-1 · format sessions · cas concret dirigeant
local (anonymisable) · FAQ confidentialité/pricing × 8 · CTA 1-to-1 final.`,
  recommendedCtaHref: "/1-to-1",
  recommendedCtaLabel: "Réserver un accompagnement 1-to-1",
};

export const landingVilleByVerticalUnAUnGenerator: Generator = {
  contentType: "landing_ville",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    return runLandingVilleByVerticalPipeline(input, CONFIG);
  },
};

export const LANDING_VILLE_BY_VERTICAL_UN_A_UN_CONFIG = CONFIG;
