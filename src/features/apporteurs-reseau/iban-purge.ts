// PR N (#2464 pt 6) : un IBAN purgé vaut « pas d'IBAN ». Aucun `server-only` (lu aussi par le worker).
//
// La purge RGPD remplace l'IBAN chiffré des tables d'historique et de demandes par le marqueur « purge »
// (empreinte et quatre derniers caractères gardés) et met `null` sur la fiche. Tout lecteur qui déchiffre un
// IBAN passe par ici : jamais d'erreur de déchiffrement ni d'IBAN fantôme sur une ligne purgée.
import { decryptPii } from "@/lib/pii-crypto";

export const MARQUEUR_IBAN_PURGE = "purge";

/** Vrai si la valeur stockée ne porte aucun IBAN : absente, vide ou purgée. */
export function ibanPurgeOuAbsent(valeur: string | null | undefined): boolean {
  return valeur == null || valeur === "" || valeur === MARQUEUR_IBAN_PURGE;
}

/** L'IBAN en clair, ou `null` quand il est absent ou purgé. */
export function lireIbanClair(
  valeur: string | null | undefined,
  options?: Parameters<typeof decryptPii>[1],
): string | null {
  if (ibanPurgeOuAbsent(valeur)) return null;
  return decryptPii(valeur as string, options) ?? null;
}
