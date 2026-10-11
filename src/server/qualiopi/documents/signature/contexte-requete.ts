/**
 * Empreintes de contexte d'une signature — LA seule lecture des en-têtes (S6a, c).
 *
 * Quatre actions de signature en portaient chacune une copie, et elles avaient
 * déjà divergé : l'une testait `ua === null`, l'autre `typeof ua !== "string"`.
 * Un en-tête qui rendrait `undefined` faisait donc échouer la signature dans un
 * fichier et pas dans l'autre.
 *
 * Hors tuple haché, donc effaçables (RGPD art. 17).
 */

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { ipVisiteurOuNull } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";

export interface ContexteRequete {
  readonly ipHash: string | null;
  readonly userAgentSha256: string | null;
}

export async function contexteRequete(): Promise<ContexteRequete> {
  const entetes = await headers();
  // `cf-connecting-ip` n'est cru que si la connexion vient de Cloudflare :
  // lu en direct, il se forgeait en contournant Cloudflare (cf. client-ip-core).
  const ipBrute = ipVisiteurOuNull(entetes);
  const ua = entetes.get("user-agent");
  return {
    ipHash: hashIp(ipBrute),
    // `typeof !== "string"` et non `=== null` : un en-tête manquant ne doit
    // jamais faire échouer une SIGNATURE sur `createHash().update(undefined)`.
    userAgentSha256: typeof ua !== "string" ? null : createHash("sha256").update(ua).digest("hex"),
  };
}
