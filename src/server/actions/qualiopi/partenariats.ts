/**
 * Qualiopi — Server Actions Partenariats (T12).
 *
 * creerPartenariatAction  : enregistre un nouveau partenariat.
 * updatePartenariatAction : met à jour un partenariat existant.
 *
 * Réseau off.25 : partenaires, dont réseau handicap.
 * Délègue au service registre (Agent A).
 */

"use server";

import { z } from "zod";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerPartenariat,
  updatePartenariat,
  getPartenariat,
} from "@/server/qualiopi/registres/partenariats-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const creerPartenariatSchema = z.object({
  nom: z.string().min(1).max(250),
  type: z.string().min(1).max(100),
  objet: z.string().min(1),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date().optional(),
  actif: z.boolean().default(true),
});

const updatePartenariatSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).max(250).optional(),
  type: z.string().min(1).max(100).optional(),
  objet: z.string().min(1).optional(),
  dateDebut: z.coerce.date().optional(),
  dateFin: z.coerce.date().optional(),
  actif: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre un nouveau partenariat dans le registre.
 */
export async function creerPartenariatAction(input: {
  nom: string;
  type: string;
  objet: string;
  dateDebut: Date;
  dateFin?: Date;
  actif?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerPartenariatSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let partenariat: { id: string };
  try {
    partenariat = await creerPartenariat({
      nom: v.nom,
      type: v.type,
      objet: v.objet,
      dateDebut: v.dateDebut,
      ...(v.dateFin !== undefined ? { dateFin: v.dateFin } : {}),
      actif: v.actif,
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement du partenariat" };
  }

  await logQualiopiActivity({
    action: "qualiopi.partenariat.create",
    targetType: "Partenariat",
    targetId: partenariat.id,
    changes: { nom: v.nom, type: v.type },
    session,
  });

  return { data: { id: partenariat.id } };
}

/**
 * Met à jour un partenariat existant.
 */
export async function updatePartenariatAction(input: {
  id: string;
  nom?: string;
  type?: string;
  objet?: string;
  dateDebut?: Date;
  dateFin?: Date;
  actif?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updatePartenariatSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  const existe = await getPartenariat(id);
  if (existe === null) return { error: "Partenariat introuvable" };

  try {
    await updatePartenariat(id, {
      ...(fields.nom !== undefined ? { nom: fields.nom } : {}),
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.objet !== undefined ? { objet: fields.objet } : {}),
      ...(fields.dateDebut !== undefined ? { dateDebut: fields.dateDebut } : {}),
      ...(fields.dateFin !== undefined ? { dateFin: fields.dateFin } : {}),
      ...(fields.actif !== undefined ? { actif: fields.actif } : {}),
    });
  } catch {
    return { error: "Partenariat introuvable ou erreur de mise à jour" };
  }

  await logQualiopiActivity({
    action: "qualiopi.partenariat.update",
    targetType: "Partenariat",
    targetId: id,
    changes: fields,
    session,
  });

  return { data: { id } };
}
