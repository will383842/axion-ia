/**
 * LIRE UN NUMÉRO DE TÉLÉPHONE TEL QU'UNE PERSONNE L'ÉCRIT.
 *
 * 🔴 CE QUE ÇA RÉPARE (mesuré le 2026-09-24, en production, au navigateur).
 *    Le formulaire de contact refusait `0639981234` — un numéro français
 *    parfaitement normal — avec « Indicatif pays obligatoire ». L'aide le
 *    disait bien sous le champ, mais **elle se lit après le refus** : on tape
 *    son numéro comme on le dit à voix haute, on clique, et on se fait
 *    renvoyer. Trois candidats ont écrit en septembre que le formulaire du
 *    site n'avait pas marché pour eux ; on ne saura jamais combien ont
 *    renoncé sans rien dire.
 *
 * 🔑 POURQUOI ON NE SE CONTENTE PAS D'ÉLARGIR L'EXPRESSION RÉGULIÈRE. Le site
 *    reçoit des candidatures du Togo, de Madagascar, de Tunisie, du Cameroun,
 *    du Maroc et d'Espagne — vérifié sur les candidatures réelles de l'été.
 *    Accepter « dix chiffres commençant par zéro » sans rien en faire rangerait
 *    côte à côte des numéros qu'on ne saurait plus composer. On NORMALISE donc
 *    vers la forme internationale, et c'est elle qu'on enregistre.
 *
 * ⚠️ L'HYPOTHÈSE FRANÇAISE EST ASSUMÉE, ET ELLE EST ÉTROITE. Un numéro à dix
 *    chiffres commençant par `0` est lu comme français. C'est aussi la forme
 *    nationale du Maroc ou du Royaume-Uni : quelqu'un de Casablanca qui tape
 *    `0662022908` sera lu `+33662022908`, et ce sera faux.
 *
 *    Deux garde-fous, et ils sont dans l'interface, pas ici :
 *    · l'aide sous le champ nomme les DEUX formes acceptées, au lieu de n'en
 *      exiger qu'une ;
 *    · les numéros étrangers reçus jusqu'ici portaient TOUS leur indicatif —
 *      quelqu'un qui écrit depuis l'étranger sait qu'il est à l'étranger. Le
 *      risque porte donc sur l'exception, pas sur le cas courant, et l'ancien
 *      comportement le faisait payer à tout le monde.
 *
 * 🔑 UNE SEULE RÈGLE, DEUX APPELANTS. `unified-contact-schema.ts` et
 *    `formulaire-reservation.ts` portaient chacun leur propre expression
 *    régulière, identiques au caractère près. Deux copies d'une règle finissent
 *    toujours par diverger, et l'écart ne se voit sur aucun écran.
 */

/** Ce qu'on accepte, dit en français, pour l'aide ET pour le refus. */
export const FORMES_ACCEPTEES =
  "Numéro français (06 12 34 56 78) ou international avec son indicatif (+212 6 61 23 45 67).";

export type LectureTelephone =
  { readonly ok: true; readonly e164: string } | { readonly ok: false; readonly motif: string };

/** Les séparateurs qu'on laisse écrire : espaces, points, tirets, parenthèses. */
// ⚠️ Les deux insecables s'ecrivent EN ECHAPPEMENT, jamais en clair : un
// caractere invisible dans une classe de caracteres ne se relit pas, et le
// premier outil de mise en forme qui passe peut le faire disparaitre sans
// qu'aucun test ne rougisse.
const SEPARATEURS = /[\s().\-\u00A0\u202F]/g;

/**
 * Lit une saisie libre et rend la forme internationale, ou dit pourquoi non.
 *
 * ⚠️ Ne lève JAMAIS : un champ de formulaire doit pouvoir être mal rempli sans
 *    que cela devienne une exception à rattraper plus haut.
 */
export function lireTelephone(saisie: string): LectureTelephone {
  const nu = saisie.replace(SEPARATEURS, "");
  if (nu === "") return { ok: false, motif: FORMES_ACCEPTEES };

  // Forme internationale explicite — on la garde telle quelle, quel que soit
  // le pays. C'est le cas de tous les numéros étrangers reçus jusqu'ici.
  const international = /^(?:\+|00)([1-9][0-9]{7,16})$/.exec(nu);
  if (international !== null) return { ok: true, e164: `+${international[1]}` };

  // Forme nationale française : 0 puis neuf chiffres, le premier non nul.
  // `01`…`09` couvre fixes, mobiles et numéros non géographiques.
  const francais = /^0([1-9][0-9]{8})$/.exec(nu);
  if (francais !== null) return { ok: true, e164: `+33${francais[1]}` };

  return { ok: false, motif: FORMES_ACCEPTEES };
}

/**
 * Vrai si la saisie est lisible. À passer à un `refine` de schéma plutôt que
 * de recopier une expression régulière — c'est le point de ce module.
 */
export function telephoneEstLisible(saisie: string): boolean {
  return lireTelephone(saisie).ok;
}

/**
 * La forme internationale, ou la saisie d'origine si elle est illisible.
 *
 * 🔑 Le repli rend la SAISIE, jamais une chaîne vide : si une garde en amont
 *    laisse passer un numéro qu'on ne sait pas lire, mieux vaut enregistrer ce
 *    que la personne a écrit — on peut encore la rappeler — que de perdre le
 *    seul moyen de la joindre.
 */
export function normaliserTelephone(saisie: string): string {
  const lu = lireTelephone(saisie);
  return lu.ok ? lu.e164 : saisie.trim();
}
