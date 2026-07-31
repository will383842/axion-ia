"use server";
// Server Actions admin Contrats DocuSeal (Sprint X.3 — Booking V1).
//
// SOURCE :
//   - 03-ARCHITECTURE-CIBLE.md §5.2.2 (A1, A21, A22)
//   - 04-PLAN-EXECUTION Sprint X.3 + X.4 + X.7
//   - Helper DocuSeal `createContractSubmission` (séquentiel client → axionia)
//
// SCOPE V1 livré
//   A1   sendContractAndDepositRequestAction (clic Will 1 D49) :
//        contract_pending|option_pending|cadrage_held|quote_signed
//          → contract_payment_sent
//        - crée Invoice deposit
//        - crée ContractDocument + DocuSeal submission
//        - crée Stripe Checkout session pour l'acompte
//        - envoie email payment-link au client
//        - applyTransition + audit log
//   A21  cancelAndReissueContractAction (D62 — avant signature) :
//        annule submission DocuSeal courante + crée v2 incrémenté
//   A22  createContractAddendumAction (D62 — après signature) :
//        crée un ContractDocument séparé (isAddendum=true)
//
// CONTRAT
//   - Toutes les writes (Invoice + Contract + Booking) sont dans une
//     transaction Prisma atomique
//   - Side-effects externes (DocuSeal API, Stripe, email queue) hors transac
//   - Audit log immuable via ActivityLog

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { captureLegalSnapshot } from "@/lib/legal-snapshot";
import { nextInvoiceNumber } from "@/lib/invoice-numbering";
import { createContractSubmission, archiveSubmission, isDocusealConfigured } from "@/lib/docuseal";
import {
  applyTransition,
  StateMachineError,
  type ApplyTransitionOptions,
} from "@/features/booking/state-machine";
import { createStripeCheckoutSessionAction } from "@/features/payment/actions";
import { enqueueEmail } from "@/server/queue/queues";
import type { Prisma, BookingStatus } from "../../../prisma/generated/client";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";

// ====================================================================
// Helpers auth + résultats
// ====================================================================

type AdminContext = { userId: string; role: "super_admin" | "admin" | "editor" | "reader" };

class AdminAuthError extends Error {
  readonly code: "unauthorized" | "forbidden";
  constructor(code: "unauthorized" | "forbidden") {
    super(code);
    this.code = code;
  }
}

async function requireAdminWrite(): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) throw new AdminAuthError("unauthorized");
  const role = (session.user as { role?: string }).role as AdminContext["role"] | undefined;
  if (!role) throw new AdminAuthError("forbidden");
  if (role !== "super_admin" && role !== "admin") throw new AdminAuthError("forbidden");
  return { userId: session.user.id, role };
}

export type ContractActionErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_input"
  | "booking_not_found"
  | "contract_not_found"
  | "docuseal_not_configured"
  | "docuseal_template_missing"
  | "missing_deposit_amount"
  | "missing_client_email"
  | "transition_not_allowed"
  | "duplicate_active_contract"
  | "contract_not_signed"
  | "contract_already_signed"
  | "internal_error";

export type ContractActionResult =
  | { ok: true; contractDocumentId: string; submissionId: string; invoiceId?: string }
  | { ok: false; error: ContractActionErrorCode };

function authErrorResult(err: unknown): ContractActionResult {
  if (err instanceof AdminAuthError) return { ok: false, error: err.code };
  console.error("[contract-admin-actions]", err);
  return { ok: false, error: "internal_error" };
}

// Set d'états V1 valides pour envoyer un contrat + demander l'acompte.
// Cf. state-machine.ts TRANSITIONS — sources possibles vers contract_payment_sent
// directement ou indirectement.
const VALID_PRE_CONTRACT_STATUSES: BookingStatus[] = [
  "option_pending", // skip cadrage (I3 audit_flash_onsite)
  "cadrage_held", // cas standard post-cadrage
  "quote_signed", // post-devis
  "contract_pending", // intermediate state
];

