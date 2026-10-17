/**
 * L09 — le cycle d'une réclamation (indicateur 31), en fonctions PURES.
 *
 * Les étapes vivent dans `reclamation_etapes`, en ajout seul (déclencheur du
 * socle) : réception → accusé → analyse → réponse → (réexamen → analyse →
 * réponse)* → clôture. Ce module dit quelle étape peut suivre, et quel statut
 * de la réclamation en découle. Le statut n'est plus qu'un RÉSUMÉ de la
 * dernière étape : la preuve, c'est le journal.
 */

import type { EtapeCode } from "./echeances";

export const ETAPES_RECLAMATION = [
  "reception",
  "accuse",
  "analyse",
  "reponse",
  "reexamen",
  "cloture",
] as const satisfies ReadonlyArray<EtapeCode>;

export const LIBELLE_ETAPE: Readonly<Record<EtapeCode, string>> = {
  reception: "Réception",
  accuse: "Accusé de réception",
  analyse: "Analyse",
  reponse: "Réponse écrite",
  reexamen: "Réexamen",
  cloture: "Clôture",
};

export type StatutReclamation = "nouvelle" | "en_cours" | "resolue" | "cloturee";

/** Le statut qu'une étape donne à la réclamation (`null` = inchangé). */
export const STATUT_APRES_ETAPE: Readonly<Record<EtapeCode, StatutReclamation | null>> = {
  reception: "nouvelle",
  accuse: null,
  analyse: "en_cours",
  reponse: "resolue",
  reexamen: "en_cours",
  cloture: "cloturee",
};

/** Longueur minimale d'un contenu d'étape écrit à la main (analyse, réponse…). */
export const CONTENU_MIN = 10;

/** La dernière étape de TRAITEMENT (l'accusé n'en est pas une : il s'ajoute à tout moment). */
function derniereEtapeDeTraitement(etapes: ReadonlyArray<EtapeCode>): EtapeCode | null {
  for (let i = etapes.length - 1; i >= 0; i -= 1) {
    const e = etapes[i];
    if (e !== undefined && e !== "accuse") return e;
  }
  return null;
}

/**
 * Pure : les étapes que l'on peut ajouter maintenant, dans l'ordre d'affichage.
 * `reception` n'est jamais proposée : elle naît avec la réclamation.
 */
export function etapesPossibles(etapes: ReadonlyArray<EtapeCode>): EtapeCode[] {
  const derniere = derniereEtapeDeTraitement(etapes);
  if (derniere === null) return [];
  const possibles: EtapeCode[] = [];
  if (!etapes.includes("accuse") && derniere !== "cloture") possibles.push("accuse");
  switch (derniere) {
    case "reception":
      // Clôture directe : un dépôt irrecevable (spam, hors sujet) ne force pas
      // une analyse et une réponse signée. Le motif « irrecevable » est
      // obligatoire et consigné (cycle-service) ; rien n'est supprimé.
      possibles.push("analyse", "cloture");
      break;
    case "reexamen":
      possibles.push("analyse");
      break;
    case "analyse":
      possibles.push("analyse", "reponse");
      break;
    case "reponse":
      possibles.push("reexamen", "cloture");
      break;
    case "cloture":
      possibles.push("reexamen");
      break;
    case "accuse":
      break;
  }
  return possibles;
}

export type VerdictEtape =
  { ok: true; statut: StatutReclamation | null } | { ok: false; erreur: string };

/** Pure : peut-on ajouter CETTE étape, et quel statut en découle ? */
export function verifierEtape(etapes: ReadonlyArray<EtapeCode>, etape: EtapeCode): VerdictEtape {
  if (etape === "reception") {
    return { ok: false, erreur: "La réception naît avec la réclamation : elle ne s'ajoute pas." };
  }
  if (!etapesPossibles(etapes).includes(etape)) {
    const derniere = derniereEtapeDeTraitement(etapes);
    const apres = derniere === null ? "aucune étape" : `« ${LIBELLE_ETAPE[derniere]} »`;
    return {
      ok: false,
      erreur: `« ${LIBELLE_ETAPE[etape]} » ne peut pas suivre ${apres}.`,
    };
  }
  return { ok: true, statut: STATUT_APRES_ETAPE[etape] };
}
