/**
 * Fabrique de faits FICTIFS pour les tests du dossier client. Aucune donnée
 * réelle : le dépôt est public.
 */

import type { FaitAConsolider } from "@/features/dossier-client/consolider-faits";

let n = 0;

export const JOUR = 24 * 60 * 60 * 1000;
export const MAINTENANT = new Date("2026-10-02T09:00:00Z");

export function ilYA(jours: number): Date {
  return new Date(MAINTENANT.getTime() - jours * JOUR);
}

export function fait(
  partiel: Partial<FaitAConsolider> & Pick<FaitAConsolider, "type">,
): FaitAConsolider {
  n += 1;
  return {
    id: `f-${String(n).padStart(4, "0")}`,
    cle: "global",
    portee: "entreprise",
    projetId: null,
    statut: "valide",
    suivi: null,
    enonce: "",
    texteCourt: null,
    montantMinCents: null,
    montantMaxCents: null,
    dateCible: null,
    quantite: null,
    refCatalogue: null,
    constateLe: ilYA(10),
    citationDebutMs: null,
    rencontreId: null,
    contactSujetId: null,
    relation: null,
    relationAvecFaitId: null,
    remplaceParId: null,
    ...partiel,
  };
}

/** Un fait rangé dans un projet. */
export function faitProjet(
  projetId: string,
  partiel: Partial<FaitAConsolider> & Pick<FaitAConsolider, "type">,
): FaitAConsolider {
  return fait({ portee: "projet", projetId, ...partiel });
}
