/**
 * Qualiopi — Lecture des relevés et lignes de rémunération (pilier C).
 *
 * Aucune règle métier ici : le calcul vit dans `calcul.ts` / `run.ts`, l'écriture
 * dans `statements.ts`. Ce module ne fait que présenter ce qui est en base.
 *
 * Stub-aware (try/catch → valeurs vides) : ces lectures peuvent être appelées au
 * build SSG, où `DATABASE_URL` pointe sur `stub.invalid`. Jamais de `*OrThrow`.
 */

import { prisma } from "@/lib/prisma";
import type { FeeLineStatut, Periode, StatementStatut } from "./run";
import type {
  CompensationModel,
  FeeLineNature,
  PrestationType,
  TvaRegimeHonoraires,
} from "./calcul";

export interface ReleveListe {
  id: string;
  trainerId: string;
  trainerNom: string;
  periodeYear: number;
  periodeMonth: number;
  statut: StatementStatut;
  tvaRegime: TvaRegimeHonoraires;
  totalHtCents: number;
  tvaCents: number;
  totalTtcCents: number;
  nbLignes: number;
}

/** Relevés d'une période, du plus gros montant au plus petit. */
export async function listRelevesPeriode(periode: Periode): Promise<ReleveListe[]> {
  try {
    const rows = await prisma.trainerStatement.findMany({
      where: { periodeYear: periode.year, periodeMonth: periode.month },
      select: {
        id: true,
        trainerId: true,
        periodeYear: true,
        periodeMonth: true,
        statut: true,
        tvaRegime: true,
        totalHtCents: true,
        tvaCents: true,
        totalTtcCents: true,
        trainer: { select: { nom: true, prenom: true } },
        _count: { select: { feeLines: true } },
      },
      orderBy: { totalTtcCents: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      trainerId: r.trainerId,
      trainerNom: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
      periodeYear: r.periodeYear,
      periodeMonth: r.periodeMonth,
      statut: r.statut,
      tvaRegime: r.tvaRegime,
      totalHtCents: r.totalHtCents,
      tvaCents: r.tvaCents,
      totalTtcCents: r.totalTtcCents,
      nbLignes: r._count.feeLines,
    }));
  } catch {
    return [];
  }
}

export interface LigneListe {
  id: string;
  prestationType: PrestationType;
  model: CompensationModel;
  nature: FeeLineNature;
  statut: FeeLineStatut;
  heures: number | null;
  montantHtCents: number;
  caBaseCents: number | null;
  motif: string | null;
  rattacheeAuReleve: boolean;
}

export interface ReleveDetail extends ReleveListe {
  numeroFacture: string | null;
  dateFacture: Date | null;
  montantFactureTtcCents: number | null;
  payeAt: Date | null;
  moyenPaiement: string | null;
  lignes: LigneListe[];
}

/**
 * Un relevé et TOUTES les lignes du formateur sur la période — pas seulement
 * celles qui lui sont rattachées. Une ligne `previsionnel` ou `analytique` ne
 * pèse pas sur la facture mais explique le mois : la cacher rendrait le total
 * incompréhensible (« pourquoi 3 jours animés et 2 facturés ? »).
 */
