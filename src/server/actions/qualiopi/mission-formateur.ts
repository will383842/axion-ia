"use server";

/**
 * Actions — cycle de vie du formateur sur une session (2026-09-03).
 *
 * Deux côtés, deux gardes :
 *   - le FORMATEUR répond (accepte / refuse avec motif) — soit connecté à son
 *     espace (`requireFormateurAction`), soit par le lien de l'e-mail : le
 *     jeton `formateur_mission` désigne la sollicitation et vaut identité ;
 *   - la CONSOLE renvoie une proposition ou consigne une absence
 *     (`requireAdminWrite`).
 *
 * Toute la logique vit dans `qualiopi/trainers/mission-formateur.ts` : ici,
 * on valide l'entrée, on garde, on appelle, on journalise.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireFormateurAction } from "@/server/formateur/guard";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import {
  lireMissionParJeton,
  proposerMissionFormateur,
  repondreMission,
  REPONSES_MISSION,
  FAITS_ABSENCE,
  type ReponseMission,
} from "@/server/qualiopi/trainers/mission-formateur";
import { ecrireApresDelai } from "@/server/qualiopi/trainers/message-apres-delai";
import type { MissionFormateurStatut } from "../../../../prisma/generated/client";

// Même forme que les autres actions Qualiopi (`trainers.ts`, `sessions.ts`).
type ActionResult<T> = { data: T } | { error: string };

const reponseSchema = z.object({
  reponse: z.enum(REPONSES_MISSION),
  motif: z.string().trim().max(2000).optional(),
});

export interface ReponseMissionOk {
  statut: MissionFormateurStatut;
  sessionId: string;
}

/**
 * Réponse par le LIEN de l'e-mail — aucune session formateur requise : le
 * jeton signé désigne la sollicitation, donc le formateur. On ne fait pas
 * confiance à un `missionId` fourni par le client : il vient du jeton.
 */
export async function repondreMissionParJetonAction(input: {
  token: string;
  reponse: ReponseMission;
  motif?: string;
}): Promise<ActionResult<ReponseMissionOk>> {
  const parsed = reponseSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  if (typeof input.token !== "string" || input.token.length < 10) {
    return { error: "Lien invalide." };
  }
  const mission = await lireMissionParJeton(input.token);
  if (mission === null) {
    return { error: "Ce lien n'est plus valide : il a expiré ou la proposition a été retirée." };
  }
  const r = await repondreMission({
    missionId: mission.id,
    reponse: parsed.data.reponse,
    ...(parsed.data.motif !== undefined ? { motif: parsed.data.motif } : {}),
  });
  if (!r.ok) return { error: r.erreur };
  return { data: { statut: r.statut, sessionId: r.sessionId } };
}

/**
 * Message libre du formateur APRÈS l'échéance, depuis son lien devenu inerte.
 *
 * Pas de garde admin : le jeton signé désigne la sollicitation, donc la
 * personne — exactement comme la réponse ci-dessus. C'est le seul geste qui
 * reste au formateur quand le délai est passé, et le lui refuser ferait perdre
 * la seule information encore utile : est-il disponible malgré tout ?
 */
export async function ecrireApresDelaiAction(input: {
  token: string;
  message: string;
}): Promise<ActionResult<{ envoye: true }>> {
  if (typeof input.token !== "string" || input.token.length < 10) {
    return { error: "Lien invalide." };
  }
  if (typeof input.message !== "string") return { error: "Données invalides" };
  const r = await ecrireApresDelai({ token: input.token, message: input.message });
  if (!r.ok) return { error: r.erreur };
  return { data: { envoye: true } };
}

