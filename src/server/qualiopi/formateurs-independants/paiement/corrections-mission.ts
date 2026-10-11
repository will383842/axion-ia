/**
 * Formateurs indépendants — CORRECTIONS DU PAIEMENT PAR MISSION, en base
 * (lots L12f, L12g, L12l). Livrées ÉTEINTES : aucun écran ni aucun passage ne
 * les appelle encore ; elles s'exécutent dans la transaction de l'appelant,
 * APRÈS `prendreVerrousRemuneration` (période puis formateur).
 *
 *   - **L12f — indemnité d'annulation** : une ligne `indemnite_annulation` par
 *     (formateur, session), SANS le mois (index unique), rattachée au relevé de
 *     mission du mois de l'annulation ;
 *   - **L12g — avoir et réémission** : une pièce de mission non payée reçoit son
 *     AVOIR (montants niés, jamais recalculés) et passe en `annule` ; la
 *     réémission REMPLACE la pièce et garde son échéance d'origine ;
 *   - **L12l — trop-perçu** : l'avoir d'une pièce PAYÉE s'impute sur le relevé
 *     suivant du même formateur (jamais négatif), sinon la demande de
 *     remboursement est marquée à 60 jours (l'e-mail F54 attend son texte validé).
 *
 * 🔴 Rien ne se supprime : une pièce corrigée reste lisible (avoir, annulation
 * motivée). Les montants viennent de `argent/calcul-mission.ts`, seule source.
 * Le PDF de l'avoir (série AXI-AUTOF) n'est pas émis par ce lot.
 */

import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";

import {
  planTropPercu,
  totaliser,
  type IndemniteCalculee,
  type ReleveMissionCalcule,
} from "../argent/calcul-mission";
import { jourParis, type JourCivil } from "../argent/dates";
import { journaliser } from "@/server/journal/journaliser";

import { uniqueHistoriqueRetire } from "./lecture-passage";
import { instantDuJour } from "./passage-mission-base";

/** Le client de transaction (forme Prisma). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

const RECALCULABLES = ["brouillon", "a_valider"] as const;

async function recalculerTotaux(tx: Tx, statementId: string, regime: TvaRegimeHonoraires) {
  const lignes: Array<{ montantHtCents: number }> = await tx.trainerFeeLine.findMany({
    where: { statementId, statut: { not: "annule" } },
    select: { montantHtCents: true },
  });
  const t = totaliser(lignes, regime);
  await tx.trainerStatement.update({
    where: { id: statementId },
    data: { totalHtCents: t.totalHtCents, tvaCents: t.tvaCents, totalTtcCents: t.totalTtcCents },
    select: { id: true },
  });
  return t;
}

/* ─── L12f — indemnité d'annulation ──────────────────────────────────────── */

export type IssueIndemnite =
  | "ecrite"
  | "non_due"
  | "deja_ecrite"
  | "releve_fige_a_la_main"
  /** M-D non fait : l'unique historique (formateur, mois) refuserait la pièce. */
  | "contract_non_fait";

