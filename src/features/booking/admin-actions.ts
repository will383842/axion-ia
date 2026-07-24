"use server";
// Server Actions admin pour le cycle de vie d'un Booking (Sprint X.4 - V1)
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.4 § « Périmètre — Server Actions admin »
//   - Agent 3 invariants TS1-TS20 + état D49-D51 + D59 + D61
//
// SCOPE V1 (livré ce sprint) :
//   - pauseBookingAction              — A19 D61 (confirmed → paused, libère slots)
//   - resumeBookingAction             — A20 D61 (paused → confirmed, re-bloque slots)
//   - markCompletedAction             — in_progress → completed
//   - markNoShowAction                — confirmed → no_show (super_admin only)
//   - markForceMajeureAction          — * → force_majeure (super_admin only)
//   - validateBookingOnCalendarAction — clic Will 2 (awaiting_admin_validation → confirmed)
//
// HORS SCOPE V1 (dépendances externes — sprints suivants) :
//   - sendContractAndDepositRequestAction → DocuSeal X.3 + emails X.13
//   - cancelBookingByAdminAction          → grille refund Stripe X.4 fin
//   - cancelAndReissueContractAction      → DocuSeal X.3
//   - createContractAddendumAction        → DocuSeal X.3
//
// CONTRAT :
//   - Toutes les actions utilisent `applyTransition()` (audit log immutable +
//     idempotence trigger).
//   - Les transitions sont enveloppées dans `prisma.$transaction` pour grouper
//     side-effects (libération slot etc.) avec le BookingTransition.
//   - Garde-fou role : `requireAdminWrite` (admin/super_admin/editor) sauf
//     `markNoShowAction` et `markForceMajeureAction` qui exigent super_admin.

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { getClientIp } from "@/lib/client-ip";
import { enqueueEmail } from "@/server/queue/queues";
import { applyTransition, StateMachineError, type ApplyTransitionOptions } from "./state-machine";

// Helper : récupère contact + intervention type d'un booking pour les emails.
async function getEmailPayloadBase(bookingId: string): Promise<{
  email: string;
  locale: "fr" | "en";
  contactName: string;
  interventionType: string;
} | null> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      interventionType: true,
      locale: true,
      submission: { select: { contactEmail: true, contactName: true } },
    },
  });
  if (!b?.submission?.contactEmail) return null;
  return {
    email: b.submission.contactEmail,
    locale: b.locale,
    contactName: b.submission.contactName ?? "Client",
    interventionType: b.interventionType,
  };
}

// ============================================================
// Helpers auth
// ============================================================

type AdminContext = { userId: string; role: "super_admin" | "admin" | "editor" | "reader" };

type AdminErrorCode = "unauthorized" | "forbidden";

class AdminAuthError extends Error {
  readonly code: AdminErrorCode;
  constructor(code: AdminErrorCode) {
    super(code);
    this.code = code;
  }
}

async function requireAdmin(minRole: "super_admin" | "admin" | "editor"): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) throw new AdminAuthError("unauthorized");
  const role = (session.user as { role?: string }).role as AdminContext["role"] | undefined;
  if (!role) throw new AdminAuthError("forbidden");
  const ROLE_RANK = { reader: 0, editor: 1, admin: 2, super_admin: 3 } as const;
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new AdminAuthError("forbidden");
  }
  return { userId: session.user.id, role };
}

function authErrorResult(err: unknown): AdminActionResult {
  if (err instanceof AdminAuthError) return { ok: false, error: err.code };
  return { ok: false, error: "internal_error" };
}

function stateMachineErrorResult(err: unknown, ctx: string): AdminActionResult {
  if (err instanceof StateMachineError) {
    const mapped: AdminActionResult["error"] =
      err.code === "booking_not_found" ? "booking_not_found" : "transition_not_allowed";
    return { ok: false, error: mapped };
  }
  console.error(ctx, err);
  return { ok: false, error: "internal_error" };
}

// ============================================================
// pauseBookingAction (A19 D61) — confirmed → paused
// ============================================================

const pauseSchema = z.object({
  bookingId: z.string().uuid(),
  pausedUntil: z
    .string()
    .datetime()
    .optional()
    .describe("Date ISO indicative de reprise. Null si indéterminée."),
  reason: z.string().min(10).max(500),
});

