/**
 * Qualiopi — Server Actions référentiel OPCO versionné (Lot 5).
 *
 * creerVersionBaremeOpcoAction : crée une nouvelle version de barème (clôt la
 *   précédente). Montants attendus en CENTIMES (le formulaire convertit €→cents).
 * supprimerBaremeOpcoAction    : retire une ligne saisie par erreur.
 *
 * Les VALEURS sont saisies par un humain (relevés portails OPCO) — jamais
 * inventées côté code.
 */

"use server";

import { z } from "zod";
import {
  requireAdminWrite,
  requireAdminDelete,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  creerVersionBaremeOpco,
  supprimerBaremeOpco,
} from "@/server/qualiopi/financements/bareme-opco-service";
import { OPCO_IDS } from "@/server/qualiopi/financements/opco-referentiel";
import type { Opco } from "../../../../prisma/generated/client";

type ActionResult<T> = { data: T } | { error: string };

// Plafond en centimes : entier ≥ 0, borné à 100 000 € (10 000 000 cents) pour
// couper les saisies aberrantes. `null` = plafond non relevé (structure vide).
const centsOptional = z.number().int().min(0).max(10_000_000).nullable().optional();

const creerVersionSchema = z.object({
  opco: z.enum(OPCO_IDS),
  dateEffet: z.coerce.date(),
  perimetre: z.string().max(200).nullable().optional(),
  intraHoraireCents: centsOptional,
  interPresentielCents: centsOptional,
  interDistancielCents: centsOptional,
  plafondFormationCents: centsOptional,
  plafondAnnuelCents: centsOptional,
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  releveLe: z.coerce.date().nullable().optional(),
  note: z.string().max(5000).nullable().optional(),
});

const supprimerSchema = z.object({ id: z.string().uuid() });

/** Crée une nouvelle version de barème OPCO (clôt la version en vigueur précédente). */
export async function creerVersionBaremeOpcoAction(input: {
  opco: string;
  dateEffet: Date | string;
  perimetre?: string | null;
  intraHoraireCents?: number | null;
  interPresentielCents?: number | null;
  interDistancielCents?: number | null;
  plafondFormationCents?: number | null;
  plafondAnnuelCents?: number | null;
  sourceUrl?: string | null;
  releveLe?: Date | string | null;
  note?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerVersionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let created: { id: string };
  try {
    created = await creerVersionBaremeOpco({
      opco: v.opco as Opco,
      dateEffet: v.dateEffet,
      perimetre: v.perimetre ?? null,
      intraHoraireCents: v.intraHoraireCents ?? null,
      interPresentielCents: v.interPresentielCents ?? null,
      interDistancielCents: v.interDistancielCents ?? null,
      plafondFormationCents: v.plafondFormationCents ?? null,
      plafondAnnuelCents: v.plafondAnnuelCents ?? null,
      sourceUrl: v.sourceUrl ?? null,
      releveLe: v.releveLe ?? null,
      note: v.note ?? null,
      createdById: session.userId,
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement du barème" };
  }

  await logQualiopiActivity({
    action: "qualiopi.bareme_opco.create_version",
    targetType: "BaremeOpco",
    targetId: created.id,
    changes: { opco: v.opco, dateEffet: v.dateEffet.toISOString() },
    session,
  });

  return { data: { id: created.id } };
}

/** Supprime une ligne de barème (saisie erronée). */
export async function supprimerBaremeOpcoAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminDelete();
  const parsed = supprimerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  try {
    await supprimerBaremeOpco(id);
  } catch {
    return { error: "Barème introuvable ou erreur de suppression" };
  }

  await logQualiopiActivity({
    action: "qualiopi.bareme_opco.delete",
    targetType: "BaremeOpco",
    targetId: id,
    changes: {},
    session,
  });

  return { data: { id } };
}
