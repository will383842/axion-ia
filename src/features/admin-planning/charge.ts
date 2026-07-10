// Planning unifié — vue « charge formateur » : logique PURE (aucune I/O, aucun
// accès Prisma), donc entièrement testable sans DB.
//
// Question métier : sur un mois donné, combien de JOURS chaque formateur est-il
// mobilisé, et quel est son taux d'occupation par rapport à une capacité cible ?
//
// Deux notions à ne pas confondre :
//   - un CONFLIT (cf. conflicts.ts) = deux prestations qui se chevauchent → bloque
//     l'exécution ;
//   - une CHARGE = volume de jours mobilisés vs capacité → signal de pilotage
//     (peut légitimement dépasser 100 % = surcharge à arbitrer).
//
// Règle de comptage des jours : on réutilise `expandEventDayKeys`, seule source
// de vérité pour l'étalement d'une prestation sur les jours qu'elle traverse
// (multi-jours, passage heure d'été). On compte des CLÉS JOUR distinctes, donc :
//   - une formation de 3 jours compte 3 jours ;
//   - deux prestations le même jour comptent 1 jour (dédup naturelle par Set) ;
//   - une prestation annulée/reportée ne compte pas (elle ne mobilise personne).

import { expandEventDayKeys } from "./expand";
import { mobiliseLeFormateur } from "./conflicts";
import type { PlanningEvent } from "./types";

/**
 * Nombre de JOURS distincts où le formateur est effectivement mobilisé par les
 * `events` fournis.
 *
 * - une formation multi-jours compte chaque jour traversé (via `expandEventDayKeys`) ;
 * - deux prestations le même jour ne comptent qu'une fois (dédup par `Set`) ;
 * - les prestations annulées/reportées sont ignorées (`mobiliseLeFormateur`).
 *
 * Fonction pure : elle ne connaît ni le mois ni la DB. C'est à l'appelant de ne
 * lui passer que les prestations pertinentes (cf. `getChargeMois`).
 */
export function joursMobilises(
  events: PlanningEvent[],
  /**
   * Restreint le comptage à certains jours. Indispensable pour une charge
   * MENSUELLE : une formation du 30 juillet au 2 aout mobilise bien 4 jours,
   * mais seuls 2 relevent de juillet. Sans ce filtre, la charge du mois serait
   * surevaluee.
   */
  filtreJour?: (dayKey: string) => boolean,
): number {
  const jours = new Set<string>();
  for (const e of events) {
    if (!mobiliseLeFormateur(e)) continue;
    for (const dayKey of expandEventDayKeys(e.debut, e.fin)) {
      if (filtreJour !== undefined && !filtreJour(dayKey)) continue;
      jours.add(dayKey);
    }
  }
  return jours.size;
}

/**
 * Taux d'occupation en pourcentage ENTIER arrondi.
 *
 * - capacité ≤ 0 → 0 (évite la division par zéro et un ∞ trompeur) ;
 * - PAS de plafond : une surcharge (> 100 %) DOIT rester visible pour être
 *   arbitrée — la masquer reviendrait à cacher le problème qu'on veut détecter.
 */
export function tauxOccupation(joursMobilises: number, capaciteJours: number): number {
  if (capaciteJours <= 0) return 0;
  return Math.round((joursMobilises / capaciteJours) * 100);
}

/** Seuils de lecture de la charge (voir `niveauCharge`). */
export type NiveauCharge = "sain" | "tension" | "surcharge";

/**
 * Interprétation d'un taux d'occupation en trois niveaux de lecture.
 *
 * Choix des seuils (pilotage d'un organisme de formation) :
 *   - < 70 %  → « sain »      : marge confortable pour absorber un imprévu ;
 *   - 70-95 % → « tension »   : bien rempli, peu de marge → surveiller ;
 *   - > 95 %  → « surcharge »  : quasi saturé ou au-delà → arbitrer (report,
 *     renfort, sous-traitance). Le seuil haut est volontairement < 100 % : à
 *     95 % il ne reste presque plus de jour ouvré libre, l'alerte doit précéder
 *     la saturation totale.
 */
export function niveauCharge(tauxPct: number): NiveauCharge {
  if (tauxPct < 70) return "sain";
  if (tauxPct <= 95) return "tension";
  return "surcharge";
}

/** Ligne de charge d'un formateur, prête à afficher. */
export interface ChargeFormateur {
  trainerId: string;
  /** Nom complet « Prénom Nom » (déjà formaté). */
  nom: string;
  joursMobilises: number;
  capaciteJours: number;
  tauxPct: number;
}

/** Forme minimale d'un formateur nécessaire à la construction de la charge. */
export interface FormateurRef {
  id: string;
  prenom: string;
  nom: string;
}

/**
 * Construit la liste de charge d'un ensemble de formateurs.
 *
 * On itère sur le ROSTER `formateurs` (et non sur les clés de `parFormateur`) :
 * ainsi un formateur sans aucune prestation apparaît quand même à 0 jour / 0 %,
 * ce qui est une information de pilotage utile (sous-charge). À l'inverse, une
 * prestation attribuée à un formateur hors roster (inactif) est ignorée.
 *
 * Résultat trié par taux décroissant (les plus chargés en tête), avec le nom
 * comme départage déterministe.
 */
export function construireCharge(
  parFormateur: Map<string, PlanningEvent[]>,
  formateurs: FormateurRef[],
  capaciteJours: number,
  /** Cf. `joursMobilises` : borne le comptage aux jours du mois affiche. */
  filtreJour?: (dayKey: string) => boolean,
): ChargeFormateur[] {
  const lignes = formateurs.map((f): ChargeFormateur => {
    const events = parFormateur.get(f.id) ?? [];
    const jm = joursMobilises(events, filtreJour);
    return {
      trainerId: f.id,
      nom: `${f.prenom} ${f.nom}`.trim(),
      joursMobilises: jm,
      capaciteJours,
      tauxPct: tauxOccupation(jm, capaciteJours),
    };
  });

  lignes.sort((a, b) => {
    const d = b.tauxPct - a.tauxPct;
    return d !== 0 ? d : a.nom.localeCompare(b.nom, "fr");
  });
  return lignes;
}

/**
 * Nombre de jours ouvrés (lundi→vendredi) du mois : capacité cible par défaut.
 *
 * Calcul en UTC — on n'a besoin que du jour de la semaine, jamais de l'heure.
 * Les jours fériés ne sont PAS déduits : ils varient (Alsace-Moselle, ponts) et
 * l'opérateur ajuste la capacité à la main. Mieux vaut une capacité légèrement
 * haute et explicite qu'un calendrier férié faux.
 */
export function joursOuvresDuMois(year: number, month: number): number {
  const nbJours = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let ouvres = 0;
  for (let d = 1; d <= nbJours; d += 1) {
    const jour = new Date(Date.UTC(year, month - 1, d)).getUTCDay(); // 0=dim..6=sam
    if (jour !== 0 && jour !== 6) ouvres += 1;
  }
  return ouvres;
}
