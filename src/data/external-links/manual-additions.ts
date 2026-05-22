/**
 * EXTERNAL LINKS — Ajouts manuels (file-based)
 *
 * Ce fichier reçoit les liens ajoutés via l'admin console
 * `/content-gen/external-links → bouton "Ajouter un lien manuel"`.
 *
 * Versionné git : chaque ajout admin requiert un commit Will manuel post-ajout.
 *
 * Cf. _AUDIT/EXTERNAL-LINKS-2026-05-22/PHASE-0-RACCORDEMENT.md §2.3
 */

import type { ExternalLink } from "./types";

export const LINKS_MANUAL_ADDITIONS: ReadonlyArray<ExternalLink> = [];
