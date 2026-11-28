/**
 * Remplissage du registre des intentions depuis la carte des requêtes (§ 7.1) : fonction PURE.
 * Une requête déjà servie par une URL propriétaire est `couverte` ; les autres n'entrent PAS
 * ici (une intention `libre` naît d'un brief, pas de la carte). L'écriture en base est un
 * autre lot : cette fonction ne touche aucune table.
 */

import type { CarteRequetes } from "../strategie/carte-requetes";
import { normaliserRequete } from "../strategie/carte-requetes";

export interface LigneRegistreAEcrire {
  readonly requeteNormalisee: string;
  readonly pageProprietaire: string;
  readonly etat: "couverte";
  readonly source: "carte_requetes";
}

export function lignesDepuisCarte(carte: CarteRequetes): ReadonlyArray<LigneRegistreAEcrire> {
  return [...carte.carte.entries()]
    .filter(([requete, url]) => requete.length > 0 && url.length > 0)
    .map(([requete, url]) => ({
      requeteNormalisee: requete.slice(0, 300),
      pageProprietaire: url.slice(0, 500),
      etat: "couverte" as const,
      source: "carte_requetes" as const,
    }))
    .sort((a, b) => a.requeteNormalisee.localeCompare(b.requeteNormalisee));
}

/** Clé de recherche au registre : même normalisation que la carte (une seule règle). */
export const cleIntention = (requete: string): string => normaliserRequete(requete).slice(0, 300);
