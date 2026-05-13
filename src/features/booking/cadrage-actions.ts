"use server";
// Server Actions cadrage (Sprint X.6 / Booking V1).
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.6 § « Périmètre — Server Actions »
//   - Agent 10 P0-1/2 + Agent 7 P0-1/2
//
// SCOPE V1 livré :
//   - `scheduleCadrageMeetingAction({bookingId, scheduledAt, visioUrl, durationMinutes?})`
//     — admin planifie le call de cadrage. Crée CadrageMeeting + transition
//     option_pending → cadrage_scheduled + email visiteur avec .ics attached.
//   - `markCadrageHeldAction({cadrageId, decision, notes?})` — admin acte
//     le résultat (pertinent / not_pertinent / reschedule). Transitions :
//     cadrage_scheduled → cadrage_held (puis I7 si not_pertinent →
//     cadrage_declined dans une suite hypothétique).
//
// HORS SCOPE V1 (sprints suivants) :
//   - `rescheduleCadrageByClientAction` (magic-link client) → V1.5
//   - `cancelCadrageByClientAction` → V1.5
//   - Drawer admin UI → Sprint X.8

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import { applyTransition, StateMachineError } from "./state-machine";

type AdminContext = { userId: string; role: "super_admin" | "admin" | "editor" | "reader" };

async function requireAdmin(): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role as AdminContext["role"] | undefined;
  if (!role || (role !== "super_admin" && role !== "admin" && role !== "editor")) {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}

export interface CadrageActionResult {
  ok: boolean;
  cadrageId?: string;
  error?:
    | "unauthorized"
    | "forbidden"
    | "invalid_input"
    | "booking_not_found"
    | "transition_not_allowed"
    | "duplicate_cadrage"
    | "internal_error";
}

// ============================================================
// scheduleCadrageMeetingAction
// ============================================================

const scheduleSchema = z.object({
  bookingId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  /**
   * URL visio (Meet/Whereby/Jitsi) — optionnel à la planification :
   * Will peut envoyer l'invitation maintenant et coller l'URL plus tard.
   */
  visioUrl: z.string().url().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(180).default(30),
});

