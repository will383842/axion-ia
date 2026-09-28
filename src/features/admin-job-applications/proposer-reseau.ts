import "server-only";

/**
 * « PROPOSER LE RÉSEAU D'APPORTEURS » — la lecture (2026-09-28).
 *
 * Pas un module `"use server"` : une lecture exportée d'un fichier d'actions
 * deviendrait un point d'entrée réseau (même doctrine que `reads.ts`). La page
 * applique sa garde avant d'appeler.
 *
 * La lecture vit dans `fiche-apporteur-depuis-candidature.ts`, sans
 * `server-only` : le passage automatique du worker la partage (2026-09-28).
 */

export { ficheApporteurDeLaCandidature } from "./fiche-apporteur-depuis-candidature";
