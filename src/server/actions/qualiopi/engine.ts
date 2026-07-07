/**
 * Qualiopi — Server Actions Formation Engine (T4).
 *
 * startGenerationAction       : lance (ou relance) la génération IA d'une formation.
 * approveFileValidationAction : approuve une FileValidation + fait avancer statutGeneration.
 * rejectFileValidationAction  : rejette une FileValidation + consigne de correction.
 * getGenerationStatusAction   : lecture statut + jobs + coût cumulé (lecture seule).
 *
 * Conventions :
 * - "use server" + Zod + requireAdminWrite/Read + logQualiopiActivity.
 * - Retour typé `{ data }` | `{ error }`.
 * - Cloisonnement : src/server/actions/qualiopi/engine.ts.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAdminWrite,
  requireAdminRead,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { enqueueFormationGeneration } from "@/server/queue/queues";
import type { FormationStatutGeneration } from "../../../../prisma/generated/client";
import {
  resolveNextStatutAfterApproval,
  resolveRevertStatutAfterRejection,
} from "@/server/qualiopi/engine/status-transitions";

type ActionResult<T> = { data: T } | { error: string };

// ── Statuts relançables (hors validation humaine bloquante) ────────────────────

const RELANCABLE_STATUTS: FormationStatutGeneration[] = [
  "intention",
  "structure_generee",
  "contenu_evalue",
];

// ── Schémas Zod ───────────────────────────────────────────────────────────────

const startGenerationSchema = z.object({
  formationId: z.string().uuid(),
});

const approveFileValidationSchema = z.object({
  id: z.string().uuid(),
  /** Étape optionnelle pour vérification croisée. */
  etape: z.enum(["structure", "contenu", "assemblage"]).optional(),
});

const rejectFileValidationSchema = z.object({
  id: z.string().uuid(),
  consigne: z
    .string()
    .min(10, "La consigne de correction doit faire au moins 10 caractères.")
    .max(2000),
});

const getGenerationStatusSchema = z.object({
  formationId: z.string().uuid(),
});

// ── Action : startGenerationAction ───────────────────────────────────────────

/**
 * Lance ou relance la génération IA d'une formation.
 *
 * Conditions :
 *   - La formation doit exister.
 *   - statutGeneration doit être dans RELANCABLE_STATUTS (pas de re-lancement
 *     sur contenu_genere ou plus — attendre validation humaine).
 *
 * Résultat : enfile un job formation-engine.
 */
export async function startGenerationAction(
  input: z.infer<typeof startGenerationSchema>,
): Promise<ActionResult<{ formationId: string; statutGeneration: string }>> {
  const session = await requireAdminWrite();
  const parsed = startGenerationSchema.safeParse(input);
  if (!parsed.success) return { error: "Paramètres invalides." };

  const { formationId } = parsed.data;

  let formation: { id: string; titre: string; statutGeneration: FormationStatutGeneration } | null;
  try {
    formation = await prisma.formation.findUnique({
      where: { id: formationId },
      select: { id: true, titre: true, statutGeneration: true },
    });
  } catch {
    return { error: "Erreur lors de la récupération de la formation." };
  }

  if (!formation) return { error: "Formation introuvable." };

  if (!RELANCABLE_STATUTS.includes(formation.statutGeneration)) {
    return {
      error: `Impossible de lancer la génération : statut actuel "${formation.statutGeneration}" n'est pas relançable. Attendez la validation humaine ou archivez la formation.`,
    };
  }

  await enqueueFormationGeneration({ formationId });

  await logQualiopiActivity({
    action: "qualiopi.formation.generation.start",
    targetType: "Formation",
    targetId: formationId,
    changes: { statutGeneration: formation.statutGeneration },
    session,
  });

  return { data: { formationId, statutGeneration: formation.statutGeneration } };
}

// ── Action : enqueueBatchGenerationAction (génération en lot) ─────────────────

const enqueueBatchSchema = z.object({
  /** Nombre max de formations à enfiler d'un coup (garde-fou). Défaut 20. */
  limite: z.number().int().min(1).max(50).optional(),
});

/**
 * Enfile la génération IA pour TOUTES les formations en statut relançable
 * (intention/structure_generee/contenu_evalue). Pour lancer d'un coup le
 * catalogue (ex. les 17 formations) sans cliquer une par une. Borné par `limite`.
 * Ne touche jamais aux formations en attente de validation humaine ou publiées.
 */
