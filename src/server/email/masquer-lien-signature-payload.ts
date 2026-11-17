/**
 * B2a — masque le lien de signature d'un payload d'e-mail STOCKÉ en corbeille.
 *
 * Le jeton de `/portail/signer/<jeton>` vaut à lui seul le droit de signer : une fois
 * l'e-mail traité, la base n'a plus à le garder en clair. On réutilise le masque
 * commun (`masquerSecretsTexte`) : la valeur devient `…/portail/signer/[masqué]`.
 *
 * Module pur. Il ne touche qu'à la clé `signatureUrl` ; toute autre clé, tout autre
 * gabarit, toute ligne sans cette clé passent à l'identique (`modifie: false`).
 */
import { masquerSecretsTexte } from "@/lib/email/masquer-secrets";

/** Gabarits dont le payload porte un lien de signature. */
export const GABARITS_AVEC_LIEN_SIGNATURE: readonly string[] = ["devis-envoi", "convention-envoi"];

export function masquerLienSignaturePayload(
  template: string,
  payload: unknown,
): { payload: unknown; modifie: boolean } {
  if (!GABARITS_AVEC_LIEN_SIGNATURE.includes(template)) return { payload, modifie: false };
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { payload, modifie: false };
  }
  const brut = (payload as Record<string, unknown>)["signatureUrl"];
  if (typeof brut !== "string") return { payload, modifie: false };
  const { sortie, masques } = masquerSecretsTexte(brut);
  if (masques === 0 || sortie === brut) return { payload, modifie: false };
  return {
    payload: { ...(payload as Record<string, unknown>), signatureUrl: sortie },
    modifie: true,
  };
}
