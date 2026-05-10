// Server Actions admin /options 48h (M9 Tier 1 section 2).
//
// Doctrine doc 09b : options posees par les visiteurs sur slots calendar
// expirent automatiquement apres 48h (cf. option-expiration-worker). Avant
// expiration, l'admin peut :
//  - VALIDER → option.status='confirmed' + cree Booking ferme + email
//    option-confirmed-by-admin + Telegram [OPTION CONFIRMÉE]
//  - REFUSER → option.status='refused' + libere slot + email
//    option-refused-by-admin + Telegram [OPTION REFUSÉE] (tag dédié)

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import { getInterventionPriceCents, enumToSlug } from "@/lib/intervention-type";
import { adminPath } from "@/lib/admin-path";
import type { BookingOptionStatus, Locale } from "../../../prisma/generated/client";

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
// listOptions
// ============================================================

const listOptionsSchema = z.object({
  status: z.enum(["pending", "confirmed", "refused", "expired", "converted", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
export type ListOptionsInput = z.infer<typeof listOptionsSchema>;

export interface OptionListItem {
  id: string;
  status: BookingOptionStatus;
  companyName: string;
  companySector: string;
  contactName: string;
  contactEmail: string;
  participantsCount: number;
  interventionType: string;
  expiresAt: Date;
  reminderSentAt: Date | null;
  createdAt: Date;
  locale: Locale;
  slotDate: Date;
}

export async function listOptionsAction(input: Partial<ListOptionsInput> = {}): Promise<{
  items: OptionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  await requireAdminRead();
  const parsed = listOptionsSchema.parse(input);
  const where = parsed.status === "all" ? {} : { status: parsed.status };

  const [total, raw] = await Promise.all([
    prisma.bookingOption.count({ where }),
    prisma.bookingOption.findMany({
      where,
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      include: { slot: { select: { slotDate: true } } },
    }),
  ]);

  const items: OptionListItem[] = raw.map((o) => ({
    id: o.id,
    status: o.status,
    companyName: o.companyName,
    companySector: o.companySector,
    contactName: o.contactName,
    contactEmail: o.contactEmail,
    participantsCount: o.participantsCount,
    interventionType: o.interventionType,
    expiresAt: o.expiresAt,
    reminderSentAt: o.reminderSentAt,
    createdAt: o.createdAt,
    locale: o.locale,
    slotDate: o.slot.slotDate,
  }));

  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

// ============================================================
// validateOption — devient booking ferme
// ============================================================

const validateSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});
export type ValidateOptionState = { ok: true } | { ok: false; error: string };

export async function validateOptionAction(
  _prev: ValidateOptionState,
  formData: FormData,
): Promise<ValidateOptionState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = validateSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const ip = await getClientIp();

  // Tx : flip option + cree booking + log activity. Tout ou rien.
  // Sprint 15 fix Fork 1 C3-1 : SELECT FOR UPDATE sur la ligne option pour
  // empecher 2 admins de valider la meme option en parallele (race condition
  // → 2 bookings creees, slot @unique sauverait la 2e mais activity log
  // dupliqué + email envoye 2x au visiteur).
  const result = await prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM bookings_options
      WHERE id = ${parsed.data.id}::uuid
      FOR UPDATE
    `;
    if (lockRows.length === 0) throw new Error("option_not_found");
    if (lockRows[0]?.status !== "pending") throw new Error("option_not_pending");

    const opt = await tx.bookingOption.findUnique({
      where: { id: parsed.data.id },
      include: { slot: true },
    });
    if (!opt) throw new Error("option_not_found");

    // Sprint 24+ fix audit 2026-05-10 : verrouille AUSSI la ligne calendar_slots
    // pour éviter qu'un visiteur public pose simultanément une nouvelle option
    // sur le même slot pendant que l'admin valide. Booking.slotId @unique
    // sauverait la 2e insertion, mais on aurait quand même un email visiteur
    // partiellement traité + activity log incohérent. Lock atomique = état
    // serializable garanti.
    await tx.$queryRaw`SELECT id FROM calendar_slots WHERE id = ${opt.slotId}::uuid FOR UPDATE`;

    const interventionSlug = enumToSlug(opt.interventionType);
    const { cents: pricePaidCents, tierLabel: participantsTier } = getInterventionPriceCents(
      interventionSlug,
      opt.participantsCount,
    );

    // Booking ferme (booking.slotId @unique → 1 seul booking par slot)
    const booking = await tx.booking.create({
      data: {
        interventionType: opt.interventionType,
        bookingDate: opt.slot.slotDate,
        participantsCount: opt.participantsCount,
        slotId: opt.slotId,
        locale: opt.locale,
        pricePaidCents,
        participantsTier,
        status: "confirmed",
      },
    });

    // Flip option status
    await tx.bookingOption.update({
      where: { id: parsed.data.id },
      data: {
        status: "converted",
        confirmedAt: new Date(),
        notes: parsed.data.notes ?? null,
      },
    });

    // Activity log
    await tx.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "option.validated",
        targetType: "booking_option",
        targetId: parsed.data.id,
        changes: { bookingId: booking.id },
        ipAddress: ip,
      },
    });

    return { booking, opt };
  });

  // Notifications outside tx (acceptable per audit fork 1 C2 — best-effort)
  await sendTelegram({
    tag: "OPTION CONFIRMÉE",
    body: `Option \`${result.opt.id}\` validée par admin\n• Société : ${result.opt.companyName}\n• Date : ${result.opt.slot.slotDate.toISOString().slice(0, 10)}\n• Booking créé : \`${result.booking.id}\``,
  });

  await enqueueEmail("option-confirmed-by-admin", result.opt.contactEmail, result.opt.locale, {
    contactName: result.opt.contactName,
    bookingDate: result.opt.slot.slotDate.toISOString().slice(0, 10),
    interventionType: result.opt.interventionType,
    bookingId: result.booking.id,
  });

  revalidatePath(adminPath("fr", "options"));
  // Sprint 24 / C1 — la decision admin modifie la dispo cote public.
  revalidatePath("/fr/reserver");
  revalidatePath("/en/book");
  return { ok: true };
}

