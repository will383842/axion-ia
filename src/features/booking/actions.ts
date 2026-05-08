// Booking — Server Actions (Sprint 15 / M8).
//
// 2 actions :
//  - createBookingAction : reservation directe (sans option 48h)
//  - postOption48hAction : pose une option 48h sur un slot (verrou pessimiste
//    Postgres SELECT ... FOR UPDATE — doctrine doc 09b)
//
// Le verrou pessimiste empeche la race condition « 2 visiteurs reservent
// le meme slot en simultane » : la premiere transaction lock la ligne
// calendar_slots, verifie status='available', insert BookingOption + flip
// slot.status='reserved' atomiquement. La 2e transaction attend, voit
// status='reserved' et echoue → page /reserver?error=slot_taken cote UI.

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { bookingSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import type { Locale, InterventionType } from "../../../prisma/generated/client";

export type BookingState = { ok: true; bookingId: string } | { ok: false; error: string };
export type Option48hState =
  | { ok: true; optionId: string; expiresAt: string }
  | {
      ok: false;
      error: string;
      reason?: "slot_taken" | "slot_unavailable" | "validation" | "rate_limit" | "captcha";
    };

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

// ============================================================
// createBookingAction — reservation directe
// ============================================================

export async function createBookingAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const ip = await getClientIp();
  const rl = await checkRateLimit(`booking:${ip}`, { limit: 5, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };

  if (formData.get("website")) return { ok: true, bookingId: "" };

  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  const parsed = bookingSchema.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    contact: formData.get("contact"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const interventionType = (formData.get("interventionType") as InterventionType) ?? "essentielle";
  const participantsCount = Number(formData.get("participantsCount") ?? 1);
  const locale = ((formData.get("locale") as string) || "fr") as Locale;
  const bookingDateTime = new Date(`${parsed.data.date}T${parsed.data.time}:00.000Z`);

  // 1. Submission record (pour traceabilite)
  const submission = await prisma.submission.create({
    data: {
      type: "intervention",
      locale,
      companyName: parsed.data.contact,
      contactName: parsed.data.contact,
      contactEmail: parsed.data.email,
      contactPhone: parsed.data.phone ?? null,
      details: {
        interventionType,
        bookingDate: parsed.data.date,
        bookingTime: parsed.data.time,
        participantsCount,
      },
      ipAddress: ip,
      userAgent: (await headers()).get("user-agent") ?? null,
    },
  });

  // 2. Booking record (pas de slot lock ici — booking direct, pas option)
  const booking = await prisma.booking.create({
    data: {
      interventionType,
      bookingDate: bookingDateTime,
      participantsCount,
      submissionId: submission.id,
      locale,
    },
  });

  await sendTelegram({
    tag: "INTERVENTION",
    body: `Nouvelle réservation ${interventionType}\n• Date : ${parsed.data.date} ${parsed.data.time}\n• Participants : ${participantsCount}\n• Contact : ${parsed.data.contact} (\`${parsed.data.email}\`)\n• Locale : ${locale}\n• ID : \`${booking.id}\``,
  });

  await enqueueEmail("booking-confirmed", parsed.data.email, locale, {
    contactName: parsed.data.contact,
    bookingDate: parsed.data.date,
    bookingTime: parsed.data.time,
    interventionType,
    participantsCount,
    bookingId: booking.id,
  });

  return { ok: true, bookingId: booking.id };
}

// ============================================================
// postOption48hAction — verrou pessimiste sur calendar_slot
// ============================================================

export async function postOption48hAction(
  _prev: Option48hState,
  formData: FormData,
): Promise<Option48hState> {
  const ip = await getClientIp();
  const rl = await checkRateLimit(`option48h:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de tentatives.", reason: "rate_limit" };
  }

  if (formData.get("website")) {
    return { ok: true, optionId: "", expiresAt: new Date(0).toISOString() };
  }

  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué.", reason: "captcha" };
  }

  const slotId = formData.get("slotId") as string | null;
  const companyName = formData.get("companyName") as string | null;
  const companySector = formData.get("companySector") as string | null;
  const interventionType = (formData.get("interventionType") as InterventionType) ?? "essentielle";
  const participantsCount = Number(formData.get("participantsCount") ?? 1);
  const contactName = formData.get("contactName") as string | null;
  const contactEmail = formData.get("contactEmail") as string | null;
  const contactPhone = formData.get("contactPhone") as string | null;
  const consentDisplay = formData.get("consentDisplay") === "true";
  const locale = ((formData.get("locale") as string) || "fr") as Locale;

  if (!slotId || !companyName || !companySector || !contactName || !contactEmail || !contactPhone) {
    return { ok: false, error: "Champs invalides.", reason: "validation" };
  }

  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verrou pessimiste : SELECT ... FOR UPDATE bloque les autres tx
      // jusqu'au commit/rollback. Postgres serializable level natif.
      const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM calendar_slots
        WHERE id = ${slotId}::uuid
        FOR UPDATE
      `;
      const slot = rows[0];
      if (!slot) {
        throw new Error("slot_unavailable");
      }
      if (slot.status !== "available") {
        throw new Error("slot_taken");
      }

      // Cree l'option + flip slot.status='reserved' atomiquement
      const option = await tx.bookingOption.create({
        data: {
          slotId,
          companyName,
          companySector,
          interventionType,
          participantsCount,
          contactName,
          contactEmail,
          contactPhone,
          consentDisplay,
          locale,
          expiresAt,
        },
      });
      await tx.calendarSlot.update({
        where: { id: slotId },
        data: {
          status: "reserved",
          displaySector: consentDisplay ? companySector : null,
          interventionType,
          participantsCount,
        },
      });
      return option;
    });

    await sendTelegram({
      tag: "OPTION",
      body: `Nouvelle option 48h\n• Société : ${companyName} (${companySector})\n• Intervention : ${interventionType}\n• Participants : ${participantsCount}\n• Contact : ${contactName} (\`${contactEmail}\`)\n• Expire : ${expiresAt.toISOString()}\n• Locale : ${locale}\n• ID : \`${result.id}\``,
    });

    // Lookup slot date pour le payload email (le tx pourrait l'inclure mais
    // on garde la simplicite ici — read commit-after-tx).
    const slot = await prisma.calendarSlot.findUnique({
      where: { id: slotId },
      select: { slotDate: true },
    });
    await enqueueEmail("option-posted", contactEmail, locale, {
      contactName,
      companyName,
      bookingDate: slot?.slotDate.toISOString().slice(0, 10) ?? "",
      interventionType,
      expiresAt: expiresAt.toISOString(),
      optionId: result.id,
    });

    return { ok: true, optionId: result.id, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    const reason = (err as Error).message;
    if (reason === "slot_taken") {
      return { ok: false, error: "Ce créneau vient d'être pris.", reason: "slot_taken" };
    }
    if (reason === "slot_unavailable") {
      return { ok: false, error: "Créneau introuvable.", reason: "slot_unavailable" };
    }
    return { ok: false, error: "Erreur interne.", reason: "validation" };
  }
}
