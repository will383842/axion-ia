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
import { echeanceEffective, joursDeRetard } from "./echeance";
import { contestationOuverte } from "./autofacturation";
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
    /**
     * Le PDF de CETTE facture, dans `documents_generes`. `null` pour les pièces
     * émises avant le 2026-09-12 — elles restent identifiables par leur numéro,
     * mais aucun lien ne les ouvre : reconstituer le rattachement par
     * heuristique reproduirait le défaut qu'on vient de corriger.
     */
    documentId: string | null;
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
        autofactureDocumentId: true,
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
        documentId: r.autofactureDocumentId,
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

/* ──────────────────────────────────────────────────────────────────────────────
 * Ce que le FORMATEUR voit de sa propre rémunération
 * ────────────────────────────────────────────────────────────────────────────── */

export interface ReleveDuFormateur {
  id: string;
  periodeYear: number;
  periodeMonth: number;
  statut: StatementStatut;
  totalHtCents: number;
  tvaCents: number;
  totalTtcCents: number;
  numeroFacture: string | null;
  /** Le PDF de SA facture, s'il lui est rattaché. */
  documentId: string | null;
  echeance: Date | null;
  payeAt: Date | null;
  /** Terme de son droit de contestation. `null` si la pièce ne lui est pas parvenue. */
  contestationAvantAt: Date | null;
  contesteeAt: Date | null;
  /**
   * La fenêtre de contestation est-elle ENCORE ouverte ?
   *
   * 🔑 Calculée ICI, jamais dans l'écran. Un composant qui lirait l'horloge
   * pendant son rendu viole la pureté du rendu — et surtout, il donnerait une
   * seconde réponse à une question dont le serveur a déjà l'autorité. C'est la
   * deuxième fois que ce réflexe est corrigé dans ce chantier.
   */
  contestable: boolean;
}

/**
 * Les relevés d'UN formateur, pour SON espace.
 *
 * 🔴 IL N'AVAIT AUCUN ENDROIT OÙ RETROUVER SA FACTURE. Son espace portait ses
 * sessions, ses séances, ses missions, ses pièces à signer — ni relevé, ni
 * facture, ni ce qu'on lui doit. Une autofacture établie EN SON NOM ne vivait
 * que dans un e-mail : perdu l'e-mail, perdue la pièce.
 *
 * C'est d'autant moins tenable qu'il dispose de HUIT JOURS pour la contester.
 * Demander à quelqu'un de contester un document qu'il ne peut pas relire n'est
 * pas un droit, c'est une formalité.
 *
 * ⚠️ Le filtre porte sur `trainerId`, jamais sur un paramètre d'appel : c'est
 * une garde de PROPRIÉTÉ. Un formateur ne voit que ses propres relevés.
 *
 * ⚠️ `brouillon` EXCLU : un montant qu'aucun humain n'a relu n'est pas une
 * promesse, et le montrer ferait naître une attente sur un chiffre qui peut
 * encore changer. `annule` aussi — une ligne annulée n'attend plus rien.
 */
export async function listRelevesDuFormateur(
  trainerId: string,
  now = new Date(),
): Promise<ReleveDuFormateur[]> {
  try {
    const rows = await prisma.trainerStatement.findMany({
      where: { trainerId, statut: { notIn: ["brouillon", "annule"] } },
      select: {
        id: true,
        periodeYear: true,
        periodeMonth: true,
        statut: true,
        totalHtCents: true,
        tvaCents: true,
        totalTtcCents: true,
        numeroFacture: true,
        autofactureDocumentId: true,
        dateFacture: true,
        echeanceAt: true,
        payeAt: true,
        contestationAvantAt: true,
        contesteeAt: true,
      },
      orderBy: [{ periodeYear: "desc" }, { periodeMonth: "desc" }],
      take: 36,
    });

    return rows.map((r) => ({
      id: r.id,
      periodeYear: r.periodeYear,
      periodeMonth: r.periodeMonth,
      statut: r.statut,
      totalHtCents: r.totalHtCents,
      tvaCents: r.tvaCents,
      totalTtcCents: r.totalTtcCents,
      numeroFacture: r.numeroFacture,
      documentId: r.autofactureDocumentId,
      echeance: echeanceEffective(r),
      payeAt: r.payeAt,
      contestationAvantAt: r.contestationAvantAt,
      contesteeAt: r.contesteeAt,
      /*
        🔴 LA RÈGLE VIENT DU MODULE, elle n'est PAS réécrite ici.

        Ces quatre conditions étaient recopiées en clair : une SECONDE
        implémentation de `contestationOuverte`, à côté de la première, et rien
        ne les obligeait à rester d'accord. Le jour où le délai change, ou où la
        règle se raffine, l'une des deux bouge — et l'écran du formateur affirme
        « contestable » sur une pièce que l'action refuse, ou l'inverse.

        ⚠️ `payeAt` n'appartient PAS à la règle et reste donc ici : une facture
        déjà payée n'est pas « hors délai », elle est SOLDÉE. Confondre les deux
        ferait dire au formateur qu'il a laissé passer son délai alors qu'il a
        simplement été réglé.
      */
      contestable: r.payeAt === null && contestationOuverte(r, now),
    }));
  } catch {
    return [];
  }
}