/** Réponse depuis l'espace formateur CONNECTÉ. */
export async function repondreMissionFormateurAction(input: {
  missionId: string;
  reponse: ReponseMission;
  motif?: string;
}): Promise<ActionResult<ReponseMissionOk>> {
  const { trainerId } = await requireFormateurAction();
  const parsed = reponseSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  if (!z.string().uuid().safeParse(input.missionId).success) return { error: "Données invalides" };
  const r = await repondreMission({
    missionId: input.missionId,
    trainerId,
    reponse: parsed.data.reponse,
    ...(parsed.data.motif !== undefined ? { motif: parsed.data.motif } : {}),
  });
  if (!r.ok) return { error: r.erreur };
  return { data: { statut: r.statut, sessionId: r.sessionId } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Console
// ─────────────────────────────────────────────────────────────────────────────

const coupleSchema = z.object({
  sessionId: z.string().uuid(),
  trainerId: z.string().uuid(),
});

/**
 * Renvoie la proposition (nouveau jeton, nouvel e-mail). La sollicitation
 * précédente encore ouverte est retirée par le service : une seule vivante.
 */
export async function renvoyerPropositionMissionAction(
  input: z.infer<typeof coupleSchema>,
): Promise<ActionResult<{ missionId: string; emailEnvoye: boolean }>> {
  const session = await requireAdminWrite();
  const parsed = coupleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, trainerId } = parsed.data;

  // Le formateur doit être AFFECTÉ : on ne propose pas une mission à quelqu'un
  // qui n'est pas sur la session — ce serait une affectation déguisée.
  let affecte: { id: string } | null;
  try {
    affecte = await prisma.sessionFormateur.findUnique({
      where: { sessionId_trainerId: { sessionId, trainerId } },
      select: { id: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de l'affectation" };
  }
  if (affecte === null) return { error: "Ce formateur n'est pas affecté à cette session." };

  const r = await proposerMissionFormateur({ sessionId, trainerId, role: "principal" });
  if (!r.proposee) return { error: `Proposition impossible : ${r.raison}.` };

  await logQualiopiActivity({
    action: "qualiopi.session.mission_formateur.renvoyee",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { trainerId, missionId: r.missionId, emailEnvoye: r.emailEnvoye },
    session,
  });
  return { data: { missionId: r.missionId, emailEnvoye: r.emailEnvoye } };
}

const absenceSchema = coupleSchema.extend({
  fait: z.enum(FAITS_ABSENCE),
  commentaire: z.string().trim().max(2000).optional(),
});

const LIBELLE_FAIT_ABSENCE: Record<(typeof FAITS_ABSENCE)[number], string> = {
  desistement: "Désistement du formateur",
  annulation_tardive: "Annulation tardive du formateur",
};

/**
 * Consigne une ABSENCE : un incident `faitIntervenant` contre le formateur,
 * rattaché à la session. C'est ce fait — pas une note — qui nourrit la
 * fiabilité (art. 7 et 8) et le pilotage « refus et absences ». L'affectation
 * n'est PAS retirée : la session a peut-être eu lieu avec un remplaçant, et
 * ce qu'il faut faire ensuite (reporter, réaffecter) reste un arbitrage.
 */
export async function declarerAbsenceFormateurAction(
  input: z.infer<typeof absenceSchema>,
): Promise<ActionResult<{ incidentId: string }>> {
  const session = await requireAdminWrite();
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let contexte: { numero: string; trainer: { prenom: string; nom: string } | null } | null;
  try {
    const [s, t] = await Promise.all([
      prisma.trainingSession.findUnique({ where: { id: v.sessionId }, select: { numero: true } }),
      prisma.trainer.findUnique({
        where: { id: v.trainerId },
        select: { prenom: true, nom: true },
      }),
    ]);
    contexte = s === null ? null : { numero: s.numero, trainer: t };
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (contexte === null) return { error: "Session introuvable" };
  if (contexte.trainer === null) return { error: "Formateur introuvable" };

  const qui = `${contexte.trainer.prenom} ${contexte.trainer.nom}`;
  let incident: { id: string };
  try {
    incident = await prisma.incident.create({
      data: {
        type: "autre",
        gravite: "majeur",
        titre: `${LIBELLE_FAIT_ABSENCE[v.fait]} — ${qui} — session ${contexte.numero}`,
        description:
          (v.commentaire && v.commentaire.length > 0
            ? v.commentaire
            : `${qui} n'a pas assuré la session ${contexte.numero}.`) +
          " Consigné depuis la fiche de session (cycle de vie du formateur).",
        sessionId: v.sessionId,
        trainerId: v.trainerId,
        faitIntervenant: v.fait,
        dateIncident: new Date(),
        statut: "ouvert",
      },
      select: { id: true },
    });
  } catch {
    return { error: "Erreur lors de la création de l'incident" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.absence_formateur",
    targetType: "Incident",
    targetId: incident.id,
    changes: { sessionId: v.sessionId, trainerId: v.trainerId, fait: v.fait },
    session,
  });
  return { data: { incidentId: incident.id } };
}
