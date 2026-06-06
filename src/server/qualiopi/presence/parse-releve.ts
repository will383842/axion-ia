/**
 * Dispatcher de parsing — relevé de connexion distanciel.
 *
 * Expose :
 *   - `parseReleveConnexion(content, plateforme)` : délègue au bon parseur.
 *   - `autodetectPlateforme(content)` : heuristique sur les en-têtes.
 *
 * Aucun import Prisma / accès DB.
 */

import type { ParsedReleve, PlateformeLabel } from "./types";
import { parseZoomCsv } from "./parse-zoom";
import { parseTeamsCsv } from "./parse-teams";
import { parseMeetCsv } from "./parse-meet";

/**
 * Détecte automatiquement la plateforme d'un rapport à partir de ses en-têtes.
 *
 * Heuristique (ordre de priorité) :
 *   1. Présence de "Join Time" + "Leave Time" + "Duration (Minutes)" → Zoom
 *   2. Présence de "UPN" ou section "Participants" avec "First Join" → Teams
 *   3. Présence de "Time joined" ou "Time exited" → Meet
 *   4. Sinon → "autre"
 */
export function autodetectPlateforme(content: string): PlateformeLabel {
  // Normaliser : retirer BOM + NUL, passer en minuscules
  const lower = content.replace(/^﻿/, "").replace(/\0/g, "").toLowerCase();

  // Zoom : colonnes caractéristiques
  if (
    lower.includes("join time") &&
    lower.includes("leave time") &&
    lower.includes("duration (minutes)")
  ) {
    return "zoom";
  }

  // Teams : UPN ou "first join" / "last leave"
  if (lower.includes("\tupn\t") || lower.includes("first join") || lower.includes("last leave")) {
    return "teams";
  }

  // Meet : colonnes spécifiques
  if (lower.includes("time joined") || lower.includes("time exited")) {
    return "meet";
  }

  return "autre";
}

/**
 * Parse un rapport de connexion en déléguant au parseur approprié.
 *
 * @param content    - Contenu textuel du rapport.
 * @param plateforme - Plateforme cible (utiliser `autodetectPlateforme` si inconnue).
 */
export function parseReleveConnexion(content: string, plateforme: PlateformeLabel): ParsedReleve {
  switch (plateforme) {
    case "zoom":
      return parseZoomCsv(content);
    case "teams":
      return parseTeamsCsv(content);
    case "meet":
      return parseMeetCsv(content);
    case "autre":
    default:
      // Tentative de parsing générique via Zoom (CSV standard)
      return { ...parseZoomCsv(content), plateforme: "autre" };
  }
}
