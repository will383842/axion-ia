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
import { bookingSchema, option48hSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { slugToEnum, getInterventionPriceCents } from "@/lib/intervention-type";

export type BookingState = { ok: true; bookingId: string } | { ok: false; error: string };
export type Option48hState =
  | { ok: true; optionId: string; expiresAt: string }
  | {
      ok: false;
      error: string;
      reason?: "slot_taken" | "slot_unavailable" | "validation" | "rate_limit" | "captcha";
    };

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
    interventionType: formData.get("interventionType"),
    participantsCount: formData.get("participantsCount"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const locale = parseLocale(formData.get("locale"));
  const bookingDateTime = new Date(`${parsed.data.date}T${parsed.data.time}:00.000Z`);
  const interventionTypeEnum = slugToEnum(parsed.data.interventionType);

  // Sprint 15 fix Fork 4 doctrine 9 : derive pricePaidCents via pricing.ts SSOT
  const { cents: pricePaidCents, tierLabel: participantsTier } = getInterventionPriceCents(
    parsed.data.interventionType,
    parsed.data.participantsCount,
  );

  // Sprint 15 fix Fork 1 C2-1 : tx atomique submission + booking pour eviter
  // submissions orphelines (crash entre les 2 statements = data integrity bug).
  const userAgent = (await headers()).get("user-agent") ?? null;
  const companyNameRaw = (formData.get("companyName") as string | null) ?? parsed.data.contact;
  const { booking } = await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: {
        type: "intervention",
        locale,
        companyName: companyNameRaw,
        contactName: parsed.data.contact,
        contactEmail: parsed.data.email,
        contactPhone: parsed.data.phone ?? null,
        details: {
          interventionType: interventionTypeEnum,
          bookingDate: parsed.data.date,
          bookingTime: parsed.data.time,
          participantsCount: parsed.data.participantsCount,
        },
        ipAddress: ip,
        userAgent,
      },
    });
    const b = await tx.booking.create({
      data: {
        interventionType: interventionTypeEnum,
        bookingDate: bookingDateTime,
        participantsCount: parsed.data.participantsCount,
        submissionId: submission.id,
        locale,
        pricePaidCents,
        participantsTier,
      },
    });
    return { submission, booking: b };
  });

  await sendTelegram({
    tag: "INTERVENTION",
    body: `Nouvelle réservation ${interventionTypeEnum}\n• Date : ${parsed.data.date} ${parsed.data.time}\n• Participants : ${parsed.data.participantsCount}\n• Prix : ${pricePaidCents != null ? `${(pricePaidCents / 100).toFixed(0)} € HT` : "sur devis"}\n• Contact : ${parsed.data.contact} (\`${parsed.data.email}\`)\n• Locale : ${locale}\n• ID : \`${booking.id}\``,
  });

  await enqueueEmail("booking-confirmed", parsed.data.email, locale, {
    contactName: parsed.data.contact,
    bookingDate: parsed.data.date,
    bookingTime: parsed.data.time,
    interventionType: interventionTypeEnum,
    participantsCount: parsed.data.participantsCount,
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

  // Sprint 15 fix Fork 2 C3-2 : validation Zod stricte avec consentRgpd obligatoire
  const parsed = option48hSchema.safeParse({
    slotId: formData.get("slotId"),
    companyName: formData.get("companyName"),
    companySector: formData.get("companySector"),
    participantsCount: formData.get("participantsCount"),
    interventionType: formData.get("interventionType"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    consentDisplay: formData.get("consentDisplay"),
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides.", reason: "validation" };
  }
  const locale = parseLocale(formData.get("locale"));
  const interventionTypeEnum = slugToEnum(parsed.data.interventionType);
  const consentDisplay = parsed.data.consentDisplay === true;

  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

  try {
    // Sprint 15 fix Fork 3 W4-3 : on inclut slotDate dans le SELECT verrou
    // pour eviter un round-trip post-tx (et pour resilience si suppression).
    const result = await prisma.$transaction(async (tx) => {
      // Verrou pessimiste : SELECT ... FOR UPDATE bloque les autres tx
      // jusqu'au commit/rollback. Postgres serializable level natif.
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; slot_date: Date }>>`
        SELECT id, status, slot_date FROM calendar_slots
        WHERE id = ${parsed.data.slotId}::uuid
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
          slotId: parsed.data.slotId,
          companyName: parsed.data.companyName,
          companySector: parsed.data.companySector,
          interventionType: interventionTypeEnum,
          participantsCount: parsed.data.participantsCount,
          contactName: parsed.data.contactName,
          contactEmail: parsed.data.contactEmail,
          contactPhone: parsed.data.contactPhone,
          consentDisplay,
          locale,
          expiresAt,
        },
      });
      await tx.calendarSlot.update({
        where: { id: parsed.data.slotId },
        data: {
          status: "reserved",
          displaySector: consentDisplay ? parsed.data.companySector : null,
          interventionType: interventionTypeEnum,
          participantsCount: parsed.data.participantsCount,
        },
      });
      return { option, slotDate: slot.slot_date };
    });

    await sendTelegram({
      tag: "OPTION",
      body: `Nouvelle option 48h\n• Société : ${parsed.data.companyName} (${parsed.data.companySector})\n• Intervention : ${interventionTypeEnum}\n• Participants : ${parsed.data.participantsCount}\n• Contact : ${parsed.data.contactName} (\`${parsed.data.contactEmail}\`)\n• Expire : ${expiresAt.toISOString()}\n• Locale : ${locale}\n• ID : \`${result.option.id}\``,
    });

    await enqueueEmail("option-posted", parsed.data.contactEmail, locale, {
      contactName: parsed.data.contactName,
      companyName: parsed.data.companyName,
      bookingDate: result.slotDate.toISOString().slice(0, 10),
      interventionType: interventionTypeEnum,
      participantsCount: parsed.data.participantsCount,
      expiresAt: expiresAt.toISOString(),
      optionId: result.option.id,
    });

    return { ok: true, optionId: result.option.id, expiresAt: expiresAt.toISOString() };
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
