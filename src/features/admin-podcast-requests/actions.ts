// Server Actions admin /podcast — suivi des demandes de tournage podcast.
// Calqué sur src/features/admin-qr-codes/actions.ts (auth inline, Zod,
// requireAdminWrite, revalidatePath, signature `(FormData) => Promise<void>`
// pour un `<form action>` rendu par un server component — zéro JS client).
// Décision Will 2026-07-21.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { getClientIp } from "@/lib/client-ip";
import { PODCAST_REQUEST_STATUS_VALUES, PODCAST_REQUEST_HANDLED_STATUSES } from "./statuses";

async function requireAdminWrite() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}

const LIST_PATH = adminPath("fr", "podcast");

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PODCAST_REQUEST_STATUS_VALUES),
  internalNotes: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(4000).optional(),
  ),
});

/** Met à jour le statut de traitement + les notes internes d'une demande. */
export async function updatePodcastRequestAction(formData: FormData): Promise<void> {
  const session = await requireAdminWrite();
  const input = updateSchema.parse({
    id: formData.get("id"),
    status: formData.get("status"),
    internalNotes: formData.get("internalNotes"),
  });

  const current = await prisma.podcastRequest.findUnique({
    where: { id: input.id },
    select: { handledAt: true },
  });
  if (!current) throw new Error("Demande introuvable.");

  // `handledAt` est posé au premier passage hors « Nouvelle » et n'est jamais
  // réécrit ensuite (c'est la date de PRISE EN CHARGE, pas la dernière modif).
  const becomesHandled = PODCAST_REQUEST_HANDLED_STATUSES.has(input.status);
  const handledAt = current.handledAt ?? (becomesHandled ? new Date() : null);

  await prisma.podcastRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      internalNotes: input.internalNotes ?? null,
      handledAt,
    },
  });

  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "podcastrequest.updated",
      targetType: "podcast_request",
      targetId: input.id,
      ipAddress: await getClientIp(),
    },
  });

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${input.id}`);
}

/** Supprime définitivement une demande (droit à l'effacement RGPD). */
export async function deletePodcastRequestAction(formData: FormData): Promise<void> {
  const session = await requireAdminWrite();
  if (session.role !== "super_admin" && session.role !== "admin") {
    throw new Error("forbidden");
  }
  const id = z.string().uuid().parse(formData.get("id"));
  await prisma.podcastRequest.delete({ where: { id } });
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "podcastrequest.deleted",
      targetType: "podcast_request",
      targetId: id,
      ipAddress: await getClientIp(),
    },
  });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