// ============================================================
// refuseOption — libere slot
// ============================================================

const refuseSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type RefuseOptionState = { ok: true } | { ok: false; error: string };

export async function refuseOptionAction(
  _prev: RefuseOptionState,
  formData: FormData,
): Promise<RefuseOptionState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = refuseSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const ip = await getClientIp();

  const result = await prisma.$transaction(async (tx) => {
    // Sprint 15 fix Fork 1 C3-1 : FOR UPDATE option (race protect)
    const lockRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM bookings_options
      WHERE id = ${parsed.data.id}::uuid
      FOR UPDATE
    `;
    if (lockRows.length === 0) throw new Error("option_not_found");
    if (lockRows[0]?.status !== "pending") throw new Error("option_not_pending");

    const opt = await tx.bookingOption.findUnique({
      where: { id: parsed.data.id },
      include: { slot: true },
    });
    if (!opt) throw new Error("option_not_found");

    // Sprint 15 fix Fork 1 W8-1 : preserve notes existantes si pas de reason
    await tx.bookingOption.update({
      where: { id: parsed.data.id },
      data: {
        status: "refused",
        notes: parsed.data.reason ?? opt.notes,
      },
    });

    // Libere le slot s'il n'est pas deja pris par autre option/booking
    const otherOption = await tx.bookingOption.findFirst({
      where: {
        slotId: opt.slotId,
        status: { in: ["pending", "confirmed"] },
        NOT: { id: opt.id },
      },
      select: { id: true },
    });
    const hasBooking = await tx.booking.findFirst({
      where: { slotId: opt.slotId },
      select: { id: true },
    });
    if (!otherOption && !hasBooking && opt.slot.status === "reserved") {
      await tx.calendarSlot.update({
        where: { id: opt.slotId },
        data: {
          status: "available",
          displaySector: null,
          interventionType: null,
          participantsCount: null,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "option.refused",
        targetType: "booking_option",
        targetId: parsed.data.id,
        changes: { reason: parsed.data.reason ?? null },
        ipAddress: ip,
      },
    });
    return opt;
  });

  await sendTelegram({
    tag: "OPTION REFUSÉE",
    body: `Option \`${result.id}\` refusée par admin\n• Société : ${result.companyName}\n• Date : ${result.slot.slotDate.toISOString().slice(0, 10)}${parsed.data.reason ? `\n• Motif : ${parsed.data.reason}` : ""}`,
  });

  await enqueueEmail("option-refused-by-admin", result.contactEmail, result.locale, {
    contactName: result.contactName,
    bookingDate: result.slot.slotDate.toISOString().slice(0, 10),
    interventionType: result.interventionType,
    reason: parsed.data.reason,
  });

  revalidatePath(adminPath("fr", "options"));
  // Sprint 24 / C1 — la decision admin libère le slot cote public.
  revalidatePath("/fr/reserver");
  revalidatePath("/en/book");
  return { ok: true };
}

// ============================================================
// getOptionDetail
// ============================================================

const getOptionDetailSchema = z.object({ id: z.string().uuid() });

export async function getOptionDetailAction(id: string) {
  await requireAdminRead();
  // Sprint 24+ fix audit 2026-05-10 : valide UUID avant Prisma findUnique.
  // Sans Zod, un id non-UUID pouvait remonter une PrismaClientValidationError
  // au lieu d'un return null clean — friction debug + risque d'expose du
  // code interne dans les logs publics.
  const parsed = getOptionDetailSchema.safeParse({ id });
  if (!parsed.success) return null;
  return prisma.bookingOption.findUnique({
    where: { id: parsed.data.id },
    include: { slot: true },
  });
}
