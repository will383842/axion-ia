"use server";
// Server Actions admin — PaymentScheduleProfile + BookingPaymentSchedule override
// (Sprint C — UI admin échéanciers).
//
// SOURCE :
//   - 03-ARCHITECTURE-CIBLE.md §5.14 (échéanciers 4 profils + override booking)
//   - Spec D40 grille SSOT seuils tiny/small/medium/large
//
// SCOPE V1
//   - upsertPaymentScheduleProfileAction — CRUD profile + validate installments JSON
//   - archivePaymentScheduleProfileAction — soft-delete (archivedAt non-null)
//   - overrideBookingPaymentScheduleAction — snapshot custom sur 1 booking
//   - listPaymentScheduleProfilesAction — wrapper read pour Server Components

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client";

// ====================================================================
// Auth helpers
// ====================================================================

type AdminContext = { userId: string; role: "super_admin" | "admin" | "editor" | "reader" };

async function requireSuperAdmin(): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role as AdminContext["role"] | undefined;
  if (!role) throw new Error("forbidden");
  if (role !== "super_admin") throw new Error("forbidden");
  return { userId: session.user.id, role };
}

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

// ====================================================================
// Validation schema installments
// ====================================================================

/**
 * Une tranche d'échéancier dans PaymentScheduleProfile.installments :
 *   percentage      : pourcentage du montant total (somme = 100)
 *   dueOffsetDays   : jours depuis dueRelativeTo
 *   dueRelativeTo   : "validation" | "j-7" | "j+30" | "booking_date"
 *   description     : libellé human-readable (ex: "Acompte à validation")
 */
const installmentSchema = z.object({
  percentage: z.number().min(0.01).max(100),
  dueOffsetDays: z.number().int(),
  dueRelativeTo: z.enum(["validation", "j-7", "j+30", "booking_date"]),
  description: z.string().min(1).max(120),
});
const installmentsArraySchema = z.array(installmentSchema).min(1).max(10);

function validateInstallmentsSum(installments: z.infer<typeof installmentsArraySchema>): boolean {
  const sum = installments.reduce((acc, t) => acc + t.percentage, 0);
  // Tolérance arrondi 0.5 % (ex: 33.33 / 33.33 / 33.34)
  return Math.abs(sum - 100) < 0.5;
}

// ====================================================================
// upsertPaymentScheduleProfileAction
// ====================================================================

const upsertSchema = z.object({
  /** Si présent → update, sinon → create. */
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_-]+$/i, "slug doit être [a-z0-9_-]"),
  installmentsJson: z.string(),
  thresholdMinCents: z.number().int().nonnegative().optional(),
  thresholdMaxCents: z.number().int().nonnegative().optional(),
  isDefault: z.boolean().default(false),
});

export type UpsertProfileResult =
  | { ok: true; profileId: string; slug: string }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "forbidden"
        | "invalid_input"
        | "invalid_installments_json"
        | "invalid_installments_shape"
        | "installments_sum_not_100"
        | "slug_taken"
        | "internal_error";
    };