export interface AdminActionResult {
  ok: boolean;
  error?:
    | "unauthorized"
    | "forbidden"
    | "invalid_input"
    | "booking_not_found"
    | "transition_not_allowed"
    | "trainer_unavailable"
    | "internal_error";
}

export async function pauseBookingAction(
  input: z.input<typeof pauseSchema>,
): Promise<AdminActionResult> {
  const parsed = pauseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin("admin");
  } catch (err) {
    return authErrorResult(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: parsed.data.bookingId },
        select: { status: true, slotId: true },
      });
      if (!booking) throw new StateMachineError("Booking introuvable", "booking_not_found");

      const txOpts: ApplyTransitionOptions = {
        to: "paused",
        trigger: "admin.pause_booking",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        reason: parsed.data.reason,
        snapshotBefore: { status: booking.status },
        snapshotAfter: { status: "paused" },
      };
      await applyTransition(tx, parsed.data.bookingId, txOpts);

      // D61 — libérer le slot pendant la pause (le slot peut être re-booké
      // par un autre client). Garde la trace via cancellationWindow non set.
      if (booking.slotId) {
        await tx.calendarSlot.update({
          where: { id: booking.slotId },
          data: { status: "available" },
        });
      }

      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: {
          pausedAt: new Date(),
          ...(parsed.data.pausedUntil ? { pausedUntil: new Date(parsed.data.pausedUntil) } : {}),
          pauseReason: parsed.data.reason,
        },
      });
    });

    sendTelegram({
      tag: "OPTION", // tag existant le plus proche; tag dédié BOOKING_PAUSED prévu Sprint X.13 final
      body: `Booking ${parsed.data.bookingId} mis en pause par ${admin.userId}. Raison : ${parsed.data.reason}`,
    }).catch(() => {});

    // Sprint X.13 — email client confirmation pause (D61).
    const ctx = await getEmailPayloadBase(parsed.data.bookingId);
    if (ctx) {
      enqueueEmail("booking-paused-confirmation", ctx.email, ctx.locale, {
        contactName: ctx.contactName,
        interventionType: ctx.interventionType,
        pausedAt: new Date().toISOString().slice(0, 10),
        ...(parsed.data.pausedUntil ? { pausedUntil: parsed.data.pausedUntil.slice(0, 10) } : {}),
        reason: parsed.data.reason,
        bookingId: parsed.data.bookingId,
      }).catch(() => {
        /* fail-soft email queue (BullMQ Redis down) */
      });
    }

    return { ok: true };
  } catch (err) {
    return stateMachineErrorResult(err, "[pauseBookingAction]");
  }
}

// ============================================================
// resumeBookingAction (A20 D61) — paused → confirmed
// ============================================================

const resumeSchema = z.object({
  bookingId: z.string().uuid(),
  newSlotId: z
    .string()
    .uuid()
    .optional()
    .describe("Nouveau slot à bloquer. Optionnel si reprise sans changement de date."),
});

