// Server Actions admin /calendrier (M9 Tier 1 section 3).
//
// V1 minimal :
//  - getCalendarMonth(year, month) : retourne tous les slots du mois +
//    relation booking + relation options pending (compte uniquement)
//  - blockDate(date, reason) : cree ou update slot status='blocked'
//  - unblockDate(date) : flip blocked → available (uniquement si pas
//    de booking ferme ni option pending)
//
// Doctrine doc 09b : 3 etats `available / reserved / blocked`. Le admin
// peut bloquer manuellement une date (vacances, indisponibilite ponctuelle).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import type { BookingStatus, CalendarSlotStatus } from "../../../prisma/generated/client";

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
// getCalendarMonth
// ============================================================

export interface CalendarMonthSlot {
  id: string;
  date: string; // YYYY-MM-DD
  status: CalendarSlotStatus;
  displaySector: string | null;
  interventionType: string | null;
  participantsCount: number | null;
  blockedReason: string | null;
  bookingId: string | null;
  bookingStatus: BookingStatus | null;
  pendingOptionsCount: number;
}

export async function getCalendarMonthAction(
  year: number,
  month: number,
): Promise<CalendarMonthSlot[]> {
  await requireAdminRead();
  // month attendu en 1-12 (humain), JS Date.UTC veut 0-11
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const slots = await prisma.calendarSlot.findMany({
    where: { slotDate: { gte: start, lt: end } },
    orderBy: { slotDate: "asc" },
    include: {
      booking: { select: { id: true, status: true } },
      options: {
        where: { status: "pending" },
        select: { id: true },
      },
    },
  });

  return slots.map((s) => ({
    id: s.id,
    date: s.slotDate.toISOString().slice(0, 10),
    status: s.status,
    displaySector: s.displaySector,
    interventionType: s.interventionType,
    participantsCount: s.participantsCount,
    blockedReason: s.blockedReason,
    bookingId: s.booking?.id ?? null,
    bookingStatus: s.booking?.status ?? null,
    pendingOptionsCount: s.options.length,
  }));
}

// ============================================================
// blockDate
// ============================================================

const blockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu."),
  reason: z.string().min(1, "Motif requis.").max(500),
});
export type BlockDateState = { ok: true } | { ok: false; error: string };

