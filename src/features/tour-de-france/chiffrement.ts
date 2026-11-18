/**
 * Tour France IA : chiffrer les coordonnées d'une demande, et fabriquer les empreintes de comptage
 * (PR-2a).
 *
 * 1. Nom, e-mail et téléphone sont chiffrés (`encryptPii`, IV aléatoire) avec la clé EXIGÉE (aucun
 *    repli en clair : sans `PII_ENCRYPTION_KEY`, l'écriture échoue au lieu de stocker en clair) et
 *    une donnée authentifiée propre au champ (`tour_demandes:<champ>`) : un chiffré recopié d'une
 *    colonne dans une autre ne se déchiffre plus.
 * 2. Les clés de comptage (une demande par personne, par entreprise, par téléphone) ne contiennent
 *    plus rien de lisible : ce sont des HMAC. La clé du HMAC est dérivée de `PII_ENCRYPTION_KEY`
 *    comme celle de `hashEmailForLookup` (aucun nouveau secret à poser), avec un libellé de domaine
 *    DIFFÉRENT par type de clé : l'empreinte d'un téléphone ne peut pas être confondue avec celle
 *    d'une adresse. Sans la clé du serveur, une copie de la base ne permet pas de retrouver un
 *    numéro ou une adresse à partir d'une clé.
 */

import { createHmac } from "node:crypto";

import { decryptPii, encryptPii } from "@/lib/pii-crypto";

export type ChampChiffre = "nom" | "email" | "telephone";

function optionsDuChamp(champ: ChampChiffre): { readonly cleExigee: true; readonly aad: string } {
  return { cleExigee: true, aad: `tour_demandes:${champ}` };
}

/** Chiffre un champ de la demande (clé exigée, donnée authentifiée liée au champ). */
export function chiffrerChamp(champ: ChampChiffre, valeur: string): string {
  return encryptPii(valeur, optionsDuChamp(champ));
}

/** Déchiffre un champ de la demande. LÈVE si la valeur est illisible (l'appelant décide). */
export function dechiffrerChamp(champ: ChampChiffre, valeur: string): string {
  return decryptPii(valeur, optionsDuChamp(champ));
}

/** Ce que l'on affiche quand un champ ne se déchiffre pas. */
export const VALEUR_ILLISIBLE = "illisible";

/** Déchiffre sans JAMAIS lever : une valeur illisible vaut « illisible » (console, export). */
export function lireChamp(champ: ChampChiffre, valeur: string): string {
  try {
    return decryptPii(valeur, optionsDuChamp(champ));
  } catch {
    return VALEUR_ILLISIBLE;
  }
}

/** Libellés de domaine : un par type de clé, jamais partagés. */
export const LIBELLE_CLE_PERSONNE = "tour-comptage-pers-v1";
export const LIBELLE_CLE_DOMAINE = "tour-comptage-dom-v1";
export const LIBELLE_CLE_TELEPHONE = "tour-comptage-tel-v1";

const CLE_DE_DEVELOPPEMENT = "axion-ia-dev-only-do-not-use-in-prod";

/**
 * HMAC-SHA256 (64 caractères hexadécimaux) de `valeur`, sous le libellé de domaine `libelle`.
 * LÈVE en production si `PII_ENCRYPTION_KEY` manque (une empreinte calculée avec la clé de
 * développement serait incompatible avec toutes les lignes existantes).
 */
export function empreinteTour(libelle: string, valeur: string): string {
  const configuree = process.env["PII_ENCRYPTION_KEY"]?.trim();
  const cle = configuree && configuree.length > 0 ? configuree : CLE_DE_DEVELOPPEMENT;
  if (cle === CLE_DE_DEVELOPPEMENT && process.env["NODE_ENV"] === "production") {
    throw new Error("PII_ENCRYPTION_KEY manquant en production (clés de comptage du Tour).");
  }
  return createHmac("sha256", cle).update(`${libelle}:${valeur}`).digest("hex");
}