export async function enqueueBatchGenerationAction(
  input: z.infer<typeof enqueueBatchSchema>,
): Promise<ActionResult<{ enfilees: number; formationIds: string[] }>> {
  const session = await requireAdminWrite();
  const parsed = enqueueBatchSchema.safeParse(input);
  if (!parsed.success) return { error: "Paramètres invalides." };

  const limite = parsed.data.limite ?? 20;

  let formations: Array<{ id: string }>;
  try {
    formations = await prisma.formation.findMany({
      where: { statutGeneration: { in: RELANCABLE_STATUTS }, statut: { not: "archive" } },
      select: { id: true },
      orderBy: { numero: "asc" },
      take: limite,
    });
  } catch {
    return { error: "Erreur lors de la récupération des formations." };
  }

  for (const f of formations) {
    await enqueueFormationGeneration({ formationId: f.id });
  }

  await logQualiopiActivity({
    action: "qualiopi.formation.generation.batch",
    targetType: "Formation",
    targetId: null,
    changes: { enfilees: formations.length, limite },
    session,
  });

  return { data: { enfilees: formations.length, formationIds: formations.map((f) => f.id) } };
}

// ── Action : approveFileValidationAction ──────────────────────────────────────

/**
 * Approuve une FileValidation.
 *
 * - Met le statut à `approuve` + valideAt/Par.
 * - Si étape = `contenu` → fait avancer statutGeneration vers `contenu_valide`.
 * - Re-enfile un job formation-engine pour continuer le pipeline.
 */
export async function approveFileValidationAction(
  input: z.infer<typeof approveFileValidationSchema>,
): Promise<ActionResult<{ fileValidationId: string; statutGeneration: string }>> {
  const session = await requireAdminWrite();
  const parsed = approveFileValidationSchema.safeParse(input);
  if (!parsed.success) return { error: "Paramètres invalides." };

  const { id } = parsed.data;

  let fv: {
    id: string;
    statut: string;
    etape: string;
    formationId: string;
    formation: { statutGeneration: FormationStatutGeneration };
  } | null;

  try {
    fv = await prisma.fileValidation.findUnique({
      where: { id },
      select: {
        id: true,
        statut: true,
        etape: true,
        formationId: true,
        formation: { select: { statutGeneration: true } },
      },
    });
  } catch {
    return { error: "Erreur lors de la récupération de la validation." };
  }

  if (!fv) return { error: "Validation introuvable." };
  if (fv.statut !== "en_attente") {
    return { error: `Cette validation a déjà été traitée (statut : ${fv.statut}).` };
  }

  const newStatutGeneration = resolveNextStatutAfterApproval(
    fv.etape,
    fv.formation.statutGeneration,
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.fileValidation.update({
        where: { id },
        data: {
          statut: "approuve",
          valideAt: new Date(),
          validePar: session.userId,
        },
      });

      if (newStatutGeneration !== null) {
        await tx.formation.update({
          where: { id: fv.formationId },
          data: { statutGeneration: newStatutGeneration },
        });
      }
    });
  } catch {
    return { error: "Erreur lors de la mise à jour de la validation." };
  }

  // Re-enfile le pipeline pour continuer
  await enqueueFormationGeneration({ formationId: fv.formationId });

  const statutFinal = newStatutGeneration ?? fv.formation.statutGeneration;

  await logQualiopiActivity({
    action: "qualiopi.filevalidation.approve",
    targetType: "FileValidation",
    targetId: id,
    changes: {
      etape: fv.etape,
      newStatutGeneration: statutFinal,
    },
    session,
  });

  return { data: { fileValidationId: id, statutGeneration: statutFinal } };
}

// ── Action : rejectFileValidationAction ───────────────────────────────────────

/**
 * Rejette une FileValidation.
 *
 * - Met le statut à `rejete` + consigne de correction.
 * - Remet statutGeneration à l'état antérieur tracé (selon l'étape rejetée).
 * - Pas de re-enqueue automatique (correction manuelle puis relance).
 */
