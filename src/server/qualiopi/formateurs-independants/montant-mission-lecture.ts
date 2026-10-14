/**
 * Formateurs indépendants — LECTURE de l'ENGAGEMENT HT d'une mission en jeu (étape 3 du
 * C4). La règle de calcul vit dans `montant-mission.ts` (pure) ; ici, la base seulement.
 *
 * Ce qui s'ajoute au cumul déjà facturé (`vigilance-seuil-lecture.ts`) pour le seuil :
 *   1. la mission en jeu, NETTE de ce qui en est déjà facturé (un relevé du mois écoulé
 *      d'une mission sur plusieurs mois est déjà au cumul : jamais compté deux fois) ;
 *   2. les AUTRES missions ouvertes du formateur (proposée, acceptée, accord hors outil),
 *      chacune nette de son déjà-facturé — relecture de l'étape 3 : trois missions de
 *      2 000 € acceptées en parallèle engagent 6 000 €, pas 2 000.
 *
 * 🔴 Garde FERMÉE : une lecture en échec rend `null`, que la garde lit « attestation
 * exigée ». Aucun montant n'est journalisé.
 *
 * Module neutre (Prisma seulement) : lu par les actions de la console ET par le worker.
 */

import { prisma } from "@/lib/prisma";
import { genererJoursParDefaut } from "@/server/qualiopi/presence/jours-defaut";
import { parisDateISO } from "@/server/qualiopi/presence/time";

import { montantMissionHtCents } from "./montant-mission";
import { STATUTS_RELEVE_CUMUL } from "./vigilance-seuil";

/** La mission dont on décide : une session existante, ou une session pas encore créée. */
export type MissionEnJeu =
  | {
      readonly sessionId: string;
      /** La mission précise (acceptation, lettre) : ses conditions figées priment. */
      readonly missionId?: string;
      /** Montant déjà calculé par l'appelant (la lettre et son annonce) : il prime. */
      readonly montantHtCents?: number;
    }
  | {
      /**
       * Création ou report de session : les journées viendront de la durée de la
       * formation (`genererJoursParDefaut`), sans formateur désigné.
       */
      readonly nouvelleSession: {
        readonly formationId: string | null;
        readonly debut: Date;
        readonly fin: Date | null;
        readonly distanciel: boolean;
        /**
         * Report : la session reportée, dont la mission (encore ouverte au moment de
         * la garde) est celle que le report remplace — jamais comptée en plus.
         */
        readonly remplaceSessionId?: string;
      };
    };

/** Missions OUVERTES : un engagement qui n'est pas (encore) facturé. */
const STATUTS_MISSION_OUVERTE = ["en_attente", "acceptee", "accord_hors_outil"] as const;

/** Sessions dont les missions encore ouvertes n'engagent plus rien. */
const STATUTS_SESSION_CLOSE = ["annulee", "reportee"] as const;

/** Au-delà, une mission ouverte d'une session finie est réputée réglée (cumul). */
const FENETRE_MISSIONS_JOURS = 120;

async function tarifFiche(trainerId: string): Promise<number | null> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { tarifJourneeHtCents: true },
  });
  return t?.tarifJourneeHtCents ?? null;
}