export async function ecrireIndemniteAnnulation(
  tx: Tx,
  e: {
    readonly trainerId: string;
    readonly sessionId: string;
    readonly indemnite: IndemniteCalculee;
    readonly regimeTva: TvaRegimeHonoraires;
    readonly tarifJourneeHtCents: number;
    readonly maintenant: Date;
  },
): Promise<IssueIndemnite> {
  if (!e.indemnite.due || e.indemnite.montantHtCents <= 0) return "non_due";
  if (!(await uniqueHistoriqueRetire(tx))) return "contract_non_fait";
  const deja = await tx.trainerFeeLine.count({
    where: {
      trainerId: e.trainerId,
      sessionId: e.sessionId,
      origine: "passage_mission",
      objet: "indemnite_annulation",
      statut: { not: "annule" },
    },
  });
  if (deja > 0) return "deja_ecrite";
  const [annee, mois] = e.indemnite.jourAnnulation.split("-").map(Number) as [number, number];
  let releve: { id: string; statut: string; echeanceAt: Date | null } | null =
    await tx.trainerStatement.findFirst({
      where: {
        trainerId: e.trainerId,
        sessionId: e.sessionId,
        origine: "passage_mission",
        periodeYear: annee,
        periodeMonth: mois,
        avoirDeId: null,
        organismeSousTraitantId: null,
        statut: { not: "annule" },
      },
      select: { id: true, statut: true, echeanceAt: true },
    });
  if (releve && !(RECALCULABLES as readonly string[]).includes(releve.statut))
    return "releve_fige_a_la_main";
  if (!releve) {
    releve = await tx.trainerStatement.create({
      data: {
        trainerId: e.trainerId,
        periodeYear: annee,
        periodeMonth: mois,
        statut: "a_valider",
        origine: "passage_mission",
        sessionId: e.sessionId,
        tvaRegime: e.regimeTva,
        // L'indemnité est payée au plus tard 30 jours après l'annulation (art. 11.3).
        echeanceAt: instantDuJour(e.indemnite.echeance),
      },
      select: { id: true, statut: true, echeanceAt: true },
    });
  } else {
    // Relevé de l'animation déjà là : la plus proche des deux échéances est gardée
    // (même règle que l'animation ajoutée à un relevé d'indemnité).
    const echeanceIndemnite = instantDuJour(e.indemnite.echeance);
    if (releve.echeanceAt === null || echeanceIndemnite.getTime() < releve.echeanceAt.getTime()) {
      await tx.trainerStatement.update({
        where: { id: releve.id },
        data: { echeanceAt: echeanceIndemnite },
        select: { id: true },
      });
    }
  }
  await tx.trainerFeeLine.create({
    data: {
      trainerId: e.trainerId,
      prestationType: "formation_collective",
      sessionId: e.sessionId,
      model: "taux_journalier",
      nature: "honoraire_du",
      tauxSnapshotCents: e.tarifJourneeHtCents,
      montantHtCents: e.indemnite.montantHtCents,
      statut: "calcule",
      periodeYear: annee,
      periodeMonth: mois,
      statementId: releve!.id,
      origine: "passage_mission",
      objet: "indemnite_annulation",
      calculatedAt: e.maintenant,
    },
    select: { id: true },
  });
  await recalculerTotaux(tx, releve!.id, e.regimeTva);
  await journaliser(
    tx,
    {
      action: "qualiopi.remuneration.indemnite_annulation_ecrite",
      targetType: "TrainerStatement",
      targetId: releve!.id,
      changes: { montantHtCents: e.indemnite.montantHtCents, echeance: e.indemnite.echeance },
      session: null,
    },
    { exiger: true },
  );
  return "ecrite";
}

/* ─── L12g — avoir et réémission ─────────────────────────────────────────── */

export type IssueAvoir =
  | { issue: "avoir_emis"; avoirId: string }
  | { issue: "trop_percu_ouvert"; avoirId: string }
  | {
      issue: "refuse";
      motif:
        | "introuvable"
        | "pas_une_piece_de_mission"
        | "pas_encore_emise"
        | "deja_corrigee"
        | "montant_requis_pour_une_piece_payee"
        | "montant_invalide"
        | "montant_inutile_piece_non_payee"
        | "contract_non_fait";
    };

/**
 * L'avoir d'une pièce de mission ÉMISE (lignes en objet `ajustement`, jamais
 * comptées par les unicités) :
 *   - pièce NON payée : avoir TOTAL (chaque ligne niée, TVA niée), la pièce passe
 *     en `annule` (motif `ajustement_remplace`) et sa place est libre pour la
 *     réémission ;
 *   - pièce PAYÉE : avoir PARTIEL du montant HT trop payé (`trop`), la pièce reste
 *     payée et l'avoir ouvre un trop-perçu (L12l). Jamais d'avoir total d'une
 *     pièce payée : il ferait réclamer au formateur ce qui lui est dû.
 */
