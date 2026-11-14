/**
 * FORME D'UN CODE DE GUIDE DU CATALOGUE — la SEULE définition (réserve N3 de l'audit S3-CRM).
 *
 * `gde-` puis 6 à 24 caractères parmi minuscules, chiffres et tiret. Le CRM refuse tout événement
 * dont un champ guide sort de cette forme (`invalid_token`) : livraison (`guide-a-livrer.ts`), connaissance
 * d'une cible (`cible-connue.ts`), gabarit d'e-mail et synchronisation CRM (`lettre-guide.ts`,
 * `synchro-v3.ts`) importent TOUS cette constante. Ne jamais en recopier le motif.
 */
export const RE_CODE_GUIDE_CATALOGUE = /^gde-[a-z0-9-]{6,24}$/;

/** `true` si `code` est un code de guide du catalogue bien formé (jamais `guide-ia`). */
export function estCodeGuideCatalogue(code: unknown): code is string {
  return typeof code === "string" && RE_CODE_GUIDE_CATALOGUE.test(code);
}
