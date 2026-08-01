/**
 * Libellé HUMAIN d'une règle de rémunération — pour les pièces contractuelles.
 *
 * ## Pourquoi ce module existe (2026-08-01)
 *
 * La lettre de mission imprimait `trainer.tarifJourneeHtCents` — le tarif
 * unique de la fiche — pendant que les relevés mensuels payaient selon
 * `TrainerCompensationRule` (règles datées, par prestation, par formation,
 * quatre modèles dont la commission sur CA). Deux chiffres, deux endroits,
 * qui pouvaient se contredire sur une pièce SIGNÉE : la lettre annonçait
 * 600 € / jour à un formateur payé 40 % du CA.
 *
 * Ce module traduit la règle RÉSOLUE (`resolveRegle`, le même résolveur que la
 * paie) en une phrase imprimable. Une seule traduction, employée par toutes les
 * pièces : deux traductions divergeraient un jour sur le même barème.
 *
 * PUR : aucune requête, aucune horloge. L'appelant résout la règle et fournit
 * le repli.
 */

import type { RegleRemuneration } from "./calcul";

/** Format monétaire des pièces (aligné sur `formatEur` de base-layout). */
function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Pourcentage sans zéros de traîne parasites (40 → « 40 % », 12.5 → « 12,5 % »). */
function pct(valeur: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(valeur)} %`;
}

/**
 * Traduit la règle en phrase de rémunération, ou le repli, ou l'aveu.
 *
 * 🔴 Le dernier cas IMPRIME l'absence au lieu de « 0,00 € / jour » : un zéro
 * ressemble à un tarif convenu — gratuit — sur une pièce qui engage. Écrire
 * qu'aucun barème n'est enregistré est rattrapable ; un faux zéro signé ne
 * l'est pas.
 *
 * ⚠️ Un taux absent sur le modèle qui l'exige relève du même traitement : la
 * règle est mal saisie, on l'écrit plutôt que d'inventer un montant.
 */
export function libelleRemuneration(
  regle: RegleRemuneration | null,
  tarifJourneeHtCentsFallback: number | null,
): string {
  if (regle !== null) {
    switch (regle.model) {
      case "taux_journalier":
        if (regle.tauxJourneeHtCents !== undefined) {
          return `${eur(regle.tauxJourneeHtCents)} HT par jour d'animation`;
        }
        break;
      case "taux_horaire":
        if (regle.tauxHoraireHtCents !== undefined) {
          return `${eur(regle.tauxHoraireHtCents)} HT par heure animée`;
        }
        break;
      case "commission_ca_pct":
        if (regle.commissionPct !== undefined) {
          return `${pct(regle.commissionPct)} du chiffre d'affaires HT de la prestation`;
        }
        break;
      case "forfait_prestation":
        if (regle.forfaitHtCents !== undefined) {
          return `${eur(regle.forfaitHtCents)} HT forfaitaire par prestation`;
        }
        break;
    }
  }
  if (tarifJourneeHtCentsFallback !== null && tarifJourneeHtCentsFallback > 0) {
    return `${eur(tarifJourneeHtCentsFallback)} HT par jour d'animation (tarif général du formateur)`;
  }
  return "Rémunération à convenir — aucun barème enregistré pour ce formateur à ce jour";
}
