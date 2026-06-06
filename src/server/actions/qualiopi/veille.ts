/**
 * Qualiopi — Server Actions Veille (T12).
 *
 * creerVeilleAction     : enregistre une entrée de veille (off.23/24/25).
 * updateVeilleAction    : met à jour une entrée existante.
 * supprimerVeilleAction : supprime une entrée.
 *
 * Délègue au service registre (Agent A).
 */

"use server";

import { z } from "zod";
import {
  requireAdminWrite,
  requireAdminDelete,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  creerVeille,
  updateVeille,
  supprimerVeille,
  getVeille,
} from "@/server/qualiopi/registres/veille-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const TYPES_VEILLE = ["legale", "metiers", "pedagogique", "handicap"] as const;

const creerVeilleSchema = z.object({
  type: z.enum(TYPES_VEILLE),
  source: z.string().min(1).max(300),
  titre: z.string().min(1).max(300),
  contenu: z.string().min(1),
  dateVeille: z.coerce.date(),
  impact: z.string().optional(),
  actionDecidee: z.string().optional(),
});

const updateVeilleSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(TYPES_VEILLE).optional(),
  source: z.string().min(1).max(300).optional(),
  titre: z.string().min(1).max(300).optional(),
  contenu: z.string().min(1).optional(),
  dateVeille: z.coerce.date().optional(),
  impact: z.string().optional(),
  actionDecidee: z.string().optional(),
});

const supprimerVeilleSchema = z.object({
  id: z.string().uuid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre une nouvelle entrée de veille dans le registre.
 */
export async function creerVeilleAction(input: {
  type: (typeof TYPES_VEILLE)[number];
  source: string;
  titre: string;
  contenu: string;
  dateVeille: Date;
  impact?: string;
  actionDecidee?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerVeilleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let veille: { id: string };
  try {
    veille = await creerVeille({
      type: v.type,
      source: v.source,
      titre: v.titre,
      contenu: v.contenu,
      dateVeille: v.dateVeille,
      ...(v.impact !== undefined ? { impact: v.impact } : {}),
      ...(v.actionDecidee !== undefined ? { actionDecidee: v.actionDecidee } : {}),
      creeParId: session.userId,
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement de la veille" };
  }

  await logQualiopiActivity({
    action: "qualiopi.veille.create",
    targetType: "Veille",
    targetId: veille.id,
    changes: { type: v.type, titre: v.titre, dateVeille: v.dateVeille },
    session,
  });

  return { data: { id: veille.id } };
}

/**
 * Met à jour une entrée de veille existante.
 */
export async function updateVeilleAction(input: {
  id: string;
  type?: (typeof TYPES_VEILLE)[number];
  source?: string;
  titre?: string;
  contenu?: string;
  dateVeille?: Date;
  impact?: string;
  actionDecidee?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateVeilleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  const existe = await getVeille(id);
  if (existe === null) return { error: "Entrée de veille introuvable" };

  try {
    await updateVeille(id, {
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.source !== undefined ? { source: fields.source } : {}),
      ...(fields.titre !== undefined ? { titre: fields.titre } : {}),
      ...(fields.contenu !== undefined ? { contenu: fields.contenu } : {}),
      ...(fields.dateVeille !== undefined ? { dateVeille: fields.dateVeille } : {}),
      ...(fields.impact !== undefined ? { impact: fields.impact } : {}),
      ...(fields.actionDecidee !== undefined ? { actionDecidee: fields.actionDecidee } : {}),
    });
  } catch {
    return { error: "Entrée de veille introuvable ou erreur de mise à jour" };
  }

  await logQualiopiActivity({
    action: "qualiopi.veille.update",
    targetType: "Veille",
    targetId: id,
    changes: fields,
    session,
  });

  return { data: { id } };
}

/**
 * Supprime définitivement une entrée de veille.
 */
export async function supprimerVeilleAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminDelete();
  const parsed = supprimerVeilleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  const existe = await getVeille(id);
  if (existe === null) return { error: "Entrée de veille introuvable" };

  try {
    await supprimerVeille(id);
  } catch {
    return { error: "Entrée de veille introuvable ou erreur de suppression" };
  }

  await logQualiopiActivity({
    action: "qualiopi.veille.delete",
    targetType: "Veille",
    targetId: id,
    changes: null,
    session,
  });

  return { data: { id } };
}
