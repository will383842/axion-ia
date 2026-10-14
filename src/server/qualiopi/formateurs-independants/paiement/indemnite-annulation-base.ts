/**
 * Formateurs indépendants — l'indemnité d'annulation, lue et ÉCRITE sur
 * décision de l'administrateur (lot D, M11).
 *
 * Le moteur des missions ne décide jamais seul pour une mission fermée dont la
 * lettre est signée (`MOTIF_FERMEE_LETTRE_SIGNEE`) : il prévient. C'est ici que
 * la décision humaine — instant de l'annulation, annulation par Axion — devient
 * une ligne `indemnite_annulation`, par LA fonction existante
 * (`ecrireIndemniteAnnulation` : une ligne par formateur et session, relevé du
 * mois de l'annulation, échéance à 30 jours), sous les verrous de rémunération
 * (période puis formateur). Idempotent : un rejeu rend « déjà écrite ».
 */

import { prisma } from "@/lib/prisma";
import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";
import {
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION,
  prendreVerrousRemuneration,
} from "@/server/qualiopi/remuneration/verrou-remuneration";

import { jourDeColonneDate } from "../argent/dates";
import { MOTIF_FERMEE_LETTRE_SIGNEE } from "../moteur-mission";
import { ecrireIndemniteAnnulation, type IssueIndemnite } from "./corrections-mission";
import { apercuIndemniteAnnulation, type ApercuIndemnite } from "./indemnite-annulation-decision";

export interface DecisionIndemnite {
  readonly missionId: string;
  readonly annuleeA: Date;
  readonly parAxion: boolean;
  /**
   * Le HT que l'administrateur a vu à l'aperçu, à CET instant et avec CETTE case.
   * Différent du HT recalculé au clic : rien n'est écrit (« aperçu périmé »).
   */
  readonly montantVuHtCents?: number;
}

export type IssueDecisionIndemnite =
  | {
      readonly issue: "refusee" | "non_due" | "apercu_perime" | "instant_anterieur_signature";
    }
  | {
      readonly issue: IssueIndemnite;
      readonly montantHtCents: number;
      readonly totalTtcCents: number;
    };

const SELECT_MISSION = {
  id: true,
  trainerId: true,
  sessionId: true,
  tarifHtCents: true,
  regimeTvaFige: true,
  lettreBlocageMotif: true,
  session: {
    select: {
      jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
      // Chantier C4 (défaut 2) : une demi-journée signée n'est jamais « annulée ».
      emargementContresignatures: {
        where: { revokedAt: null },
        select: { trainerId: true, date: true, demiJournee: true },
      },
    },
  },
} as const;

type MissionLue = {
  id: string;
  trainerId: string;
  sessionId: string;
  tarifHtCents: number | null;
  regimeTvaFige: string | null;
  lettreBlocageMotif: string | null;
  session: {
    jours: Array<{ date: Date; heureDebut: string; heureFin: string; trainerId: string | null }>;
    emargementContresignatures?: Array<{
      trainerId: string;
      date: Date;
      demiJournee: "matin" | "apres_midi" | "journee";
    }>;
  };
};

/**
 * L'aperçu d'une décision, ou `null` si la mission n'attend pas de décision.
 * Une mission ne se ferme ainsi qu'après un accord (une lettre n'existe qu'après
 * « J'accepte » ou un accord hors outil) : `accepteeAvant` est donc acquis.
 */
function apercuDe(m: MissionLue | null, d: Omit<DecisionIndemnite, "missionId">) {
  if (
    m === null ||
    m.lettreBlocageMotif !== MOTIF_FERMEE_LETTRE_SIGNEE ||
    m.tarifHtCents === null ||
    m.regimeTvaFige === null
  ) {
    return null;
  }
  const regimeTva = m.regimeTvaFige as TvaRegimeHonoraires;
  const apercu: ApercuIndemnite = apercuIndemniteAnnulation({
    annuleeA: d.annuleeA,
    // Ses journées : celles qui lui sont attribuées, ou sans formateur désigné.
    journeesPrevues: m.session.jours
      .filter((j) => j.trainerId === null || j.trainerId === m.trainerId)
      .map((j) => ({
        jour: jourDeColonneDate(j.date),
        heureDebut: j.heureDebut,
        heureFin: j.heureFin,
      })),
    tarifJourneeHtCents: m.tarifHtCents,
    accepteeAvant: true,
    parAxion: d.parAxion,
    regimeTva,
    contresignatures: (m.session.emargementContresignatures ?? [])
      .filter((c) => c.trainerId === m.trainerId)
      .map((c) => ({ jour: jourDeColonneDate(c.date), demiJournee: c.demiJournee })),
  });
  return { apercu, regimeTva };
}

