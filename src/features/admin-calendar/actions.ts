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
import { notify } from "@/server/notifications";
import { enqueueEmail } from "@/server/queue/queues";
import type { BookingStatus } from "../../../prisma/generated/client";

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

// Modèle multi-demandes (Will 2026-06-10) : une journée n'est plus une case
// binaire réservé/dispo mais un CONTENEUR de demandes. On agrège par jour :
//   - demandesCount  = pré-réservations en cours (le visiteur sera rappelé)
//   - valideesCount  = interventions confirmées/en cours/terminées
//   - blocked        = journée marquée « Complet » par l'admin
export interface CalendarDaySummary {
  date: string; // YYYY-MM-DD
  blocked: boolean;
  blockedReason: string | null;
  demandesCount: number;
  valideesCount: number;
  /** Noms des formateurs affectés aux interventions validées ce jour (distincts). */
  formateurs: string[];
}

// Statuts « demande » (parcours en cours) vs « validée » (verrouillé). Aligné
// sur la state machine + le distinguo préréservé/validé côté UI.
const PRERESERVED_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  "option_pending",
  "cadrage_scheduled",
  "cadrage_held",
  "quote_required",
  "quote_sent",
  "quote_signed",
  "contract_pending",
  "contract_payment_sent",
  "contract_signed",
  "awaiting_admin_validation",
]);
const VALIDATED_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  "confirmed",
  "reminded_j7",
  "in_progress",
  "paused",
  "completed",
  "invoiced_balance",
  "installment_overdue",
  "paid_balance",
]);

export async function getCalendarMonthAction(
  year: number,
  month: number,
): Promise<CalendarDaySummary[]> {
  await requireAdminRead();
  // month attendu en 1-12 (humain), JS Date.UTC veut 0-11
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const [bookings, blockedSlots] = await Promise.all([
    prisma.booking.findMany({
      where: { bookingDate: { gte: start, lt: end } },
      select: {
        bookingDate: true,
        status: true,
        formateur: { select: { prenom: true, nom: true } },
      },
    }),
    prisma.calendarSlot.findMany({
      where: { slotDate: { gte: start, lt: end }, status: "blocked" },
      select: { slotDate: true, blockedReason: true },
    }),
  ]);

  const byDate = new Map<string, CalendarDaySummary>();
  const ensure = (date: string): CalendarDaySummary => {
    let d = byDate.get(date);
    if (!d) {
      d = {
        date,
        blocked: false,
        blockedReason: null,
        demandesCount: 0,
        valideesCount: 0,
        formateurs: [],
      };
      byDate.set(date, d);
    }
    return d;
  };

  for (const b of bookings) {
    if (PRERESERVED_STATUSES.has(b.status))
      ensure(b.bookingDate.toISOString().slice(0, 10)).demandesCount++;
    else if (VALIDATED_STATUSES.has(b.status)) {
      const day = ensure(b.bookingDate.toISOString().slice(0, 10));
      day.valideesCount++;
      if (b.formateur) {
        const name = `${b.formateur.prenom} ${b.formateur.nom}`;
        if (!day.formateurs.includes(name)) day.formateurs.push(name);
      }
    }
  }
  for (const s of blockedSlots) {
    const d = ensure(s.slotDate.toISOString().slice(0, 10));
    d.blocked = true;
    d.blockedReason = s.blockedReason;
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
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

  try {
    await prisma.$transaction(async (tx) => {
      // Sprint 15 fix Fork 2 W4-2 : SELECT FOR UPDATE pour verrouiller la ligne
      // pendant la decision admin (race avec visiteur posant option en parallele).
      await tx.$queryRaw`
      SELECT id FROM calendar_slots
      WHERE slot_date = ${slotDate}::date
      FOR UPDATE
    `;

      const existing = await tx.calendarSlot.findUnique({
        where: { slotDate },
        include: {
          options: { where: { status: "pending" }, select: { id: true } },
        },
      });

      // Modèle multi-demandes (Will 2026-06-10) : « Bloquer » = marquer la
      // journée COMPLETE → on n'accepte plus de NOUVELLE pré-réservation
      // publique ce jour-là. Les demandes déjà reçues (Booking rattachés par
      // bookingDate, sans slotId) restent gérables sur /reservations — bloquer
      // ne les écrase pas. On autorise donc toujours le blocage, on refuse
      // seulement s'il reste des options 48h pending (flux legacy lié au slot).
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
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "options_pending") {
      return { ok: false, error: "Options en attente sur cette date — refusez-les d'abord." };
    }
    return { ok: false, error: "Impossible de marquer cette date complète." };
  }

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
    const lockRows = await tx.$queryRaw<
      Array<{ id: string; status: string; slotId: string | null }>
    >`
      SELECT id, status, slot_id as "slotId" FROM bookings
      WHERE id = ${parsed.data.bookingId}::uuid
      FOR UPDATE
    `;
    if (lockRows.length === 0) throw new Error("booking_not_found");
    if (lockRows[0]?.status === "cancelled") throw new Error("booking_already_cancelled");

    // Sprint 24+ fix audit 2026-05-10 : verrouille aussi le slot pour
    // éviter qu'un visiteur public pose une option simultanément (le slot
    // serait alors faussement marqué 'reserved' par le visiteur juste après
    // qu'on libère le slot suite à l'annulation admin).
    if (lockRows[0]?.slotId) {
      await tx.$queryRaw`SELECT id FROM calendar_slots WHERE id = ${lockRows[0].slotId}::uuid FOR UPDATE`;
    }

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

  // Notif via hub typé (cf. ADR 0027) — pilote migration cancelBookingAction.
  await notify({
    category: "BOOKING_CANCELLED",
    payload: {
      bookingId: result.booking.id,
      reason: parsed.data.reason,
      cancelledBy: session.userId,
    },
    dedupKey: `cancel-${result.booking.id}`,
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
