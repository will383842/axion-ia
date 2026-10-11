/**
 * EMPREINTE d'un IBAN (08c §D2, 08 §4 e) : HMAC-SHA256 de l'IBAN normalisé, clé dérivée
 * d'`IBAN_EMPREINTE_SECRET` (distinct d'`AUTH_SECRET`) avec une séparation de domaine
 * propre (`axion-iban-empreinte|<secret>`).
 *
 * Usages : repérer un même IBAN sur deux fiches sans déchiffrer, et prouver le compte payé
 * (`Trainer.ibanEmpreinte`, CHECK `trainers_iban_empreinte_coherente`).
 *
 * 🔴 Le secret est lu À L'APPEL, jamais au chargement (build `stub.invalid`). Sans secret,
 * AUCUNE empreinte (`null`) : l'appelant refuse l'enregistrement de l'IBAN plutôt que d'en
 * fabriquer une avec une clé de repli — une empreinte calculée sans le vrai secret ne se
 * comparerait plus jamais aux suivantes.
 *
 * Module serveur (`node:crypto`) : ne jamais l'importer depuis un composant client.
 */

import { createHash, createHmac } from "node:crypto";

/** « fr76 3000 … » → « FR763000… ». */
export function ibanNormalise(brut: string): string {
  return brut.replace(/\s+/g, "").toUpperCase();
}

/** L'empreinte (64 caractères hexadécimaux), ou `null` sans secret. */
export function empreinteIban(brut: string): string | null {
  const secret = process.env["IBAN_EMPREINTE_SECRET"];
  if (!secret) return null;
  const cle = createHash("sha256").update(`axion-iban-empreinte|${secret}`).digest();
  return createHmac("sha256", cle).update(ibanNormalise(brut)).digest("hex");
}
