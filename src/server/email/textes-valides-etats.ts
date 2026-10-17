/**
 * Registre « texte validé » — la partie PURE de la lecture (FAC-1, lot 8A #1510-1).
 *
 * Un texte FORMATEUR n'est validé que si sa ligne porte l'EMPREINTE du texte actuel ;
 * les autres gardent leur règle (`{ valide: true }` suffit). Sans Prisma : importable
 * par un module pur (préalables d'allumage) et par les fixtures du banc. La lecture en
 * base reste `textes-valides-lecture.ts`.
 */

import { empreinteAttendue } from "./textes-formateurs-a-valider";
import {
  lireEmpreinte,
  textesValidesDepuisLignes,
  type RegistreTextesValides,
} from "./textes-valides";

export interface EtatsTextes {
  readonly valides: RegistreTextesValides;
  /** Validés sur un AUTRE texte que l'actuel (ou sans empreinte) : la validation est tombée. */
  readonly aRevalider: ReadonlySet<string>;
}

/** Pur : sépare les validations encore justes de celles que le texte a dépassées. */
export function etatsTextesDepuisLignes(
  lignes: ReadonlyArray<{ key: string; value: unknown }>,
): EtatsTextes {
  const parCle = new Map(lignes.map((l) => [l.key, l.value]));
  const valides = new Set<string>();
  const aRevalider = new Set<string>();
  for (const cle of textesValidesDepuisLignes(lignes)) {
    const attendue = empreinteAttendue(cle);
    if (attendue === null || lireEmpreinte(parCle.get(cle)) === attendue) valides.add(cle);
    else aRevalider.add(cle);
  }
  return { valides, aRevalider };
}