export async function emettreAvoirMission(
  tx: Tx,
  statementId: string,
  maintenant: Date,
  trop?: { readonly montantHtCents: number },
): Promise<IssueAvoir> {
  const p = await tx.trainerStatement.findUnique({
    where: { id: statementId },
    select: {
      id: true,
      trainerId: true,
      sessionId: true,
      periodeYear: true,
      periodeMonth: true,
      statut: true,
      origine: true,
      avoirDeId: true,
      autofactureAt: true,
      numeroFacture: true,
      tvaRegime: true,
      totalHtCents: true,
      tvaCents: true,
      totalTtcCents: true,
      echeanceAt: true,
      feeLines: {
        where: { statut: { not: "annule" } },
        select: { id: true, montantHtCents: true, objet: true },
      },
    },
  });
  if (!p) return { issue: "refuse", motif: "introuvable" };
  // L'avoir partage le mois de la pièce : tant que M-D n'est pas fait, refus net.
  if (!(await uniqueHistoriqueRetire(tx))) return { issue: "refuse", motif: "contract_non_fait" };
  if (p.origine !== "passage_mission" || p.avoirDeId !== null)
    return { issue: "refuse", motif: "pas_une_piece_de_mission" };
  if (p.numeroFacture === null) return { issue: "refuse", motif: "pas_encore_emise" };
  if (p.statut === "annule") return { issue: "refuse", motif: "deja_corrigee" };
  const dejaAvoir = await tx.trainerStatement.count({
    where: { avoirDeId: p.id, statut: { not: "annule" } },
  });
  if (dejaAvoir > 0) return { issue: "refuse", motif: "deja_corrigee" };

  if (p.statut !== "paye" && trop)
    return { issue: "refuse", motif: "montant_inutile_piece_non_payee" };
  if (p.statut === "paye") {
    if (!trop) return { issue: "refuse", motif: "montant_requis_pour_une_piece_payee" };
    if (
      !Number.isInteger(trop.montantHtCents) ||
      trop.montantHtCents <= 0 ||
      trop.montantHtCents > p.totalHtCents
    )
      return { issue: "refuse", motif: "montant_invalide" };
    const t = totaliser([{ montantHtCents: -trop.montantHtCents }], p.tvaRegime);
    const partiel = await tx.trainerStatement.create({
      data: {
        trainerId: p.trainerId,
        periodeYear: p.periodeYear,
        periodeMonth: p.periodeMonth,
        statut: "valide",
        origine: "passage_mission",
        sessionId: p.sessionId,
        avoirDeId: p.id,
        tvaRegime: p.tvaRegime,
        totalHtCents: t.totalHtCents,
        tvaCents: t.tvaCents,
        totalTtcCents: t.totalTtcCents,
        echeanceAt: p.echeanceAt,
      },
      select: { id: true },
    });
    await tx.trainerFeeLine.create({
      data: {
        trainerId: p.trainerId,
        prestationType: "formation_collective",
        sessionId: p.sessionId,
        model: "taux_journalier",
        nature: "honoraire_du",
        montantHtCents: -trop.montantHtCents,
        statut: "valide",
        periodeYear: p.periodeYear,
        periodeMonth: p.periodeMonth,
        statementId: partiel.id,
        origine: "passage_mission",
        objet: "ajustement",
        motif: "Trop-perçu (décision 89)",
        calculatedAt: maintenant,
      },
      select: { id: true },
    });
    await journaliser(
      tx,
      {
        action: "qualiopi.remuneration.avoir_trop_percu",
        targetType: "TrainerStatement",
        targetId: partiel.id,
        changes: { pieceId: p.id, montantHtCents: trop.montantHtCents },
        session: null,
      },
      { exiger: true },
    );
    return { issue: "trop_percu_ouvert", avoirId: partiel.id };
  }

  const avoir = await tx.trainerStatement.create({
    data: {
      trainerId: p.trainerId,
      periodeYear: p.periodeYear,
      periodeMonth: p.periodeMonth,
      statut: "valide",
      origine: "passage_mission",
      sessionId: p.sessionId,
      avoirDeId: p.id,
      tvaRegime: p.tvaRegime,
      totalHtCents: -p.totalHtCents,
      tvaCents: -p.tvaCents,
      totalTtcCents: -p.totalTtcCents,
      echeanceAt: p.echeanceAt,
    },
    select: { id: true },
  });
  await tx.trainerFeeLine.createMany({
    data: p.feeLines.map((l: { montantHtCents: number }) => ({
      trainerId: p.trainerId,
      prestationType: "formation_collective",
      sessionId: p.sessionId,
      model: "taux_journalier",
      nature: "honoraire_du",
      montantHtCents: -l.montantHtCents,
      statut: "valide",
      periodeYear: p.periodeYear,
      periodeMonth: p.periodeMonth,
      statementId: avoir.id,
      origine: "passage_mission",
      objet: "ajustement",
      calculatedAt: maintenant,
    })),
  });
  await tx.trainerStatement.update({
    where: { id: p.id },
    data: { statut: "annule" },
    select: { id: true },
  });
  await tx.trainerFeeLine.updateMany({
    where: { statementId: p.id, statut: { not: "annule" } },
    data: { statut: "annule", annuleMotif: "ajustement_remplace" },
  });
  await journaliser(
    tx,
    {
      action: "qualiopi.remuneration.avoir_emis",
      targetType: "TrainerStatement",
      targetId: avoir.id,
      changes: { pieceId: p.id, totalHtCents: -p.totalHtCents },
      session: null,
    },
    { exiger: true },
  );
  return { issue: "avoir_emis", avoirId: avoir.id };
}

