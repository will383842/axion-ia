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

import type { ModaliteFormation, PriseEnChargeUnite } from "../../../../prisma/generated/client";

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

// ─────────────────────────────────────────────────────────────────────────────
// computeVentilationDossier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule les lignes de facturation à partir du barème de prise en charge
 * saisi sur le dossier (TrainingSession.priseEnChargeMontantCents +
 * priseEnChargeUnite), en remplacement du référentiel OPCO centralisé.
 *
 * Formules par unité :
 *   - euro_heure      → dureeHeures × nbParticipants × montantCents
 *   - euro_jour       → ceil(dureeHeures / 7) × nbParticipants × montantCents
 *   - euro_formation  → nbParticipants × montantCents
 *   - euro_an_salarie → nbParticipants × montantCents
 *
 * Plafonds (optionnels) :
 *   - plafondFormationCents : cap du coût par participant sur l'ensemble de la formation.
 *   - plafondAnnuelCents    : cap du coût par salarié sur l'année (même logique par participant).
 *
 * @param input.unite                  unité de prise en charge issue du dossier.
 * @param input.montantCents           montant unitaire en centimes.
 * @param input.dureeHeures            durée réelle de la session (heures, peut être décimal).
 * @param input.nbParticipants         nombre de participants réels.
 * @param input.plafondFormationCents  plafond par participant pour la formation (optionnel).
 * @param input.plafondAnnuelCents     plafond annuel par salarié (optionnel).
 */
export function computeVentilationDossier(input: {
  unite: PriseEnChargeUnite;
  montantCents: number;
  dureeHeures: number;
  nbParticipants: number;
  plafondFormationCents?: number | null;
  plafondAnnuelCents?: number | null;
}): ResultatVentilation {
  const {
    unite,
    montantCents,
    dureeHeures,
    nbParticipants,
    plafondFormationCents,
    plafondAnnuelCents,
  } = input;

  // ── Désignation lisible selon l'unité ────────────────────────────────────
  const UNITE_LABELS: Record<PriseEnChargeUnite, string> = {
    euro_heure: `€/h`,
    euro_jour: `€/j`,
    euro_formation: `€/formation`,
    euro_an_salarie: `€/an/salarié`,
  };
  const uniteLabel = UNITE_LABELS[unite];

  // ── Coût brut par participant selon l'unité ──────────────────────────────
  let puBrutCents: number;
  let quantiteLabel: string;

  switch (unite) {
    case "euro_heure": {
      puBrutCents = Math.round(dureeHeures * montantCents);
      quantiteLabel = `${dureeHeures} h × ${nbParticipants} participant${nbParticipants > 1 ? "s" : ""}`;
      break;
    }
    case "euro_jour": {
      const nbJours = Math.ceil(dureeHeures / 7);
      puBrutCents = nbJours * montantCents;
      quantiteLabel = `${nbJours} j × ${nbParticipants} participant${nbParticipants > 1 ? "s" : ""}`;
      break;
    }
    case "euro_formation": {
      puBrutCents = montantCents;
      quantiteLabel = `${nbParticipants} participant${nbParticipants > 1 ? "s" : ""}`;
      break;
    }
    case "euro_an_salarie": {
      puBrutCents = montantCents;
      quantiteLabel = `${nbParticipants} salarié${nbParticipants > 1 ? "s" : ""}`;
      break;
    }
  }

  // ── Application des plafonds par participant ─────────────────────────────
  let puPlafonneCents = puBrutCents;

  if (plafondFormationCents != null && puPlafonneCents > plafondFormationCents) {
    puPlafonneCents = plafondFormationCents;
  }
  if (plafondAnnuelCents != null && puPlafonneCents > plafondAnnuelCents) {
    puPlafonneCents = plafondAnnuelCents;
  }

  const totalHtCents = puPlafonneCents * nbParticipants;

  const designation =
    `Prise en charge formation — ${quantiteLabel} @ ${(montantCents / 100).toFixed(2)} ${uniteLabel}` +
    (puPlafonneCents < puBrutCents
      ? ` (plafonné à ${(puPlafonneCents / 100).toFixed(2)} €/participant)`
      : "");

  const lignes: LigneFacture[] = [
    {
      designation,
      quantite: nbParticipants,
      prixUnitaireHtCents: puPlafonneCents,
    },
  ];

  return { lignes, totalHtCents };
}