/** L'aperçu affiché avant la décision (lecture seule). */
export async function apercuDecisionIndemnite(
  d: DecisionIndemnite,
): Promise<ApercuIndemnite | null> {
  const m = (await prisma.missionFormateur.findUnique({
    where: { id: d.missionId },
    select: SELECT_MISSION,
  })) as MissionLue | null;
  return apercuDe(m, d)?.apercu ?? null;
}

export async function ecrireIndemniteDecidee(
  d: DecisionIndemnite,
): Promise<IssueDecisionIndemnite> {
  const m = (await prisma.missionFormateur.findUnique({
    where: { id: d.missionId },
    select: SELECT_MISSION,
  })) as MissionLue | null;
  const lu = apercuDe(m, d);
  if (lu === null) return { issue: "refusee" };
  const { apercu, regimeTva } = lu;
  // Chantier C4 (défaut 2) : l'instant saisi précède une demi-journée signée.
  if (apercu.refus !== null) return { issue: "instant_anterieur_signature" };
  const htRecalcule = apercu.indemnite.due ? apercu.totaux.totalHtCents : 0;
  if (d.montantVuHtCents !== undefined && d.montantVuHtCents !== htRecalcule) {
    return { issue: "apercu_perime" };
  }
  if (!apercu.indemnite.due || apercu.indemnite.montantHtCents <= 0) return { issue: "non_due" };
  const [annee, mois] = apercu.indemnite.jourAnnulation.split("-").map(Number) as [number, number];
  const issue: IssueIndemnite = await prisma.$transaction(async (tx) => {
    await prendreVerrousRemuneration(tx, {
      periodes: [{ year: annee, month: mois }],
      trainerIds: [m!.trainerId],
    });
    return ecrireIndemniteAnnulation(tx, {
      trainerId: m!.trainerId,
      sessionId: m!.sessionId,
      indemnite: apercu.indemnite,
      regimeTva,
      tarifJourneeHtCents: m!.tarifHtCents!,
      maintenant: new Date(),
    });
  }, DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION);
  return {
    issue,
    montantHtCents: apercu.totaux.totalHtCents,
    totalTtcCents: apercu.totaux.totalTtcCents,
  };
}

/** Une mission qui attend la décision d'indemnité, pour l'écran « Missions ». */
export interface MissionAIndemniser {
  readonly missionId: string;
  readonly sessionId: string;
  readonly numero: string;
  readonly intitule: string;
  readonly formateur: string;
  /** Proposition d'instant d'annulation : le moment où le moteur a prévenu. */
  readonly annuleeAProposee: Date | null;
}

/** Au plus 50 : la liste est un tri de décisions, pas un registre. */
export async function lireMissionsAIndemniser(): Promise<ReadonlyArray<MissionAIndemniser>> {
  try {
    const ms = await prisma.missionFormateur.findMany({
      where: { lettreBlocageMotif: MOTIF_FERMEE_LETTRE_SIGNEE },
      orderBy: { lettreBlocageNotifieAt: "desc" },
      take: 50,
      select: {
        id: true,
        trainerId: true,
        sessionId: true,
        lettreBlocageNotifieAt: true,
        trainer: { select: { prenom: true, nom: true } },
        session: { select: { numero: true, titreSession: true } },
      },
    });
    const deja = await prisma.trainerFeeLine.findMany({
      where: {
        objet: "indemnite_annulation",
        statut: { not: "annule" },
        OR: ms.map((m) => ({ trainerId: m.trainerId, sessionId: m.sessionId })),
      },
      select: { trainerId: true, sessionId: true },
    });
    const ecrites = new Set(deja.map((l) => `${l.trainerId}|${l.sessionId}`));
    return ms
      .filter((m) => !ecrites.has(`${m.trainerId}|${m.sessionId}`))
      .map((m) => ({
        missionId: m.id,
        sessionId: m.sessionId,
        numero: m.session.numero,
        intitule: m.session.titreSession,
        formateur: `${m.trainer.prenom} ${m.trainer.nom}`.trim(),
        annuleeAProposee: m.lettreBlocageNotifieAt,
      }));
  } catch {
    return [];
  }
}
