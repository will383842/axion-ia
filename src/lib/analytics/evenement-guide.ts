/**
 * Événement Plausible posé par le navigateur quand une demande du guide IA est
 * ACCEPTÉE par le serveur (lot L1, 2026-09-25).
 *
 * Propriété unique : `source` (liste fermée `SOURCES_GUIDE`) — jamais
 * l'adresse ni sa nature, qui sont des données personnelles. Pendant serveur :
 * « Guide Downloaded », posé au clic sur le lien de l'e-mail (lot L2).
 *
 * Module à part, sans dépendance : il est importé par un composant client, et
 * `content/guide-ia-formulaire.ts` (tous les textes) n'a rien à faire dans le
 * JavaScript envoyé au navigateur pour une chaîne de 15 caractères.
 */
export const EVENEMENT_GUIDE_DEMANDE = "Guide Requested";
