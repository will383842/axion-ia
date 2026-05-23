/**
 * Content Generator — Landing ville × verticale IMPLEMENTATIONS (Sprint v7 Phase 5 commit 1).
 *
 * Module 3 Axion-IA : implémentation IA entreprise (4 niveaux : automatisation
 * simple 990 €, projet intermédiaire 2 900 €, projet complet 5 900 €, IA Custom
 * 8-50 k€). Tone : technique mais accessible, deliverables concrets.
 *
 * Migration depuis `landing-ville-templates.ts` variant `focus_implementation`
 * (supprimé en Phase 5 commit 1).
 */

import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import {
  DOCTRINE_INTOUCHABLE,
  runLandingVilleByVerticalPipeline,
  type VerticalConfig,
} from "./landing-ville-shared";

const CONFIG: VerticalConfig = {
  slug: "implementations",
  label: "Implémentations IA (Module 3)",
  systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Verticale landing-ville : IMPLEMENTATIONS (Module 3).
Pivote sur le Module 3 Implémentation IA entreprise. Couvre les 4 niveaux :
automatisation simple (à partir 990 €), projet intermédiaire (à partir 2 900 €),
projet complet (à partir 5 900 €), IA custom (8 000-50 000 € — service premium).

KPIs centraux : déploiement effectif, agents IA en production, CRM/ERP intégré,
chatbot opérationnel. Délai de livraison annoncé (1-12 semaines selon niveau).

Tone : technique mais accessible, deliverables concrets, "code livré + maintenance".
Sub-prompt complet : prompts/landing-ville.md megapack (variant implementations).`,
  userPromptFocusSection: `## Focus IMPLEMENTATIONS (Module 3)
Pivote sur l'implémentation IA. Tone technique accessible, deliverables concrets.
Présente les 4 niveaux : automatisation simple 990 €, projet intermédiaire
2 900 €, projet complet 5 900 €, IA Custom 8-50k €. Mention service premium.
CTA principal : /implementation (formulaire 4 étapes → étude personnalisée).
Sections obligatoires : Hero implémentation · 4 niveaux · cas concret IA Custom
local · FAQ technique × 8 · CTA implementation final.`,
  recommendedCtaHref: "/implementation",
  recommendedCtaLabel: "Démarrer une implémentation IA",
};

export const landingVilleByVerticalImplementationsGenerator: Generator = {
  contentType: "landing_ville",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    return runLandingVilleByVerticalPipeline(input, CONFIG);
  },
};

export const LANDING_VILLE_BY_VERTICAL_IMPLEMENTATIONS_CONFIG = CONFIG;
