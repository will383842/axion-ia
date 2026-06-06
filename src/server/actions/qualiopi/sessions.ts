/**
 * Qualiopi — Server Actions Session de formation (T3).
 *
 * createSessionAction      : crée une session planifiée (validation canCreateSessionFor).
 * transitionSessionAction  : applique une transition de statut (machine à états).
 *
 * Chaque création/transition écrit une FormationTransition (event sourcing).
 * Idempotence via @@unique [sessionId, toStatus, trigger] — P2002 = déjà fait → ok.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type {
  Prisma,
  TrainingSessionStatut,
  TransitionTriggeredBy,
} from "../../../../prisma/generated/client";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { allocateSessionNumero } from "@/server/qualiopi/formations/numbering";
import { canCreateSessionFor } from "@/server/qualiopi/formations/formations";
import { assertSessionTransition } from "@/server/qualiopi/formations/state-machine";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Enums Zod (miroir enum Prisma)
// ─────────────────────────────────────────────────────────────────────────────

const MODALITES = ["presentiel", "distanciel", "hybride"] as const;
const FINANCEMENT_TYPES = ["direct", "opco", "cpf", "france_travail", "mixte"] as const;
const SESSION_STATUTS = ["planifiee", "en_cours", "realisee", "annulee", "reportee"] as const;
const TRANSITION_TRIGGERED_BY = ["admin", "cron", "webhook", "system", "client", "user"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  formationId: z.string().uuid(),
  titreSession: z.string().min(1).max(300).optional(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date(),
  modalite: z.enum(MODALITES),
  nbParticipantsPrevus: z.number().int().min(1),
  montantHtCents: z.number().int().min(0),
  clientId: z.string().uuid().optional(),
  devisId: z.string().uuid().optional(),
  financementType: z.enum(FINANCEMENT_TYPES).optional(),
  recurrence: z.number().int().min(1).optional(),
});

const transitionSessionSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum(SESSION_STATUTS),
  trigger: z.string().max(80).optional(),
  reason: z.string().max(500).optional(),
  triggeredBy: z.enum(TRANSITION_TRIGGERED_BY).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne : écriture d'une FormationTransition
// ─────────────────────────────────────────────────────────────────────────────

interface WriteSessionTransitionInput {
  sessionId: string;
  from: TrainingSessionStatut | null;
  to: TrainingSessionStatut;
  trigger: string;
  triggeredBy: TransitionTriggeredBy;
  triggeredById?: string | null;
  reason?: string | null;
  snapshotBefore?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
  snapshotAfter?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
}

async function writeSessionTransition(
  tx: Prisma.TransactionClient,
  input: WriteSessionTransitionInput,
): Promise<void> {
  await tx.formationTransition.create({
    data: {
      sessionId: input.sessionId,
      // fromStatus est nullable (null = création initiale). Spread conditionnel
      // pour respecter exactOptionalPropertyTypes : on ne passe pas undefined.
      ...(input.from !== null ? { fromStatus: input.from } : {}),
      toStatus: input.to,
      trigger: input.trigger.slice(0, 80),
      triggeredBy: input.triggeredBy,
      ...(input.triggeredById !== undefined ? { triggeredById: input.triggeredById } : {}),
      ...(input.reason !== undefined && input.reason !== null ? { reason: input.reason } : {}),
      ...(input.snapshotBefore !== undefined ? { snapshotBefore: input.snapshotBefore } : {}),
      ...(input.snapshotAfter !== undefined ? { snapshotAfter: input.snapshotAfter } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une session planifiée rattachée à une formation publiée.
 *
 * Validations métier :
 *   - La formation doit pouvoir accueillir des sessions (canCreateSessionFor).
 *   - dateFin doit être strictement postérieure à dateDebut.
 * Statut initial : 'planifiee'.
 * Écrit une FormationTransition initiale (null → planifiee, trigger 'admin.create').
 */
