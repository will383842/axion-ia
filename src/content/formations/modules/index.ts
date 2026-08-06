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

import { IA_POUR_BIEN_COMMENCER } from "./ia-pour-bien-commencer";
import { IA_POUR_BIEN_COMMENCER_JOURNEE } from "./ia-pour-bien-commencer-journee";
import { IA_POUR_LA_BANQUE_ASSURANCE } from "./ia-pour-la-banque-assurance";
import { IA_POUR_LE_COMMERCE } from "./ia-pour-le-commerce";
import { IA_POUR_L_HOTELLERIE_RESTAURATION } from "./ia-pour-l-hotellerie-restauration";
import { IA_POUR_L_IMMOBILIER } from "./ia-pour-l-immobilier";
import { IA_POUR_LA_SANTE } from "./ia-pour-la-sante";
import { IA_POUR_LE_BTP } from "./ia-pour-le-btp";
import { IA_POUR_LE_JURIDIQUE } from "./ia-pour-le-juridique";
import { IA_POUR_LES_ACHATS } from "./ia-pour-les-achats";
import { IA_POUR_LA_FINANCE } from "./ia-pour-la-finance";
import { IA_POUR_LES_COMMERCIAUX } from "./ia-pour-les-commerciaux";
import { IA_POUR_LE_MARKETING } from "./ia-pour-le-marketing";
import { IA_POUR_LA_RELATION_CLIENT } from "./ia-pour-la-relation-client";
import { IA_POUR_LES_EQUIPES } from "./ia-pour-les-equipes";
import { IA_POUR_LES_RH } from "./ia-pour-les-rh";
import type { EnrichissementFormation } from "./types";

export type { EnrichissementFormation, EnrichissementModule } from "./types";

/** Slug de formation → contenu rédigé de ses modules. */
export const ENRICHISSEMENTS: Readonly<Record<string, EnrichissementFormation>> = {
  "ia-pour-bien-commencer": IA_POUR_BIEN_COMMENCER,
  "ia-pour-bien-commencer-journee": IA_POUR_BIEN_COMMENCER_JOURNEE,
  "ia-pour-la-banque-assurance": IA_POUR_LA_BANQUE_ASSURANCE,
  "ia-pour-le-commerce": IA_POUR_LE_COMMERCE,
  "ia-pour-l-hotellerie-restauration": IA_POUR_L_HOTELLERIE_RESTAURATION,
  "ia-pour-l-immobilier": IA_POUR_L_IMMOBILIER,
  "ia-pour-la-sante": IA_POUR_LA_SANTE,
  "ia-pour-le-btp": IA_POUR_LE_BTP,
  "ia-pour-le-juridique": IA_POUR_LE_JURIDIQUE,
  "ia-pour-les-achats": IA_POUR_LES_ACHATS,
  "ia-pour-la-finance": IA_POUR_LA_FINANCE,
  "ia-pour-la-relation-client": IA_POUR_LA_RELATION_CLIENT,
  "ia-pour-le-marketing": IA_POUR_LE_MARKETING,
  "ia-pour-les-commerciaux": IA_POUR_LES_COMMERCIAUX,
  "ia-pour-les-equipes": IA_POUR_LES_EQUIPES,
  "ia-pour-les-rh": IA_POUR_LES_RH,
};

/** Contenu rédigé d'une formation, ou `undefined` si elle n'en a pas encore. */
export function enrichissementDe(slug: string): EnrichissementFormation | undefined {
  return ENRICHISSEMENTS[slug];
}
