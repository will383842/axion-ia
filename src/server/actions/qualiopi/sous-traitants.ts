/**
 * Qualiopi — Server Actions Sous-traitants OF (T12).
 *
 * creerSousTraitantAction      : enregistre un sous-traitant de l'OF.
 * verifierSousTraitantOfAction : marque la vérification data.gouv.fr.
 *
 * off.27 : sous-traitants prestataires ≠ formateurs individuels.
 * Délègue au service registre (Agent A).
 */

"use server";

import { z } from "zod";
import { siretField } from "@/lib/siret-schema";
import { premierMessageZod } from "@/lib/zod-message";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerSousTraitant,
  verifierDataGouv,
  getSousTraitant,
} from "@/server/qualiopi/registres/sous-traitants-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const creerSousTraitantSchema = z.object({
  nom: z.string().min(1).max(250),
  // Un sous-traitant de l'OF est un organisme français (indicateur 27) : même
  // règle que pour un client. `max(20)` laissait passer n'importe quoi ; la
  // valeur normalisée fait 14 caractères et tient dans la colonne VarChar(20).
  siret: siretField.optional(),
  nda: z.string().max(20).optional(),
  objetPrestation: z.string().min(1),
  contratSigneAt: z.coerce.date().optional(),
  actif: z.boolean().default(true),
});

const verifierSousTraitantOfSchema = z.object({
  id: z.string().uuid(),
  verifieDataGouvAt: z.coerce.date().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre un nouveau sous-traitant dans le registre.
 */
export async function creerSousTraitantAction(input: {
  nom: string;
  siret?: string;
  nda?: string;
  objetPrestation: string;
  contratSigneAt?: Date;
  actif?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerSousTraitantSchema.safeParse(input);
  if (!parsed.success) return { error: premierMessageZod(parsed.error) };
  const v = parsed.data;

  let sousTraitant: { id: string };
  try {
    sousTraitant = await creerSousTraitant({
      nom: v.nom,
      objetPrestation: v.objetPrestation,
      actif: v.actif,
      ...(v.siret !== undefined ? { siret: v.siret } : {}),
      ...(v.nda !== undefined ? { nda: v.nda } : {}),
      ...(v.contratSigneAt !== undefined ? { contratSigneAt: v.contratSigneAt } : {}),
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement du sous-traitant" };
  }

  await logQualiopiActivity({
    action: "qualiopi.sous_traitant.create",
    targetType: "SousTraitant",
    targetId: sousTraitant.id,
    changes: { nom: v.nom, siret: v.siret, nda: v.nda },
    session,
  });

  return { data: { id: sousTraitant.id } };
}

/**
 * Marque la vérification data.gouv.fr d'un sous-traitant (NDA actif confirmé).
 */
export async function verifierSousTraitantOfAction(input: {
  id: string;
  verifieDataGouvAt?: Date;
}): Promise<ActionResult<{ id: string; verifieDataGouvAt: Date }>> {
  const session = await requireAdminWrite();
  const parsed = verifierSousTraitantOfSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, verifieDataGouvAt } = parsed.data;

  const existe = await getSousTraitant(id);
  if (existe === null) return { error: "Sous-traitant introuvable" };

  let updated: { id: string; verifieDataGouvAt: Date | null };
  try {
    updated = await verifierDataGouv(id, verifieDataGouvAt);
  } catch {
    return { error: "Sous-traitant introuvable ou erreur de mise à jour" };
  }

  const dateVerif = updated.verifieDataGouvAt ?? verifieDataGouvAt ?? new Date();

  await logQualiopiActivity({
    action: "qualiopi.sous_traitant.verifie_data_gouv",
    targetType: "SousTraitant",
    targetId: id,
    changes: { verifieDataGouvAt: dateVerif },
    session,
  });

  return { data: { id, verifieDataGouvAt: dateVerif } };
}