export async function scheduleCadrageMeetingAction(
  input: z.input<typeof scheduleSchema>,
): Promise<CadrageActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin();
  } catch (err) {
    const msg = (err as Error).message;
    return {
      ok: false,
      error: msg === "unauthorized" ? "unauthorized" : "forbidden",
    };
  }

  try {
    const cadrageId = await prisma.$transaction(async (tx) => {
      // -- 1. Validate booking exists + has correct status -----------
      const booking = await tx.booking.findUnique({
        where: { id: parsed.data.bookingId },
        select: {
          status: true,
          interventionType: true,
          locale: true,
          submission: { select: { contactEmail: true, contactName: true } },
        },
      });
      if (!booking) {
        throw new StateMachineError("Booking introuvable", "booking_not_found");
      }

      // I3 — skip cadrage si audit_flash_onsite (transition directe ailleurs).
      // Ici on refuse explicitement la planif d'un cadrage pour ce type.
      if (booking.interventionType === "audit_flash_onsite") {
        throw new StateMachineError(
          "Audit Flash terrain : pas de cadrage requis (I3)",
          "transition_not_allowed",
        );
      }

      // -- 2. Idempotence : un seul cadrage actif par booking --------
      const existing = await tx.cadrageMeeting.findUnique({
        where: { bookingId: parsed.data.bookingId },
        select: { id: true, status: true },
      });
      if (existing && existing.status === "scheduled") {
        throw new StateMachineError(
          `Cadrage déjà planifié pour ce booking (id=${existing.id})`,
          "transition_duplicate",
        );
      }

      // -- 3. Créer CadrageMeeting -----------------------------------
      const cm = await tx.cadrageMeeting.create({
        data: {
          bookingId: parsed.data.bookingId,
          scheduledAt: new Date(parsed.data.scheduledAt),
          durationMinutes: parsed.data.durationMinutes,
          ...(parsed.data.visioUrl ? { visioUrl: parsed.data.visioUrl } : {}),
          visioProvider: "manual_external",
          status: "scheduled",
        },
        select: {
          id: true,
        },
      });

      // -- 4. Transition booking option_pending → cadrage_scheduled --
      await applyTransition(tx, parsed.data.bookingId, {
        to: "cadrage_scheduled",
        trigger: "admin.schedule_cadrage",
        triggeredBy: "admin",
        triggeredById: admin.userId,
      });

      // -- 5. Lien cadrageMeetingId sur Booking ----------------------
      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: { cadrageMeetingId: cm.id },
      });

      return cm.id;
    });

    // -- 6. Telegram + email visiteur (best-effort, hors tx) ---------
    const ctx = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: {
        interventionType: true,
        locale: true,
        submission: { select: { contactEmail: true, contactName: true } },
      },
    });

    if (ctx?.submission?.contactEmail) {
      enqueueEmail("cadrage-scheduled", ctx.submission.contactEmail, ctx.locale, {
        contactName: ctx.submission.contactName ?? "Client",
        interventionType: ctx.interventionType,
        scheduledAt: parsed.data.scheduledAt,
        durationMinutes: parsed.data.durationMinutes,
        visioUrl: parsed.data.visioUrl ?? null,
        cadrageId,
      }).catch(() => {
        /* fail-soft */
      });
    }

    sendTelegram({
      tag: "OPTION",
      body: `📅 Cadrage planifié pour booking ${parsed.data.bookingId}\n• Date : ${parsed.data.scheduledAt}\n• Durée : ${parsed.data.durationMinutes} min\n• Visio : ${parsed.data.visioUrl ?? "à coller plus tard"}\n• Cadrage ID : ${cadrageId}`,
    }).catch(() => {});

    return { ok: true, cadrageId };
  } catch (err) {
    if (err instanceof StateMachineError) {
      const map: Record<string, CadrageActionResult["error"]> = {
        booking_not_found: "booking_not_found",
        transition_not_allowed: "transition_not_allowed",
        transition_duplicate: "duplicate_cadrage",
      };
      return { ok: false, error: map[err.code] ?? "transition_not_allowed" };
    }
    console.error("[scheduleCadrageMeetingAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// markCadrageHeldAction
// ============================================================

const markHeldSchema = z.object({
  cadrageId: z.string().uuid(),
  decision: z.enum(["pertinent", "not_pertinent", "reschedule"]),
  notes: z.string().max(5000).optional(),
  actualDurationMinutes: z.coerce.number().int().min(1).max(240).optional(),
});

export async function markCadrageHeldAction(
  input: z.input<typeof markHeldSchema>,
): Promise<CadrageActionResult> {
  const parsed = markHeldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdmin();
  } catch (err) {
    const msg = (err as Error).message;
    return {
      ok: false,
      error: msg === "unauthorized" ? "unauthorized" : "forbidden",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const cadrage = await tx.cadrageMeeting.findUnique({
        where: { id: parsed.data.cadrageId },
        select: { bookingId: true, status: true },
      });
      if (!cadrage) {
        throw new StateMachineError("Cadrage introuvable", "booking_not_found");
      }
      if (cadrage.status !== "scheduled") {
        throw new StateMachineError(
          `Cadrage déjà acté (status=${cadrage.status})`,
          "transition_duplicate",
        );
      }

      // Update CadrageMeeting : heldAt + validationDecision + notes.
      await tx.cadrageMeeting.update({
        where: { id: parsed.data.cadrageId },
        data: {
          status: "held",
          heldAt: new Date(),
          heldByAdminId: admin.userId,
          validationDecision: parsed.data.decision,
          ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
        },
      });

      // Transition booking cadrage_scheduled → cadrage_held (puis admin
      // décide la suite : cadrage_held → quote_required ou contract_pending
      // ou cadrage_declined via I7).
      await applyTransition(tx, cadrage.bookingId, {
        to: "cadrage_held",
        trigger: "admin.mark_cadrage_held",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      });

      // I7 — si decision === 'not_pertinent', cascade vers cadrage_declined
      // dans la même tx (terminal).
      if (parsed.data.decision === "not_pertinent") {
        await applyTransition(tx, cadrage.bookingId, {
          to: "cadrage_declined",
          trigger: "admin.cadrage_declined",
          triggeredBy: "admin",
          triggeredById: admin.userId,
          reason: "Cadrage négatif (not_pertinent)",
        });
      }
    });

    // Email visiteur si décliné. La relation CadrageMeeting → Booking est
    // 1-1 logique mais 1-N côté schema (Booking.cadrageMeetingId), donc on
    // requête Booking via le cadrageMeetingId.
    if (parsed.data.decision === "not_pertinent") {
      const cm = await prisma.cadrageMeeting.findUnique({
        where: { id: parsed.data.cadrageId },
        select: { bookingId: true },
      });
      if (cm) {
        const b = await prisma.booking.findUnique({
          where: { id: cm.bookingId },
          select: {
            locale: true,
            interventionType: true,
            submission: { select: { contactEmail: true, contactName: true } },
          },
        });
        const email = b?.submission?.contactEmail;
        if (b && email) {
          enqueueEmail("cadrage-declined", email, b.locale, {
            contactName: b.submission?.contactName ?? "Client",
            interventionType: b.interventionType,
            ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
          }).catch(() => {});
        }
      }
    }

    return { ok: true, cadrageId: parsed.data.cadrageId };
  } catch (err) {
    if (err instanceof StateMachineError) {
      const map: Record<string, CadrageActionResult["error"]> = {
        booking_not_found: "booking_not_found",
        transition_not_allowed: "transition_not_allowed",
        transition_duplicate: "duplicate_cadrage",
      };
      return { ok: false, error: map[err.code] ?? "transition_not_allowed" };
    }
    console.error("[markCadrageHeldAction]", err);
    return { ok: false, error: "internal_error" };
  }
}
