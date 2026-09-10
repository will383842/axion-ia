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
import { echeanceEffective, joursDeRetard, STATUTS_RELEVE_DU } from "./echeance";
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
  /** Échéance effective (colonne, ou `dateFacture + 30 j`). `null` sans facture. */
  echeance: Date | null;
  /** Jours de retard, `null` si le relevé n'est pas en retard. */
  retardJours: number | null;
  /**
   * Autofacturation — l'état des trois moments qui comptent.
   *
   * 🔑 `emiseAt` sans `transmiseAt` n'est PAS un détail d'affichage : la
   * fenêtre de contestation court depuis la TRANSMISSION, donc une pièce émise
   * et non transmise n'ouvre aucun délai. L'écran doit pouvoir le dire, et
   * proposer de réessayer.
   */
  autofacture: {
    emiseAt: Date | null;
    transmiseAt: Date | null;
    contestationAvantAt: Date | null;
    contesteeAt: Date | null;
    contestationMotif: string | null;
  };
  lignes: LigneListe[];
}

/**
 * Un relevé et TOUTES les lignes du formateur sur la période — pas seulement
 * celles qui lui sont rattachées. Une ligne `previsionnel` ou `analytique` ne
 * pèse pas sur la facture mais explique le mois : la cacher rendrait le total
 * incompréhensible (« pourquoi 3 jours animés et 2 facturés ? »).
 */
export async function getReleveDetail(id: string, now = new Date()): Promise<ReleveDetail | null> {
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
        echeanceAt: true,
        autofactureAt: true,
        autofactureTransmiseAt: true,
        contestationAvantAt: true,
        contesteeAt: true,
        contestationMotif: true,
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
      echeance: echeanceEffective(r),
      retardJours: joursDeRetard(r, now),
      autofacture: {
        emiseAt: r.autofactureAt,
        transmiseAt: r.autofactureTransmiseAt,
        contestationAvantAt: r.contestationAvantAt,
        contesteeAt: r.contesteeAt,
        contestationMotif: r.contestationMotif,
      },
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

export interface ReleveDu {
  id: string;
  trainerNom: string;
  periodeYear: number;
  periodeMonth: number;
  statut: StatementStatut;
  totalTtcCents: number;
  numeroFacture: string | null;
  /** Échéance RÉELLE : colonne posée, ou `dateFacture + 30 j` pour le stock. */
  echeance: Date | null;
  /** Jours écoulés depuis l'échéance, `null` si le relevé n'est pas en retard. */
  retardJours: number | null;
  /**
   * 🔴 Autofacture ÉMISE et JAMAIS TRANSMISE — l'état le plus dangereux du
   * circuit, et le seul que cet écran ne savait pas montrer.
   *
   * Une telle pièce s'affiche « Facture reçue » avec une échéance, comme
   * n'importe quelle autre : rien ne distingue une facture que le formateur a
   * reçue d'une facture qu'il ignore. Or celle-ci n'a ouvert AUCUN délai de
   * contestation, et la payer à l'échéance reviendrait à régler une pièce
   * qu'il n'a jamais pu contester — la quatrième condition de régularité,
   * perdue en silence.
   *
   * La fiche du relevé le disait déjà. Mais la fiche, il faut l'ouvrir : c'est
   * ICI qu'on décide de payer.
   */
  autofactureNonTransmise: boolean;
}

/**
 * Ce que l'organisme DOIT aux formateurs, toutes périodes confondues.
 *
 * 🔴 L'écran de rémunération est PAR PÉRIODE, et c'est ce qui rendait la dette
 * invisible. Un relevé de juillet impayé n'apparaît plus dès qu'on affiche août :
 * il faut savoir qu'il existe pour aller le chercher. La question « qu'est-ce
 * qu'on doit, à qui, échu ou à venir » n'avait donc aucune réponse à l'écran —
 * et aucune alerte ne la posait non plus (cf. `releve_formateur_echu`).
 *
 * ⚠️ Le tri est par ÉCHÉANCE croissante, le plus en retard d'abord, et il se
 * fait EN MÉMOIRE : trier en SQL sur `echeanceAt` remonterait les lignes du
 * stock (colonne nulle) au mauvais bout de la liste, exactement là où on ne les
 * regarde pas. Le volume est celui des relevés non soldés — quelques dizaines.
 *
 * Un relevé `valide` sans facture n'a pas d'échéance : il apparaît, sans retard,
 * en fin de liste. C'est voulu — la dette existe, son exigibilité n'est pas
 * encore née.
 */
export async function listRelevesDus(now = new Date()): Promise<ReleveDu[]> {
  try {
    const rows = await prisma.trainerStatement.findMany({
      where: { statut: { in: [...STATUTS_RELEVE_DU] }, payeAt: null },
      select: {
        id: true,
        statut: true,
        autofactureAt: true,
        autofactureTransmiseAt: true,
        periodeYear: true,
        periodeMonth: true,
        totalTtcCents: true,
        numeroFacture: true,
        dateFacture: true,
        echeanceAt: true,
        payeAt: true,
        trainer: { select: { nom: true, prenom: true } },
      },
      take: 200,
    });

    return rows
      .map((r) => ({
        id: r.id,
        trainerNom: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
        periodeYear: r.periodeYear,
        periodeMonth: r.periodeMonth,
        statut: r.statut,
        totalTtcCents: r.totalTtcCents,
        numeroFacture: r.numeroFacture,
        echeance: echeanceEffective(r),
        retardJours: joursDeRetard(r, now),
        autofactureNonTransmise: r.autofactureAt !== null && r.autofactureTransmiseAt === null,
      }))
      .sort((a, b) => {
        // Sans échéance = pas encore exigible : en fin de liste, jamais en tête.
        if (a.echeance === null) return b.echeance === null ? 0 : 1;
        if (b.echeance === null) return -1;
        return a.echeance.getTime() - b.echeance.getTime();
      });
  } catch {
    return [];
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
