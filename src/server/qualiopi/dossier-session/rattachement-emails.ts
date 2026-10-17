/**
 * 🔴 CHANTIER QNC, LOT L11 — À QUELLE SESSION UN E-MAIL APPARTIENT-IL ?
 *
 * Un e-mail « de formation » est un e-mail dont l'entité visée (`entityType` /
 * `entityId`, posés à l'enfilage) se rattache à UNE session : l'inscription,
 * son questionnaire, une pièce de la session, la session elle-même, la mission
 * ou l'affectation du formateur. Le rattachement passe par l'entité, jamais par
 * l'adresse : une adresse sert à plusieurs dossiers (`idsLiesALaSession`).
 *
 * ⚠️ L'accès au portail (`PortailAcces`) vise un STAGIAIRE, qui peut suivre
 * plusieurs sessions : il ne se rattache à aucune en particulier, et n'est donc
 * pas un e-mail « de formation » au sens de ce module.
 *
 * Une requête par table (`id IN (…)`), sans relation imbriquée : le nombre
 * d'envois d'une personne est petit, et chaque lecture reste vérifiable seule.
 * Toute lecture qui échoue rend « non rattaché » — c'est-à-dire, pour
 * l'effacement, le comportement d'avant ce lot (la copie est supprimée).
 */

import { prisma } from "@/lib/prisma";
import type { DocumentType } from "../../../../prisma/generated/client";
import { documentJointAuDossierAudit } from "@/server/qualiopi/conformite/hors-dossier-audit";
import { emailHorsDossier } from "./classement";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EnvoiARattacher {
  readonly id: string;
  readonly template: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
}

export interface RattachementEmail {
  readonly sessionId: string;
  /** La session OU l'inscription visée est du banc d'essai. */
  readonly essai: boolean;
  /** Pièce de facturation, de rémunération ou d'employeur : hors dossier. */
  readonly horsDossier: boolean;
}

function ids(envois: readonly EnvoiARattacher[], type: string): string[] {
  return [
    ...new Set(
      envois
        .filter((e) => e.entityType === type && e.entityId !== null && UUID.test(e.entityId))
        .map((e) => e.entityId as string),
    ),
  ];
}

async function lire<T>(liste: string[], f: (l: string[]) => Promise<T[]>): Promise<T[]> {
  if (liste.length === 0) return [];
  try {
    return await f(liste);
  } catch {
    return [];
  }
}

/** Rattache chaque envoi à sa session, quand il en a une. */
export async function rattacherEnvoisAUneSession(
  envois: readonly EnvoiARattacher[],
): Promise<Map<string, RattachementEmail>> {
  const resultat = new Map<string, RattachementEmail>();
  if (envois.length === 0) return resultat;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return resultat;

  const [questionnaires, pieces, affectations, missions] = await Promise.all([
    lire(ids(envois, "Questionnaire"), (l) =>
      prisma.questionnaire.findMany({
        where: { id: { in: l } },
        select: { id: true, enrollmentId: true },
      }),
    ),
    lire(ids(envois, "DocumentGenere"), (l) =>
      prisma.documentGenere.findMany({
        where: { id: { in: l } },
        select: { id: true, sessionId: true, type: true },
      }),
    ),
    lire(ids(envois, "SessionFormateur"), (l) =>
      prisma.sessionFormateur.findMany({
        where: { id: { in: l } },
        select: { id: true, sessionId: true },
      }),
    ),
    lire(ids(envois, "MissionFormateur"), (l) =>
      prisma.missionFormateur.findMany({
        where: { id: { in: l } },
        select: { id: true, sessionId: true },
      }),
    ),
  ]);

  const idsInscriptions = [
    ...new Set([...ids(envois, "Enrollment"), ...questionnaires.map((q) => q.enrollmentId)]),
  ];
  const inscriptions = await lire(idsInscriptions, (l) =>
    prisma.enrollment.findMany({
      where: { id: { in: l } },
      select: { id: true, sessionId: true, estTestInterne: true },
    }),
  );

  const idsSessions = [
    ...new Set([
      ...ids(envois, "TrainingSession"),
      ...inscriptions.map((i) => i.sessionId),
      ...pieces.map((p) => p.sessionId).filter((s): s is string => s !== null),
      ...affectations.map((a) => a.sessionId),
      ...missions.map((m) => m.sessionId),
    ]),
  ];
  const sessions = await lire(idsSessions, (l) =>
    prisma.trainingSession.findMany({
      where: { id: { in: l } },
      select: { id: true, estTestInterne: true },
    }),
  );

  const sessionEssai = new Map(sessions.map((s) => [s.id, s.estTestInterne === true]));
  const parInscription = new Map(inscriptions.map((i) => [i.id, i]));
  const parQuestionnaire = new Map(questionnaires.map((q) => [q.id, q.enrollmentId]));
  const parPiece = new Map(pieces.map((p) => [p.id, p]));
  const parAffectation = new Map(affectations.map((a) => [a.id, a.sessionId]));
  const parMission = new Map(missions.map((m) => [m.id, m.sessionId]));

  for (const e of envois) {
    if (e.entityId === null) continue;
    let sessionId: string | null = null;
    let inscriptionEssai = false;
    let typePiece: DocumentType | null = null;
    switch (e.entityType) {
      case "TrainingSession":
        sessionId = e.entityId;
        break;
      case "Enrollment":
      case "Questionnaire": {
        const idInscription =
          e.entityType === "Enrollment" ? e.entityId : (parQuestionnaire.get(e.entityId) ?? null);
        const i = idInscription === null ? undefined : parInscription.get(idInscription);
        if (i !== undefined) {
          sessionId = i.sessionId;
          inscriptionEssai = i.estTestInterne === true;
        }
        break;
      }
      case "DocumentGenere": {
        const p = parPiece.get(e.entityId);
        if (p !== undefined) {
          sessionId = p.sessionId;
          typePiece = p.type;
        }
        break;
      }
      case "SessionFormateur":
        sessionId = parAffectation.get(e.entityId) ?? null;
        break;
      case "MissionFormateur":
        sessionId = parMission.get(e.entityId) ?? null;
        break;
      default:
        break;
    }
    // Une session inconnue de la base (supprimée, identifiant faux) n'est pas
    // un rattachement : on ne garde rien sur la foi d'un identifiant orphelin.
    if (sessionId === null || !sessionEssai.has(sessionId)) continue;
    resultat.set(e.id, {
      sessionId,
      essai: sessionEssai.get(sessionId) === true || inscriptionEssai,
      horsDossier: emailHorsDossier(
        e.template,
        typePiece !== null && !documentJointAuDossierAudit(typePiece),
      ),
    });
  }
  return resultat;
}
