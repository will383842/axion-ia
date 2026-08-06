/**
 * Registre des contenus pédagogiques rédigés, par slug de formation.
 *
 * Une formation absente de ce registre reste parfaitement valide : elle a son
 * programme minuté, sa fiche publique et son programme opposable. Il lui manque
 * la matière des documents — et le diagnostic le dit module par module, plutôt
 * que de laisser un support sortir à moitié vide sans que rien ne le signale.
 *
 * Pour ajouter une formation : écrire `<slug>.ts` sur le modèle de
 * `ia-pour-les-rh.ts`, puis l'inscrire ici. `enrichissements.spec.ts` refusera
 * tout `moduleId` qui ne correspond à aucun module du catalogue.
 */

import { IA_POUR_LES_RH } from "./ia-pour-les-rh";
import type { EnrichissementFormation } from "./types";

export type { EnrichissementFormation, EnrichissementModule } from "./types";

/** Slug de formation → contenu rédigé de ses modules. */
export const ENRICHISSEMENTS: Readonly<Record<string, EnrichissementFormation>> = {
  "ia-pour-les-rh": IA_POUR_LES_RH,
};

/** Contenu rédigé d'une formation, ou `undefined` si elle n'en a pas encore. */
export function enrichissementDe(slug: string): EnrichissementFormation | undefined {
  return ENRICHISSEMENTS[slug];
}