export async function resumeBookingAction(
  input: z.input<typeof resumeSchema>,
): Promise<AdminActionResult> {
  const parsed = resumeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin("admin");
  } catch (err) {
    return authErrorResult(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await applyTransition(tx, parsed.data.bookingId, {
        to: "confirmed",
        trigger: "admin.resume_booking",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        reason: "Reprise après pause",
      });

      // Re-bloquer le slot (ou nouveau slot si fourni).
      if (parsed.data.newSlotId) {
        await tx.calendarSlot.update({
          where: { id: parsed.data.newSlotId },
          data: { status: "reserved" },
        });
        await tx.booking.update({
          where: { id: parsed.data.bookingId },
          data: {
            slotId: parsed.data.newSlotId,
            pausedAt: null,
            pausedUntil: null,
            pauseReason: null,
          },
        });
      } else {
        await tx.booking.update({
          where: { id: parsed.data.bookingId },
          data: { pausedAt: null, pausedUntil: null, pauseReason: null },
        });
      }
    });

    // Sprint X.13 — email client confirmation reprise (D61). Récupère la
    // nouvelle date depuis le slot si newSlotId fourni, sinon depuis l'existant.
    const ctx = await getEmailPayloadBase(parsed.data.bookingId);
    if (ctx) {
      const bb = await prisma.booking.findUnique({
        where: { id: parsed.data.bookingId },
        select: { bookingDate: true },
      });
      const iso = bb?.bookingDate.toISOString() ?? new Date().toISOString();
      enqueueEmail("booking-resumed-notification", ctx.email, ctx.locale, {
        contactName: ctx.contactName,
        interventionType: ctx.interventionType,
        resumedDate: iso.slice(0, 10),
        resumedTime: iso.slice(11, 16),
        bookingId: parsed.data.bookingId,
      }).catch(() => {
        /* fail-soft */
      });
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return stateMachineErrorResult(err, "[bookingAdminAction]");
    }
    console.error("[resumeBookingAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// markCompletedAction — in_progress → completed
// ============================================================

const markCompletedSchema = z.object({
  bookingId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export async function markCompletedAction(
  input: z.input<typeof markCompletedSchema>,
): Promise<AdminActionResult> {
  const parsed = markCompletedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin("admin");
  } catch (err) {
    return authErrorResult(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await applyTransition(tx, parsed.data.bookingId, {
        to: "completed",
        trigger: "admin.mark_completed",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      });
      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: { completedAt: new Date() },
      });
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return stateMachineErrorResult(err, "[bookingAdminAction]");
    }
    console.error("[markCompletedAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// markNoShowAction — confirmed → no_show (super_admin only)
// ============================================================

const markNoShowSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(10).max(500),
});

export async function markNoShowAction(
  input: z.input<typeof markNoShowSchema>,
): Promise<AdminActionResult> {
  const parsed = markNoShowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin("super_admin"); // role check I9
  } catch (err) {
    return authErrorResult(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await applyTransition(tx, parsed.data.bookingId, {
        to: "no_show",
        trigger: "admin.mark_no_show",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        reason: parsed.data.reason,
      });
      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: { cancelledAt: new Date(), cancellationReason: parsed.data.reason },
      });
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return stateMachineErrorResult(err, "[bookingAdminAction]");
    }
    console.error("[markNoShowAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// markForceMajeureAction — * → force_majeure (super_admin only)
// ============================================================

const markForceMajeureSchema = z.object({
  bookingId: z.string().uuid(),
  notes: z.string().min(20).max(2000),
});

export async function markForceMajeureAction(
  input: z.input<typeof markForceMajeureSchema>,
): Promise<AdminActionResult> {
  const parsed = markForceMajeureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin("super_admin"); // role check I9
  } catch (err) {
    return authErrorResult(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await applyTransition(tx, parsed.data.bookingId, {
        to: "force_majeure",
        trigger: "admin.mark_force_majeure",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        notes: parsed.data.notes,
      });
      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: { forceMajeureNotes: parsed.data.notes },
      });
    });

    // Sprint X.13 — email client force majeure (refund 100% sauf override CGV).
    const ctx = await getEmailPayloadBase(parsed.data.bookingId);
    if (ctx) {
      enqueueEmail("force-majeure-notice", ctx.email, ctx.locale, {
        contactName: ctx.contactName,
        interventionType: ctx.interventionType,
        notes: parsed.data.notes,
        bookingId: parsed.data.bookingId,
      }).catch(() => {
        /* fail-soft */
      });
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return stateMachineErrorResult(err, "[bookingAdminAction]");
    }
    console.error("[markForceMajeureAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// validateBookingOnCalendarAction (clic Will 2) — awaiting_admin_validation → confirmed
// ============================================================
//
// Trigger : depuis admin /calendrier ou /demandes après validation manuelle
// par Will que l'intervention peut être verrouillée (acompte reçu + cadrage OK
// + contrat signé OU mode hybride manuel). Le slot bascule en 🔴 "reserved"
// définitif et un email "intervention verrouillée" part au visiteur.
//
// Différence vs Stripe webhook auto :
//   - Webhook deposit.paid → deposit_paid (état intermédiaire)
//   - Workflow normal V1.5+ : deposit_paid + contract_signed + cadrage_held
//     → applyTransition(awaiting_admin_validation, trigger=system.*)
//   - Clic Will 2 ici : awaiting_admin_validation → confirmed
//
// V1 transitoire (sans DocuSeal X.3 ni cadrage workflow complet) : Will peut
// invoquer cette action depuis n'importe quel état "en attente" via override
// (transition_not_allowed retourné si état pas dans la whitelist).

const validateOnCalendarSchema = z.object({
  bookingId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export async function validateBookingOnCalendarAction(
  input: z.input<typeof validateOnCalendarSchema>,
): Promise<AdminActionResult> {
  const parsed = validateOnCalendarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin("admin");
  } catch (err) {
    return authErrorResult(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: parsed.data.bookingId },
        select: { status: true, slotId: true },
      });
      if (!booking) throw new StateMachineError("Booking introuvable", "booking_not_found");

      const txOpts: ApplyTransitionOptions = {
        to: "confirmed",
        trigger: "admin.validate_on_calendar",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
        snapshotBefore: { status: booking.status },
        snapshotAfter: { status: "confirmed" },
      };
      await applyTransition(tx, parsed.data.bookingId, txOpts);

      // Slot calendrier : confirme le statut "reserved" définitif.
      if (booking.slotId) {
        await tx.calendarSlot.update({
          where: { id: booking.slotId },
          data: { status: "reserved" },
        });
      }

      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: { confirmedAt: new Date() },
      });
    });

    sendTelegram({
      tag: "OPTION CONFIRMÉE",
      body: `Booking ${parsed.data.bookingId} verrouillé sur calendrier par ${admin.userId}.`,
    }).catch(() => {});

    // Sprint X.13 — email visiteur "intervention verrouillée dans le calendrier".
    const ctx = await getEmailPayloadBase(parsed.data.bookingId);
    if (ctx) {
      const bb = await prisma.booking.findUnique({
        where: { id: parsed.data.bookingId },
        select: { bookingDate: true, participantsCount: true },
      });
      const iso = bb?.bookingDate.toISOString() ?? new Date().toISOString();
      enqueueEmail("booking-validated-on-calendar", ctx.email, ctx.locale, {
        contactName: ctx.contactName,
        interventionType: ctx.interventionType,
        bookingDate: iso.slice(0, 10),
        bookingTime: iso.slice(11, 16),
        participantsCount: bb?.participantsCount ?? 1,
        bookingId: parsed.data.bookingId,
      }).catch(() => {
        /* fail-soft email queue (BullMQ Redis down) */
      });
    }

    return { ok: true };
  } catch (err) {
    return stateMachineErrorResult(err, "[validateBookingOnCalendarAction]");
  }
}

