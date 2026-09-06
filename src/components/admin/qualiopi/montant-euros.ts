/**
 * Conversion euros ↔ centimes pour les champs de montant (côté client).
 *
 * Module SANS "use client", sans JSX et surtout **sans aucun import de Server
 * Action** : c'est ce qui le rend testable. `SessionMontantForm` importe
 * `setSessionMontantAction`, qui tire `next-auth` et toute la pile serveur —
 * un test qui importe le composant pour éprouver deux fonctions pures échoue au
 * chargement du module, avant d'exécuter le moindre `it`. Et il échoue en
 * annonçant « no tests », ce qui se lit comme « rien à signaler ».
 *
 * Même raison d'être que `lieu-values.ts`, et même règle : ce qui est pur vit à
 * part de ce qui rend.
 *
 * ⚠️ La colonne est `montantHtCents`. L'écran, lui, ne peut pas demander des
 * centimes à un humain — personne ne tape « 190000 » pour 1 900 €. La
 * conversion est donc faite ici, une seule fois : c'est le seul endroit où une
 * erreur d'unité ou d'arrondi se glisserait, et elle irait ensuite sur la
 * CONVENTION et sur la FACTURE.
 */

/**
 * « 1 234,56 » → 123456 centimes. `null` si la saisie n'est pas un montant.
 *
 * Volontairement strict : deux décimales au plus, pas de notation
 * exponentielle, pas de signe. `parseFloat` accepterait « 12e3 », « .5 » et
 * « 100abc » — trois façons d'écrire en base un prix que personne n'a saisi.
 *
 * Les espaces (y compris l'insécable et la fine insécable, que `Intl` émet et
 * que le copier-coller ramène) sont tolérés comme séparateurs de milliers,
 * parce que c'est ainsi que le montant s'affiche juste au-dessus du champ.
 */
export function eurosVersCentimes(saisie: string): number | null {
  const nettoye = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(nettoye)) return null;
  const [entier, decimales = ""] = nettoye.split(".");
  // Concaténation de chaînes plutôt que multiplication : `19.99 * 100` vaut
  // 1998.9999999999998 en IEEE 754. `Math.round` le rattraperait, mais ne rien
  // devoir à l'arrondi vaut mieux que de dépendre de sa correction.
  return Number(`${entier}${decimales.padEnd(2, "0")}`);
}

/** 123456 → « 1234,56 », la forme que le champ doit contenir au chargement. */
export function centimesVersEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
