/**
 * L09 — règles PURES du dépôt public d'une réclamation (partagées par l'action
 * serveur, le formulaire et leurs tests).
 */

import type { EtatInterrupteur } from "@/server/qualiopi/socle/interrupteurs";

/** Les qualités proposées au dépôt (indicateur 31 : toutes les parties prenantes). */
export const QUALITES_DEPOT = [
  "stagiaire",
  "entreprise",
  "formateur",
  "financeur",
  "autre",
] as const;
export type QualiteDepot = (typeof QUALITES_DEPOT)[number];

export const LIBELLE_QUALITE_DEPOT: Readonly<Record<QualiteDepot, string>> = {
  stagiaire: "Stagiaire (participant à une formation)",
  entreprise: "Entreprise cliente ou employeur",
  formateur: "Formateur ou intervenant",
  financeur: "Financeur (OPCO, France Travail…)",
  autre: "Autre",
};

/**
 * Le seul message de refus, quel que soit le motif (fermé, essai hors banc) :
 * la réponse ne doit rien apprendre à qui sonde la route.
 */
export const MESSAGE_REFUS_DEPOT =
  "Le dépôt en ligne n'est pas disponible pour le moment. Vous pouvez adresser votre réclamation par écrit, comme l'indique notre procédure de réclamation.";

/** Pure : le formulaire accepte-t-il un dépôt ? */
export function formulaireOuvert(
  etat: EtatInterrupteur,
  contexte: { readonly inscriptionDeTest: boolean },
): boolean {
  if (etat === "actif") return true;
  if (etat === "essai") return contexte.inscriptionDeTest;
  return false;
}

const CONTROLE_LIGNE = /[\u0000-\u001F\u007F]/g;
const CONTROLE_TEXTE_LONG = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Retire les caractères de contrôle (et, hors texte long, les sauts de ligne),
 * puis les espaces de bord. `undefined` reste `undefined`.
 */
export function nettoyerTexte(valeur: string | undefined, multiligne = false): string | undefined {
  if (valeur === undefined) return undefined;
  return multiligne
    ? valeur.replace(CONTROLE_TEXTE_LONG, "").trim()
    : valeur.replace(CONTROLE_LIGNE, " ").trim();
}

/** Pure : l'adresse sous la forme qui sert de clé de limite (partie locale coupée au premier « + »). */
export function cleLimiteAdresse(email: string): string {
  const normalisee = email.trim().toLowerCase();
  const arobase = normalisee.lastIndexOf("@");
  if (arobase < 0) return normalisee;
  return `${normalisee.slice(0, arobase).split("+")[0]}${normalisee.slice(arobase)}`;
}