// ============================================================
// assignTrainerToBookingAction (Phase 2 calendrier — Will 2026-06-10)
// ============================================================
//
// Affecte (ou retire) le formateur d'une intervention/réservation. Modifiable à
// tout moment depuis la fiche /reservations/[id]. Libre parmi les formateurs
// ACTIFS (pas de contrôle d'habilitation : les interventions calendrier ≠ les
// formations Qualiopi cataloguées — décision Will). `trainerId = null` retire.
const assignFormateurSchema = z.object({
  bookingId: z.string().uuid(),
  trainerId: z.string().uuid().nullable(),
});

export async function assignTrainerToBookingAction(
  input: z.input<typeof assignFormateurSchema>,
): Promise<AdminActionResult> {
  const parsed = assignFormateurSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin("admin");
  } catch (err) {
    return authErrorResult(err);
  }

  const { bookingId, trainerId } = parsed.data;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true },
    });
    if (!booking) return { ok: false, error: "booking_not_found" };

    if (trainerId !== null) {
      const trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
        select: { actif: true },
      });
      if (!trainer) return { ok: false, error: "trainer_unavailable" };
      if (!trainer.actif) return { ok: false, error: "trainer_unavailable" };
    }

    await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { formateurId: trainerId } }),
      prisma.activityLog.create({
        data: {
          adminUserId: admin.userId,
          action: trainerId ? "booking.assign_formateur" : "booking.unassign_formateur",
          targetType: "booking",
          targetId: bookingId,
          changes: { formateurId: trainerId },
          ipAddress: await getClientIp(),
        },
      }),
    ]);

    return { ok: true };
  } catch (err) {
    console.error("[assignTrainerToBookingAction]", err);
    return { ok: false, error: "internal_error" };
  }
}