/** Montant HT (centimes) d'une mission de ce formateur ; `null` si illisible. */
async function montantDe(trainerId: string, enJeu: MissionEnJeu): Promise<number | null> {
  if ("sessionId" in enJeu && enJeu.montantHtCents !== undefined) {
    return Number.isFinite(enJeu.montantHtCents) ? enJeu.montantHtCents : null;
  }
  if ("nouvelleSession" in enJeu) {
    const n = enJeu.nouvelleSession;
    const formation =
      n.formationId === null
        ? null
        : await prisma.formation.findUnique({
            where: { id: n.formationId },
            select: { dureeHeures: true },
          });
    const proposes =
      formation === null
        ? []
        : genererJoursParDefaut({
            dateDebutIso: parisDateISO(n.debut),
            dureeHeures: formation.dureeHeures,
          });
    const fiche = await tarifFiche(trainerId);
    const base = {
      trainerId,
      affectes: [],
      distanciel: n.distanciel,
      tarifFigeHtCents: null,
      forfaitFigeHtCents: null,
      tarifFicheHtCents: fiche,
    };
    // Les journées que la session recevra, et la période : la PLUS HAUTE estimation
    // (les journées issues de la durée peuvent déborder la date de fin).
    const parJours =
      proposes.length === 0
        ? null
        : montantMissionHtCents({
            ...base,
            jours: proposes.map((j) => ({
              date: new Date(`${j.date}T00:00:00.000Z`),
              heureDebut: j.heureDebut,
              heureFin: j.heureFin,
              trainerId: null,
            })),
            repli: null,
          });
    const parPeriode = montantMissionHtCents({
      ...base,
      jours: [],
      repli: { debut: n.debut, fin: n.fin },
    });
    if (parJours === null && parPeriode === null) return null;
    return Math.max(parJours ?? 0, parPeriode ?? 0);
  }
  const [session, missions, choix, fiche] = await Promise.all([
    prisma.trainingSession.findUnique({
      where: { id: enJeu.sessionId },
      select: {
        lieuType: true,
        dateDebut: true,
        dateFin: true,
        jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
        sessionFormateurs: { select: { trainerId: true } },
      },
    }),
    // Les conditions FIGÉES de la mission (celles que la lettre et le paiement lisent) :
    // la mission désignée, sinon la plus récente de ce couple encore OUVERTE qui en
    // porte — jamais celles d'une mission refusée, retirée ou expirée.
    prisma.missionFormateur.findMany({
      where: {
        sessionId: enJeu.sessionId,
        trainerId,
        ...(enJeu.missionId !== undefined
          ? { id: enJeu.missionId }
          : { tarifHtCents: { not: null }, statut: { in: [...STATUTS_MISSION_OUVERTE] } }),
      },
      orderBy: { solliciteAt: "desc" },
      take: 1,
      select: { tarifHtCents: true, forfaitDeplacementParJourHtCents: true },
    }),
    // Celles figées au choix (cartes), que la proposition recopiera.
    prisma.choixFormateurSession.findUnique({
      where: { sessionId_trainerId: { sessionId: enJeu.sessionId, trainerId } },
      select: { tarifHtCents: true, forfaitDeplacementParJourHtCents: true, sauteAt: true },
    }),
    tarifFiche(trainerId),
  ]);
  if (session === null) return null;
  const commun = {
    trainerId,
    affectes: session.sessionFormateurs,
    distanciel: session.lieuType === "distanciel",
    jours: session.jours,
    tarifFicheHtCents: fiche,
    repli: { debut: session.dateDebut, fin: session.dateFin },
  };
  const mission = missions[0] ?? null;
  const candidats: Array<{ tarif: number; forfait: number | null }> = [];
  if (mission !== null && mission.tarifHtCents !== null) {
    candidats.push({
      tarif: mission.tarifHtCents,
      forfait: mission.forfaitDeplacementParJourHtCents,
    });
  }
  // Sans mission désignée, le choix en cours compte aussi : le PLUS HAUT des deux.
  if (
    (enJeu.missionId === undefined || candidats.length === 0) &&
    choix !== null &&
    choix.sauteAt === null &&
    choix.tarifHtCents !== null
  ) {
    candidats.push({ tarif: choix.tarifHtCents, forfait: choix.forfaitDeplacementParJourHtCents });
  }
  if (candidats.length === 0) {
    return montantMissionHtCents({ ...commun, tarifFigeHtCents: null, forfaitFigeHtCents: null });
  }
  let max: number | null = null;
  for (const c of candidats) {
    const m = montantMissionHtCents({
      ...commun,
      tarifFigeHtCents: c.tarif,
      forfaitFigeHtCents: c.forfait,
    });
    if (m === null) return null;
    max = Math.max(max ?? 0, m);
  }
  return max;
}

