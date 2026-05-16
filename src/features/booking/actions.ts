// Booking — Server Actions (Sprint 15 / M8 + Sprint X.4 final V1 refactor).
//
// 2 actions :
//  - createBookingAction : réservation directe parcours A (V1 deposit-gated).
//    Le visiteur crée une pré-réservation en `option_pending` ; l'admin
//    poursuit le cycle (cadrage → contrat → acompte → calendar validation).
//  - postOption48hAction : pose une option 48h sur un slot (verrou pessimiste
//    Postgres SELECT ... FOR UPDATE — doctrine doc 09b + ADR 0017 cap).
//
// Le verrou pessimiste empêche la race condition « 2 visiteurs réservent
// le même slot en simultané » : la première transaction lock la ligne
// calendar_slots, vérifie status='available', insert BookingOption + flip
// slot.status='reserved' atomiquement. La 2e transaction attend, voit
// status='reserved' et échoue → page /reserver?error=slot_taken côté UI.

"use server";

import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { bookingSchema, option48hSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { redactContactLine } from "@/lib/pii-redaction";
import { encryptPii } from "@/lib/pii-crypto";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { slugToEnum, getInterventionPriceCents } from "@/lib/intervention-type";
import { readUtmCookie, UTM_COOKIE_NAME, type UtmParams } from "@/lib/utm";
import { REFERRER_CITY_COOKIE_NAME } from "@/lib/pseo-referrer";
import { countActiveOptionsForSlot, getMaxConcurrentOptionsPerSlot } from "./option-cap";

/**
 * Lecture cookies funnel (UTM + referrerCity pSEO) — Sprint X.18.
 * Best-effort : si cookie absent ou corrompu, retourne objet vide (les
 * Server Actions persistent quand même la Submission sans attribution).
 */
async function readFunnelAttribution(): Promise<{
  utm?: UtmParams;
  referrerCity?: string;
}> {
  try {
    const c = await cookies();
    const utmRaw = c.get(UTM_COOKIE_NAME)?.value;
    const referrerCityRaw = c.get(REFERRER_CITY_COOKIE_NAME)?.value;
    const utm = utmRaw ? readUtmCookie(utmRaw) : undefined;
    const out: { utm?: UtmParams; referrerCity?: string } = {};
    if (utm && Object.keys(utm).length > 0) out.utm = utm;
    if (referrerCityRaw && referrerCityRaw.length > 0 && referrerCityRaw.length <= 120) {
      out.referrerCity = referrerCityRaw;
    }
    return out;
  } catch {
    return {};
  }
}

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

  // Méta-cert 2026-05-15 AGENT 12 P0 OWASP A04 — idempotency anti double-submit.
  // Le client génère un UUID v4 au mount du formulaire (`BookingForm`).
  // Si un Booking existe déjà avec cette clé → retourne l'existant SANS recréer
  // (zéro double email, zéro double Telegram, zéro double Stripe). Si la clé
  // est absente (compat legacy / requête manuelle) → flow normal.
  const rawIdempotencyKey = formData.get("idempotencyKey");
  const idempotencyKey =
    typeof rawIdempotencyKey === "string" && rawIdempotencyKey.length > 0
      ? rawIdempotencyKey.slice(0, 64)
      : null;
  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (existing) return { ok: true, bookingId: existing.id };
  }

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
  // P0-3 fix : on persiste les champs social proof reçus depuis BookingCalendar
  // pour qu'ils soient lisibles par /reserver/page.tsx::loadDbBookedSlots.
  const companySectorRaw = (formData.get("companySector") as string | null) ?? null;
  const companyCityRaw = (formData.get("companyCity") as string | null) ?? null;
  const companySizeRaw = (formData.get("companySize") as string | null) ?? null;
  const contactRoleRaw = (formData.get("contactRole") as string | null) ?? null;
  const notesRaw = (formData.get("notes") as string | null) ?? null;
  // Sprint X.18 — attribution funnel (UTM cookie + pSEO referrerCity).
  const funnelAttr = await readFunnelAttribution();
  const { booking } = await prisma.$transaction(async (tx) => {
    // Méta-cert 2026-05-15 AGENT 12 P0 OWASP A02 — PII at-rest encryption.
    // `encryptPii` est passe-through en dev sans clé (warn log) + idempotent
    // (rows déjà chiffrées ne sont pas re-chiffrées). Format `enc:v1:iv:ct:tag`
    // détecté par `decryptPii` aux read sites (booking-crons-worker etc.).
    const submission = await tx.submission.create({
      data: {
        type: "intervention",
        locale,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        companyName: companyNameRaw,
        sector: companySectorRaw,
        address: companyCityRaw,
        employeesCount: companySizeRaw,
        contactName: encryptPii(parsed.data.contact),
        contactRole: contactRoleRaw,
        contactEmail: encryptPii(parsed.data.email) as string,
        contactPhone: encryptPii(parsed.data.phone) ?? null,
        details: {
          interventionType: interventionTypeEnum,
          bookingDate: parsed.data.date,
          bookingTime: parsed.data.time,
          participantsCount: parsed.data.participantsCount,
          ...(companyCityRaw ? { companyCity: companyCityRaw } : {}),
          ...(companySectorRaw ? { companySector: companySectorRaw } : {}),
          ...(notesRaw ? { notes: notesRaw } : {}),
          // Sprint X.18 — funnel attribution (UTM cookie + pSEO referrerCity).
          ...(funnelAttr.utm || funnelAttr.referrerCity
            ? { funnel: funnelAttr as unknown as object }
            : {}),
        } as object,
        ipAddress: ip,
        ipHash: hashIp(ip),
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
        ...(idempotencyKey ? { idempotencyKey } : {}),
        // Sprint X.4 refactor V1 — pré-réservation deposit-gated.
        // L'admin poursuit le flow via admin-actions (cadrage / contract).
        status: "option_pending",
        originPath: "direct",
      },
    });
    // Audit trail state machine (idempotent — UNIQUE bookingId/toStatus/trigger).
    await tx.bookingTransition.create({
      data: {
        bookingId: b.id,
        fromStatus: "draft",
        toStatus: "option_pending",
        trigger: "visitor.create_booking",
        triggeredBy: "user",
      },
    });
    return { submission, booking: b };
  });

  await sendTelegram({
    tag: "INTERVENTION",
    body: `Nouvelle réservation ${interventionTypeEnum}\n• Date : ${parsed.data.date} ${parsed.data.time}\n• Participants : ${parsed.data.participantsCount}\n• Prix : ${pricePaidCents != null ? `${(pricePaidCents / 100).toFixed(0)} € HT` : "sur devis"}\n• Contact : ${redactContactLine(parsed.data.contact, parsed.data.email)}\n• Locale : ${locale}\n• ID : \`${booking.id}\``,
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
    // Sprint X.5 — cap multi-options (ADR 0017). Plusieurs visiteurs peuvent
    // poser une option 48h sur le même slot jusqu'à cap (défaut 3). L'admin
    // choisit ensuite laquelle valider ; les autres deviennent lost_other_won.
    const cap = getMaxConcurrentOptionsPerSlot();
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
      // Slots terminaux (booked, blocked) refusés. Reserved = cap déjà atteint.
      if (slot.status !== "available") {
        throw new Error("slot_taken");
      }

      // Compte les options actives concurrentes (cap multi-options).
      const activeCount = await countActiveOptionsForSlot(tx, parsed.data.slotId);
      if (activeCount >= cap) {
        // État incohérent (slot encore "available" mais cap atteint) → on
        // force le flip pour cohérence future + reject ce visiteur.
        await tx.calendarSlot.update({
          where: { id: parsed.data.slotId },
          data: { status: "reserved" },
        });
        throw new Error("slot_taken");
      }

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

      // Premier option : on enrichit le slot avec sector/intervention/count.
      // Options suivantes : on ne touche pas (affichage = première société
      // qui a posé l'option, V1 simple). Admin UI X.9 affichera toutes les
      // options concurrentes.
      const isFirstOption = activeCount === 0;
      const reachedCap = activeCount + 1 >= cap;
      if (isFirstOption) {
        await tx.calendarSlot.update({
          where: { id: parsed.data.slotId },
          data: {
            ...(reachedCap ? { status: "reserved" } : {}),
            displaySector: consentDisplay ? parsed.data.companySector : null,
            interventionType: interventionTypeEnum,
            participantsCount: parsed.data.participantsCount,
          },
        });
      } else if (reachedCap) {
        await tx.calendarSlot.update({
          where: { id: parsed.data.slotId },
          data: { status: "reserved" },
        });
      }
      return { option, slotDate: slot.slot_date };
    });

    await sendTelegram({
      tag: "OPTION",
      body: `Nouvelle option 48h\n• Société : ${parsed.data.companyName} (${parsed.data.companySector})\n• Intervention : ${interventionTypeEnum}\n• Participants : ${parsed.data.participantsCount}\n• Contact : ${redactContactLine(parsed.data.contactName, parsed.data.contactEmail)}\n• Expire : ${expiresAt.toISOString()}\n• Locale : ${locale}\n• ID : \`${result.option.id}\``,
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
