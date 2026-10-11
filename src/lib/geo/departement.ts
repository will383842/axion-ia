/**
 * Département d'une commune, depuis son code INSEE (lot L15b, pur).
 *
 * Sert au forfait de déplacement (contrat-cadre v3, art. 10) : les formations
 * dans le département du formateur sont comprises dans ses honoraires.
 *
 *   - métropole : les deux premiers caractères (« 17300 » → « 17 ») ;
 *   - Corse : « 2A » / « 2B » (le code INSEE les porte déjà) ;
 *   - outre-mer : les trois premiers (« 97411 » → « 974 »).
 *
 * ⚠️ Un CODE POSTAL n'est pas un code INSEE (la Corse a des codes postaux en
 * « 20 »). Seul le code INSEE est accepté ; tout autre format rend `null`.
 */
export function departementDeCommune(codeInsee: string | null | undefined): string | null {
  const c = (codeInsee ?? "").trim().toUpperCase();
  if (!/^(\d{5}|2[AB]\d{3})$/.test(c)) return null;
  if (c.startsWith("97") || c.startsWith("98")) return c.slice(0, 3);
  return c.slice(0, 2);
}

/**
 * Hors du département du formateur ? `null` si l'un des deux est inconnu : le
 * forfait ne se décide jamais sur une donnée absente (l'appelant demande).
 */
export function horsDepartement(
  communeFormateur: string | null | undefined,
  communeSession: string | null | undefined,
): boolean | null {
  const a = departementDeCommune(communeFormateur);
  const b = departementDeCommune(communeSession);
  if (a === null || b === null) return null;
  return a !== b;
}