function adminPrefix(): string {
  return process.env["ADMIN_URL_PREFIX"] ?? "admin";
}

function revalidateBookingPaths(bookingId: string): void {
  const p = adminPrefix();
  revalidatePath(`/fr/${p}`);
  revalidatePath(`/fr/${p}/reservations`);
  revalidatePath(`/fr/${p}/reservations/${bookingId}`);
  revalidatePath(`/fr/${p}/factures`);
}

// ====================================================================
// A1 — sendContractAndDepositRequestAction (D49 clic Will 1)
// ====================================================================

const sendContractSchema = z.object({
  bookingId: z.string().uuid(),
  /** Override montant acompte (cents). Défaut = booking.depositAmountCents. */
  depositAmountCentsOverride: z.number().int().positive().optional(),
  /** Frais accessoires édités par admin (D55). */
  travelFeeCents: z.number().int().nonnegative().optional(),
  accommodationFeeCents: z.number().int().nonnegative().optional(),
  mealFeeCents: z.number().int().nonnegative().optional(),
  additionalFeesCents: z.number().int().nonnegative().optional(),
  additionalFeesNotes: z.string().max(500).optional(),
  /** Tiptap body contrat — snapshot immuable côté ContractDocument. */
  contractBodyTiptap: z.unknown().optional(),
  /** Variables interpolées dans le template DocuSeal. */
  contractVariables: z.record(z.string(), z.string()).optional(),
  /** Notes admin internes (D55). */
  notes: z.string().max(2000).optional(),
});