export async function blockDateAction(
  _prev: BlockDateState,
  formData: FormData,
): Promise<BlockDateState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = blockDateSchema.safeParse({
    date: formData.get("date"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const ip = await getClientIp();
  const slotDate = new Date(`${parsed.data.date}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    // Sprint 15 fix Fork 2 W4-2 : SELECT FOR UPDATE pour verrouiller la ligne
    // pendant la decision admin (race avec visiteur posant option en parallele).
    await tx.$queryRaw`
      SELECT id FROM calendar_slots
      WHERE slot_date = ${slotDate}::date
      FOR UPDATE
    `;

    // Verifie pas de booking ferme sur ce slot
    const existing = await tx.calendarSlot.findUnique({
      where: { slotDate },
      include: {
        booking: { select: { id: true, status: true } },
        options: { where: { status: "pending" }, select: { id: true } },
      },
    });

    if (existing?.booking && existing.booking.status === "confirmed") {
      throw new Error("booking_active");
    }
    if (existing && existing.options.length > 0) {
      throw new Error("options_pending");
    }

    if (existing) {
      await tx.calendarSlot.update({
        where: { id: existing.id },
        data: {
          status: "blocked",
          blockedReason: parsed.data.reason,
          displaySector: null,
          interventionType: null,
          participantsCount: null,
        },
      });
    } else {
      await tx.calendarSlot.create({
        data: {
          slotDate,
          status: "blocked",
          blockedReason: parsed.data.reason,
          showPublicly: false,
        },
      });
    }
    await tx.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "calendar.blocked",
        targetType: "calendar_slot",
        changes: { date: parsed.data.date, reason: parsed.data.reason },
        ipAddress: ip,
      },
    });
  });

  revalidatePath(adminPath("fr", "calendrier"));
  // Sprint 24 / C1 — bloquer une date retire le slot des dispos public.
  revalidatePath("/fr/reserver");
  revalidatePath("/en/book");
  return { ok: true };
}

// ============================================================
// cancelBooking — Sprint 24 / C3
// ============================================================
//
// Annule une reservation ferme : Booking.status='cancelled', libere le slot
// (status='available' si pas d'autre option/booking concurrent), envoie
// email au contact (si trouve) et alerte Telegram [ANNULATION].
// Le contact provient soit de la Submission liee, soit de la BookingOption
// d'origine (slotId match + status='converted').

const cancelBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(1, "Motif requis.").max(500),
});
export type CancelBookingState = { ok: true } | { ok: false; error: string };

export async function cancelBookingAction(
  _prev: CancelBookingState,
  formData: FormData,
): Promise<CancelBookingState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = cancelBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const ip = await getClientIp();

  const result = await prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM bookings
      WHERE id = ${parsed.data.bookingId}::uuid
      FOR UPDATE
    `;
    if (lockRows.length === 0) throw new Error("booking_not_found");
    if (lockRows[0]?.status === "cancelled") throw new Error("booking_already_cancelled");

    const booking = await tx.booking.findUnique({
      where: { id: parsed.data.bookingId },
      include: {
        slot: true,
        submission: {
          select: { contactName: true, contactEmail: true, locale: true },
        },
      },
    });
    if (!booking) throw new Error("booking_not_found");

    await tx.booking.update({
      where: { id: parsed.data.bookingId },
      data: {
        status: "cancelled",
        internalNotes: parsed.data.reason,
      },
    });

    // Libere slot si plus rien dessus
    if (booking.slotId && booking.slot) {
      const otherOption = await tx.bookingOption.findFirst({
        where: {
          slotId: booking.slotId,
          status: { in: ["pending", "confirmed"] },
        },
        select: { id: true },
      });
      if (!otherOption && booking.slot.status === "reserved") {
        await tx.calendarSlot.update({
          where: { id: booking.slotId },
          data: {
            status: "available",
            displaySector: null,
            interventionType: null,
            participantsCount: null,
          },
        });
      }
    }

    // Recupere contact depuis BookingOption d'origine si pas de submission
    let contactName = booking.submission?.contactName ?? null;
    let contactEmail = booking.submission?.contactEmail ?? null;
    if (!contactEmail && booking.slotId) {
      const originOption = await tx.bookingOption.findFirst({
        where: { slotId: booking.slotId, status: "converted" },
        select: { contactName: true, contactEmail: true },
        orderBy: { createdAt: "desc" },
      });
      if (originOption) {
        contactName = originOption.contactName;
        contactEmail = originOption.contactEmail;
      }
    }

    await tx.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "booking.cancelled",
        targetType: "booking",
        targetId: parsed.data.bookingId,
        changes: { reason: parsed.data.reason },
        ipAddress: ip,
      },
    });

    return { booking, contactName, contactEmail };
  });

  await sendTelegram({
    tag: "ANNULATION",
    body: `Réservation \`${result.booking.id}\` annulée par admin\n• Date : ${result.booking.bookingDate.toISOString().slice(0, 10)}\n• Type : ${result.booking.interventionType}\n• Motif : ${parsed.data.reason}`,
  });

  if (result.contactEmail && result.contactName) {
    await enqueueEmail("booking-cancelled", result.contactEmail, result.booking.locale, {
      contactName: result.contactName,
      bookingDate: result.booking.bookingDate.toISOString().slice(0, 10),
      interventionType: result.booking.interventionType,
      reason: parsed.data.reason,
    });
  }

  revalidatePath(adminPath("fr", "calendrier"));
  revalidatePath(adminPath("fr", "options"));
  revalidatePath("/fr/reserver");
  revalidatePath("/en/book");
  return { ok: true };
}

// ============================================================
// unblockDate
// ============================================================

const unblockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type UnblockDateState = { ok: true } | { ok: false; error: string };

export async function unblockDateAction(
  _prev: UnblockDateState,
  formData: FormData,
): Promise<UnblockDateState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = unblockSchema.safeParse({ date: formData.get("date") });
  if (!parsed.success) return { ok: false, error: "Date invalide." };

  const ip = await getClientIp();
  const slotDate = new Date(`${parsed.data.date}T00:00:00.000Z`);

  const existing = await prisma.calendarSlot.findUnique({ where: { slotDate } });
  if (!existing) return { ok: false, error: "Créneau introuvable." };
  if (existing.status !== "blocked") {
    return { ok: false, error: "Ce créneau n'est pas bloqué." };
  }

  await prisma.$transaction([
    prisma.calendarSlot.update({
      where: { id: existing.id },
      data: { status: "available", blockedReason: null, showPublicly: true },
    }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "calendar.unblocked",
        targetType: "calendar_slot",
        targetId: existing.id,
        changes: { date: parsed.data.date },
        ipAddress: ip,
      },
    }),
  ]);

  revalidatePath(adminPath("fr", "calendrier"));
  // Sprint 24 / C1 — débloquer un slot le rend visible cote public.
  revalidatePath("/fr/reserver");
  revalidatePath("/en/book");
  return { ok: true };
}