/**
 * La réémission d'une pièce annulée par avoir : un relevé « à valider » qui
 * REMPLACE la pièce et garde SON échéance (une contestation ne recule jamais la
 * date limite du formateur).
 */
export async function reemettreMission(
  tx: Tx,
  pieceAnnuleeId: string,
  releve: ReleveMissionCalcule,
  regimeTva: TvaRegimeHonoraires,
  tarifJourneeHtCents: number,
  maintenant: Date,
): Promise<{ issue: "reemis"; id: string } | { issue: "refuse"; motif: string }> {
  const p = await tx.trainerStatement.findUnique({
    where: { id: pieceAnnuleeId },
    select: {
      trainerId: true,
      sessionId: true,
      periodeYear: true,
      periodeMonth: true,
      statut: true,
      origine: true,
      echeanceAt: true,
    },
  });
  if (!(await uniqueHistoriqueRetire(tx)))
    return {
      issue: "refuse",
      motif: "M-D non fait : l'unique historique refuserait la réémission",
    };
  if (!p || p.origine !== "passage_mission" || p.statut !== "annule")
    return { issue: "refuse", motif: "la pièce n'est pas une pièce de mission annulée par avoir" };
  if (releve.mois !== `${p.periodeYear}-${String(p.periodeMonth).padStart(2, "0")}`)
    return { issue: "refuse", motif: "mois différent de la pièce remplacée" };
  const r = await tx.trainerStatement.create({
    data: {
      trainerId: p.trainerId,
      periodeYear: p.periodeYear,
      periodeMonth: p.periodeMonth,
      statut: "a_valider",
      origine: "passage_mission",
      sessionId: p.sessionId,
      remplaceId: pieceAnnuleeId,
      tvaRegime: regimeTva,
      totalHtCents: releve.totalHtCents,
      tvaCents: releve.tvaCents,
      totalTtcCents: releve.totalTtcCents,
      echeanceAt: p.echeanceAt,
    },
    select: { id: true },
  });
  await tx.trainerFeeLine.createMany({
    data: releve.lignes.map((l) => ({
      trainerId: p.trainerId,
      prestationType: "formation_collective",
      sessionId: p.sessionId,
      model: "taux_journalier",
      nature: "honoraire_du",
      tauxSnapshotCents: l.objet === "animation" ? tarifJourneeHtCents : null,
      montantHtCents: l.montantHtCents,
      statut: "calcule",
      periodeYear: p.periodeYear,
      periodeMonth: p.periodeMonth,
      statementId: r.id,
      origine: "passage_mission",
      objet: l.objet,
      demiJournees: l.demiJournees ?? null,
      journeesDeplacement: l.journeesDeplacement ?? null,
      calculatedAt: maintenant,
    })),
  });
  return { issue: "reemis", id: r.id };
}

/* ─── L12l — trop-perçu ──────────────────────────────────────────────────── */

export interface BilanTropPercu {
  readonly imputeHtCents: number;
  readonly demandesRemboursement: number;
}

/**
 * Impute les avoirs ouverts (pièce PAYÉE) du formateur sur `releveSuivantId`
 * (brouillon ou à valider), sans jamais le rendre négatif ; sans relevé suivant,
 * marque la demande de remboursement des avoirs de 60 jours et plus.
 */
