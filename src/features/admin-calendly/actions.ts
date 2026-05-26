// Calendly admin Server Actions (Sprint Notif Infra 2026-05-26 / fix P1-6
// audit 2026-05-27).
//
// Permet à l'admin de :
//  - éditer manuellement un CalendlyEvent (inviteeName/Email/Phone/startTime/
//    status/notes) après capture Embed JS partielle (limitation Calendly Free)
//  - lier manuellement un CalendlyEvent à une Submission existante
//  - créer manuellement un CalendlyEvent (rattraper les events reçus uniquement
//    par mail Calendly natif sans passer par /appel)

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";

async function requireAdminWriteSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}

// ============================================================
// updateCalendlyEventAction — édition inline admin
// ============================================================

const updateCalendlyEventSchema = z.object({
  id: z.string().min(1).max(64),
  inviteeName: z.string().max(255).nullable().optional(),
  inviteeEmail: z.string().email().max(255).nullable().optional(),
  inviteePhone: z.string().max(40).nullable().optional(),
  startTime: z.string().datetime().nullable().optional(),
  endTime: z.string().datetime().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  status: z.enum(["scheduled", "canceled", "completed", "no_show"]).optional(),
  notes: z.string().max(5000).nullable().optional(),
  linkedSubmissionId: z.string().uuid().nullable().optional(),
});

export type UpdateCalendlyEventState = { ok: true } | { ok: false; error: string };

export async function updateCalendlyEventAction(
  input: z.input<typeof updateCalendlyEventSchema>,
): Promise<UpdateCalendlyEventState> {
  try {
    await requireAdminWriteSession();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }
  const parsed = updateCalendlyEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const { id, startTime, endTime, ...rest } = parsed.data;

  const data: Record<string, unknown> = { ...rest };
  if (startTime !== undefined) data.startTime = startTime ? new Date(startTime) : null;
  if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;

  try {
    await prisma.calendlyEvent.update({ where: { id }, data });
    revalidatePath(adminPath("fr", "contacts/calendly"));
    revalidatePath(adminPath("fr", `contacts/calendly/${id}`));
    return { ok: true };
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }
}

// ============================================================
// createManualCalendlyEventAction — rattrapage manuel d'un RDV
// ============================================================

const createManualSchema = z.object({
  eventTypeName: z.string().min(1).max(255),
  eventTypeSlug: z.string().min(1).max(100),
  inviteeName: z.string().max(255).optional(),
  inviteeEmail: z.string().email().max(255).optional(),
  inviteePhone: z.string().max(40).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
});

export type CreateManualCalendlyEventState =
  | { ok: true; eventId: string }
  | { ok: false; error: string };

export async function createManualCalendlyEventAction(
  input: z.input<typeof createManualSchema>,
): Promise<CreateManualCalendlyEventState> {
  try {
    await requireAdminWriteSession();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }
  const parsed = createManualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const data = parsed.data;

  try {
    const event = await prisma.calendlyEvent.create({
      data: {
        eventTypeName: data.eventTypeName,
        eventTypeSlug: data.eventTypeSlug,
        status: "scheduled",
        source: "manual_import",
        ...(data.inviteeName ? { inviteeName: data.inviteeName } : {}),
        ...(data.inviteeEmail ? { inviteeEmail: data.inviteeEmail } : {}),
        ...(data.inviteePhone ? { inviteePhone: data.inviteePhone } : {}),
        ...(data.startTime ? { startTime: new Date(data.startTime) } : {}),
        ...(data.endTime ? { endTime: new Date(data.endTime) } : {}),
        ...(data.location ? { location: data.location } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        rawPayload: { _manual: true, _source: "admin-ui" },
      },
      select: { id: true },
    });
    revalidatePath(adminPath("fr", "contacts/calendly"));
    return { ok: true, eventId: event.id };
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }
}
