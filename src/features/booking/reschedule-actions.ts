"use server";
// Server Actions admin — reschedule booking (Sprint E — D60).
//
// SOURCE :
//   - 03-ARCHITECTURE-CIBLE.md §5.2.2 A18 rescheduleBookingByAdminAction
//   - Spec D60 drag-drop calendrier admin
//
// SCOPE V1
//   - rescheduleBookingByAdminAction(bookingId, newSlotId, reason, notifyClient)
//       libère ancien slot + bloque nouveau slot dans 1 transaction atomique
//       email client booking-rescheduled-by-admin (fail-soft)
//       transition state machine : keep current status (reschedule = même status)
//       audit log avec diff slots

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { sendTelegram } from "@/lib/telegram";
import type { Prisma, BookingStatus } from "../../../prisma/generated/client";

type AdminContext = { userId: string; role: "super_admin" | "admin" | "editor" | "reader" };

async function requireAdminWrite(): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role as AdminContext["role"] | undefined;
  if (!role) throw new Error("forbidden");
  if (role !== "super_admin" && role !== "admin") throw new Error("forbidden");
  return { userId: session.user.id, role };
}

function authError(err: unknown): {
  ok: false;
  error: "unauthorized" | "forbidden" | "internal_error";
} {
  const msg = (err as Error)?.message;
  if (msg === "unauthorized") return { ok: false, error: "unauthorized" };
  if (msg === "forbidden") return { ok: false, error: "forbidden" };
  return { ok: false, error: "internal_error" };
}

// État du booking valide pour reschedule (cf. 03-ARCH §5.2.2 A18).
const RESCHEDULABLE_STATUSES: BookingStatus[] = [
  "contract_payment_sent",
  "awaiting_admin_validation",
  "confirmed",
  "paused",
];

const rescheduleSchema = z.object({
  bookingId: z.string().uuid(),
  /** Nouveau slot calendrier où re-bloquer. Doit être disponible (status=available). */
  newSlotId: z.string().uuid(),
  reason: z.string().min(10).max(500),
  /** Si true, envoie un email "booking-rescheduled-by-admin" au client. */
  notifyClient: z.boolean().default(true),
});

export type RescheduleResult =
  | {
      ok: true;
      bookingId: string;
      oldSlotId: string | null;
      newSlotId: string;
      newBookingDate: string;
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "forbidden"
        | "invalid_input"
        | "booking_not_found"
        | "invalid_status_for_admin_reschedule"
        | "new_slot_not_found"
        | "new_slot_unavailable"
        | "internal_error";
    };

export async function rescheduleBookingByAdminAction(
  input: z.input<typeof rescheduleSchema>,
): Promise<RescheduleResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdminWrite();
  } catch (err) {
    return authError(err) as RescheduleResult;
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: {
        id: true,
        status: true,
        slotId: true,
        locale: true,
        interventionType: true,
        bookingDate: true,
        submission: { select: { contactEmail: true, contactName: true } },
        fromSubmission: { select: { contactEmail: true, contactName: true } },
      },
    });
    if (!booking) return { ok: false, error: "booking_not_found" };
    if (!RESCHEDULABLE_STATUSES.includes(booking.status)) {
      return { ok: false, error: "invalid_status_for_admin_reschedule" };
    }

    const newSlot = await prisma.calendarSlot.findUnique({
      where: { id: parsed.data.newSlotId },
      select: { id: true, slotDate: true, status: true },
    });
    if (!newSlot) return { ok: false, error: "new_slot_not_found" };
    if (newSlot.status !== "available") {
      return { ok: false, error: "new_slot_unavailable" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Libère ancien slot
      if (booking.slotId) {
        await tx.calendarSlot.update({
          where: { id: booking.slotId },
          data: { status: "available" },
        });
      }

      // Bloque nouveau slot
      await tx.calendarSlot.update({
        where: { id: parsed.data.newSlotId },
        data: { status: "reserved" },
      });

      // Update Booking
      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: {
          slotId: parsed.data.newSlotId,
          bookingDate: newSlot.slotDate,
        },
      });

      // ActivityLog admin (preuve audit). BookingTransition n'est pas créée
      // car reschedule = modification slot, pas transition d'état (le status
      // reste identique). L'index unique partial (bookingId, toStatus, trigger)
      // de BookingTransition empêcherait de toute façon multiples reschedules
      // sur le même booking.
      await tx.activityLog.create({
        data: {
          adminUserId: admin.userId,
          action: "booking.reschedule",
          targetType: "booking",
          targetId: parsed.data.bookingId,
          changes: {
            oldSlotId: booking.slotId,
            newSlotId: parsed.data.newSlotId,
            oldBookingDate: booking.bookingDate.toISOString(),
            newBookingDate: newSlot.slotDate.toISOString(),
            reason: parsed.data.reason,
            notifyClient: parsed.data.notifyClient,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return { newBookingDate: newSlot.slotDate.toISOString() };
    });

    // Email client (fail-soft hors tx)
    if (parsed.data.notifyClient) {
      const sub = booking.fromSubmission ?? booking.submission;
      if (sub?.contactEmail) {
        await enqueueEmail("booking-rescheduled-by-admin", sub.contactEmail, booking.locale, {
          contactName: sub.contactName ?? "Client",
          interventionType: booking.interventionType,
          oldDate: booking.bookingDate.toISOString().slice(0, 10),
          newDate: newSlot.slotDate.toISOString().slice(0, 10),
          reason: parsed.data.reason,
          bookingId: parsed.data.bookingId,
        }).catch(() => {
          /* fail-soft */
        });
      }
    }

    // Telegram
    await sendTelegram({
      tag: "AUTO",
      body: `📅 Booking ${parsed.data.bookingId.slice(0, 8)} rescheduled par ${admin.userId.slice(0, 8)}.\nAncien: ${booking.bookingDate.toISOString().slice(0, 10)}\nNouveau: ${newSlot.slotDate.toISOString().slice(0, 10)}\nMotif: ${parsed.data.reason}`,
      silent: true,
    }).catch(() => {});

    revalidatePath(
      `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/reservations/${parsed.data.bookingId}`,
    );
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/reservations`);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/calendrier`);

    return {
      ok: true,
      bookingId: parsed.data.bookingId,
      oldSlotId: booking.slotId,
      newSlotId: parsed.data.newSlotId,
      newBookingDate: result.newBookingDate,
    };
  } catch (err) {
    console.error("[rescheduleBookingByAdminAction]", err);
    return { ok: false, error: "internal_error" };
  }
}
