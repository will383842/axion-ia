// Documents interventions — Server Actions : gestion des listes de
// destinataires e-mail (formateurs / commerciaux). Aucun compte requis.
// RBAC write = editor+.

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdminWrite } from "./_guards";

const FAMILLES = ["formation", "un_a_un", "audit"] as const;
const ROLES = ["formateur", "commercial"] as const;

const createSchema = z.object({
  email: z.string().email().max(200),
  nom: z.string().max(200).optional(),
  role: z.enum(ROLES),
  famille: z.enum(FAMILLES).nullable().optional(),
  interventionSlug: z.string().max(80).nullable().optional(),
});

export async function createRecipientAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminWrite();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides (e-mail / rôle)." };
  const { email, nom, role, famille, interventionSlug } = parsed.data;
  await prisma.documentRecipient.create({
    data: {
      email,
      nom: nom?.trim() || null,
      role,
      famille: famille ?? null,
      interventionSlug: interventionSlug?.trim() || null,
    },
  });
  await logActivity({
    action: "documents-interventions.recipient.create",
    targetType: "DocumentRecipient",
    changes: { email, role, famille: famille ?? null },
    session,
  });
  return { ok: true };
}

const toggleSchema = z.object({ id: z.string().uuid(), actif: z.boolean() });

export async function toggleRecipientAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminWrite();
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  await prisma.documentRecipient.update({
    where: { id: parsed.data.id },
    data: { actif: parsed.data.actif },
  });
  return { ok: true };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteRecipientAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminWrite();
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  await prisma.documentRecipient.delete({ where: { id: parsed.data.id } });
  await logActivity({
    action: "documents-interventions.recipient.delete",
    targetType: "DocumentRecipient",
    targetId: parsed.data.id,
    session,
  });
  return { ok: true };
}

/**
 * Importe les formateurs ACTIFS (fiches Qualiopi → Formateurs) dans l'annuaire
 * de notification, en rôle « formateur ». Dédoublonné par `trainerId` : un
 * ré-import n'ajoute que les nouveaux. La base Formateurs reste la source riche ;
 * cet annuaire ne stocke que ce qu'il faut pour notifier (e-mail + nom).
 */
export async function importTrainersAction(): Promise<{
  ok: boolean;
  imported?: number;
  skipped?: number;
  error?: string;
}> {
  const session = await requireAdminWrite();
  const trainers = await prisma.trainer.findMany({
    where: { actif: true },
    select: { id: true, nom: true, prenom: true, email: true },
  });
  let imported = 0;
  let skipped = 0;
  for (const t of trainers) {
    const exists = await prisma.documentRecipient.findFirst({ where: { trainerId: t.id } });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.documentRecipient.create({
      data: {
        email: t.email,
        nom: `${t.prenom} ${t.nom}`.trim(),
        role: "formateur",
        trainerId: t.id,
        actif: true,
      },
    });
    imported++;
  }
  await logActivity({
    action: "documents-interventions.recipient.import-trainers",
    targetType: "DocumentRecipient",
    changes: { imported, skipped },
    session,
  });
  return { ok: true, imported, skipped };
}
