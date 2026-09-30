/**
 * Le texte du refus de la page « Enregistreur » (PR 5). La LISTE des rôles et
 * les GARDES sont celles du dossier client (`@/features/dossier-client/acces`,
 * décision A2) : seule l'explication change, parce que la page donne accès au
 * son des échanges, pas aux onglets du dossier.
 */

export function motifSansAccesEnregistreur(): string {
  return (
    "L'enregistreur des rendez-vous est réservé à Williams et aux administrateurs : " +
    "il donne accès au son des échanges avec les clients."
  );
}
