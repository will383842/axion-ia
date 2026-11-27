/**
 * Motifs interdits pour les GÉNÉRATEURS de contenu (blog, offres d'emploi) — fichier à part.
 *
 * `src/server/content-gen/brand/positionnement.ts` est modifié par la PR 2137 : on n'y touche pas
 * ici. ➜ IMPORT MANQUANT À FAIRE après la fusion de la PR 2137 : y importer `CONSIGNE_SANS_FINANCEMENT`
 * et l'ajouter à `LIGNES_INTERDITS` (ou à `BLOC_POSITIONNEMENT`). Tant que cet import manque, la
 * consigne n'est pas dans le prompt : seul le garde-fou aval (le motif ci-dessous) protège.
 */

import { PHRASE_FR } from "./phrases-standard";

/** Motif de garde (test + post-traitement) : tout article ou offre généré qui le contient est bloqué. */
export const MOTIFS_INTERDITS_GENERATEUR =
  /\bOPCOs?\b|qualiopi|datadock|\bEDOF\b|subrogation|mon ?compte ?formation|FNE[- ]Formation|\bAIF\b|finan[cç]ables?|\bCPF\b/i;

/** Consigne à ajouter au prompt des générateurs. */
export const CONSIGNE_SANS_FINANCEMENT =
  "Financement : Axion-IA ne propose aucun financement de formation. N'écris JAMAIS OPCO, Qualiopi, CPF, Mon Compte Formation, " +
  "Datadock, EDOF, subrogation, FNE-Formation, AIF, « finançable », ni France Travail / Pôle emploi / France Compétences dans un " +
  "contexte de financement, ni « prise en charge » au sens financier (« prise en charge des appels » reste permis). " +
  `Si le sujet touche au financement, écris seulement : « ${PHRASE_FR} »`;
