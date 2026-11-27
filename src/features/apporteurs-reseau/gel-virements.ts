/**
 * Le GEL DES VIREMENTS (lot 7 du plan changement d'IBAN) existe-t-il en ligne ?
 *
 * ⛔ Lot 7 ARRÊTÉ (décisions D-4 et D-6 du dirigeant attendues). Tant que cette constante vaut `false`,
 * `changementIbanActif()` rend `false` quoi que dise `APPORTEUR_CHANGEMENT_IBAN_ENABLED` : sans gel,
 * une demande ouverte ne bloquerait aucun virement (plan §9, point 5).
 * Ne passer à `true` que dans la PR qui livre le gel (lot 7), avec son test.
 */
export const GEL_VIREMENTS_DISPONIBLE = false;
