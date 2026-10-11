/**
 * Fin de collaboration d'un formateur indépendant — le SERVICE (lot L14, E25).
 *
 * Une seule transaction :
 *   1. la fiche est fermée (`finCollaborationAt` = la décision, motif, auteur, date d'effet,
 *      note) et ses accès sont révoqués (`accesVersion + 1`) ;
 *   2. un contrat-cadre encore NON signé est annulé (motif système) et ses liens de
 *      signature non utilisés sont révoqués ;
 *   3. le journal est écrit (`exiger`) : motif, dates, préavis — jamais la note ni une
 *      coordonnée.
 * Puis, hors transaction : une fin IMMÉDIATE désactive la fiche par l'écrivain unique de
 * `actif` (`activation.ts`, lot S1), qui retire aussi les sollicitations en attente ; avec
 * préavis, seules les sollicitations en attente sont retirées (la fiche reste active
 * jusqu'à la date d'effet : ses missions acceptées avant restent dues).
 *
 * 🔴 AUCUNE SUPPRESSION. Le mandat d'autofacturation n'est pas touché : il survit pour
 * les missions réalisées (décision F4 ; décès : règlement à la main, procédure L18).
 *
 * ⚠️ Ne juge ni le rôle ni l'interrupteur : l'action serveur le fait AVANT.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { retirerSollicitationsDuFormateur } from "@/server/qualiopi/trainers/mission-formateur";

import { changerActivationFormateur } from "./activation";

import {
  avecPreavis,
  preavisJours,
  refusFin,
  type MotifFin,
  type RefusFin,
} from "./fin-collaboration";

export const GABARIT_AVERTISSEMENT = "formateur-avertissement";

export interface ContexteFin {
  readonly trainer: {
    readonly id: string;
    readonly prenom: string;
    readonly email: string;
    readonly statut: string;
    readonly organismeSousTraitantId: string | null;
    readonly finCollaborationAt: Date | null;
  };
  /** Première signature d'un contrat-cadre, sinon la date saisie, sinon la création. */
  readonly debutRelation: Date;
  /** Dernier avertissement F49 parti (ni en échec, ni annulé). */
  readonly avertissementEnvoyeAt: Date | null;
}

