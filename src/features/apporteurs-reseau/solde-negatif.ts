// Réseau d'apporteurs — SOLDE NÉGATIF (contrat 2.3, art. 12.4). Lecture pour la console.
//
// Quand les reprises en attente dépassent les commissions encore à facturer, l'apporteur doit la
// différence. Elle s'impute par compensation sur ses commissions à venir (la facturation le fait
// d'elle-même, avec pièces). À défaut d'imputation dans les DOUZE mois, la Société PEUT en demander
// le remboursement par écrit, dans la limite des commissions versées au cours des VINGT-QUATRE mois
// précédant l'annulation à l'origine de la reprise. Ce module ne fait qu'AFFICHER cette situation à
// Williams : rien n'est envoyé à l'apporteur (décision de Will).

import { prisma } from "@/lib/prisma";

import { ajouterMois } from "./regles";

export const DELAI_IMPUTATION_MOIS = 12;
export const PLAFOND_REMBOURSEMENT_MOIS = 24;

export interface SoldeNegatif {
  soldeCents: number;
  /** Date de la plus ancienne reprise non imputée (repère de l'annulation, faute de mieux). */
  depuis: Date;
  remboursementDemandable: boolean;
  /** Commissions versées dans les 24 mois précédant `depuis`. */
  plafondCents: number;
  /** Ce qui peut être demandé : le solde, dans la limite du plafond. */
  demandableCents: number;
}

/** Calcul pur, à partir des lignes lues. `null` si le solde n'est pas négatif. */
export function calculerSoldeNegatif(
  e: {
    reprisesEnAttente: ReadonlyArray<{ montantCents: number | null; creeAt: Date }>;
    aFacturerCents: number;
    versees: ReadonlyArray<{ montantCents: number | null; verseeAt: Date | null }>;
  },
  maintenant: Date,
): SoldeNegatif | null {
  const reprises = e.reprisesEnAttente.reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0);
  const solde = reprises - Math.max(0, e.aFacturerCents);
  if (solde <= 0 || e.reprisesEnAttente.length === 0) return null;
  const depuis = new Date(Math.min(...e.reprisesEnAttente.map((r) => r.creeAt.getTime())));
  const debut = ajouterMois(depuis, -PLAFOND_REMBOURSEMENT_MOIS).getTime();
  const plafond = e.versees
    .filter(
      (v) =>
        v.verseeAt && v.verseeAt.getTime() >= debut && v.verseeAt.getTime() <= depuis.getTime(),
    )
    .reduce((s, v) => s + (v.montantCents ?? 0), 0);
  return {
    soldeCents: solde,
    depuis,
    remboursementDemandable:
      maintenant.getTime() >= ajouterMois(depuis, DELAI_IMPUTATION_MOIS).getTime(),
    plafondCents: plafond,
    demandableCents: Math.min(solde, plafond),
  };
}

export async function lireSoldeNegatif(
  apporteurId: string,
  maintenant: Date = new Date(),
): Promise<SoldeNegatif | null> {
  const [reprises, aFacturer, versees] = await Promise.all([
    prisma.commissionApporteur.findMany({
      where: { apporteurId, statut: "reprise", releveMois: null },
      select: { montantCents: true, creeAt: true },
    }),
    prisma.commissionApporteur.findMany({
      where: {
        apporteurId,
        statut: { in: ["due", "en_attente_vigilance"] },
        autofactureNumero: null,
        montantCents: { not: null },
      },
      select: { montantCents: true },
    }),
    prisma.commissionApporteur.findMany({
      where: { apporteurId, statut: "versee" },
      select: { montantCents: true, verseeAt: true },
    }),
  ]);
  return calculerSoldeNegatif(
    {
      reprisesEnAttente: reprises,
      aFacturerCents: aFacturer.reduce((s, l) => s + (l.montantCents ?? 0), 0),
      versees,
    },
    maintenant,
  );
}