export async function upsertPaymentScheduleProfileAction(
  input: z.input<typeof upsertSchema>,
): Promise<UpsertProfileResult> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    return authError(err) as UpsertProfileResult;
  }

  // Parse + valide installments
  let parsedInstallments: z.infer<typeof installmentsArraySchema>;
  try {
    const raw = JSON.parse(parsed.data.installmentsJson);
    const parsedIns = installmentsArraySchema.safeParse(raw);
    if (!parsedIns.success) return { ok: false, error: "invalid_installments_shape" };
    parsedInstallments = parsedIns.data;
  } catch {
    return { ok: false, error: "invalid_installments_json" };
  }

  if (!validateInstallmentsSum(parsedInstallments)) {
    return { ok: false, error: "installments_sum_not_100" };
  }

  try {
    const data = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      installments: parsedInstallments as unknown as Prisma.InputJsonValue,
      ...(parsed.data.thresholdMinCents !== undefined
        ? { thresholdMinCents: parsed.data.thresholdMinCents }
        : {}),
      ...(parsed.data.thresholdMaxCents !== undefined
        ? { thresholdMaxCents: parsed.data.thresholdMaxCents }
        : {}),
      isDefault: parsed.data.isDefault,
    };

    let profile;
    if (parsed.data.id) {
      profile = await prisma.paymentScheduleProfile.update({
        where: { id: parsed.data.id },
        data,
        select: { id: true, slug: true },
      });
    } else {
      profile = await prisma.paymentScheduleProfile.create({
        data,
        select: { id: true, slug: true },
      });
    }

    // Audit log
    await prisma.activityLog.create({
      data: {
        adminUserId: admin.userId,
        action: parsed.data.id ? "payment_schedule.update" : "payment_schedule.create",
        targetType: "payment_schedule_profile",
        targetId: profile.id,
        changes: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          installmentsCount: parsedInstallments.length,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/echeanciers`);

    return { ok: true, profileId: profile.id, slug: profile.slug };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return { ok: false, error: "slug_taken" };
    console.error("[upsertPaymentScheduleProfileAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ====================================================================
// archivePaymentScheduleProfileAction
// ====================================================================

const archiveSchema = z.object({ profileId: z.string().uuid() });

export async function archivePaymentScheduleProfileAction(
  input: z.input<typeof archiveSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    return authError(err);
  }

  try {
    await prisma.paymentScheduleProfile.update({
      where: { id: parsed.data.profileId },
      data: { archivedAt: new Date(), isDefault: false },
    });
    await prisma.activityLog.create({
      data: {
        adminUserId: admin.userId,
        action: "payment_schedule.archive",
        targetType: "payment_schedule_profile",
        targetId: parsed.data.profileId,
      },
    });
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/echeanciers`);
    return { ok: true };
  } catch (err) {
    console.error("[archivePaymentScheduleProfileAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ====================================================================
// overrideBookingPaymentScheduleAction (C3)
// ====================================================================

const overrideSchema = z.object({
  bookingId: z.string().uuid(),
  /** JSON array `[{percentage, dueOffsetDays, dueRelativeTo, description}]`. */
  customInstallmentsJson: z.string(),
  reason: z.string().min(10).max(500),
});

export type OverrideScheduleResult =
  | { ok: true; scheduleId: string }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "forbidden"
        | "invalid_input"
        | "invalid_installments_json"
        | "invalid_installments_shape"
        | "installments_sum_not_100"
        | "booking_not_found"
        | "internal_error";
    };

export async function overrideBookingPaymentScheduleAction(
  input: z.input<typeof overrideSchema>,
): Promise<OverrideScheduleResult> {
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdminWrite();
  } catch (err) {
    return authError(err) as OverrideScheduleResult;
  }

  let parsedInstallments: z.infer<typeof installmentsArraySchema>;
  try {
    const raw = JSON.parse(parsed.data.customInstallmentsJson);
    const validated = installmentsArraySchema.safeParse(raw);
    if (!validated.success) return { ok: false, error: "invalid_installments_shape" };
    parsedInstallments = validated.data;
  } catch {
    return { ok: false, error: "invalid_installments_json" };
  }

  if (!validateInstallmentsSum(parsedInstallments)) {
    return { ok: false, error: "installments_sum_not_100" };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: { id: true },
    });
    if (!booking) return { ok: false, error: "booking_not_found" };

    // Upsert (1 schedule par booking — bookingId @unique)
    const schedule = await prisma.bookingPaymentSchedule.upsert({
      where: { bookingId: parsed.data.bookingId },
      create: {
        bookingId: parsed.data.bookingId,
        profileId: null, // override custom = pas de profile parent
        installments: parsedInstallments as unknown as Prisma.InputJsonValue,
        overrideReason: parsed.data.reason,
      },
      update: {
        profileId: null,
        installments: parsedInstallments as unknown as Prisma.InputJsonValue,
        overrideReason: parsed.data.reason,
      },
      select: { id: true },
    });

    await prisma.activityLog.create({
      data: {
        adminUserId: admin.userId,
        action: "booking_payment_schedule.override",
        targetType: "booking",
        targetId: parsed.data.bookingId,
        changes: {
          installmentsCount: parsedInstallments.length,
          reason: parsed.data.reason,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    revalidatePath(
      `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/reservations/${parsed.data.bookingId}`,
    );
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/echeanciers`);

    return { ok: true, scheduleId: schedule.id };
  } catch (err) {
    console.error("[overrideBookingPaymentScheduleAction]", err);
    return { ok: false, error: "internal_error" };
  }
}
