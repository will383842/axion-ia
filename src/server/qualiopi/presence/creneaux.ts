/**
 * Génération des créneaux planifiés d'une session de formation.
 *
 * Règle Qualiopi : chaque jour ouvré produit 2 créneaux (matin + après-midi),
 * chacun d'une durée égale à la moitié des heures de travail journalières.
 * Aucun import Prisma / accès DB.
 */

import type { CreneauPlan } from "./types";
import { parisDateISO, parisDateLabel } from "./time";

/** Durée journalière par défaut en heures (7 h de formation = 420 min/jour). */
const HEURES_PAR_JOUR_DEFAUT = 7;

/**
 * Génère la liste des créneaux planifiés pour une session.
 *
 * - Un créneau par demi-journée (matin + après-midi) pour chaque jour entre
 *   `dateDebut` et `dateFin` inclus.
 * - Si `dateDebut === dateFin` (session < 1 jour), un seul jour est produit.
 * - Les dates sont calculées en fuseau Europe/Paris pour éviter les décalages
 *   DST autour de minuit UTC.
 *
 * @param input.dateDebut      - Début de la session (n'importe quelle heure).
 * @param input.dateFin        - Fin de la session (n'importe quelle heure).
 * @param input.heuresParJour  - Heures effectives par jour (défaut 7).
 */
export function genererCreneaux(input: {
  dateDebut: Date;
  dateFin: Date;
  heuresParJour?: number;
}): CreneauPlan[] {
  const heuresParJour =
    input.heuresParJour !== undefined ? input.heuresParJour : HEURES_PAR_JOUR_DEFAUT;

  // Durée d'une demi-journée en minutes (arrondie)
  const dureeDemiJournee = Math.round((heuresParJour * 60) / 2);

  // Dates ISO en Paris pour le début et la fin
  const isoDebut = parisDateISO(input.dateDebut);
  const isoFin = parisDateISO(input.dateFin);

  // Parcours des jours entre isoDebut et isoFin
  const creneaux: CreneauPlan[] = [];
  let courant = parseDateISO(isoDebut);
  const fin = parseDateISO(isoFin);

  while (courant <= fin) {
    const iso = toISODate(courant);

    creneaux.push({
      date: iso,
      demiJournee: "matin",
      libelle: parisDateLabel(iso, "matin"),
      dureePrevueMinutes: dureeDemiJournee,
    });

    creneaux.push({
      date: iso,
      demiJournee: "apres_midi",
      libelle: parisDateLabel(iso, "apres_midi"),
      dureePrevueMinutes: dureeDemiJournee,
    });

    // Passer au jour suivant
    courant = new Date(courant.getTime() + 24 * 60 * 60 * 1000);
  }

  return creneaux;
}

// ─── Helpers internes ───────────────────────────────────────────────────────

/**
 * Parse une date ISO "YYYY-MM-DD" en objet Date UTC minuit.
 * On travaille en UTC pur pour le comptage de jours, la conversion Paris est
 * déjà faite en amont.
 */
function parseDateISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Formatte un objet Date (UTC) en "YYYY-MM-DD". */
function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const j = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}
