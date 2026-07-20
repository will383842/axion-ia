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
 * - Un créneau par demi-journée (matin + après-midi) pour chaque **jour ouvré**
 *   entre `dateDebut` et `dateFin` inclus.
 * - Si `dateDebut === dateFin` (session < 1 jour), un seul jour est produit.
 * - Les dates sont calculées en fuseau Europe/Paris pour éviter les décalages
 *   DST autour de minuit UTC.
 *
 * Samedis et dimanches sont exclus par défaut : une session du vendredi au lundi
 * représente 2 jours de formation, pas 4. Sans ce filtre, les créneaux du week-end
 * — jamais cochés — divisaient le taux de présence et déclenchaient des
 * attestations « partielles » à tort (seuils 80 % / 60 %, cf. `taux.ts`).
 *
 * Garde-fou : si le filtrage ne laisse AUCUN jour alors que la plage en contenait,
 * c'est que la session se tient volontairement un week-end. On retourne alors la
 * plage complète plutôt que zéro créneau (cf. `inclureWeekends` pour forcer).
 *
 * Durée : `heuresParJour` prime ; sinon `dureeTotaleHeures` est **répartie sur les
 * jours retenus** ; sinon 7 h/jour. ⚠️ Ne JAMAIS passer une durée totale de session
 * dans `heuresParJour` : c'était le bug corrigé ici — une session de 2 jours / 14 h
 * produisait 28 h prévues, donc un taux de présence divisé par 2 et des attestations
 * refusées à tort.
 *
 * @param input.dateDebut          - Début de la session (n'importe quelle heure).
 * @param input.dateFin            - Fin de la session (n'importe quelle heure).
 * @param input.heuresParJour      - Heures effectives par jour (prioritaire).
 * @param input.dureeTotaleHeures  - Durée TOTALE de la session, répartie sur les jours retenus.
 * @param input.inclureWeekends    - Force l'inclusion des samedis/dimanches (défaut false).
 */
export function genererCreneaux(input: {
  dateDebut: Date;
  dateFin: Date;
  heuresParJour?: number;
  dureeTotaleHeures?: number;
  inclureWeekends?: boolean;
}): CreneauPlan[] {
  // Dates ISO en Paris pour le début et la fin
  const isoDebut = parisDateISO(input.dateDebut);
  const isoFin = parisDateISO(input.dateFin);

  // Parcours des jours entre isoDebut et isoFin
  const tousLesJours: string[] = [];
  let courant = parseDateISO(isoDebut);
  const fin = parseDateISO(isoFin);

  while (courant <= fin) {
    tousLesJours.push(toISODate(courant));
    // Passer au jour suivant
    courant = new Date(courant.getTime() + 24 * 60 * 60 * 1000);
  }

  const joursRetenus =
    input.inclureWeekends === true ? tousLesJours : filtrerJoursOuvres(tousLesJours);

  // Durée d'une demi-journée en minutes (arrondie).
  // La répartition de `dureeTotaleHeures` ne peut se faire qu'APRÈS le filtrage :
  // 14 h sur 2 jours ouvrés = 7 h/jour, pas 14 h/jour.
  const heuresParJour = resoudreHeuresParJour({
    heuresParJour: input.heuresParJour,
    dureeTotaleHeures: input.dureeTotaleHeures,
    nbJours: joursRetenus.length,
  });
  const dureeDemiJournee = Math.round((heuresParJour * 60) / 2);

  const creneaux: CreneauPlan[] = [];
  for (const iso of joursRetenus) {
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
  }

  return creneaux;
}

// ─── Helpers internes ───────────────────────────────────────────────────────

/**
 * Résout les heures par jour à partir des entrées disponibles.
 *
 * Ordre de priorité : `heuresParJour` explicite → `dureeTotaleHeures / nbJours`
 * → défaut 7 h. Une durée totale nulle ou négative, ou un nombre de jours nul,
 * retombe sur le défaut plutôt que de produire une division absurde.
 */
function resoudreHeuresParJour(input: {
  // `| undefined` explicite : le projet active `exactOptionalPropertyTypes`,
  // un `?` seul refuserait la valeur `undefined` passée explicitement.
  heuresParJour: number | undefined;
  dureeTotaleHeures: number | undefined;
  nbJours: number;
}): number {
  if (input.heuresParJour !== undefined) return input.heuresParJour;
  if (input.dureeTotaleHeures !== undefined && input.dureeTotaleHeures > 0 && input.nbJours > 0) {
    return input.dureeTotaleHeures / input.nbJours;
  }
  return HEURES_PAR_JOUR_DEFAUT;
}

/**
 * Retire les samedis et dimanches.
 *
 * Si le filtrage ne laisse rien alors que la plage n'était pas vide, la session
 * se tient entièrement le week-end (cas volontaire : formation samedi). On rend
 * alors la plage intacte — mieux vaut des créneaux week-end assumés que zéro
 * créneau, qui bloquerait l'émargement et la clôture de la session.
 */
function filtrerJoursOuvres(jours: string[]): string[] {
  const ouvres = jours.filter((iso) => {
    const jour = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return jour !== 0 && jour !== 6; // 0 = dimanche, 6 = samedi
  });
  return ouvres.length === 0 ? jours : ouvres;
}

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