export async function traiterTropPercu(
  tx: Tx,
  trainerId: string,
  releveSuivantId: string | null,
  aujourdhui: JourCivil,
  maintenant: Date,
): Promise<BilanTropPercu> {
  const avoirs: Array<{
    id: string;
    totalHtCents: number;
    createdAt: Date;
    remboursementDemandeAt: Date | null;
    tvaRegime: TvaRegimeHonoraires;
    avoirDe: { statut: string } | null;
    imputations: Array<{ montantHtCents: number }>;
  }> = await tx.trainerStatement.findMany({
    where: {
      trainerId,
      origine: "passage_mission",
      avoirDeId: { not: null },
      statut: { not: "annule" },
    },
    select: {
      id: true,
      totalHtCents: true,
      createdAt: true,
      remboursementDemandeAt: true,
      tvaRegime: true,
      avoirDe: { select: { statut: true } },
      imputations: { where: { statut: { not: "annule" } }, select: { montantHtCents: true } },
    },
  });
  const ouverts = avoirs
    .filter((a) => a.avoirDe?.statut === "paye")
    .map((a) => ({
      statementId: a.id,
      // L'avoir est négatif ; les imputations aussi : reste = |avoir| − |imputé|.
      resteHtCents: Math.max(
        0,
        -a.totalHtCents + a.imputations.reduce((s, l) => s + l.montantHtCents, 0),
      ),
      emisLe: jourParis(a.createdAt),
      remboursementDemande: a.remboursementDemandeAt !== null,
      tvaRegime: a.tvaRegime,
    }));
  let suivant: {
    id: string;
    trainerId: string;
    statut: string;
    totalHtCents: number;
    tvaRegime: TvaRegimeHonoraires;
    sessionId: string | null;
    periodeYear: number;
    periodeMonth: number;
    origine: string;
    avoirDeId: string | null;
  } | null = null;
  if (releveSuivantId) {
    suivant = await tx.trainerStatement.findUnique({
      where: { id: releveSuivantId },
      select: {
        id: true,
        trainerId: true,
        statut: true,
        totalHtCents: true,
        tvaRegime: true,
        sessionId: true,
        periodeYear: true,
        periodeMonth: true,
        origine: true,
        avoirDeId: true,
      },
    });
    // Seul un relevé DE MISSION (jamais un relevé mensuel, jamais un avoir), encore
    // recalculable, reçoit une imputation : le run mensuel ne connaît pas ces lignes.
    if (
      !suivant ||
      suivant.trainerId !== trainerId ||
      suivant.origine !== "passage_mission" ||
      suivant.avoirDeId !== null ||
      !(RECALCULABLES as readonly string[]).includes(suivant.statut)
    )
      suivant = null;
    // Un relevé suivant désigné mais inadmissible : rien (ni imputation, ni demande).
    if (suivant === null) return { imputeHtCents: 0, demandesRemboursement: 0 };
  }
  // Un avoir ne s'impute que sur un relevé du MÊME régime de TVA : en HT, deux
  // régimes différents fausseraient le TTC retenu. Sinon, il attend (ou la demande).
  // Un avoir dont le remboursement a été DEMANDÉ ne s'impute plus : le formateur
  // a pu rembourser, et rien ne le dit encore — l'imputer reprendrait deux fois.
  const imputables = suivant
    ? ouverts.filter((o) => o.tvaRegime === suivant!.tvaRegime && !o.remboursementDemande)
    : ouverts;
  const plan = planTropPercu(
    imputables,
    suivant ? { totalHtCents: suivant.totalHtCents } : null,
    aujourdhui,
  );
  let impute = 0;
  if (suivant) {
    for (const i of plan.imputations) {
      // Idempotent : une imputation existante de CET avoir sur CE relevé grossit,
      // jamais de seconde ligne (index `trainer_fee_lines_imputation_unique`).
      const existante: { id: string; montantHtCents: number } | null =
        await tx.trainerFeeLine.findFirst({
          where: {
            statementId: suivant.id,
            imputeDeStatementId: i.avoirId,
            statut: { not: "annule" },
          },
          select: { id: true, montantHtCents: true },
        });
      if (existante) {
        await tx.trainerFeeLine.update({
          where: { id: existante.id },
          data: {
            montantHtCents: existante.montantHtCents + i.montantHtCents,
            calculatedAt: maintenant,
          },
          select: { id: true },
        });
      } else {
        await tx.trainerFeeLine.create({
          data: {
            trainerId,
            prestationType: "formation_collective",
            sessionId: suivant.sessionId,
            model: "taux_journalier",
            nature: "honoraire_du",
            montantHtCents: i.montantHtCents,
            statut: "calcule",
            periodeYear: suivant.periodeYear,
            periodeMonth: suivant.periodeMonth,
            statementId: suivant.id,
            origine: "passage_mission",
            objet: "ajustement",
            imputeDeStatementId: i.avoirId,
            motif: "Trop-perçu imputé (décision 89)",
            calculatedAt: maintenant,
          },
          select: { id: true },
        });
      }
      impute += -i.montantHtCents;
    }
    if (plan.imputations.length) {
      await recalculerTotaux(tx, suivant.id, suivant.tvaRegime);
      await journaliser(
        tx,
        {
          action: "qualiopi.remuneration.trop_percu_impute",
          targetType: "TrainerStatement",
          targetId: suivant.id,
          changes: { imputeHtCents: impute },
          session: null,
        },
        { exiger: true },
      );
    }
  }
  for (const id of plan.demandesRemboursement) {
    await tx.trainerStatement.update({
      where: { id },
      data: { remboursementDemandeAt: maintenant },
      select: { id: true },
    });
  }
  return { imputeHtCents: impute, demandesRemboursement: plan.demandesRemboursement.length };
}