/** Lit ce qu'il faut pour décider. `null` : fiche introuvable. */
export async function lireContexteFin(trainerId: string): Promise<ContexteFin | null> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      prenom: true,
      email: true,
      statut: true,
      organismeSousTraitantId: true,
      finCollaborationAt: true,
      sousTraitantContratSigneAt: true,
      createdAt: true,
    },
  });
  if (trainer === null) return null;
  const [contrats, avertissement] = await Promise.all([
    prisma.documentGenere.findMany({
      where: { trainerId, type: "contrat_sous_traitance", statutSignature: "signee" },
      select: {
        signatures: {
          where: { revokedAt: null },
          orderBy: { signeAt: "asc" },
          take: 1,
          select: { signeAt: true },
        },
      },
    }),
    prisma.emailLog.findFirst({
      where: {
        template: GABARIT_AVERTISSEMENT,
        entityType: "Trainer",
        entityId: trainerId,
        status: { in: ["sent", "pending"] },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  const signatures = (contrats as Array<{ signatures?: Array<{ signeAt: Date }> }>)
    .flatMap((c) => c.signatures ?? [])
    .map((s) => s.signeAt.getTime());
  const candidats = [
    ...signatures,
    ...(trainer.sousTraitantContratSigneAt ? [trainer.sousTraitantContratSigneAt.getTime()] : []),
  ];
  const debutRelation = new Date(
    candidats.length > 0 ? Math.min(...candidats) : trainer.createdAt.getTime(),
  );
  return {
    trainer: {
      id: trainer.id,
      prenom: trainer.prenom,
      email: trainer.email,
      statut: trainer.statut,
      organismeSousTraitantId: trainer.organismeSousTraitantId,
      finCollaborationAt: trainer.finCollaborationAt,
    },
    debutRelation,
    avertissementEnvoyeAt: avertissement?.createdAt ?? null,
  };
}

/** Indépendant en nom propre seulement : ni salarié, ni dirigeant, ni intervenant d'organisme. */
export function estIndependant(t: ContexteFin["trainer"]): boolean {
  return t.statut === "sous_traitant" && t.organismeSousTraitantId === null;
}

/**
 * Missions acceptées, ou affectations, sur une session qui commence à `date` ou après,
 * hors session annulée.
 */
export async function missionsApres(
  trainerId: string,
  date: Date,
): Promise<Array<{ sessionId: string; debut: Date }>> {
  const session = { dateDebut: { gte: date }, statut: { not: "annulee" as const } };
  const [missions, affectations, principales] = await Promise.all([
    prisma.missionFormateur.findMany({
      where: { trainerId, statut: { in: ["acceptee", "accord_hors_outil"] }, session },
      select: { sessionId: true, session: { select: { dateDebut: true } } },
    }),
    prisma.sessionFormateur.findMany({
      where: { trainerId, session },
      select: { sessionId: true, session: { select: { dateDebut: true } } },
    }),
    prisma.trainingSession.findMany({
      where: { formateurPrincipalId: trainerId, ...session },
      select: { id: true, dateDebut: true },
    }),
  ]);
  const parSession = new Map<string, Date>();
  for (const m of [...(missions ?? []), ...(affectations ?? [])]) {
    parSession.set(m.sessionId, m.session.dateDebut);
  }
  for (const s of principales ?? []) parSession.set(s.id, s.dateDebut);
  return [...parSession].map(([sessionId, debut]) => ({ sessionId, debut }));
}

export interface EntreeFin {
  readonly trainerId: string;
  readonly motif: MotifFin;
  readonly dateEffet: Date;
  readonly note: string;
  readonly irreparable: boolean;
  /** L'administrateur qui décide (UUID) et son rôle. */
  readonly userId: string;
  readonly role: string;
  /** Son nom, pour `annuleePar` d'une pièce annulée. */
  readonly annuleePar: string;
}

export type ResultatFin =
  | { readonly ok: true; readonly preavis: 30 | 60 | 90; readonly contexte: ContexteFin }
  | { readonly ok: false; readonly raison: "introuvable" | "pas-independant" | "deja-terminee" }
  | {
      readonly ok: false;
      readonly raison: "refus";
      readonly refus: RefusFin[];
      readonly missions: Array<{ sessionId: string; debut: Date }>;
    };

class DejaTerminee extends Error {}

export async function terminerCollaboration(e: EntreeFin, maintenant: Date): Promise<ResultatFin> {
  const contexte = await lireContexteFin(e.trainerId);
  if (contexte === null) return { ok: false, raison: "introuvable" };
  if (!estIndependant(contexte.trainer)) return { ok: false, raison: "pas-independant" };
  if (contexte.trainer.finCollaborationAt !== null) return { ok: false, raison: "deja-terminee" };

  const missions = await missionsApres(e.trainerId, e.dateEffet);
  const refus = refusFin({
    motif: e.motif,
    dateEffet: e.dateEffet,
    decision: maintenant,
    debutRelation: contexte.debutRelation,
    avertissementEnvoyeAt: contexte.avertissementEnvoyeAt,
    irreparable: e.irreparable,
    note: e.note,
    missionsApresEffet: missions,
  });
  if (refus.length > 0) return { ok: false, raison: "refus", refus, missions };

  const preavis = preavisJours(contexte.debutRelation, maintenant);
  const immediate = !avecPreavis(e.motif);
  const note = e.note.trim();

  try {
    await prisma.$transaction(async (tx) => {
      const fermee = await tx.trainer.updateMany({
        where: { id: e.trainerId, finCollaborationAt: null },
        data: {
          finCollaborationAt: maintenant,
          finCollaborationMotif: e.motif,
          finCollaborationParId: e.userId,
          finCollaborationEffetAt: e.dateEffet,
          finCollaborationNote: note === "" ? null : note,
          accesVersion: { increment: 1 },
        },
      });
      if (fermee.count === 0) throw new DejaTerminee();

      const contratsNonSignes = await tx.documentGenere.findMany({
        where: {
          trainerId: e.trainerId,
          type: "contrat_sous_traitance",
          statutSignature: { in: ["en_attente", "partielle"] },
          annuleeAt: null,
        },
        select: { id: true },
      });
      const ids = (contratsNonSignes ?? []).map((d) => d.id);
      if (ids.length > 0) {
        await tx.documentGenere.updateMany({
          where: { id: { in: ids }, annuleeAt: null },
          data: {
            annuleeAt: maintenant,
            annuleeMotif: "Fin de collaboration : contrat non signé annulé.",
            annuleePar: e.annuleePar,
          },
        });
        await tx.documentSignatureToken.updateMany({
          where: { documentGenereId: { in: ids }, revokedAt: null, usedAt: null },
          data: {
            revokedAt: maintenant,
            revokedMotif: "Fin de collaboration",
            revokedById: e.userId,
          },
        });
      }

      await journaliser(
        tx,
        {
          action: "qualiopi.trainer.fin_collaboration",
          targetType: "Trainer",
          targetId: e.trainerId,
          changes: {
            motif: e.motif,
            dateEffet: e.dateEffet.toISOString().slice(0, 10),
            preavisJours: immediate ? 0 : preavis,
            contratsAnnules: ids.length,
            noteSaisie: note !== "",
          },
          session: { userId: e.userId },
        },
        { exiger: true },
      );
    });
  } catch (err) {
    if (err instanceof DejaTerminee) return { ok: false, raison: "deja-terminee" };
    throw err;
  }

  // Hors transaction, tolérant : la fiche est déjà fermée, c'est l'essentiel.
  if (immediate) {
    await changerActivationFormateur({
      trainerId: e.trainerId,
      actif: false,
      acteur: { type: "administrateur", session: { userId: e.userId, role: e.role } },
      motif: "Fin de collaboration",
    });
  } else {
    await retirerSollicitationsDuFormateur(e.trainerId);
  }
  return { ok: true, preavis, contexte };
}
