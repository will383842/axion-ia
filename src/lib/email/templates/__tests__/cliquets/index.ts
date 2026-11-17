/**
 * Registre des cliquets par groupe (lot S1). Écrit une fois : chaque fiche de migration
 * n'édite que son fichier `gN.ts`. Voir `PLAN-STRUCTURE-ACCUSES.md` §2.3 et §2.4.
 */

import type { EmailJobName } from "@/server/queue/types";
import type { Regle } from "../regles-chassis";
import { GROUPE_G1 } from "./g1";
import { GROUPE_G2 } from "./g2";
import { GROUPE_G3 } from "./g3";
import { GROUPE_G4 } from "./g4";
import { GROUPE_G5 } from "./g5";
import { GROUPE_G6 } from "./g6";
import { GROUPE_G7 } from "./g7";
import { GROUPE_G8 } from "./g8";
import { GROUPE_G9 } from "./g9";

export interface GroupeCliquet {
  /** Les `EmailJobName` du groupe. */
  readonly gabarits: readonly EmailJobName[];
  /** Pour chaque règle, les gabarits du groupe qui la violent aujourd'hui. */
  readonly dettes: Readonly<Record<Regle, readonly string[]>>;
  /** Durées en dur justifiées par une constante : exemptées de `delaiEnDur`. */
  readonly exceptionsDurees: readonly { gabarit: string; constante: string }[];
}

export const GROUPES: Readonly<Record<string, GroupeCliquet>> = {
  G1: GROUPE_G1,
  G2: GROUPE_G2,
  G3: GROUPE_G3,
  G4: GROUPE_G4,
  G5: GROUPE_G5,
  G6: GROUPE_G6,
  G7: GROUPE_G7,
  G8: GROUPE_G8,
  G9: GROUPE_G9,
};

/**
 * G-preheader — les gabarits dont le pré-en-tête commence aujourd'hui par une salutation
 * (mesuré le 2026-11-17). Ce sont les deux gabarits qui recopient le DÉBUT d'un texte saisi
 * par une personne : le pré-en-tête est alors son « Bonjour, … ». Aucun autre gabarit n'est
 * concerné. Comme un cliquet : égalité des ensembles, la liste ne fait que diminuer.
 */
export const PREHEADER_DEPUIS_TEXTE_LIBRE: readonly EmailJobName[] = [
  "submission-reply",
  "candidature-reponse",
];