export async function sendContractAndDepositRequestAction(
  input: z.input<typeof sendContractSchema>,
): Promise<ContractActionResult> {
  const parsed = sendContractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdminWrite();
  } catch (err) {
    return authErrorResult(err);
  }

  if (!isDocusealConfigured()) {
    return { ok: false, error: "docuseal_not_configured" };
  }

  const docusealTemplateIdRaw = process.env["DOCUSEAL_CONTRACT_TEMPLATE_ID"];
  if (!docusealTemplateIdRaw) {
    return { ok: false, error: "docuseal_template_missing" };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: {
        id: true,
        status: true,
        locale: true,
        interventionType: true,
        bookingDate: true,
        basePriceHtCents: true,
        depositAmountCents: true,
        balanceAmountCents: true,
        travelFeeCents: true,
        accommodationFeeCents: true,
        mealFeeCents: true,
        additionalFeesCents: true,
        additionalFeesNotes: true,
        submission: {
          select: {
            companyName: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            address: true,
          },
        },
        fromSubmission: {
          select: {
            companyName: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            address: true,
          },
        },
      },
    });
    if (!booking) return { ok: false, error: "booking_not_found" };

    if (!VALID_PRE_CONTRACT_STATUSES.includes(booking.status)) {
      return { ok: false, error: "transition_not_allowed" };
    }

    // Pas plus d'un contrat actif sur ce booking (D62 — réémission via A21).
    const existingActive = await prisma.contractDocument.findFirst({
      where: {
        bookingId: parsed.data.bookingId,
        status: { in: ["draft", "sent"] },
        isAddendum: false,
      },
      select: { id: true },
    });
    if (existingActive) return { ok: false, error: "duplicate_active_contract" };

    const submission = booking.fromSubmission ?? booking.submission;
    const clientEmail = submission?.contactEmail;
    const clientName = submission?.contactName;
    if (!clientEmail || !clientName) {
      return { ok: false, error: "missing_client_email" };
    }

    const depositAmountCents =
      parsed.data.depositAmountCentsOverride ?? booking.depositAmountCents ?? null;
    if (!depositAmountCents || depositAmountCents <= 0) {
      return { ok: false, error: "missing_deposit_amount" };
    }

    // Frais accessoires édités (D55) ou snapshots existants.
    const travelFeeCents = parsed.data.travelFeeCents ?? booking.travelFeeCents;
    const accommodationFeeCents =
      parsed.data.accommodationFeeCents ?? booking.accommodationFeeCents;
    const mealFeeCents = parsed.data.mealFeeCents ?? booking.mealFeeCents;
    const additionalFeesCents = parsed.data.additionalFeesCents ?? booking.additionalFeesCents;
    const additionalFeesNotes =
      parsed.data.additionalFeesNotes ?? booking.additionalFeesNotes ?? null;

    const legalSnapshot = await captureLegalSnapshot();
    const now = new Date();
    const archivedUntil = new Date(now);
    archivedUntil.setFullYear(archivedUntil.getFullYear() + 10);

    // 🔴 Constaté le 2026-07-27. `?? 0` faisait d'un instantané légal SANS taux
    // une TVA à ZÉRO — silencieusement, sur une facture. Un champ absent n'est
    // pas une exonération : c'est une donnée manquante, et le repli prudent est
    // le taux de droit commun, pas son contraire.
    // Cette pile ne lit PAS `qualiopi.regime_tva` et c'est délibéré (la brancher
    // lui AJOUTERAIT une capacité d'exonération qu'elle n'a pas). Le taux
    // standard est donc écrit ici, depuis le SSOT.
    const vatRateRaw = legalSnapshot.vatRate ?? TAUX_TVA_STANDARD;
    const PrismaRuntime = (await import("../../../prisma/generated/client")).Prisma;
    const vatRateDec = new PrismaRuntime.Decimal(vatRateRaw);
    const amountTtcDeposit = legalSnapshot.vatReverseCharge
      ? depositAmountCents
      : Math.round(depositAmountCents * (1 + vatRateRaw / 100));

    // -- 1. Transaction atomique : Invoice + ContractDocument + transitions DB
    const txResult = await prisma.$transaction(async (tx) => {
      // Update booking avec les fees édités (D55)
      const feesUpdate: Prisma.BookingUncheckedUpdateInput = {
        travelFeeCents,
        accommodationFeeCents,
        mealFeeCents,
        additionalFeesCents,
      };
      if (additionalFeesNotes !== null) feesUpdate.additionalFeesNotes = additionalFeesNotes;
      if (parsed.data.depositAmountCentsOverride) {
        feesUpdate.depositAmountCents = parsed.data.depositAmountCentsOverride;
      }
      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: feesUpdate,
      });

      // Crée Invoice deposit avec numéro atomique
      const invoiceNumber = await nextInvoiceNumber(tx, now.getFullYear());
      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          bookingId: parsed.data.bookingId,
          type: "deposit",
          basePriceHtCents: booking.basePriceHtCents ?? depositAmountCents,
          travelFeeCents,
          accommodationFeeCents,
          mealFeeCents,
          additionalFeesCents,
          ...(additionalFeesNotes ? { additionalFeesNotes } : {}),
          amountHtCents: depositAmountCents,
          vatRate: vatRateDec,
          vatReverseCharge: legalSnapshot.vatReverseCharge,
          vatMention: legalSnapshot.vatMention,
          amountTtcCents: amountTtcDeposit,
          depositExpectedCents: depositAmountCents,
          issuedAt: now,
          status: "issued",
          archivedUntil,
          payerType: "client",
          payerName: submission.companyName,
          payerEmail: clientEmail,
          ...(submission.address ? { payerAddress: submission.address } : {}),
          locale: booking.locale,
          legalSnapshot: legalSnapshot as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, number: true },
      });

      // Crée ContractDocument (draft, sera mis en `sent` après DocuSeal OK)
      const contractBody = (parsed.data.contractBodyTiptap ?? {
        version: "v1-skeleton",
        note: "Contract body Tiptap injectée par admin UI (Sprint X.3b) — V1 transitoire stocke un placeholder.",
      }) as Prisma.InputJsonValue;
      const contract = await tx.contractDocument.create({
        data: {
          bookingId: parsed.data.bookingId,
          provider: "docuseal",
          body: contractBody,
          ...(parsed.data.contractVariables
            ? { variables: parsed.data.contractVariables as Prisma.InputJsonValue }
            : {}),
          status: "draft",
          version: 1,
        },
        select: { id: true },
      });

      // Marque le booking actif sur ce contrat
      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: { contractDocumentId: contract.id },
      });

      return { invoice, contract };
    });

    // -- 2. Side-effects externes (hors transaction)
    // 2a. DocuSeal submission
    const submissionResult = await createContractSubmission({
      templateId: docusealTemplateIdRaw,
      client: {
        email: clientEmail,
        name: clientName,
        ...(submission.contactPhone ? { phone: submission.contactPhone } : {}),
      },
      fields: Object.entries(parsed.data.contractVariables ?? {}).map(([name, value]) => ({
        name,
        default_value: value,
      })),
      metadata: {
        bookingId: parsed.data.bookingId,
        contractDocumentId: txResult.contract.id,
        invoiceId: txResult.invoice.id,
      },
      sendEmail: true,
    });

    // 2b. Update ContractDocument avec providerId + status sent + sentAt
    await prisma.contractDocument.update({
      where: { id: txResult.contract.id },
      data: {
        providerId: submissionResult.submissionId,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // 2c. Stripe Checkout session pour l'acompte
    const checkoutResult = await createStripeCheckoutSessionAction({
      invoiceId: txResult.invoice.id,
    });

    // 2d. Transition state machine + audit log
    await prisma.$transaction(async (tx) => {
      const txOpts: ApplyTransitionOptions = {
        to: "contract_payment_sent",
        trigger: "admin.send_contract_and_deposit_request",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        snapshotBefore: { status: booking.status },
        snapshotAfter: { status: "contract_payment_sent" },
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      };
      await applyTransition(tx, parsed.data.bookingId, txOpts);

      // Audit log explicite admin
      await tx.activityLog.create({
        data: {
          adminUserId: admin.userId,
          action: "contract.send_with_deposit",
          targetType: "booking",
          targetId: parsed.data.bookingId,
          changes: {
            contractDocumentId: txResult.contract.id,
            invoiceId: txResult.invoice.id,
            invoiceNumber: txResult.invoice.number,
            depositAmountCents,
            docusealSubmissionId: submissionResult.submissionId,
            ...(checkoutResult.ok && checkoutResult.url
              ? { stripeCheckoutUrl: checkoutResult.url }
              : { stripeError: checkoutResult.error }),
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    // 2e. Email payment-link au client (fail-soft)
    if (checkoutResult.ok && checkoutResult.url) {
      enqueueEmail("payment-link", clientEmail, booking.locale, {
        contactName: clientName,
        interventionType: booking.interventionType,
        invoiceNumber: txResult.invoice.number,
        amountTtc: amountTtcDeposit,
        checkoutUrl: checkoutResult.url,
        bookingDate: booking.bookingDate.toISOString().slice(0, 10),
        bookingId: parsed.data.bookingId,
      }).catch(() => {
        /* email queue fail-soft */
      });
    }

    revalidateBookingPaths(parsed.data.bookingId);

    return {
      ok: true,
      contractDocumentId: txResult.contract.id,
      submissionId: submissionResult.submissionId,
      invoiceId: txResult.invoice.id,
    };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return { ok: false, error: "transition_not_allowed" };
    }
    console.error("[sendContractAndDepositRequestAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ====================================================================
// A21 — cancelAndReissueContractAction (D62 — AVANT signature)
// ====================================================================

const cancelReissueSchema = z.object({
  contractDocumentId: z.string().uuid(),
  newBodyTiptap: z.unknown(),
  reason: z.string().min(10).max(500),
});

export async function cancelAndReissueContractAction(
  input: z.input<typeof cancelReissueSchema>,
): Promise<ContractActionResult> {
  const parsed = cancelReissueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdminWrite();
  } catch (err) {
    return authErrorResult(err);
  }

  if (!isDocusealConfigured()) {
    return { ok: false, error: "docuseal_not_configured" };
  }

  const docusealTemplateIdRaw = process.env["DOCUSEAL_CONTRACT_TEMPLATE_ID"];
  if (!docusealTemplateIdRaw) {
    return { ok: false, error: "docuseal_template_missing" };
  }

  try {
    const old = await prisma.contractDocument.findUnique({
      where: { id: parsed.data.contractDocumentId },
      select: {
        id: true,
        bookingId: true,
        providerId: true,
        status: true,
        version: true,
        booking: {
          select: {
            submission: { select: { contactEmail: true, contactName: true, contactPhone: true } },
            fromSubmission: {
              select: { contactEmail: true, contactName: true, contactPhone: true },
            },
          },
        },
      },
    });
    if (!old) return { ok: false, error: "contract_not_found" };
    if (old.status === "signed") return { ok: false, error: "contract_already_signed" };

    const sub = old.booking.fromSubmission ?? old.booking.submission;
    if (!sub?.contactEmail || !sub.contactName) {
      return { ok: false, error: "missing_client_email" };
    }

    // 1. Archive old DocuSeal submission (best-effort, fail-soft si déjà supprimée)
    if (old.providerId) {
      await archiveSubmission(old.providerId).catch((e) => {
        console.warn("[cancelAndReissueContractAction] archiveSubmission failed", e);
      });
    }

    // 2. Create new contract document v(N+1) + new DocuSeal submission
    const newContract = await prisma.$transaction(async (tx) => {
      // Mark old as cancelled_admin
      await tx.contractDocument.update({
        where: { id: old.id },
        data: { status: "cancelled_admin" },
      });
      // Insert v(N+1)
      const created = await tx.contractDocument.create({
        data: {
          bookingId: old.bookingId,
          provider: "docuseal",
          body: parsed.data.newBodyTiptap as Prisma.InputJsonValue,
          status: "draft",
          version: old.version + 1,
          previousVersionId: old.id,
        },
        select: { id: true },
      });
      // Update Booking.contractDocumentId to point on new active version
      await tx.booking.update({
        where: { id: old.bookingId },
        data: { contractDocumentId: created.id },
      });
      // Audit log
      await tx.activityLog.create({
        data: {
          adminUserId: admin.userId,
          action: "contract.cancel_and_reissue",
          targetType: "contract_document",
          targetId: created.id,
          changes: {
            previousContractId: old.id,
            previousVersion: old.version,
            newVersion: old.version + 1,
            reason: parsed.data.reason,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return created;
    });

    // 3. Create new DocuSeal submission
    const submissionResult = await createContractSubmission({
      templateId: docusealTemplateIdRaw,
      client: {
        email: sub.contactEmail,
        name: sub.contactName,
        ...(sub.contactPhone ? { phone: sub.contactPhone } : {}),
      },
      metadata: {
        bookingId: old.bookingId,
        contractDocumentId: newContract.id,
        previousContractId: old.id,
        reissueReason: parsed.data.reason,
      },
      sendEmail: true,
    });

    // 4. Update new contract with submissionId
    await prisma.contractDocument.update({
      where: { id: newContract.id },
      data: {
        providerId: submissionResult.submissionId,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // 5. Email client (template contract-version-updated — Sprint X.13)
    enqueueEmail("contract-version-updated", sub.contactEmail, "fr", {
      contactName: sub.contactName,
      reason: parsed.data.reason,
      newVersion: old.version + 1,
      bookingId: old.bookingId,
    }).catch(() => {
      /* fail-soft */
    });

    revalidateBookingPaths(old.bookingId);

    return {
      ok: true,
      contractDocumentId: newContract.id,
      submissionId: submissionResult.submissionId,
    };
  } catch (err) {
    console.error("[cancelAndReissueContractAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ====================================================================
// A22 — createContractAddendumAction (D62 — APRÈS signature)
// ====================================================================

const addendumSchema = z.object({
  bookingId: z.string().uuid(),
  addendumBodyTiptap: z.unknown(),
  reason: z.string().min(10).max(500),
});

export async function createContractAddendumAction(
  input: z.input<typeof addendumSchema>,
): Promise<ContractActionResult> {
  const parsed = addendumSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdminWrite();
  } catch (err) {
    return authErrorResult(err);
  }

  if (!isDocusealConfigured()) {
    return { ok: false, error: "docuseal_not_configured" };
  }

  const docusealTemplateIdRaw = process.env["DOCUSEAL_CONTRACT_TEMPLATE_ID"];
  if (!docusealTemplateIdRaw) {
    return { ok: false, error: "docuseal_template_missing" };
  }

  try {
    // Récupère le contrat signé (s'il existe)
    const signed = await prisma.contractDocument.findFirst({
      where: { bookingId: parsed.data.bookingId, status: "signed", isAddendum: false },
      orderBy: { signedAt: "desc" },
      select: {
        id: true,
        version: true,
        booking: {
          select: {
            submission: { select: { contactEmail: true, contactName: true, contactPhone: true } },
            fromSubmission: {
              select: { contactEmail: true, contactName: true, contactPhone: true },
            },
          },
        },
      },
    });
    if (!signed) return { ok: false, error: "contract_not_signed" };

    const sub = signed.booking.fromSubmission ?? signed.booking.submission;
    if (!sub?.contactEmail || !sub.contactName) {
      return { ok: false, error: "missing_client_email" };
    }

    // Crée l'avenant comme ContractDocument séparé (isAddendum=true)
    const addendum = await prisma.$transaction(async (tx) => {
      const created = await tx.contractDocument.create({
        data: {
          bookingId: parsed.data.bookingId,
          provider: "docuseal",
          body: parsed.data.addendumBodyTiptap as Prisma.InputJsonValue,
          status: "draft",
          version: 1, // avenant a sa propre numérotation
          previousVersionId: signed.id,
          isAddendum: true,
        },
        select: { id: true },
      });
      await tx.activityLog.create({
        data: {
          adminUserId: admin.userId,
          action: "contract.create_addendum",
          targetType: "contract_document",
          targetId: created.id,
          changes: {
            mainContractId: signed.id,
            reason: parsed.data.reason,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return created;
    });

    // Envoi DocuSeal
    const submissionResult = await createContractSubmission({
      templateId: docusealTemplateIdRaw,
      client: {
        email: sub.contactEmail,
        name: sub.contactName,
        ...(sub.contactPhone ? { phone: sub.contactPhone } : {}),
      },
      metadata: {
        bookingId: parsed.data.bookingId,
        contractDocumentId: addendum.id,
        mainContractId: signed.id,
        addendum: "true",
      },
      sendEmail: true,
    });

    await prisma.contractDocument.update({
      where: { id: addendum.id },
      data: {
        providerId: submissionResult.submissionId,
        status: "sent",
        sentAt: new Date(),
      },
    });

    enqueueEmail("contract-version-updated", sub.contactEmail, "fr", {
      contactName: sub.contactName,
      reason: parsed.data.reason,
      isAddendum: true,
      bookingId: parsed.data.bookingId,
    }).catch(() => {
      /* fail-soft */
    });

    revalidateBookingPaths(parsed.data.bookingId);

    return {
      ok: true,
      contractDocumentId: addendum.id,
      submissionId: submissionResult.submissionId,
    };
  } catch (err) {
    console.error("[createContractAddendumAction]", err);
    return { ok: false, error: "internal_error" };
  }
}
