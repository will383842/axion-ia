/**
 * Montant pondéré d'une prestation (lot B8). PUR : centimes entiers en entrée et en sortie, HT
 * seulement (le TTC se déduit à l'affichage, jamais ici). Aucun flottant ne traverse la sortie :
 * `montant × chances / 100` est arrondi au centime le plus proche (0,5 centime vers le haut).
 * Rien de ceci ne part vers le CRM.
 */

/** `null` si le montant ou les chances manquent ; `undefined` n'existe pas. */
export function montantPondereCents(
  montantCents: number | null,
  probabilitePct: number | null,
): number | null {
  if (montantCents === null || probabilitePct === null) return null;
  if (!Number.isInteger(montantCents) || montantCents < 0) return null;
  if (!Number.isInteger(probabilitePct) || probabilitePct < 0 || probabilitePct > 100) return null;
  // Division entière exacte : (m × p + 50) / 100 arrondit au demi vers le haut sans flottant.
  return Math.floor((montantCents * probabilitePct + 50) / 100);
}

/** Chances saisies : « » donne `null` (non estimées), un entier de 0 à 100 donne l'entier, sinon `undefined`. */
export function lireChancesSaisies(saisie: string): number | null | undefined {
  const brut = saisie.trim();
  if (brut === "") return null;
  if (!/^\d{1,3}$/.test(brut)) return undefined;
  const n = Number(brut);
  return n >= 0 && n <= 100 ? n : undefined;
}

/** Date de clôture saisie : « » donne `null`, « AAAA-MM-JJ » réelle donne la chaîne, sinon `undefined`. */
export function lireClotureSaisie(saisie: string): string | null | undefined {
  const brut = saisie.trim();
  if (brut === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(brut);
  if (m === null) return undefined;
  const d = new Date(`${brut}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== brut) return undefined;
  if (Number(m[1]) < 2000) return undefined;
  return brut;
}
