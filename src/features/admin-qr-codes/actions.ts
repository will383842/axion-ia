// Server Actions admin /qr-codes — QR codes dynamiques (liens pilotables).
// Calqué sur src/features/admin-job-offers/actions.ts (auth inline, Zod,
// requireAdminWrite, revalidatePath). Aucune indexation (routes /qr = noindex
// implicite, redirections). Décision Will 2026-07-18.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { QR_CATEGORY_VALUES } from "./categories";

async function requireAdminWrite() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}

const LIST_PATH = adminPath("fr", "qr-codes");

const upsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug : minuscules, chiffres et tirets uniquement."),
  destinationUrl: z.string().trim().url("URL de destination invalide.").max(2000),
  label: z.string().trim().min(2).max(200),
  category: z.enum(QR_CATEGORY_VALUES).default("general"),
  active: z.coerce.boolean().default(true),
});

/** Crée un QR dynamique puis redirige vers la liste. */
export async function createQrLinkAction(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const input = upsertSchema.parse({
    slug: formData.get("slug"),
    destinationUrl: formData.get("destinationUrl"),
    label: formData.get("label"),
    category: formData.get("category"),
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });

  const exists = await prisma.qrLink.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (exists) throw new Error(`Le slug « ${input.slug} » est déjà utilisé.`);

  await prisma.qrLink.create({ data: input });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

/** Met à jour un QR (slug/destination/label/actif) puis redirige vers la liste. */
export async function updateQrLinkAction(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const id = z.string().uuid().parse(formData.get("id"));
  const input = upsertSchema.parse({
    slug: formData.get("slug"),
    destinationUrl: formData.get("destinationUrl"),
    label: formData.get("label"),
    category: formData.get("category"),
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });

  const clash = await prisma.qrLink.findFirst({
    where: { slug: input.slug, NOT: { id } },
    select: { id: true },
  });
  if (clash) throw new Error(`Le slug « ${input.slug} » est déjà utilisé par un autre QR.`);

  await prisma.qrLink.update({ where: { id }, data: input });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

/** Active/désactive un QR (une redirection désactivée renvoie 404). */
export async function toggleQrLinkAction(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const id = z.string().uuid().parse(formData.get("id"));
  const current = await prisma.qrLink.findUnique({ where: { id }, select: { active: true } });
  if (!current) throw new Error("QR introuvable.");
  await prisma.qrLink.update({ where: { id }, data: { active: !current.active } });
  revalidatePath(LIST_PATH);
}

/** Supprime définitivement un QR (le QR imprimé renverra alors 404). */
export async function deleteQrLinkAction(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const id = z.string().uuid().parse(formData.get("id"));
  await prisma.qrLink.delete({ where: { id } });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
