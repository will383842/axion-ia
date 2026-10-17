/**
 * CHANTIER QNC, LOT L02 — CET ENVOI CONCERNE-T-IL UN ESSAI ?
 *
 * `enqueueEmail` ne connaît que l'entité rattachée au journal
 * (`entityType` / `entityId`). Ce module remonte de cette entité jusqu'à la
 * session et à l'inscription pour lire leur drapeau d'essai.
 *
 * Entités reconnues : TrainingSession, Enrollment, Questionnaire,
 * DocumentGenere, FactureFormation, SessionFormateur, MissionFormateur,
 * DossierFinancement, PortailAcces. Toute autre entité (candidature, devis,
 * apporteur…) n'appartient à aucune session : pas d'essai.
 *
 * PortailAcces porte un stagiaire, pas une session : il est d'essai si TOUTES
 * les inscriptions du stagiaire le sont (au moins une). Un stagiaire inscrit à
 * une vraie session reçoit son accès.
 *
 * ⚠️ Une lecture en échec rend `"inconnu"` : l'appelant décide. `enqueueEmail`
 * laisse alors partir l'e-mail — c'est le comportement d'avant ce lot, et une
 * convocation réelle bloquée par une base hésitante coûte plus qu'un essai
 * dont la session ne se relit pas (la session d'essai, elle, est lisible : on
 * vient de l'écrire). Le cas est signalé dans les journaux du processus.
 */

import { prisma } from "@/lib/prisma";
import {
  estInscriptionReelle,
  estSessionReelle,
  SELECTION_DRAPEAU_FACTURE,
  estFactureReelle,
} from "./perimetre";

export type VerdictEssai = "essai" | "reel" | "inconnu";

export interface ReferenceEnvoi {
  readonly entityType?: string | null;
  readonly entityId?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DRAPEAU_INSCRIPTION = {
  estTestInterne: true,
  session: { select: { estTestInterne: true } },
} as const;

/** `null` (ligne introuvable) : rien ne la rattache à un essai. */
const verdict = (reelle: boolean | null): VerdictEssai => (reelle === false ? "essai" : "reel");

/** L'entité rattachée à l'envoi relève-t-elle d'un essai ? */
export async function verdictEssaiDeLEntite(ref: ReferenceEnvoi): Promise<VerdictEssai> {
  const type = ref.entityType ?? null;
  const id = ref.entityId ?? null;
  if (type === null || id === null || !UUID.test(id)) return "reel";
  try {
    switch (type) {
      case "TrainingSession": {
        const s = await prisma.trainingSession.findUnique({
          where: { id },
          select: { estTestInterne: true },
        });
        return verdict(s === null ? null : estSessionReelle(s));
      }
      case "Enrollment": {
        const e = await prisma.enrollment.findUnique({
          where: { id },
          select: DRAPEAU_INSCRIPTION,
        });
        return verdict(e === null ? null : estInscriptionReelle(e));
      }
      case "Questionnaire": {
        const q = await prisma.questionnaire.findUnique({
          where: { id },
          select: { enrollment: { select: DRAPEAU_INSCRIPTION } },
        });
        return verdict(q === null ? null : estInscriptionReelle(q.enrollment));
      }
      case "DocumentGenere": {
        const d = await prisma.documentGenere.findUnique({
          where: { id },
          select: { session: { select: { estTestInterne: true } } },
        });
        return verdict(d === null ? null : estSessionReelle(d.session));
      }
      case "FactureFormation": {
        const f = await prisma.factureFormation.findUnique({
          where: { id },
          select: SELECTION_DRAPEAU_FACTURE,
        });
        return verdict(f === null ? null : estFactureReelle(f));
      }
      case "SessionFormateur": {
        const sf = await prisma.sessionFormateur.findUnique({
          where: { id },
          select: { session: { select: { estTestInterne: true } } },
        });
        return verdict(sf === null ? null : estSessionReelle(sf.session));
      }
      case "MissionFormateur": {
        const m = await prisma.missionFormateur.findUnique({
          where: { id },
          select: { session: { select: { estTestInterne: true } } },
        });
        return verdict(m === null ? null : estSessionReelle(m.session));
      }
      case "DossierFinancement": {
        const d = await prisma.dossierFinancement.findUnique({
          where: { id },
          select: { trainingSession: { select: { estTestInterne: true } } },
        });
        return verdict(d === null ? null : estSessionReelle(d.trainingSession));
      }
      case "PortailAcces": {
        const a = await prisma.portailAcces.findUnique({
          where: { id },
          select: { traineeId: true },
        });
        return a === null ? "reel" : (await stagiaireDEssai(a.traineeId)) ? "essai" : "reel";
      }
      default:
        return "reel";
    }
  } catch (err) {
    console.warn(
      `[qualiopi.essai] drapeau d'essai illisible pour ${type}/${id}`,
      err instanceof Error ? err.message : String(err),
    );
    return "inconnu";
  }
}

/**
 * Le stagiaire n'existe-t-il QUE dans des sessions d'essai (au moins une
 * inscription, toutes d'essai) ? Un stagiaire inscrit à une vraie session est
 * réel. Lève si la base ne répond pas : l'appelant choisit sa tolérance.
 */
export async function stagiaireDEssai(traineeId: string): Promise<boolean> {
  const inscriptions = await prisma.enrollment.findMany({
    where: { traineeId },
    select: DRAPEAU_INSCRIPTION,
  });
  return inscriptions.length > 0 && inscriptions.every((e) => !estInscriptionReelle(e));
}
