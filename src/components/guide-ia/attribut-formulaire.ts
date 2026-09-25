/**
 * Repères partagés entre la page du guide (serveur) et l'observateur de la
 * barre collante (client) — lot L1.
 *
 * Module À PART, sans directive : exportées depuis un fichier `"use client"`,
 * ces constantes devenaient des références client, et la page serveur recevait
 * une fonction au lieu d'une chaîne (attribut invalide, mesuré en dev).
 */

/** Posé sur l'enveloppe de chaque formulaire du guide : la barre s'efface quand l'un d'eux est à l'écran. */
export const ATTRIBUT_FORMULAIRE_GUIDE = "data-formulaire-guide";

/** Identifiant de la barre collante, que l'observateur montre ou cache. */
export const ID_BARRE_GUIDE = "barre-guide";

/**
 * Événement (window) émis par le formulaire du guide quand une demande est
 * ACCEPTÉE : la barre collante se retire, elle n'a plus rien à proposer.
 */
export const EVENEMENT_GUIDE_ENVOYE = "axion:guide-envoye";
