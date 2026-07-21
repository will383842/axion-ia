/**
 * Calcul du taux de présence — Qualiopi indicateur 12.
 *
 * Décision Will #7 :
 *   - ≥ seuilComplete (défaut 80 %) → "complete"
 *   - 60 %...(seuilComplete - 1) → "partielle"
 *   - < 60 % → "aucune"
 *
 * Aucun import Prisma / accès DB.
 */

import type { TauxResult } from "./types";

/**
 * Seuil inférieur de présence partielle (décision Will #7). Constante métier,
 * contrairement au seuil de présence « complète » qui est réglable en config
 * (`seuil_presence_pct`). Exporté pour que les écrans cessent de le redéclarer
 * en dur — la liste des sessions et la grille d'émargement le dupliquaient.
 */
export const SEUIL_PARTIELLE_PCT = 60;

/** Clé de regroupement journalier : date civile ISO (`YYYY-MM-DD`). */
function cleJour(date: Date | string): string {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

/**
 * Calcule le taux de présence global pour un ensemble de créneaux.
 *
 * ⚠️ COLLISION DE GRANULARITÉ — un même jour peut porter DEUX représentations
 * concurrentes de la même réalité :
 *   - `matin` + `apres_midi` : créneaux présentiels de `genererCreneauxAction` ;
 *   - `journee`              : créneau posé par l'import d'un relevé distanciel,
 *                              qui porte la durée d'une JOURNÉE PLEINE.
 *
 * Sommer les trois double le dénominateur (420 prévues deviennent 840) → taux
 * plafonné à ~50 % → attestation faussement « partielle ». Le cas se produit dès
 * qu'un import distanciel suit une génération de créneaux, ET réapparaît si
 * l'admin reclique « Générer » après un import (`generateSessionCreneauxAction`
 * ne connaît pas les créneaux `journee`).
 *
 * Règle retenue, par jour : les deux représentations sont mises en CONCURRENCE,
 * jamais additionnées.
 *   prévu(jour)    = max(prévu(journee), Σ prévu(demi-journées))
 *   réalisé(jour)  = max(réalisé(journee), Σ réalisé(demi-journées))
 *
 * Ce choix est délibérément non destructif : aucun créneau n'est supprimé, donc
 * aucune preuve opposable (art. R.6313-3) ne disparaît, et le résultat est
 * identique quel que soit l'ordre des actions de l'admin. Une absence émargée et
 * un créneau jamais touché étant indiscernables en base (mêmes `source`,
 * `present`, `dureeRealiseeMinutes`), toute correction par suppression serait un
 * effacement de preuve à l'aveugle.
 *
 * ⚠️ Limite connue : une journée réellement hybride (matin présentiel + après-midi
 * distanciel) reste sous-évaluée, le créneau `journee` de l'import couvrant déjà
 * la journée entière. Sous-évaluer est le sens sûr — c'est la surévaluation que
 * sanctionne un contrôle de service fait.
 *
 * Les créneaux sans `date` sont comptés individuellement (comportement d'origine).
 *
 * @param creneaux - Créneaux avec durée prévue/réalisée, et si connus la date
 *                   civile + la demi-journée (nécessaires au dédoublonnage).
 * @returns `tauxPct` arrondi à l'entier, 0 si aucune durée prévue.
 */
export function computeTauxPresence(
  creneaux: Array<{
    dureePrevueMinutes: number;
    dureeRealiseeMinutes: number;
    date?: Date | string;
    demiJournee?: "matin" | "apres_midi" | "journee";
  }>,
): TauxResult {
  // Accumulateurs par jour : représentation « journée pleine » vs « demi-journées ».
  const jours = new Map<
    string,
    { jourPrevu: number; jourReel: number; demiPrevu: number; demiReel: number }
  >();
  let minutesPrevues = 0;
  let minutesRealisees = 0;

  for (const c of creneaux) {
    // Sans date, aucun dédoublonnage possible : on somme comme avant.
    if (c.date === undefined) {
      minutesPrevues += c.dureePrevueMinutes;
      minutesRealisees += c.dureeRealiseeMinutes;
      continue;
    }

    const cle = cleJour(c.date);
    const jour = jours.get(cle) ?? { jourPrevu: 0, jourReel: 0, demiPrevu: 0, demiReel: 0 };
    if (c.demiJournee === "journee") {
      jour.jourPrevu += c.dureePrevueMinutes;
      jour.jourReel += c.dureeRealiseeMinutes;
    } else {
      jour.demiPrevu += c.dureePrevueMinutes;
      jour.demiReel += c.dureeRealiseeMinutes;
    }
    jours.set(cle, jour);
  }

  for (const jour of jours.values()) {
    minutesPrevues += Math.max(jour.jourPrevu, jour.demiPrevu);
    minutesRealisees += Math.max(jour.jourReel, jour.demiReel);
  }

  if (minutesPrevues === 0) {
    return { tauxPct: 0, minutesPrevues: 0, minutesRealisees: 0 };
  }

  const tauxPct = Math.round((minutesRealisees / minutesPrevues) * 100);
  return { tauxPct, minutesPrevues, minutesRealisees };
}

/**
 * Classe un taux de présence en catégorie qualitative.
 *
 * @param tauxPct         - Taux calculé (0–100+).
 * @param seuilCompletePct - Seuil de présence complète (défaut 80).
 */
export function classifierPresence(
  tauxPct: number,
  seuilCompletePct = 80,
): "complete" | "partielle" | "aucune" {
  if (tauxPct >= seuilCompletePct) return "complete";
  if (tauxPct >= SEUIL_PARTIELLE_PCT) return "partielle";
  return "aucune";
}
