/**
 * Chiffrement de la PAROLE — le seul module que le circuit visio utilise
 * (chantier visio, ADR 0054 et 0056 ; plan §3.10, PA-11).
 *
 * Tout texte issu d'une conversation (transcription, citation, énoncé d'un
 * fait, compte rendu, réponse à un questionnaire, preuve d'accord) est chiffré
 * par ce module, et par lui seul
 * (`tests/unit/ci/le-circuit-ne-chiffre-qu-avec-chiffrer-parole.spec.ts`).
 *
 * ## Pourquoi pas `encryptPii` / `decryptPii` directement
 *
 * Ils sont TOLÉRANTS, et c'est voulu pour les formulaires du site :
 *   · sans clé, `encryptPii` rend le texte EN CLAIR (repli de développement) ;
 *   · une valeur sans préfixe `enc:v1:` est rendue telle quelle par
 *     `decryptPii` (lignes historiques en clair) ;
 *   · sans clé, `decryptPii` rend un texte de remplacement au lieu d'échouer.
 *
 * Pour une conversation, chacune de ces tolérances est une fuite ou un
 * mensonge : une parole écrite en clair en base, ou un compte rendu qui
 * afficherait « [encrypted — key missing] » comme si c'était ce qu'on a dit.
 * Ici, les trois cas LÈVENT.
 */

import {
  chiffrerOctetsPii,
  dechiffrerOctetsPii,
  decryptPii,
  encryptPii,
  PII_DECRYPT_PLACEHOLDER,
  PREFIX_V1,
} from "@/lib/pii-crypto";

function exigerCle(usage: string): void {
  const hex = process.env["PII_ENCRYPTION_KEY"];
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `[chiffrer-parole] PII_ENCRYPTION_KEY absente ou invalide : ${usage} refusé (aucun repli en clair).`,
    );
  }
}

/**
 * Chiffre une parole. Lève si la clé manque. La chaîne vide reste vide (une
 * colonne vidée par un effacement doit le rester, sans préfixe).
 */
export function chiffrerParole(texte: string): string {
  if (texte === "") return "";
  exigerCle("chiffrement d'une parole");
  if (texte.startsWith(PREFIX_V1)) {
    // Déjà chiffré : l'idempotence d'`encryptPii` le rendrait tel quel, ce qui
    // masquerait un double appel. On refuse : c'est une erreur d'appelant.
    throw new Error("[chiffrer-parole] texte déjà chiffré : double chiffrement refusé.");
  }
  const chiffre = encryptPii(texte);
  if (!chiffre.startsWith(PREFIX_V1)) {
    throw new Error("[chiffrer-parole] le chiffrement n'a pas produit de valeur chiffrée.");
  }
  return chiffre;
}

/**
 * Déchiffre une parole. Lève si la clé manque, si la valeur n'est pas chiffrée
 * (une parole en clair en base est une anomalie, jamais un cas normal), ou si
 * le texte de remplacement de `decryptPii` apparaît. La chaîne vide reste vide.
 */
export function dechiffrerParole(valeur: string): string {
  if (valeur === "") return "";
  exigerCle("déchiffrement d'une parole");
  if (!valeur.startsWith(PREFIX_V1)) {
    throw new Error("[chiffrer-parole] valeur non chiffrée (préfixe enc:v1: absent).");
  }
  const clair = decryptPii(valeur);
  if (clair === PII_DECRYPT_PLACEHOLDER) {
    throw new Error("[chiffrer-parole] déchiffrement impossible (clé absente).");
  }
  return clair;
}

/** Variante qui laisse passer `null` (colonnes facultatives). */
export function dechiffrerParoleOuNull(valeur: string | null): string | null {
  return valeur === null ? null : dechiffrerParole(valeur);
}

/** Octets (son) : AES-256-GCM, enveloppe `AXB1`. Lève si la clé manque. */
export const chiffrerOctets = chiffrerOctetsPii;

/** Octets (son) : lève si la clé manque, si l'en-tête ou l'étiquette sont faux. */
export const dechiffrerOctets = dechiffrerOctetsPii;
