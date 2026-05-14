"use server";
// Server Actions admin Factures V1 (Sprint X.10).
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.10 § « Périmètre — Server Actions »
//   - 03-ARCHITECTURE-CIBLE.md §5.1.6 (model Invoice)
//   - Agent 11 P0-1 à P0-7 (numérotation immuable + archivage 10 ans)
//
// SCOPE V1 livré ici
//   - issueInvoiceFromBookingAction(bookingId, type=deposit|balance) — crée
//     l'Invoice atomique avec numérotation `AXION-YYYY-NNNN` + legalSnapshot
//     + archivedUntil = +10 ans
//   - markInvoicePaidManuallyAction(invoiceId, amount, paidAt, mode, reference)
//     — saisie virement/chèque/cash + crée Payment + audit log
//   - issueCreditNoteAction(invoiceId, reason, amount) — avoir lié à facture
//     existante
//
// HORS SCOPE V1 (X.10b)
//   - PDF react-pdf rendering (`pdfUrl` reste null V1, hash null)
//   - Stripe Checkout session auto-créée à issue
//   - Cron booking-j7-balance-invoice (X.12)
//
// CONTRAT : toutes les writes Invoice/Payment passent par une transaction
// atomique qui acquiert pg_advisory_xact_lock pour la numérotation.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { captureLegalSnapshot } from "@/lib/legal-snapshot";
import { nextInvoiceNumber } from "@/lib/invoice-numbering";
import type { Prisma, InvoiceType, PaymentProvider } from "../../../prisma/generated/client";

export type IssueInvoiceErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_input"
  | "booking_not_found"
  | "missing_amount"
  | "duplicate_invoice"
  | "internal_error";

export type IssueInvoiceResult =
  | { ok: true; invoiceId: string; number: string }
  | { ok: false; error: IssueInvoiceErrorCode };

class AdminAuthError extends Error {
  readonly code: "unauthorized" | "forbidden";
  constructor(code: "unauthorized" | "forbidden") {
    super(code);
    this.code = code;
  }
}

async function requireAdminWrite(): Promise<{ userId: string; role: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new AdminAuthError("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") throw new AdminAuthError("forbidden");
  return { userId: session.user.id, role };
}

function toError(err: unknown): IssueInvoiceErrorCode {
  if (err instanceof AdminAuthError) return err.code;
  console.error("[invoice-admin-actions]", err);
  return "internal_error";
}

// ────────────────────────────────────────────────────────────────────
// issueInvoiceFromBookingAction — deposit | balance
// ────────────────────────────────────────────────────────────────────

const issueSchema = z.object({
  bookingId: z.string().uuid(),
  type: z.enum(["deposit", "balance", "full"]),
});

