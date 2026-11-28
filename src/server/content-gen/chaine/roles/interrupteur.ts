/**
 * Interrupteurs de la chaîne éditoriale : TOUT est éteint par défaut (conception § 10, § 12).
 * Interrupteur général `CONTENT_CHAINE_EDITORIALE` et un interrupteur par rôle
 * `CONTENT_CHAINE_ROLE_<ROLE>`. Exactement « true », relu à chaque appel (comme
 * `CONTENT_GEN_BLOG_CLAUDE`). Aucun rôle n'est aujourd'hui branché sur la publication : l'orchestration
 * (C10) devra appeler `exigerChaineAllumee()` avant tout appel de rôle.
 */

import type { RoleChaine } from "./commun";

export const INTERRUPTEUR_CHAINE = "CONTENT_CHAINE_EDITORIALE";

export class ChaineEteinteError extends Error {
  constructor(message = "Chaîne éditoriale éteinte (interrupteur général)") {
    super(message);
    this.name = "ChaineEteinteError";
  }
}

export function chaineAllumee(): boolean {
  return process.env[INTERRUPTEUR_CHAINE] === "true";
}

export function exigerChaineAllumee(): void {
  if (!chaineAllumee()) throw new ChaineEteinteError();
}

/** Un rôle tourne seulement si l'interrupteur général ET le sien valent « true ». */
export function roleAllume(role: RoleChaine): boolean {
  return chaineAllumee() && process.env[`CONTENT_CHAINE_ROLE_${role.toUpperCase()}`] === "true";
}
