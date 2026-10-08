// Normalisation d'un numéro de téléphone pour la RECHERCHE (relecture de a1, 08/10).
// Fonction pure, hors du fichier d'actions : un fichier « use server » n'exporte que des actions.

/**
 * Les chiffres d'un numéro, au format national : « +33 6 12… » et « 0033 6 12… » deviennent
 * « 0612… ».
 */
export function chiffresTelephone(v: string): string {
  const d = v.replace(/\D/g, "");
  // « +33 6 12 » saisi en partie : le « + » dit l'indicatif, quelle que soit la longueur.
  if (v.trim().startsWith("+33")) return `0${d.slice(2)}`;
  if (d.startsWith("0033")) return `0${d.slice(4)}`;
  if (d.startsWith("33") && d.length === 11) return `0${d.slice(2)}`;
  return d;
}
