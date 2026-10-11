/**
 * Pièces qu'un administrateur peut contresigner D'UN GESTE (lot S6a, i).
 *
 * Module pur, adossé au SSOT des circuits : une pièce est contresignable quand
 * l'organisme figure à son circuit, n'a pas encore signé, et que TOUTES les
 * parties placées avant lui ont signé — la même règle que la garde d'ordre de
 * `contresignerPieceAction`, qui la revérifie de toute façon pièce par pièce.
 * Ce module ne fait que choisir quoi PROPOSER à l'écran.
 */

import { circuitPour } from "./parties-requises";

export function estContresignable(type: string, partiesSignees: readonly string[]): boolean {
  const circuit = circuitPour(type);
  if (circuit === null) return false;
  const rang = circuit.parties.indexOf("axionia");
  if (rang < 0 || partiesSignees.includes("axionia")) return false;
  return circuit.parties.slice(0, rang).every((p) => partiesSignees.includes(p));
}
