// Banc @formateurs — une livraison webhook Calendly SIGNÉE.
//
// Signer est l'inverse de vérifier, et on ne peut pas l'emprunter au code : le
// site ne signe jamais rien, il vérifie. La signature est donc calculée ici —
// une ligne, au format documenté par Calendly — puis IMMÉDIATEMENT passée à
// `verifyCalendlySignature`, la fonction que la route appelle. Si le format
// dérive d'un côté ou de l'autre, le banc échoue ICI, en le disant, au lieu de
// produire un « 401 » que personne ne saurait lire.

import crypto from "node:crypto";

import { verifyCalendlySignature } from "@/server/calendly/webhook-signature";

/** En-tête `Calendly-Webhook-Signature` pour `corps`, à l'instant `tSec`. */
export function signerLivraisonCalendly(corps: string, cle: string, tSec: number): string {
  const v1 = crypto.createHmac("sha256", cle).update(`${tSec}.${corps}`, "utf8").digest("hex");
  const entete = `t=${tSec},v1=${v1}`;
  const verdict = verifyCalendlySignature(corps, entete, cle, tSec * 1000);
  if (!verdict.ok) {
    throw new Error(`banc @formateurs : la signature produite est refusée (${verdict.reason})`);
  }
  return entete;
}