export async function getReleveDetail(id: string): Promise<ReleveDetail | null> {
  try {
    const r = await prisma.trainerStatement.findUnique({
      where: { id },
      select: {
        id: true,
        trainerId: true,
        periodeYear: true,
        periodeMonth: true,
        statut: true,
        tvaRegime: true,
        totalHtCents: true,
        tvaCents: true,
        totalTtcCents: true,
        numeroFacture: true,
        dateFacture: true,
        montantFactureTtcCents: true,
        payeAt: true,
        moyenPaiement: true,
        trainer: { select: { nom: true, prenom: true } },
      },
    });
    if (r === null) return null;

    const lignes = await prisma.trainerFeeLine.findMany({
      where: {
        trainerId: r.trainerId,
        periodeYear: r.periodeYear,
        periodeMonth: r.periodeMonth,
      },
      select: {
        id: true,
        prestationType: true,
        model: true,
        nature: true,
        statut: true,
        heures: true,
        montantHtCents: true,
        caBaseCents: true,
        motif: true,
        statementId: true,
      },
      orderBy: { montantHtCents: "desc" },
    });

    return {
      id: r.id,
      trainerId: r.trainerId,
      trainerNom: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
      periodeYear: r.periodeYear,
      periodeMonth: r.periodeMonth,
      statut: r.statut,
      tvaRegime: r.tvaRegime,
      totalHtCents: r.totalHtCents,
      tvaCents: r.tvaCents,
      totalTtcCents: r.totalTtcCents,
      numeroFacture: r.numeroFacture,
      dateFacture: r.dateFacture,
      montantFactureTtcCents: r.montantFactureTtcCents,
      payeAt: r.payeAt,
      moyenPaiement: r.moyenPaiement,
      nbLignes: lignes.length,
      lignes: lignes.map((l) => ({
        id: l.id,
        prestationType: l.prestationType,
        model: l.model,
        nature: l.nature,
        statut: l.statut,
        heures: l.heures === null ? null : l.heures.toNumber(),
        montantHtCents: l.montantHtCents,
        caBaseCents: l.caBaseCents,
        motif: l.motif,
        rattacheeAuReleve: l.statementId === r.id,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Statuts de relevé dont les honoraires sont ENGAGÉS, donc déclarables au BPF.
 *
 * `brouillon` et `a_valider` en sont exclus : un montant qu'un humain n'a pas
 * encore relu n'est pas une charge de l'exercice. `annule` aussi, évidemment.
 * Le BPF déclare ce qui est dû, pas ce qui est estimé.
 */
const STATUTS_RELEVE_ENGAGES: readonly StatementStatut[] = ["valide", "facture_recue", "paye"];

export interface HonorairesAnnee {
  annee: number;
  totalHtCents: number;
  parFormateur: { trainerId: string; trainerNom: string; totalHtCents: number }[];
}

/**
 * Honoraires de sous-traitance d'un exercice — la charge que le BPF attend en
 * face des produits de formation.
 *
 * N'écrit RIEN : la dépense BPF reste saisie par un humain (`ajouterDepense`).
 * Déclarer une charge est un acte comptable ; ce module fournit le chiffre et
 * son détail, pas la déclaration. Seules les lignes `honoraire_du` comptent —
 * une ligne `analytique` valorise un salaire, qui est déjà déclaré ailleurs.
 */
export async function honorairesSousTraitanceAnnee(annee: number): Promise<HonorairesAnnee> {
  try {
    const rows = await prisma.trainerFeeLine.findMany({
      where: {
        periodeYear: annee,
        nature: "honoraire_du",
        statement: { statut: { in: [...STATUTS_RELEVE_ENGAGES] } },
      },
      select: {
        trainerId: true,
        montantHtCents: true,
        trainer: { select: { nom: true, prenom: true } },
      },
    });

    const parId = new Map<string, { trainerNom: string; totalHtCents: number }>();
    let totalHtCents = 0;
    for (const r of rows) {
      totalHtCents += r.montantHtCents;
      const acc = parId.get(r.trainerId) ?? {
        trainerNom: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
        totalHtCents: 0,
      };
      acc.totalHtCents += r.montantHtCents;
      parId.set(r.trainerId, acc);
    }

    return {
      annee,
      totalHtCents,
      parFormateur: [...parId.entries()]
        .map(([trainerId, v]) => ({ trainerId, ...v }))
        .sort((a, b) => b.totalHtCents - a.totalHtCents),
    };
  } catch {
    return { annee, totalHtCents: 0, parFormateur: [] };
  }
}

export interface AnomaliePersistee {
  id: string;
  trainerId: string;
  trainerNom: string;
  motif: string;
  prestationType: string;
  montantHtCents: number;
}

/**
 * Les lignes d'une période portant un motif d'anomalie. C'est la trace DURABLE
 * du run : la liste retournée en mémoire par `runRemunerationMensuelle` s'évapore
 * avec la requête, celle-ci survit et se relit demain.
 */
export async function listAnomaliesPeriode(periode: Periode): Promise<AnomaliePersistee[]> {
  try {
    const rows = await prisma.trainerFeeLine.findMany({
      where: {
        periodeYear: periode.year,
        periodeMonth: periode.month,
        motif: { not: null },
      },
      select: {
        id: true,
        trainerId: true,
        motif: true,
        prestationType: true,
        montantHtCents: true,
        trainer: { select: { nom: true, prenom: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      trainerId: r.trainerId,
      trainerNom: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
      motif: r.motif ?? "",
      prestationType: r.prestationType,
      montantHtCents: r.montantHtCents,
    }));
  } catch {
    return [];
  }
}
