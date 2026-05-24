/**
 * Content Generator — Landing ville DISPATCHER (Sprint v7 Phase 5 commit 1).
 *
 * Avant Phase 5 : ce fichier contenait l'intégralité du pipeline + lookup
 * variants dans `landing-ville-templates.ts` (4 variants tactiques).
 *
 * Depuis Phase 5 : le pipeline est extrait dans `landing-ville-shared.ts`
 * (`runLandingVilleByVerticalPipeline`) et 5 generators verticaux dédiés
 * (`landing-ville-by-vertical-*.ts`) appellent ce pipeline avec leur
 * `VerticalConfig`. Ce fichier devient un dispatcher minimal qui résout
 * `input.templateVariant` → vertical slug → generator vertical.
 *
 * Compat historique : les 4 anciens variants (`default`, `focus_audit`,
 * `focus_interventions`, `focus_implementation`) restent acceptés et sont
 * mappés vers les nouvelles verticales pour ne pas casser les jobs en cours
 * de queue au moment du déploiement.
 */

import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import type { LandingVilleVerticalSlug } from "./landing-ville-shared";
import { LANDING_VILLE_VERTICAL_SLUGS } from "./landing-ville-shared";
import { landingVilleByVerticalInterventionsGenerator } from "./landing-ville-by-vertical-interventions";
import { landingVilleByVerticalAuditsGenerator } from "./landing-ville-by-vertical-audits";
import { landingVilleByVerticalImplementationsGenerator } from "./landing-ville-by-vertical-implementations";
import { landingVilleByVerticalUnAUnGenerator } from "./landing-ville-by-vertical-un-a-un";
import { landingVilleByVerticalSitesWebIaGenerator } from "./landing-ville-by-vertical-sites-web-ia";

/**
 * Registry strict {slug → generator} pour les 5 verticales métier.
 * Consommé par le dispatcher ci-dessous et exporté pour usages avancés
 * (tests, admin /content-gen/landing-variants, dispatch ad-hoc Session 6).
 */
export const LANDING_VILLE_BY_VERTICAL_REGISTRY: Record<LandingVilleVerticalSlug, Generator> = {
  interventions: landingVilleByVerticalInterventionsGenerator,
  audits: landingVilleByVerticalAuditsGenerator,
  implementations: landingVilleByVerticalImplementationsGenerator,
  "un-a-un": landingVilleByVerticalUnAUnGenerator,
  "sites-web-ia": landingVilleByVerticalSitesWebIaGenerator,
};

/**
 * Mapping rétro-compatible 4 anciens variants → 5 verticales Phase 5.
 * Permet de continuer à traiter sans erreur les jobs en queue dont
 * `templateVariant` provient de l'ancien `landing-ville-templates.ts`.
 *
 * Stratégie :
 *   - "default"              → "interventions" (Essentielle 490 € = offre phare)
 *   - "focus_audit"          → "audits"
 *   - "focus_interventions"  → "interventions"
 *   - "focus_implementation" → "implementations"
 */
const LEGACY_VARIANT_TO_VERTICAL: Record<string, LandingVilleVerticalSlug> = {
  default: "interventions",
  focus_audit: "audits",
  focus_interventions: "interventions",
  focus_implementation: "implementations",
};

/**
 * Résout `templateVariant` → vertical slug. Fallback `interventions` si
 * absent ou inconnu (offre phare Essentielle 490 €).
 */
export function resolveLandingVilleVertical(
  templateVariant: string | null | undefined,
): LandingVilleVerticalSlug {
  if (!templateVariant) return "interventions";
  if ((LANDING_VILLE_VERTICAL_SLUGS as ReadonlyArray<string>).includes(templateVariant)) {
    return templateVariant as LandingVilleVerticalSlug;
  }
  return LEGACY_VARIANT_TO_VERTICAL[templateVariant] ?? "interventions";
}

/**
 * Generator `landing_ville` exposé via le registry standard (`index.ts`).
 * Dispatch vers le bon generator vertical selon `input.templateVariant`.
 */
export const landingVilleGenerator: Generator = {
  contentType: "landing_ville",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const vertical = resolveLandingVilleVertical(input.templateVariant);
    return LANDING_VILLE_BY_VERTICAL_REGISTRY[vertical].generate(input);
  },
};
