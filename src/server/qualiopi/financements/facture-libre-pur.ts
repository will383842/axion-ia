/**
 * Hub facturation — logique métier PURE (aucun import runtime lourd : testable
 * sans DB, sans react-pdf, sans next). Consommée par facture-libre.ts.
 *
 * Règle TVA centrale : l'exonération 261-4-4° CGI ne couvre QUE la formation
 * professionnelle continue. En régime `exoneration_261`, les lignes d'une
 * activité hors champ (audit/implementation/site_web) sont taxées au taux
 * standard, sauf taux explicite par ligne. `franchise_293b` et `assujetti`
 * s'appliquent au niveau de l'entité (aucun forçage par activité).
 */

import type { ActiviteFacturation } from "../../../../prisma/generated/client";
import type { RegimeTva } from "@/server/qualiopi/legal/tva";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";

/** Activités couvertes par l'exonération 261-4-4° (formation pro continue). */
export const ACTIVITES_EXONERABLES: ReadonlyArray<ActiviteFacturation> = ["formation", "un_a_un"];

/** Libellés d'affichage des activités (PDF, admin). */
export const ACTIVITE_LABELS: Record<ActiviteFacturation, string> = {
  formation: "Formation",
  un_a_un: "Accompagnement individuel (1-to-1)",
  audit: "Audit IA",
  implementation: "Implémentation IA",
  site_web: "Site web augmenté",
};

/**
 * Applique la règle « exonération = formation uniquement » : en régime
 * `exoneration_261`, une activité hors champ voit ses lignes sans taux
 * explicite taxées au taux standard.
 */
export function normaliserLignesPourActivite(
  lignes: LigneFacture[],
  activite: ActiviteFacturation,
  regimeTva: RegimeTva,
  tauxStandard: number,
): LigneFacture[] {
  if (regimeTva !== "exoneration_261") return lignes;
  if (ACTIVITES_EXONERABLES.includes(activite)) return lignes;
  return lignes.map((l) =>
    l.tauxTvaPercent === undefined ? { ...l, tauxTvaPercent: tauxStandard } : l,
  );
}

/**
 * Construit les lignes d'un avoir : négation intégrale des lignes d'origine,
 * ou ligne unique partielle (HT) si `montantPartielHtCents` est fourni.
 * Les taux de TVA d'origine sont conservés (l'avoir rectifie la même TVA).
 */
export function construireLignesAvoir(
  lignesOrigine: LigneFacture[],
  montantPartielHtCents: number | undefined,
  motif: string,
  tauxUniformePercent?: number,
): LigneFacture[] {
  if (montantPartielHtCents === undefined) {
    return lignesOrigine.map((l) => ({
      ...l,
      designation: `Avoir — ${l.designation}`,
      prixUnitaireHtCents: -l.prixUnitaireHtCents,
    }));
  }
  return [
    {
      designation: `Avoir partiel — ${motif}`,
      quantite: 1,
      prixUnitaireHtCents: -Math.abs(montantPartielHtCents),
      ...(tauxUniformePercent !== undefined ? { tauxTvaPercent: tauxUniformePercent } : {}),
    },
  ];
}

/**
 * Avance une date de N mois en conservant le jour (clampé à la fin du mois
 * cible : 31 janv. + 1 mois → 28/29 févr., jamais de dérive vers mars).
 * Utilisé par les plans récurrents (Phase 5).
 */
export function calculerProchaineGeneration(depuis: Date, periodiciteMois: number): Date {
  const d = new Date(depuis);
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + periodiciteMois);
  const dernierJourDuMois = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(jour, dernierJourDuMois));
  return d;
}

/** Statut d'encaissement d'une facture d'après le total encaissé (centimes). */
export function calculerStatutEncaissement(
  montantDuCents: number,
  totalEncaisseCents: number,
): "emise" | "partiellement_payee" | "payee" {
  if (totalEncaisseCents <= 0) return "emise";
  if (totalEncaisseCents >= montantDuCents) return "payee";
  return "partiellement_payee";
}
