/**
 * Qualiopi — Server Actions Session de formation (T3).
 *
 * createSessionAction      : crée une session planifiée (validation canCreateSessionFor).
 * transitionSessionAction  : applique une transition de statut (machine à états).
 *
 * Chaque création/transition écrit une FormationTransition (event sourcing).
 * Idempotence via @@unique [sessionId, toStatus, trigger] — P2002 = déjà fait → ok.
 *
 * T6 — writeSessionTransition déplacé dans formations/transition-helper.ts
 * (module sans "use server", importable par workers BullMQ et tests sans conflit).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type {
  TrainingSessionStatut,
  TransitionTriggeredBy,
} from "@/server/qualiopi/formations/types";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { allocateSessionNumero } from "@/server/qualiopi/formations/numbering";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { canCreateSessionFor } from "@/server/qualiopi/formations/formations";
import { assertSessionTransition } from "@/server/qualiopi/formations/state-machine";
import { writeSessionTransition } from "@/server/qualiopi/formations/transition-helper";
import { getFinancementValidations } from "@/server/qualiopi/financements/validation-service";
import {
  FORMATION_SNAPSHOT_SELECT,
  buildFormationSnapshot,
} from "@/server/qualiopi/formations/formation-snapshot";

// NB : le type `WriteSessionTransitionInput` n'est PAS ré-exporté ici (aucun
// caller externe). Un `export type { … }` dans un module "use server" est
// mal compilé par Turbopack (Next 16.2) en Server Action runtime → 500.
// Source du type : @/server/qualiopi/formations/transition-helper.

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

  // Vérifier que la formation est publiée et active. On lit aussi les champs du
  // snapshot légal (WS5) pour les figer dans la session dès sa création.
  let formation:
    | ({ id: string; statutGeneration: string; statut: string; titre: string } & {
        dureeHeures: number;
        modalite: string;
        objectifsPedagogiques: unknown;
        programmeDetaille: unknown;
        methodesPedagogiques: string;
        certificationType: string;
        versionProgramme: string;
      })
    | null;
  try {
    formation = await prisma.formation.findUnique({
      where: { id: v.formationId },
      select: { id: true, statutGeneration: true, statut: true, ...FORMATION_SNAPSHOT_SELECT },
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

  // Titre par défaut si non fourni
  const titreSession = v.titreSession ?? formation.titre;

  // Snapshot légal (WS5) — fige la formation telle que vendue à cette session.
  const formationSnapshot = buildFormationSnapshot(formation, new Date());

  // Créer la session + FormationTransition initiale dans une transaction,
  // avec retry sur collision de numéro (R7 : numéro ré-alloué à chaque tentative).
  let created: { id: string; numero: string };
  try {
    created = await withNumberRetry(() =>
      prisma.$transaction(async (tx) => {
        const numero = await allocateSessionNumero(
          v.recurrence !== undefined ? { recurrence: v.recurrence } : undefined,
        );
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
            formationSnapshot: formationSnapshot as never,
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
      }),
    );
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
    changes: {
      numero: created.numero,
      formationId: v.formationId,
      dateDebut: v.dateDebut,
      dateFin: v.dateFin,
    },
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

  // Garde financement : si la cible est en_cours, vérifier les validations bloquantes.
  if (toStatus === "en_cours") {
    let financementEntries: Awaited<ReturnType<typeof getFinancementValidations>>;
    try {
      financementEntries = await getFinancementValidations(v.id);
    } catch {
      financementEntries = [];
    }
    const critiques = financementEntries.filter(
      (e) => e.result.ok === false && e.result.gravite === "critique",
    );
    if (critiques.length > 0) {
      const messages = critiques.map((e) => e.result.alerte ?? e.code).join(" | ");
      return {
        error: `Démarrage bloqué : ${messages} (accord OPCO/EDOF/France Travail requis).`,
      };
    }
  }

  // Garde émargement (R1 audit) : on ne marque pas une session « réalisée »
  // manuellement sans aucune trace de présence/émargement (ind. 12). S'il existe
  // des inscrits mais aucun émargement/taux saisi → bloquer. (L'auto-clôture cron
  // J+1 reste un filet de sécurité signalé par l'alerte R03 a posteriori.)
  if (toStatus === "realisee") {
    try {
      const totalInscrits = await prisma.enrollment.count({ where: { sessionId: v.id } });
      if (totalInscrits > 0) {
        // Symétrique de la garde du cron (`qualiopi-formation-crons-worker.ts`) :
        // `> 0` et non `not: null`, car `recomputeTauxPresence` écrit toujours ce
        // champ, 0 compris. Les deux gardes DOIVENT rester alignées, sinon la
        // clôture automatique et la clôture manuelle divergent.
        const avecEmargement = await prisma.enrollment.count({
          where: {
            sessionId: v.id,
            OR: [{ emargementSigneAt: { not: null } }, { tauxPresencePct: { gt: 0 } }],
          },
        });
        if (avecEmargement === 0) {
          return {
            error:
              "Clôture bloquée : aucun émargement/relevé de présence saisi. Renseigner la présence avant de marquer la session réalisée.",
          };
        }
      }
    } catch {
      // En cas d'erreur de lecture, ne pas bloquer la transition (fail-soft).
    }
  }

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