/** Ce qui est déjà facturé (relevés qui comptent au cumul), par session. */
async function factureParSession(
  trainerId: string,
  sessionIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
  const parSession = new Map<string, number>();
  if (sessionIds.length === 0) return parSession;
  const lignes = await prisma.trainerFeeLine.findMany({
    where: {
      sessionId: { in: [...sessionIds] },
      statut: { not: "annule" },
      // Les HONORAIRES de la mission seulement (animation, déplacement ; NULL = ligne
      // du relevé mensuel) : une indemnité d'annulation, une pénalité ou une
      // présentation de méthode est au cumul, mais n'est pas une part de la mission.
      // Les lignes négatives (avoir partiel) comptent : le cumul les déduit aussi.
      nature: "honoraire_du",
      OR: [{ objet: null }, { objet: { in: ["animation", "deplacement"] } }],
      statement: { trainerId, statut: { in: [...STATUTS_RELEVE_CUMUL] } },
    },
    select: { sessionId: true, montantHtCents: true },
  });
  for (const l of lignes) {
    if (l.sessionId === null) continue;
    parSession.set(l.sessionId, (parSession.get(l.sessionId) ?? 0) + l.montantHtCents);
  }
  // Jamais négatif : un avoir ne gonfle pas l'engagement au-delà de la mission.
  for (const [id, v] of parSession) parSession.set(id, Math.max(0, v));
  return parSession;
}

/**
 * ENGAGEMENT HT à ajouter au cumul déjà facturé : la mission en jeu et les autres
 * missions ouvertes, chacune nette de son déjà-facturé. `null` si illisible.
 */
export async function lireEngagementHtCents(
  trainerId: string,
  enJeu: MissionEnJeu,
  maintenant: Date = new Date(),
): Promise<number | null> {
  try {
    const sessionEnJeu = "sessionId" in enJeu ? enJeu.sessionId : null;
    const exclue =
      "sessionId" in enJeu ? enJeu.sessionId : (enJeu.nouvelleSession.remplaceSessionId ?? null);
    const borne = new Date(maintenant.getTime() - FENETRE_MISSIONS_JOURS * 86_400_000);
    const autres = await prisma.missionFormateur.findMany({
      where: {
        trainerId,
        statut: { in: [...STATUTS_MISSION_OUVERTE] },
        ...(exclue === null ? {} : { sessionId: { not: exclue } }),
        // Une session annulée ou reportée n'engage plus rien : ce qui en reste dû
        // (indemnité d'annulation) passe par un relevé, donc par le cumul ; la session
        // qui remplace une session reportée porte sa propre mission.
        session: { dateFin: { gte: borne }, statut: { notIn: [...STATUTS_SESSION_CLOSE] } },
      },
      select: { id: true, sessionId: true },
    });
    // Une mission par session (la plus haute) : deux propositions au même couple ne
    // sont qu'un seul engagement.
    const sessions = [...new Set(autres.map((m) => m.sessionId))];
    const facture = await factureParSession(
      trainerId,
      sessionEnJeu === null ? sessions : [...sessions, sessionEnJeu],
    );
    const enJeuBrut = await montantDe(trainerId, enJeu);
    if (enJeuBrut === null) return null;
    let total = Math.max(
      0,
      enJeuBrut - (sessionEnJeu === null ? 0 : (facture.get(sessionEnJeu) ?? 0)),
    );
    for (const sessionId of sessions) {
      const m = await montantDe(trainerId, { sessionId });
      if (m === null) return null;
      total += Math.max(0, m - (facture.get(sessionId) ?? 0));
    }
    return total;
  } catch {
    return null;
  }
}

/** Montant HT (centimes) de la mission en jeu seule (lettre, tests) ; `null` si illisible. */
export async function lireMontantMissionHtCents(
  trainerId: string,
  enJeu: MissionEnJeu,
): Promise<number | null> {
  try {
    return await montantDe(trainerId, enJeu);
  } catch {
    return null;
  }
}