export async function createSessionAction(
  input: z.infer<typeof createSessionSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Valider dateFin > dateDebut
  if (v.dateFin <= v.dateDebut) {
    return { error: "La date de fin doit être postérieure à la date de début" };
  }

  // Vérifier que la formation est publiée et active
  let formation: { id: string; statutGeneration: string; statut: string; titre: string } | null;
  try {
    formation = await prisma.formation.findUnique({
      where: { id: v.formationId },
      select: { id: true, statutGeneration: true, statut: true, titre: true },
    });
  } catch {
    return { error: "Erreur lors de la vérification de la formation" };
  }
  if (!formation) return { error: "Formation introuvable" };

  if (
    !canCreateSessionFor({
      statutGeneration: formation.statutGeneration as Parameters<
        typeof canCreateSessionFor
      >[0]["statutGeneration"],
      statut: formation.statut as Parameters<typeof canCreateSessionFor>[0]["statut"],
    })
  ) {
    return {
      error: `Impossible de créer une session : la formation doit être publiée et active (statut actuel : ${formation.statut} / ${formation.statutGeneration})`,
    };
  }

  // Allouer le numéro (spread conditionnel pour exactOptionalPropertyTypes)
  const numero = await allocateSessionNumero(
    v.recurrence !== undefined ? { recurrence: v.recurrence } : undefined,
  );

  // Titre par défaut si non fourni
  const titreSession = v.titreSession ?? formation.titre;

  // Créer la session + FormationTransition initiale dans une transaction
  let created: { id: string; numero: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const newSession = await tx.trainingSession.create({
        data: {
          numero,
          titreSession,
          formationId: v.formationId,
          dateDebut: v.dateDebut,
          dateFin: v.dateFin,
          modalite: v.modalite,
          nbParticipantsPrevus: v.nbParticipantsPrevus,
          montantHtCents: v.montantHtCents,
          statut: "planifiee",
          ...(v.clientId !== undefined ? { clientId: v.clientId } : {}),
          ...(v.devisId !== undefined ? { devisId: v.devisId } : {}),
          ...(v.financementType !== undefined ? { financementType: v.financementType } : {}),
        },
        select: { id: true, numero: true },
      });

      // Transition initiale null → planifiee
      await writeSessionTransition(tx, {
        sessionId: newSession.id,
        from: null,
        to: "planifiee",
        trigger: "admin.create",
        triggeredBy: "admin",
        triggeredById: session.userId,
      });

      return newSession;
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002")
      return { error: "Un conflit de numéro a été détecté, veuillez réessayer" };
    return { error: "Erreur lors de la création de la session" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.create",
    targetType: "TrainingSession",
    targetId: created.id,
    changes: { numero, formationId: v.formationId, dateDebut: v.dateDebut, dateFin: v.dateFin },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}

/**
 * Applique une transition de statut à une session.
 *
 * Validation : assertSessionTransition lève si la transition est interdite.
 * Idempotence : P2002 sur FormationTransition @@unique = déjà fait → retour ok.
 */
export async function transitionSessionAction(input: {
  id: string;
  toStatus: z.infer<typeof transitionSessionSchema>["toStatus"];
  trigger?: string;
  reason?: string;
  triggeredBy?: z.infer<typeof transitionSessionSchema>["triggeredBy"];
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = transitionSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Lire le statut actuel
  let currentSession: { id: string; statut: TrainingSessionStatut } | null;
  try {
    currentSession = await prisma.trainingSession.findUnique({
      where: { id: v.id },
      select: { id: true, statut: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!currentSession) return { error: "Session introuvable" };

  const fromStatus = currentSession.statut;
  const toStatus = v.toStatus as TrainingSessionStatut;

  // Valider la transition (lève si interdite)
  try {
    assertSessionTransition(fromStatus, toStatus);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Transition interdite" };
  }

  const trigger = v.trigger ?? `admin.transition.${toStatus}`;
  const triggeredBy: TransitionTriggeredBy = (v.triggeredBy as TransitionTriggeredBy) ?? "admin";

  // Appliquer transition + écrire FormationTransition dans une tx
  try {
    await prisma.$transaction(async (tx) => {
      // Idempotence : @@unique [sessionId, toStatus, trigger]
      await writeSessionTransition(tx, {
        sessionId: v.id,
        from: fromStatus,
        to: toStatus,
        trigger,
        triggeredBy,
        triggeredById: session.userId,
        reason: v.reason ?? null,
      });

      await tx.trainingSession.update({
        where: { id: v.id },
        data: { statut: toStatus },
      });
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      // Transition déjà appliquée pour ce trigger → idempotent, ok
      return { data: { id: v.id } };
    }
    return { error: "Erreur lors de la transition de la session" };
  }

  await logQualiopiActivity({
    action: `qualiopi.session.transition.${toStatus}`,
    targetType: "TrainingSession",
    targetId: v.id,
    changes: { from: fromStatus, to: toStatus, trigger },
    session,
  });

  return { data: { id: v.id } };
}
