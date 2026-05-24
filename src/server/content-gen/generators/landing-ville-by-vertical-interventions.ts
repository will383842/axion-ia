/**
 * Content Generator — Landing ville × verticale INTERVENTIONS (Sprint v7 Phase 5 commit 1).
 *
 * Module 1 Axion-IA : interventions terrain entreprise (5 types : Essentielle 490 €,
 * Équipes 1h/jour, Managers réduction coûts, Conférence dirigeants, CODIR).
 * Tone : opérationnel terrain, "résultats immédiats sans théorie".
 *
 * Migration depuis `landing-ville-templates.ts` variant `focus_interventions`
 * (supprimé en Phase 5 commit 1).
 */

import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import {
  DOCTRINE_INTOUCHABLE,
  runLandingVilleByVerticalPipeline,
  type VerticalConfig,
} from "./landing-ville-shared";

const CONFIG: VerticalConfig = {
  slug: "interventions",
  label: "Interventions terrain (Module 1)",
  systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Verticale landing-ville : INTERVENTIONS (Module 1).
Pivote sur les interventions entreprise. Les 5 types d'interventions sont présentés
(Essentielle 490 €, Équipes 1h/jour, Managers réduction coûts, Conférence dirigeants,
CODIR entreprise IA).

KPIs centraux : intervention sur site, dès le lendemain, opérationnelle.
Tarif phare Essentielle 490 € HT (mention systématique).

Tone : opérationnel, terrain, "résultats immédiats sans théorie".
Sub-prompt complet : prompts/landing-ville.md megapack (variant interventions).`,
  userPromptFocusSection: `## Focus INTERVENTIONS (Module 1)
Pivote sur les interventions entreprise. Tone opérationnel terrain.
Présente les 5 types : Essentielle (490 €), Équipes 1h/jour, Managers
réduction coûts, Conférence dirigeants, CODIR entreprise IA.
CTA principal : /interventions/essentielle (offre phare 490 €).
Sections obligatoires : Hero intervention · 5 types · cas concret local
post-intervention · FAQ × 8 · CTA Essentielle final.`,
  recommendedCtaHref: "/interventions/essentielle",
  recommendedCtaLabel: "Réserver l'intervention Essentielle · 490 €",
};

export const landingVilleByVerticalInterventionsGenerator: Generator = {
  contentType: "landing_ville",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    return runLandingVilleByVerticalPipeline(input, CONFIG);
  },
};

export const LANDING_VILLE_BY_VERTICAL_INTERVENTIONS_CONFIG = CONFIG;
