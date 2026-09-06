/**
 * F5 — le montant HT d'une session part du TARIF DE L'OFFRE, plus de zéro.
 *
 * ## Le défaut fermé
 *
 * « MONTANT HT (€) * » démarrait à `0` et bloquait la création. La formation est
 * pourtant déjà choisie à ce moment-là, elle porte une offre, et cette offre
 * porte un tarif — 1 900 € HT pour AXI-FORM-2026-038, lisible sur
 * `/qualiopi/offres`. Il fallait ouvrir un second onglet, trouver l'offre, lire
 * le prix, revenir. Un nouveau salarié ne SAIT PAS que le prix est dans
 * « Offres » : rien sur l'écran de création ne le dit.
 *
 * Le risque n'est pas la lenteur, c'est le chiffre INVENTÉ — un montant faux
 * part ensuite sur la convention et sur la facture, deux pièces que le client
 * reçoit et qu'un auditeur lit.
 *
 * ## Ce que ce module décide, et pourquoi il est à part
 *
 * Module sans "use client", sans JSX et **sans aucun import de Server Action** :
 * `SessionForm` importe `createSessionAction`, qui tire `next-auth` et toute la
 * pile serveur. Même raison d'être que `lieu-values.ts` et `montant-euros.ts`.
 *
 * ⚠️ Le tarif arrive en CENTIMES, déjà résolu côté serveur par
 * `resolveOffrePriceEur`. Ne pas « simplifier » en résolvant côté client :
 * importer `pricing-resolver` dans un composant client tirerait tout
 * `pricing.ts` dans le bundle admin — c'est écrit noir sur blanc dans
 * `devis/new/page.tsx`, et le gate de poids du bundle est bloquant depuis le
 * 2026-08-24.
 */

/** État du champ montant, et d'où vient sa valeur. */
export interface EtatMontant {
  /** Ce qu'affiche le champ, dans la forme d'un `<input type="number">`. */
  readonly montant: string;
  /**
   * La valeur affichée a-t-elle été posée par le catalogue ?
   *
   * C'est ce booléen qui distingue « 1 900 que personne n'a regardé » de
   * « 1 900 que quelqu'un a tapé ». Sans lui on ne peut ni écraser sans risque,
   * ni s'interdire d'écraser.
   */
  readonly vientDuCatalogue: boolean;
}

/** 190000 → « 1900.00 », la forme qu'un `<input type="number">` accepte. */
export function centimesVersChampNombre(cents: number): string {
  // Point décimal, jamais virgule : `centimesVersEuros` (montant-euros.ts) rend
  // « 1900,00 » pour un champ TEXTE, et une virgule dans un `type="number"`
  // vide le champ sans un mot. Deux formats, deux fonctions.
  return (cents / 100).toFixed(2);
}

/** Le champ est-il « vierge » — c'est-à-dire rien, ou le zéro de départ ? */
function estVierge(montant: string): boolean {
  const nettoye = montant.trim();
  return nettoye === "" || Number(nettoye) === 0;
}

/**
 * Nouveau montant après un changement de formation.
 *
 * Trois règles, et aucune n'est cosmétique — ce sont celles que `DevisForm`
 * s'est déjà données pour la même raison :
 *
 * 1. **On n'écrase JAMAIS un chiffre saisi à la main.** Un admin qui a négocié
 *    2 400 € et change ensuite la formation par erreur ne doit pas voir son
 *    chiffrage disparaître sans un mot.
 * 2. **Une offre SANS prix ferme (sur devis, fourchette, paliers) ne pré-remplit
 *    rien** — et retire le tarif précédent s'il venait du catalogue : garder
 *    1 900 € en changeant de formation attribuerait à la nouvelle un prix qui
 *    n'est pas le sien, ce qui est pire que le champ à zéro d'avant.
 * 3. **Un champ vierge (« », « 0 ») est remplaçable** : c'est l'état de départ,
 *    personne ne l'a choisi.
 */
export function montantApresChoixFormation(
  etat: EtatMontant,
  tarifCatalogueHtCents: number | null,
): EtatMontant {
  const remplacable = etat.vientDuCatalogue || estVierge(etat.montant);

  if (tarifCatalogueHtCents === null) {
    // Règle 2 : on retire un tarif catalogue devenu faux, on garde une saisie.
    return remplacable && etat.vientDuCatalogue
      ? { montant: "0", vientDuCatalogue: false }
      : { montant: etat.montant, vientDuCatalogue: false };
  }

  if (!remplacable) return { montant: etat.montant, vientDuCatalogue: false };

  return {
    montant: centimesVersChampNombre(tarifCatalogueHtCents),
    vientDuCatalogue: true,
  };
}
