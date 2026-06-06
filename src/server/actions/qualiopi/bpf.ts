/**
 * Qualiopi — Server Actions BPF Dépenses (T17 · CLUSTER 5).
 *
 * ajouterBpfDepenseAction   : ajoute une dépense BPF (admin).
 * supprimerBpfDepenseAction : supprime une dépense BPF (admin).
 */

"use server";

import { z } from "zod";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { ajouterDepense, supprimerDepense } from "@/server/qualiopi/bpf/service";
import type { BpfDepenseItem } from "@/server/qualiopi/bpf/service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const ajouterBpfDepenseSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
  categorie: z.string().min(1).max(80),
  libelle: z.string().min(1).max(250),
  montantHtCents: z.number().int().positive(),
});

const supprimerBpfDepenseSchema = z.object({
  id: z.string().uuid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ajoute une dépense au Bilan Pédagogique et Financier.
 */
export async function ajouterBpfDepenseAction(input: {
  annee: number;
  categorie: string;
  libelle: string;
  montantHtCents: number;
}): Promise<ActionResult<BpfDepenseItem>> {
  const session = await requireAdminWrite();
  const parsed = ajouterBpfDepenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let depense: BpfDepenseItem;
  try {
    depense = await ajouterDepense(v);
  } catch {
    return { error: "Erreur lors de la création de la dépense" };
  }

  await logQualiopiActivity({
    action: "qualiopi.bpf.depense.create",
    targetType: "BpfDepense",
    targetId: depense.id,
    changes: {
      annee: v.annee,
      categorie: v.categorie,
      libelle: v.libelle,
      montantHtCents: v.montantHtCents,
    },
    session,
  });

  return { data: depense };
}

/**
 * Supprime une dépense BPF par identifiant.
 */
export async function supprimerBpfDepenseAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = supprimerBpfDepenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  try {
    await supprimerDepense(id);
  } catch {
    return { error: "Erreur lors de la suppression de la dépense" };
  }

  await logQualiopiActivity({
    action: "qualiopi.bpf.depense.delete",
    targetType: "BpfDepense",
    targetId: id,
    changes: { id },
    session,
  });

  return { data: { id } };
}
