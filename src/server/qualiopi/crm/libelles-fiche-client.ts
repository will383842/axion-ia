/**
 * Libellés VISIBLES de la fiche client qui dépendent de la certification (B4).
 * Même modèle que `qualiopi/devis/[id]/page.tsx` : le libellé d'origine
 * n'apparaît qu'une fois la certification obtenue.
 */
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

/** Titre du bloc de la branche. Sans certification : « Branche professionnelle ». */
export function libelleBlocBranche(): string {
  return isQualiopiCertificationObtenue() ? "Branche et OPCO" : "Branche professionnelle";
}

/** Titre d'onglet des pages client : « Qualiopi — … » une fois certifié, « Clients — … » avant. */
export function titreOngletClient(suite: string): string {
  return `${isQualiopiCertificationObtenue() ? "Qualiopi" : "Clients"} — ${suite} | Axion-IA Admin`;
}
