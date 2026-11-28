/**
 * Le GEL DES VIREMENTS (lot 7 du plan changement d'IBAN) existe-t-il en ligne ?
 *
 * ✅ Lot 7 livré : `marquerVerse` refuse pendant une demande ouverte, « Virements à faire » (console des
 * commissions et vue commune) grise la ligne et retire « Ouvrir le RIB », l'ouverture du RIB est refusée
 * sous gel, et le compte réellement payé est enregistré (`virement-compte.ts`, `rib-a-virer.ts`).
 * Décisions retenues (recommandations du plan) : D-4 = option B, D-6 = option A.
 *
 * Tant que cette constante vaut `false`, `changementIbanActif()` rend `false` quoi que dise
 * `APPORTEUR_CHANGEMENT_IBAN_ENABLED` (plan §9, point 5). Ne la repasser à `false` que si un de ces
 * quatre chemins perd sa garde (le test `gel-complet-avant-interrupteur.spec.ts` les verrouille).
 */
export const GEL_VIREMENTS_DISPONIBLE = true;
