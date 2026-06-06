/**
 * Qualiopi — Calcul OPCO (module PUR, T11 AGENT A).
 *
 * Pas d'import DB/next ici : fonctions pures testables en isolation.
 * Plafonds lus via la config Qualiopi (SiteSetting) côté appelant.
 *
 * Conventions monétaires :
 *   - `PlafondOpco` : valeurs en **euros** (issues de QUALIOPI_CONFIG_REGISTRY, ex. 40 €/h).
 *   - Sorties `prixUnitaireHtCents` / `totalHtCents` : **centimes** (integer, sans arrondi flottant).
 */

import type { ModaliteFormation } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plafonds OPCO Atlas issus de getQualiopiConfig (en euros, pas en centimes).
 * Noms conformes au contrat T11 AGENT A.
 */
export interface PlafondOpco {
  /** Plafond intra (€/h/participant). Ex : 40. */
  intraHoraire: number;
  /** Plafond inter présentiel (€/h/participant). Ex : 25. */
  interPresentiel: number;
  /** Plafond inter distanciel (€/h/participant). Ex : 15. */
  interDistanciel: number;
}

/** Ligne de facturation (centimes). Utilisée par FactureData.lignes. */
export interface LigneFacture {
  designation: string;
  quantite: number;
  prixUnitaireHtCents: number;
}

/** Résultat de calcul de ventilation (lignes + total en centimes). */
export interface ResultatVentilation {
  lignes: LigneFacture[];
  totalHtCents: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// tarifHoraireOpco
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne le tarif horaire plafond OPCO en **centimes** selon la modalité
 * et le caractère intra/inter.
 *
 * @param modalite  modalité Prisma de la session.
 * @param intra     `true` si intra-entreprise.
 * @param plafonds  plafonds OPCO Atlas en euros (issus de getQualiopiConfig).
 */
export function tarifHoraireOpco(
  modalite: ModaliteFormation,
  intra: boolean,
  plafonds: PlafondOpco,
): number {
  if (intra) {
    return Math.round(plafonds.intraHoraire * 100);
  }
  if (modalite === "distanciel") {
    return Math.round(plafonds.interDistanciel * 100);
  }
  // présentiel ou hybride → inter présentiel
  return Math.round(plafonds.interPresentiel * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeVentilationHoraire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule les lignes de facturation en mode ventilation horaire OPCO.
 *
 * Formule : `dureeHeures × tarifHoraireCents` par participant.
 * La ligne expose `quantite = nbParticipants` et `prixUnitaireHtCents` = coût
 * par participant pour toute la durée.
 *
 * @param input.dureeHeures       durée réelle (heures, peut être décimal ex. 3.5).
 * @param input.nbParticipants    nombre de participants réels.
 * @param input.tarifHoraireCents tarif HT OPCO en centimes/h/participant.
 */
export function computeVentilationHoraire(input: {
  dureeHeures: number;
  nbParticipants: number;
  tarifHoraireCents: number;
}): ResultatVentilation {
  const { dureeHeures, nbParticipants, tarifHoraireCents } = input;

  // Coût unitaire par participant (arrondi entier pour éviter les flottants).
  const puCents = Math.round(dureeHeures * tarifHoraireCents);
  const totalHtCents = puCents * nbParticipants;

  const lignes: LigneFacture[] = [
    {
      designation: `Formation professionnelle — ${dureeHeures} h × ${nbParticipants} participant${nbParticipants > 1 ? "s" : ""} (ventilation horaire OPCO)`,
      quantite: nbParticipants,
      prixUnitaireHtCents: puCents,
    },
  ];

  return { lignes, totalHtCents };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeForfait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule les lignes de facturation en mode forfaitaire.
 *
 * Une seule ligne : `1 × montantHtCents`.
 *
 * @param montantHtCents montant HT forfaitaire de la session (centimes).
 */
export function computeForfait(montantHtCents: number): ResultatVentilation {
  const lignes: LigneFacture[] = [
    {
      designation: "Formation professionnelle — forfait session",
      quantite: 1,
      prixUnitaireHtCents: montantHtCents,
    },
  ];
  return { lignes, totalHtCents: montantHtCents };
}
