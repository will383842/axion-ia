/**
 * Chantier QNC, lot L05 — ce qui retient la convocation d'une inscription.
 *
 * Deux faits, lus aux MÊMES prédicats que le reste du dépôt (jamais recomptés
 * ici) :
 *   - la convention : `conventionSigneePourInscription` (L04) — une pièce
 *     contractuelle vivante, signée par toutes les parties de son circuit ;
 *   - l'adaptation : `etatReponseAdaptation === "a_consigner"` (ind. 10) — un
 *     besoin déclaré dont la réponse de l'organisme n'est pas consignée, ou
 *     antérieure à la dernière déclaration.
 *
 * Le MOTIF est ensuite journalisé (une ligne `activity_logs` quand l'ensemble
 * des motifs CHANGE, pas à chaque passage du cron) : c'est ce que lit la
 * console. Rien ne s'écrit sur l'inscription — elle reste candidate au
 * rattrapage du lendemain.
 *
 * ⚠️ Atteint par le WORKER : aucun import `server-only`, Next ni Server Action.
 */

import { prisma } from "@/lib/prisma";
import { colonneDeclarationDisponible } from "@/server/qualiopi/adaptation/colonne-declaration";
import { lireCircuitAdaptation } from "@/server/qualiopi/adaptation/journal-consignation";
import {
  HORODATAGE_CIRCUIT_VIDE,
  besoinAdaptationDeclare,
  etatReponseAdaptation,
} from "@/server/qualiopi/adaptation/reponse-organisme";
import {
  TYPES_PIECE_CONTRACTUELLE,
  conventionSigneePourInscription,
} from "@/server/qualiopi/positionnement/convention-signee";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import {
  decisionEnvoiConvocation,
  libellesMotifs,
  memesMotifs,
  type DecisionConvocation,
} from "./decision";
import { cibleEssaiConvocation, convocationV2Applique, etatConvocationV2 } from "./interrupteur";

export const ACTION_JOURNAL_CONVOCATION_RETENUE = "qualiopi.convocation.retenue";
export const ACTION_JOURNAL_CONVOCATION_ENVOYEE = "qualiopi.convocation.envoyee_v2";

export interface ResultatBlocage {
  readonly decision: DecisionConvocation;
  /** Le banc d'essai : l'inscription OU sa session. */
  readonly essai: boolean;
}

/**
 * Évalue le blocage d'une inscription. `null` si l'inscription n'existe plus.
 * Une lecture de la base qui échoue LÈVE : l'appelant ne doit pas confondre
 * « je n'ai pas pu lire » avec « rien ne retient ».
 */
export async function evaluerBlocageConvocation(
  enrollmentId: string,
): Promise<ResultatBlocage | null> {
  const colonneDeclaration = await colonneDeclarationDisponible();
  const ins = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      traineeId: true,
      clientId: true,
      estTestInterne: true,
      adaptationsRealisees: true,
      besoinAdaptationDeclareAt: colonneDeclaration,
      trainee: { select: { situationHandicap: true } },
      questionnaires: {
        where: { type: "positionnement", reponduAt: { not: null } },
        select: { reponses: true, reponduAt: true },
      },
      session: {
        select: {
          dateFin: true,
          estTestInterne: true,
          interEntreprises: true,
          documents: {
            where: { type: { in: [...TYPES_PIECE_CONTRACTUELLE] }, annuleeAt: null },
            select: {
              type: true,
              statutSignature: true,
              annuleeAt: true,
              clientId: true,
              traineeId: true,
            },
          },
        },
      },
    },
  });
  if (ins === null) return null;

  const conventionSignee = conventionSigneePourInscription(ins.session.documents, {
    traineeId: ins.traineeId,
    clientId: ins.clientId,
    interEntreprises: ins.session.interEntreprises,
  });

  const besoin = besoinAdaptationDeclare({
    situationHandicap: ins.trainee.situationHandicap,
    reponsesPositionnements: ins.questionnaires.map((q) => q.reponses),
    besoinAdaptationDeclareAt: ins.besoinAdaptationDeclareAt ?? null,
  });
  let adaptationNonTraitee = false;
  if (besoin) {
    const circuit = await lireCircuitAdaptation([
      {
        id: ins.id,
        traineeId: ins.traineeId,
        finSession: ins.session.dateFin,
        positionnements: ins.questionnaires,
      },
    ]);
    adaptationNonTraitee =
      etatReponseAdaptation(
        true,
        ins.adaptationsRealisees,
        circuit.get(ins.id) ?? HORODATAGE_CIRCUIT_VIDE,
      ) === "a_consigner";
  }

  return {
    decision: decisionEnvoiConvocation({ conventionSignee, adaptationNonTraitee }),
    essai: ins.estTestInterne || ins.session.estTestInterne,
  };
}