export async function issueInvoiceFromBookingAction(
  input: z.input<typeof issueSchema>,
): Promise<IssueInvoiceResult> {
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  try {
    await requireAdminWrite();
  } catch (err) {
    return { ok: false, error: toError(err) };
  }

  const { bookingId, type } = parsed.data;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        locale: true,
        basePriceHtCents: true,
        depositAmountCents: true,
        balanceAmountCents: true,
        travelFeeCents: true,
        accommodationFeeCents: true,
        mealFeeCents: true,
        additionalFeesCents: true,
        additionalFeesNotes: true,
        submission: { select: { companyName: true, contactEmail: true, address: true } },
        fromSubmission: { select: { companyName: true, contactEmail: true, address: true } },
      },
    });
    if (!booking) return { ok: false, error: "booking_not_found" };

    // Compute amount depending on type. V1 simple : deposit/balance/full.
    let amountHtCents: number | null = null;
    if (type === "deposit") {
      amountHtCents = booking.depositAmountCents ?? null;
    } else if (type === "balance") {
      amountHtCents = booking.balanceAmountCents ?? null;
    } else if (type === "full") {
      const base = booking.basePriceHtCents ?? 0;
      amountHtCents =
        base +
        booking.travelFeeCents +
        booking.accommodationFeeCents +
        booking.mealFeeCents +
        booking.additionalFeesCents;
      if (amountHtCents === 0) amountHtCents = null;
    }
    if (!amountHtCents || amountHtCents <= 0) return { ok: false, error: "missing_amount" };

    // Anti-doublon : si une facture deposit/balance existe déjà non annulée,
    // on refuse l'émission V1 (V1.5+ : versioning / re-emission).
    const existing = await prisma.invoice.findFirst({
      where: { bookingId, type: type as InvoiceType, status: { notIn: ["cancelled", "void"] } },
      select: { id: true },
    });
    if (existing) return { ok: false, error: "duplicate_invoice" };

    const legalSnapshot = await captureLegalSnapshot();
    const issuedAt = new Date();
    const archivedUntil = new Date(issuedAt);
    archivedUntil.setFullYear(archivedUntil.getFullYear() + 10);

    const result = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, issuedAt.getFullYear());

      const vatRateRaw = legalSnapshot.vatRate ?? 0;
      const vatRate = new (await import("../../../prisma/generated/client")).Prisma.Decimal(
        vatRateRaw,
      );
      const amountTtcCents = legalSnapshot.vatReverseCharge
        ? amountHtCents!
        : Math.round(amountHtCents! * (1 + vatRateRaw / 100));

      const invoice = await tx.invoice.create({
        data: {
          number,
          bookingId,
          type: type as InvoiceType,
          basePriceHtCents: booking.basePriceHtCents ?? amountHtCents!,
          travelFeeCents: booking.travelFeeCents,
          accommodationFeeCents: booking.accommodationFeeCents,
          mealFeeCents: booking.mealFeeCents,
          additionalFeesCents: booking.additionalFeesCents,
          ...(booking.additionalFeesNotes
            ? { additionalFeesNotes: booking.additionalFeesNotes }
            : {}),
          amountHtCents: amountHtCents!,
          vatRate,
          vatReverseCharge: legalSnapshot.vatReverseCharge,
          vatMention: legalSnapshot.vatMention,
          amountTtcCents,
          ...(type === "deposit" ? { depositExpectedCents: amountHtCents! } : {}),
          ...(type === "balance" ? { balanceExpectedCents: amountHtCents! } : {}),
          issuedAt,
          status: "issued",
          archivedUntil,
          payerType: "client",
          ...(booking.fromSubmission?.companyName
            ? { payerName: booking.fromSubmission.companyName }
            : booking.submission?.companyName
              ? { payerName: booking.submission.companyName }
              : {}),
          ...(booking.fromSubmission?.contactEmail
            ? { payerEmail: booking.fromSubmission.contactEmail }
            : booking.submission?.contactEmail
              ? { payerEmail: booking.submission.contactEmail }
              : {}),
          ...(booking.fromSubmission?.address
            ? { payerAddress: booking.fromSubmission.address }
            : booking.submission?.address
              ? { payerAddress: booking.submission.address }
              : {}),
          locale: booking.locale,
          legalSnapshot: legalSnapshot as unknown as Prisma.InputJsonValue,
        },
      });
      return invoice;
    });

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/factures`);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/factures/${result.id}`);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/reservations/${bookingId}`);

    return { ok: true, invoiceId: result.id, number: result.number };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

// ────────────────────────────────────────────────────────────────────
// markInvoicePaidManuallyAction — virement / chèque / cash
// ────────────────────────────────────────────────────────────────────

const manualPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  paidAt: z.string().datetime(),
  mode: z.enum(["manual_wire", "manual_check", "manual_cash"]),
  reference: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export type ManualPaymentResult =
  | { ok: true; paymentId: string }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "forbidden"
        | "invalid_input"
        | "invoice_not_found"
        | "internal_error";
    };

export async function markInvoicePaidManuallyAction(
  input: z.input<typeof manualPaymentSchema>,
): Promise<ManualPaymentResult> {
  const parsed = manualPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let userId: string;
  try {
    const ctx = await requireAdminWrite();
    userId = ctx.userId;
  } catch (err) {
    if (err instanceof AdminAuthError) return { ok: false, error: err.code };
    return { ok: false, error: "internal_error" };
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: parsed.data.invoiceId },
      select: {
        id: true,
        bookingId: true,
        amountTtcCents: true,
        status: true,
      },
    });
    if (!invoice) return { ok: false, error: "invoice_not_found" };

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          bookingId: invoice.bookingId,
          invoiceId: invoice.id,
          provider: parsed.data.mode as PaymentProvider,
          amountCents: parsed.data.amountCents,
          currency: "EUR",
          type: "deposit", // V1 transitoire — TODO X.11 logique deposit/tranche/balance
          status: "succeeded",
          paidAt: new Date(parsed.data.paidAt),
          ...(parsed.data.reference ? { receivedReference: parsed.data.reference } : {}),
          ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
          mode:
            parsed.data.mode === "manual_wire"
              ? "sepa_credit_transfer"
              : parsed.data.mode === "manual_check"
                ? "cheque"
                : "cash",
          recordedByAdminId: userId,
        },
      });

      // Update invoice status — paid si montant total atteint, partially_paid sinon.
      const sumRow = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, status: "succeeded" },
        _sum: { amountCents: true },
      });
      const paidTotal = sumRow._sum.amountCents ?? 0;
      const newStatus = paidTotal >= invoice.amountTtcCents ? "paid" : "partially_paid";

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
          ...(newStatus === "paid" ? { paidAt: new Date(parsed.data.paidAt) } : {}),
        },
      });

      // Audit log.
      await tx.activityLog.create({
        data: {
          adminUserId: userId,
          action: "invoice.mark_paid_manual",
          targetType: "invoice",
          targetId: invoice.id,
          changes: {
            mode: parsed.data.mode,
            amountCents: parsed.data.amountCents,
            ...(parsed.data.reference ? { reference: parsed.data.reference } : {}),
            paidAt: parsed.data.paidAt,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return p;
    });

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/factures/${invoice.id}`);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/paiements`);
    revalidatePath(
      `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/reservations/${invoice.bookingId}`,
    );

    return { ok: true, paymentId: payment.id };
  } catch (err) {
    console.error("[markInvoicePaidManuallyAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ────────────────────────────────────────────────────────────────────
// issueCreditNoteAction — avoir lié à facture existante
// ────────────────────────────────────────────────────────────────────

const creditNoteSchema = z.object({
  originalInvoiceId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reason: z.string().min(10).max(500),
});

export type CreditNoteResult =
  | { ok: true; creditNoteId: string; number: string }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "forbidden"
        | "invalid_input"
        | "invoice_not_found"
        | "internal_error";
    };

export async function issueCreditNoteAction(
  input: z.input<typeof creditNoteSchema>,
): Promise<CreditNoteResult> {
  const parsed = creditNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let userId: string;
  try {
    const ctx = await requireAdminWrite();
    userId = ctx.userId;
  } catch (err) {
    if (err instanceof AdminAuthError) return { ok: false, error: err.code };
    return { ok: false, error: "internal_error" };
  }

  try {
    const original = await prisma.invoice.findUnique({
      where: { id: parsed.data.originalInvoiceId },
      select: {
        id: true,
        bookingId: true,
        basePriceHtCents: true,
        travelFeeCents: true,
        accommodationFeeCents: true,
        mealFeeCents: true,
        additionalFeesCents: true,
        additionalFeesNotes: true,
        vatRate: true,
        vatReverseCharge: true,
        vatMention: true,
        legalSnapshot: true,
        locale: true,
        payerName: true,
        payerEmail: true,
        payerAddress: true,
        payerType: true,
      },
    });
    if (!original) return { ok: false, error: "invoice_not_found" };

    const issuedAt = new Date();
    const archivedUntil = new Date(issuedAt);
    archivedUntil.setFullYear(archivedUntil.getFullYear() + 10);

    const result = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, issuedAt.getFullYear());
      const amountTtcCents = original.vatReverseCharge
        ? parsed.data.amountCents
        : Math.round(parsed.data.amountCents * (1 + Number(original.vatRate) / 100));

      const creditNote = await tx.invoice.create({
        data: {
          number,
          bookingId: original.bookingId,
          type: "credit_note",
          basePriceHtCents: 0,
          travelFeeCents: 0,
          accommodationFeeCents: 0,
          mealFeeCents: 0,
          additionalFeesCents: 0,
          additionalFeesNotes: parsed.data.reason,
          amountHtCents: -Math.abs(parsed.data.amountCents),
          vatRate: original.vatRate,
          vatReverseCharge: original.vatReverseCharge,
          ...(original.vatMention ? { vatMention: original.vatMention } : {}),
          amountTtcCents: -Math.abs(amountTtcCents),
          issuedAt,
          status: "issued",
          archivedUntil,
          payerType: original.payerType,
          ...(original.payerName ? { payerName: original.payerName } : {}),
          ...(original.payerEmail ? { payerEmail: original.payerEmail } : {}),
          ...(original.payerAddress ? { payerAddress: original.payerAddress } : {}),
          locale: original.locale,
          legalSnapshot: original.legalSnapshot as Prisma.InputJsonValue,
          creditNoteOfId: original.id,
        },
      });

      await tx.activityLog.create({
        data: {
          adminUserId: userId,
          action: "invoice.issue_credit_note",
          targetType: "invoice",
          targetId: creditNote.id,
          changes: {
            originalInvoiceId: original.id,
            amountCents: parsed.data.amountCents,
            reason: parsed.data.reason,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return creditNote;
    });

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/factures`);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/factures/${result.id}`);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/factures/${original.id}`);

    return { ok: true, creditNoteId: result.id, number: result.number };
  } catch (err) {
    console.error("[issueCreditNoteAction]", err);
    return { ok: false, error: "internal_error" };
  }
}