export async function rejectFileValidationAction(
  input: z.infer<typeof rejectFileValidationSchema>,
): Promise<ActionResult<{ fileValidationId: string; statutGeneration: string }>> {
  const session = await requireAdminWrite();
  const parsed = rejectFileValidationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Paramètres invalides." };

  const { id, consigne } = parsed.data;

  let fv: {
    id: string;
    statut: string;
    etape: string;
    formationId: string;
    formation: { statutGeneration: FormationStatutGeneration };
  } | null;

  try {
    fv = await prisma.fileValidation.findUnique({
      where: { id },
      select: {
        id: true,
        statut: true,
        etape: true,
        formationId: true,
        formation: { select: { statutGeneration: true } },
      },
    });
  } catch {
    return { error: "Erreur lors de la récupération de la validation." };
  }

  if (!fv) return { error: "Validation introuvable." };
  if (fv.statut !== "en_attente") {
    return { error: `Cette validation a déjà été traitée (statut : ${fv.statut}).` };
  }

  // Statut antérieur : en cas de rejet on revient à structure_generee (contenu)
  // ou à contenu_genere (assemblage) pour permettre une correction manuelle.
  const revertStatut = resolveRevertStatutAfterRejection(fv.etape);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.fileValidation.update({
        where: { id },
        data: {
          statut: "rejete",
          consigne,
        },
      });

      await tx.formation.update({
        where: { id: fv.formationId },
        data: { statutGeneration: revertStatut },
      });
    });
  } catch {
    return { error: "Erreur lors du rejet de la validation." };
  }

  await logQualiopiActivity({
    action: "qualiopi.filevalidation.reject",
    targetType: "FileValidation",
    targetId: id,
    changes: {
      etape: fv.etape,
      consigne: consigne.slice(0, 200),
      revertStatut,
    },
    session,
  });

  return { data: { fileValidationId: id, statutGeneration: revertStatut } };
}

// ── Action : getGenerationStatusAction ────────────────────────────────────────

export interface GenerationStatus {
  formationId: string;
  statutGeneration: string;
  titre: string;
  dernierJobs: Array<{
    id: string;
    etape: string;
    status: string;
    modele: string | null;
    coutUsd: string;
    tokensIn: number;
    tokensOut: number;
    cacheHit: boolean;
    dureeMs: number | null;
    createdAt: Date;
  }>;
  coutCumuleUsd: number;
  validationsEnAttente: Array<{
    id: string;
    etape: string;
    createdAt: Date;
  }>;
}

/**
 * Lit le statut de génération + les derniers jobs + le coût cumulé.
 * Lecture seule (requireAdminRead).
 */
export async function getGenerationStatusAction(
  input: z.infer<typeof getGenerationStatusSchema>,
): Promise<ActionResult<GenerationStatus>> {
  await requireAdminRead();
  const parsed = getGenerationStatusSchema.safeParse(input);
  if (!parsed.success) return { error: "Paramètres invalides." };

  const { formationId } = parsed.data;

  try {
    const formation = await prisma.formation.findUnique({
      where: { id: formationId },
      select: { id: true, titre: true, statutGeneration: true },
    });

    if (!formation) return { error: "Formation introuvable." };

    const jobs = await prisma.formationGenerationJob.findMany({
      where: { formationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const coutCumuleRaw = await prisma.formationGenerationJob.aggregate({
      where: { formationId },
      _sum: { coutUsd: true },
    });

    const validationsEnAttente = await prisma.fileValidation.findMany({
      where: { formationId, statut: "en_attente" },
      select: { id: true, etape: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const coutCumuleUsd = Number(coutCumuleRaw._sum.coutUsd ?? 0);

    return {
      data: {
        formationId: formation.id,
        statutGeneration: formation.statutGeneration,
        titre: formation.titre,
        dernierJobs: jobs.map((j) => ({
          id: j.id,
          etape: j.etape,
          status: j.status,
          modele: j.modele,
          coutUsd: j.coutUsd.toString(),
          tokensIn: j.tokensIn,
          tokensOut: j.tokensOut,
          cacheHit: j.cacheHit,
          dureeMs: j.dureeMs,
          createdAt: j.createdAt,
        })),
        coutCumuleUsd,
        validationsEnAttente: validationsEnAttente.map((v) => ({
          id: v.id,
          etape: v.etape,
          createdAt: v.createdAt,
        })),
      },
    };
  } catch {
    return { error: "Erreur lors de la lecture du statut." };
  }
}

// Helpers purs (logique de machine d'états) déplacés dans
// `@/server/qualiopi/engine/status-transitions` : un module "use server" importé
// côté client ne peut exporter que des fonctions async (contrainte Next.js).
// engine.ts les consomme en interne via l'import en tête de fichier.
