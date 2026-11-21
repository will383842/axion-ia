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

/** Gabarits dont le payload porte un lien de signature sous la clé `signatureUrl`. */
export const GABARITS_AVEC_LIEN_SIGNATURE: readonly string[] = [
  "devis-envoi",
  "convention-envoi",
  "relance-devis-client",
];

/**
 * Gabarits formateurs dont le payload porte un lien de signature à jeton sous la clé `lien`
 * (`/portail/signer/<jeton>`) : contrat-cadre à signer (F16), relance (F18), nouvelle
 * version (F45). Les autres gabarits formateurs portent des liens sans jeton de signature
 * (connexion, invitation) : ils ne sont pas masqués.
 */
export const GABARITS_FORMATEUR_AVEC_LIEN_SIGNATURE: readonly string[] = [
  "formateur-contrat-a-signer",
  "formateur-contrat-relance",
  "formateur-contrat-nouvelle-version",
];

/** La clé qui porte le lien pour ce gabarit, ou `null` s'il n'en porte pas. */
export function cleLienSignature(template: string): "signatureUrl" | "lien" | null {
  if (GABARITS_AVEC_LIEN_SIGNATURE.includes(template)) return "signatureUrl";
  if (GABARITS_FORMATEUR_AVEC_LIEN_SIGNATURE.includes(template)) return "lien";
  return null;
}

export function masquerLienSignaturePayload(
  template: string,
  payload: unknown,
): { payload: unknown; modifie: boolean } {
  const cle = cleLienSignature(template);
  if (cle === null) return { payload, modifie: false };
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { payload, modifie: false };
  }
  const brut = (payload as Record<string, unknown>)[cle];
  if (typeof brut !== "string") return { payload, modifie: false };
  const { sortie, masques } = masquerSecretsTexte(brut);
  if (masques === 0 || sortie === brut) return { payload, modifie: false };
  return {
    payload: { ...(payload as Record<string, unknown>), [cle]: sortie },
    modifie: true,
  };
}
