/**
 * L'identité d'un contact (civilité facultative, prénom, nom de famille),
 * rangée dans `Submission.details.identite` — SANS migration.
 *
 * `Submission.contactName` reste « Prénom Nom » chiffré : plus de trente
 * consommateurs le lisent. Cette clé ne sert qu'à la salutation des accusés
 * (et plus tard à la console).
 *
 * Données de personnes : le prénom et le nom sont chiffrés (`encryptPii`) ;
 * la civilité (« madame » / « monsieur ») ne permet pas d'identifier quelqu'un
 * et reste en clair. La clé `identite` suit la demande : son effacement
 * (corbeille définitive, RGPD) la supprime avec `details`.
 *
 * Lecture TOLÉRANTE : clé absente (ancienne demande), forme inattendue, clé de
 * chiffrement absente (`PII_DECRYPT_PLACEHOLDER`) ou valeur illisible → `null`.
 * Une valeur chiffrée ne doit jamais finir dans un bonjour.
 */

import { decryptPii, encryptPii, PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { normaliserCivilite, type CiviliteSalutation } from "@/lib/email/salutation";

/** Clé de `Submission.details` qui porte l'identité. */
export const CLE_IDENTITE = "identite";

export interface IdentiteContact {
  civilite: CiviliteSalutation | null;
  prenom: string | null;
  nomFamille: string | null;
}

/** Le contenu à ranger sous `details.identite` : prénom et nom chiffrés. */
export function identitePourDetails(i: {
  civilite?: CiviliteSalutation;
  prenom: string;
  nomFamille: string;
}): Record<string, string> {
  return {
    ...(i.civilite ? { civilite: i.civilite } : {}),
    prenom: encryptPii(i.prenom),
    nomFamille: encryptPii(i.nomFamille),
  };
}

function lireChiffre(v: unknown): string | null {
  if (typeof v !== "string" || v.length === 0) return null;
  try {
    const clair = decryptPii(v);
    if (typeof clair !== "string" || clair === "" || clair === PII_DECRYPT_PLACEHOLDER) return null;
    return clair;
  } catch {
    return null;
  }
}

/** Relit `details.identite` (déchiffrée). Ne lève jamais. */
export function lireIdentiteDetails(details: unknown): IdentiteContact {
  const vide: IdentiteContact = { civilite: null, prenom: null, nomFamille: null };
  if (!details || typeof details !== "object" || Array.isArray(details)) return vide;
  const brut = (details as Record<string, unknown>)[CLE_IDENTITE];
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return vide;
  const o = brut as Record<string, unknown>;
  return {
    civilite: normaliserCivilite(o["civilite"]),
    prenom: lireChiffre(o["prenom"]),
    nomFamille: lireChiffre(o["nomFamille"]),
  };
}
