/**
 * Pièces dont la conclusion ENGAGE l'action de formation (lot S6a, g).
 *
 * C'est le moment exact où le positionnement doit partir et où la lettre de
 * mission du formateur devient due : avant, on ne sait pas encore si l'action
 * aura lieu ; après, c'est un oubli qui coûte l'indicateur 8.
 *
 * 🔴 Liste FERMÉE, et c'est délibéré. Le devis n'y figure pas — un accord
 * commercial n'engage pas encore une formation. Le mandat OPCO non plus : il
 * autorise un dépôt, il ne conclut rien. Ajouter un type ici déclenche des
 * envois aux stagiaires : c'est une décision, pas un réglage.
 */

export const PIECES_ENGAGEANTES = ["convention", "convention_tripartite", "contrat"] as const;

export type PieceEngageante = (typeof PIECES_ENGAGEANTES)[number];

const ENSEMBLE: ReadonlySet<string> = new Set(PIECES_ENGAGEANTES);

export function estPieceEngageante(type: string): type is PieceEngageante {
  return ENSEMBLE.has(type);
}
