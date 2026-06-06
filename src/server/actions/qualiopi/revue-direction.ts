/**
 * Qualiopi — Server Actions Revue de direction (T12).
 *
 * creerRevueDirectionAction  : crée la revue annuelle avec snapshot indicateurs.
 * updateRevueDirectionAction : met à jour une revue existante.
 *
 * off.32 — indicateur 32 (NC majeure). Snapshot indicateurs capturé à la création.
 */

"use server";

import { z } from "zod";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { creerRevue, updateRevue } from "@/server/qualiopi/registres/revue-direction-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const creerRevueDirectionSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
  dateRevue: z.coerce.date(),
  participants: z.array(z.unknown()).optional(),
  decisions: z.array(z.unknown()).optional(),
  planActions: z.array(z.unknown()).optional(),
  statut: z.string().max(20).optional(),
});

const updateRevueDirectionSchema = z.object({
  id: z.string().uuid(),
  dateRevue: z.coerce.date().optional(),
  participants: z.array(z.unknown()).optional(),
  decisions: z.array(z.unknown()).optional(),
  planActions: z.array(z.unknown()).optional(),
  statut: z.string().max(20).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée la revue de direction d'une année.
 * Génère automatiquement un snapshot des indicateurs via le service.
 * Lève si une revue existe déjà pour l'année (contrainte @unique sur `annee`).
 */
export async function creerRevueDirectionAction(input: {
  annee: number;
  dateRevue: Date;
  participants?: unknown[];
  decisions?: unknown[];
  planActions?: unknown[];
  statut?: string;
}): Promise<ActionResult<{ id: string; annee: number }>> {
  const session = await requireAdminWrite();
  const parsed = creerRevueDirectionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let revue: { id: string; annee: number };
  try {
    revue = await creerRevue(v.annee, {
      dateRevue: v.dateRevue,
      ...(v.participants !== undefined ? { participants: v.participants } : {}),
      ...(v.decisions !== undefined ? { decisions: v.decisions } : {}),
      ...(v.planActions !== undefined ? { planActions: v.planActions } : {}),
      ...(v.statut !== undefined ? { statut: v.statut } : {}),
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return { error: `Une revue de direction existe déjà pour ${v.annee}` };
    return { error: "Erreur lors de la création de la revue de direction" };
  }

  await logQualiopiActivity({
    action: "qualiopi.revue_direction.create",
    targetType: "RevueDirection",
    targetId: revue.id,
    changes: { annee: v.annee, dateRevue: v.dateRevue, statut: v.statut },
    session,
  });

  return { data: { id: revue.id, annee: revue.annee } };
}

/**
 * Met à jour une revue de direction existante (participants, décisions, plan, statut).
 */
export async function updateRevueDirectionAction(input: {
  id: string;
  dateRevue?: Date;
  participants?: unknown[];
  decisions?: unknown[];
  planActions?: unknown[];
  statut?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateRevueDirectionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  await updateRevue(id, {
    ...(fields.dateRevue !== undefined ? { dateRevue: fields.dateRevue } : {}),
    ...(fields.participants !== undefined ? { participants: fields.participants } : {}),
    ...(fields.decisions !== undefined ? { decisions: fields.decisions } : {}),
    ...(fields.planActions !== undefined ? { planActions: fields.planActions } : {}),
    ...(fields.statut !== undefined ? { statut: fields.statut } : {}),
  });

  await logQualiopiActivity({
    action: "qualiopi.revue_direction.update",
    targetType: "RevueDirection",
    targetId: id,
    changes: { statut: fields.statut },
    session,
  });

  return { data: { id } };
}