/**
 * Journalise la retenue — une ligne quand l'ensemble des motifs change, pas à
 * chaque passage. Fail-soft : un journal indisponible ne change pas la décision
 * (la convocation reste retenue).
 */
export async function journaliserRetenue(
  enrollmentId: string,
  motifs: readonly string[],
  essai: boolean,
): Promise<void> {
  try {
    const derniere = await prisma.activityLog.findFirst({
      where: {
        action: { in: [ACTION_JOURNAL_CONVOCATION_RETENUE, ACTION_JOURNAL_CONVOCATION_ENVOYEE] },
        targetType: "Enrollment",
        targetId: enrollmentId,
      },
      orderBy: { createdAt: "desc" },
      select: { action: true, changes: true },
    });
    const dernierMotifs =
      derniere?.action === ACTION_JOURNAL_CONVOCATION_RETENUE
        ? ((derniere.changes as { motifs?: string[] } | null)?.motifs ?? null)
        : null;
    if (memesMotifs(dernierMotifs, motifs)) return;
    await prisma.activityLog.create({
      data: {
        action: ACTION_JOURNAL_CONVOCATION_RETENUE,
        targetType: "Enrollment",
        targetId: enrollmentId,
        changes: { motifs: [...motifs], essai },
      },
    });
  } catch (err) {
    console.error(
      `[convocation-v2] retenue non journalisée (inscription ${enrollmentId}) :`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface RetenuesConvocationSession {
  /** `false` : interrupteur éteint (ou lecture impossible) — la console n'affiche rien. */
  readonly actif: boolean;
  /** Motifs (libellés) par inscription dont la convocation est retenue. */
  readonly parInscription: Readonly<Record<string, readonly string[]>>;
}

const AUCUNE_RETENUE: RetenuesConvocationSession = { actif: false, parInscription: {} };

/**
 * Pour la console : quelles inscriptions de la session ont leur convocation
 * retenue, et pourquoi. Ne lève jamais — un écran ne tombe pas pour un motif.
 * Les inscriptions déjà convoquées n'y figurent pas.
 */
export async function lireRetenuesConvocationSession(
  sessionId: string,
): Promise<RetenuesConvocationSession> {
  try {
    const etat = await etatConvocationV2();
    if (etat === "eteint") return AUCUNE_RETENUE;
    const inscriptions = await prisma.enrollment.findMany({
      where: {
        sessionId,
        ...inscriptionsActives(),
        convocationEnvoyeeAt: null,
      },
      select: { id: true, estTestInterne: true, session: { select: { estTestInterne: true } } },
    });
    const parInscription: Record<string, readonly string[]> = {};
    for (const ins of inscriptions) {
      const cible = cibleEssaiConvocation(ins, ins.session);
      if (!convocationV2Applique(etat, cible)) continue;
      const blocage = await evaluerBlocageConvocation(ins.id);
      if (blocage !== null && !blocage.decision.autorisee) {
        parInscription[ins.id] = libellesMotifs(blocage.decision.motifs);
      }
    }
    return { actif: true, parInscription };
  } catch {
    return AUCUNE_RETENUE;
  }
}

/**
 * Pour la console : le numéro d'accès REMIS au stagiaire par sa convocation, tel
 * que journalisé à l'envoi (`accesId` dans `qualiopi.convocation.envoyee_v2`). Le
 * dernier accès non révoqué n'est pas fiable : le rappel J-7 en crée un autre.
 * Ne lève jamais. Une inscription sans trace n'a pas d'entrée.
 */
export async function lireAccesRemisParInscription(
  enrollmentIds: readonly string[],
): Promise<Readonly<Record<string, string>>> {
  if (enrollmentIds.length === 0) return {};
  try {
    const lignes = await prisma.activityLog.findMany({
      where: {
        action: ACTION_JOURNAL_CONVOCATION_ENVOYEE,
        targetType: "Enrollment",
        targetId: { in: [...enrollmentIds] },
      },
      orderBy: { createdAt: "desc" },
      select: { targetId: true, changes: true },
    });
    const remis: Record<string, string> = {};
    for (const l of lignes) {
      if (l.targetId === null || remis[l.targetId] !== undefined) continue;
      const accesId = (l.changes as { accesId?: unknown } | null)?.accesId;
      if (typeof accesId === "string") remis[l.targetId] = accesId;
    }
    return remis;
  } catch {
    return {};
  }
}
