/**
 * Qualiopi — Server Actions Supports de formation (T13 AGENT B).
 *
 * genererSupportAction    : génère (ou regénère) un SupportFormation pour une
 *                           formation donnée, par type. Enrichissement IA optionnel.
 * regenererSupportAction  : regénère un support existant (incrémente la version).
 * supprimerSupportAction  : supprime un SupportFormation par id.
 *
 * Pattern : requireAdminWrite + Zod + ActionResult + logQualiopiActivity.
 * Voir enrollments.ts comme référence de structure.
 */

"use server";

import { z } from "zod";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  genererSupport,
  genererTousSupports,
  regenererSupport,
  supprimerSupport,
  type GenererTousSupportsResult,
} from "@/server/qualiopi/supports/supports-service";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORT_TYPES = [
  "slides_formateur",
  "slides_stagiaire",
  "livret_stagiaire",
  "memo",
  "guide_animation",
  "exercices",
  "grille_eval",
] as const;

const genererSupportSchema = z.object({
  formationId: z.string().uuid(),
  type: z.enum(SUPPORT_TYPES),
  enrichirIA: z.boolean().optional(),
});

const regenererSupportSchema = z.object({
  id: z.string().uuid(),
});

const supprimerSupportSchema = z.object({
  id: z.string().uuid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un SupportFormation pour une formation, par type.
 *
 * Crée ou met à jour (version incrémentée) le support du même type pour cette
 * formation. Si `enrichirIA` est true et que le contexte n'est pas stub,
 * enrichit le contenu via le provider Anthropic.
 */
export async function genererSupportAction(input: {
  formationId: string;
  type: (typeof SUPPORT_TYPES)[number];
  enrichirIA?: boolean;
}): Promise<ActionResult<{ id: string; pdfUrl: string | null }>> {
  const session = await requireAdminWrite();

  const parsed = genererSupportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Données invalides" };
  }

  let result: { id: string; pdfUrl: string | null };
  try {
    result = await genererSupport({
      formationId: parsed.data.formationId,
      type: parsed.data.type,
      ...(parsed.data.enrichirIA !== undefined ? { enrichirIA: parsed.data.enrichirIA } : {}),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de la génération" };
  }

  await logQualiopiActivity({
    action: "qualiopi.support.generer",
    targetType: "SupportFormation",
    targetId: result.id,
    changes: { formationId: parsed.data.formationId, type: parsed.data.type },
    session,
  });

  return { data: result };
}

/**
 * Génère (ou régénère) EN LOT les 7 supports d'une formation en un clic.
 */
export async function genererTousSupportsAction(input: {
  formationId: string;
  enrichirIA?: boolean;
}): Promise<ActionResult<GenererTousSupportsResult>> {
  const session = await requireAdminWrite();

  const parsed = z
    .object({ formationId: z.string().uuid(), enrichirIA: z.boolean().optional() })
    .safeParse(input);
  if (!parsed.success) {
    return { error: "Données invalides" };
  }

  let result: GenererTousSupportsResult;
  try {
    result = await genererTousSupports({
      formationId: parsed.data.formationId,
      ...(parsed.data.enrichirIA !== undefined ? { enrichirIA: parsed.data.enrichirIA } : {}),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de la génération en lot" };
  }

  await logQualiopiActivity({
    action: "qualiopi.support.generer_tous",
    targetType: "Formation",
    targetId: parsed.data.formationId,
    changes: { ok: result.ok.length, echecs: result.echecs.length },
    session,
  });

  return { data: result };
}

/**
 * Regénère un support existant (relit formationId + type, incrémente la version).
 */
export async function regenererSupportAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string; pdfUrl: string | null }>> {
  const session = await requireAdminWrite();

  const parsed = regenererSupportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Données invalides" };
  }

  let result: { id: string; pdfUrl: string | null };
  try {
    result = await regenererSupport({ id: parsed.data.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de la régénération" };
  }

  await logQualiopiActivity({
    action: "qualiopi.support.regenerer",
    targetType: "SupportFormation",
    targetId: parsed.data.id,
    changes: { newId: result.id },
    session,
  });

  return { data: result };
}

/**
 * Supprime un support de formation par id.
 */
export async function supprimerSupportAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();

  const parsed = supprimerSupportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Données invalides" };
  }

  try {
    await supprimerSupport(parsed.data.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de la suppression" };
  }

  await logQualiopiActivity({
    action: "qualiopi.support.supprimer",
    targetType: "SupportFormation",
    targetId: parsed.data.id,
    changes: {},
    session,
  });

  return { data: { id: parsed.data.id } };
}
