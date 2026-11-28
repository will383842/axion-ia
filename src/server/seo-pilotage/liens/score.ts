/**
 * S10-1 · Score d'une occasion de lien (§ 4.2). Module PUR.
 *
 * score = pertinence × portée × probabilité / effort, chaque terme de 1 à 3.
 * Le score est calculé, jamais saisi. Une opposition le rend nul.
 */
export type Note = 1 | 2 | 3;
export type CanalContact =
  "formulaire_public" | "adresse_generique" | "adresse_nominative" | "aucun";

export interface EntreesScore {
  readonly pertinence: number;
  readonly portee: number;
  readonly probabilite: number;
  readonly effort: number;
  readonly opposition?: boolean;
}

function verifier(nom: string, v: number): void {
  if (!Number.isInteger(v) || v < 1 || v > 3) {
    throw new RangeError(`${nom} doit être un entier de 1 à 3 (reçu : ${String(v)})`);
  }
}

export function calculerScore(e: EntreesScore): number {
  if (e.opposition) return 0;
  verifier("pertinence", e.pertinence);
  verifier("portee", e.portee);
  verifier("probabilite", e.probabilite);
  verifier("effort", e.effort);
  return Math.round(((e.pertinence * e.portee * e.probabilite) / e.effort) * 100) / 100;
}

/** 3 si le domaine nous cite déjà, 2 si une rubrique accepte les propositions, 1 sinon. */
export function probabiliteSelonContexte(c: {
  readonly citeDeja: boolean;
  readonly rubriqueAccepte: boolean;
}): Note {
  if (c.citeDeja) return 3;
  return c.rubriqueAccepte ? 2 : 1;
}

/** 1 formulaire public, 2 proposition à rédiger, 3 contenu à produire (aucun canal). */
export function effortSelonCanal(canal: CanalContact): Note {
  if (canal === "formulaire_public") return 1;
  return canal === "aucun" ? 3 : 2;
}
