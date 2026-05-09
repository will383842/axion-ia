// Server Actions admin /parametres (M9 Tier 3 section 2).
//
// Settings : table key-value JSON (Setting model). V1 minimal : edit JSON
// brut par key. M9 v2 livrera UI custom par categorie (pricing builder,
// CTA editor, ROI simulator tuning, mode maintenance toggle).
//
// Doctrine §14 : prix dynamiques (3 modules), simulateur ROI tuning, CTA
// central texte/prix, mode maintenance.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";

async function requireAdminWrite() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") throw new Error("forbidden");
  return { userId: session.user.id, role };
}
async function requireAdminRead() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

// ============================================================
// list / detail
// ============================================================

export async function listSettingsAction() {
  await requireAdminRead();
  return prisma.setting.findMany({
    orderBy: { key: "asc" },
  });
}

export async function getSettingAction(key: string) {
  await requireAdminRead();
  return prisma.setting.findUnique({ where: { key } });
}

// ============================================================
// upsert
// ============================================================

const upsertSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9._-]+$/i, "Caractères autorisés : a-z, 0-9, ., _, -"),
  valueJson: z.string().min(1, "Valeur JSON requise."),
  description: z.string().max(500).optional(),
});
export type UpsertSettingState = { ok: true } | { ok: false; error: string };

export async function upsertSettingAction(
  _prev: UpsertSettingState,
  formData: FormData,
): Promise<UpsertSettingState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = upsertSchema.safeParse({
    key: formData.get("key"),
    valueJson: formData.get("valueJson"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  let value: unknown;
  try {
    value = JSON.parse(parsed.data.valueJson);
  } catch {
    return { ok: false, error: "JSON invalide. Vérifiez la syntaxe." };
  }

  // Sprint 15 fix Fork 1 W6-1 : tx atomique upsert + activityLog (avant : 2
  // statements separes → crash entre = setting modifie sans audit trail).
  // Sprint 15 fix Fork 2 W2-2 : targetId = key pour requetes audit ciblees.
  const ip = await getClientIp();
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: parsed.data.key },
      create: {
        key: parsed.data.key,
        value: value as never,
        description: parsed.data.description ?? null,
        updatedBy: session.userId,
      },
      update: {
        value: value as never,
        description: parsed.data.description ?? null,
        updatedBy: session.userId,
      },
    }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "setting.updated",
        targetType: "setting",
        changes: { key: parsed.data.key },
        ipAddress: ip,
      },
    }),
  ]);

  // Revalidate les pages publiques qui pourraient depend du setting
  revalidatePath(adminPath("fr", "settings"));
  revalidatePath("/fr");
  revalidatePath("/en");
  return { ok: true };
}

// ============================================================
// delete (super_admin only)
// ============================================================

export type DeleteSettingState = { ok: true } | { ok: false; error: string };

export async function deleteSettingAction(
  _prev: DeleteSettingState,
  formData: FormData,
): Promise<DeleteSettingState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin") {
    return { ok: false, error: "Suppression réservée au super-admin." };
  }
  const key = formData.get("key");
  if (typeof key !== "string" || key.length < 2) {
    return { ok: false, error: "Clé invalide." };
  }
  await prisma.$transaction([
    prisma.setting.delete({ where: { key } }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "setting.deleted",
        targetType: "setting",
        changes: { key },
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "settings"));
  return { ok: true };
}
