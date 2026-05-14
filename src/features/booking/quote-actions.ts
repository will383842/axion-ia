"use server";
// Server Actions Quote (Sprint X.7 / Booking V1).
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.7 + Sprint X.7 final (DocuSeal wiring)
//   - 03-ARCHITECTURE-CIBLE §5.1.7 (Quote model)
//   - ADR 0014 — DocuSeal self-hosted vs Yousign
//
// SCOPE V1 final (DocuSeal wiré) :
//   - `generateQuoteDraftAction({bookingId, amountHtCents, vatRate, vatReverseCharge, body, validUntil?})`
//     — admin crée un Quote draft (numéro séquentiel).
//   - `editQuoteDraftAction({quoteId, ...fields})` — édition tant que status='draft'.
//   - `sendQuoteAction({quoteId})` — passe en 'sent', crée submission DocuSeal
//     (si configuré + `DOCUSEAL_QUOTE_TEMPLATE_ID` présent), stocke
//     `docusealSubmissionId` + `pdfUrl=embedUrl`, transition booking
//     quote_required → quote_sent + email visiteur (avec lien signature).
//     Fallback gracieux si DocuSeal indisponible/non configuré.
//   - `markQuoteSignedManuallyAction({quoteId, pdfUrl?})` — super_admin only,
//     passe en 'accepted', transition quote_sent → quote_signed.
//   - `markQuoteDeclinedAction({quoteId, reason?})` — passe en 'declined',
//     transition terminal.
//
// HORS SCOPE :
//   - PDF auto-render (react-pdf) — V1.5
//   - Admin UI `/admin/devis/[bookingId]` — Sprint X.8

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { sendTelegram } from "@/lib/telegram";
import { applyTransition, StateMachineError } from "./state-machine";
import { generateQuoteNumber, computeQuotePricing } from "@/lib/quote-helpers";
import { createContractSubmission, isDocusealConfigured, DocusealApiError } from "@/lib/docuseal";

type AdminContext = { userId: string; role: "super_admin" | "admin" | "editor" | "reader" };

async function requireAdmin(
  min: "super_admin" | "admin" | "editor" = "admin",
): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role as AdminContext["role"] | undefined;
  if (!role) throw new Error("forbidden");
  const RANK = { reader: 0, editor: 1, admin: 2, super_admin: 3 } as const;
  if (RANK[role] < RANK[min]) throw new Error("forbidden");
  return { userId: session.user.id, role };
}

export interface QuoteActionResult {
  ok: boolean;
  quoteId?: string;
  number?: string;
  error?:
    | "unauthorized"
    | "forbidden"
    | "invalid_input"
    | "booking_not_found"
    | "quote_not_found"
    | "quote_already_sent"
    | "quote_already_signed"
    | "transition_not_allowed"
    | "internal_error";
}

function authErr(err: unknown): QuoteActionResult {
  const msg = (err as Error)?.message;
  if (msg === "unauthorized") return { ok: false, error: "unauthorized" };
  if (msg === "forbidden") return { ok: false, error: "forbidden" };
  return { ok: false, error: "internal_error" };
}

// ============================================================
// generateQuoteDraftAction
// ============================================================

const generateSchema = z.object({
  bookingId: z.string().uuid(),
  amountHtCents: z.coerce.number().int().min(1).max(10_000_000), // jusqu'à 100k€
  vatRate: z.coerce.number().min(0).max(30),
  vatReverseCharge: z.coerce.boolean().default(false),
  /** Tiptap JSON ou markdown — corps libre du devis. */
  body: z.unknown(),
  /** ISO date — défaut +30j. */
  validUntilIso: z.string().datetime().optional(),
});

export async function generateQuoteDraftAction(
  input: z.input<typeof generateSchema>,
): Promise<QuoteActionResult> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  let admin: AdminContext;
  try {
    admin = await requireAdmin();
  } catch (err) {
    return authErr(err);
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: { id: true },
    });
    if (!booking) return { ok: false, error: "booking_not_found" };

    const pricing = computeQuotePricing({
      amountHtCents: parsed.data.amountHtCents,
      vatRate: parsed.data.vatRate,
      vatReverseCharge: parsed.data.vatReverseCharge,
    });
    const validUntil = parsed.data.validUntilIso
      ? new Date(parsed.data.validUntilIso)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Numérotation V1 (count + 1, à durcir Sprint X.10 advisory lock).
    const number = await generateQuoteNumber(prisma);

    const quote = await prisma.quote.create({
      data: {
        number,
        bookingId: parsed.data.bookingId,
        body: parsed.data.body as object,
        amountHtCents: pricing.amountHtCents,
        vatRate: pricing.vatRate,
        vatReverseCharge: pricing.vatReverseCharge,
        vatMention: pricing.vatMention,
        amountTtcCents: pricing.amountTtcCents,
        validUntil,
        status: "draft",
      },
      select: { id: true, number: true },
    });

    sendTelegram({
      tag: "AUTO",
      body: `📄 Devis ${quote.number} créé en draft par ${admin.userId} pour booking ${parsed.data.bookingId}`,
    }).catch(() => {});

    return { ok: true, quoteId: quote.id, number: quote.number };
  } catch (err) {
    console.error("[generateQuoteDraftAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// editQuoteDraftAction
// ============================================================

const editSchema = z.object({
  quoteId: z.string().uuid(),
  amountHtCents: z.coerce.number().int().min(1).max(10_000_000).optional(),
  vatRate: z.coerce.number().min(0).max(30).optional(),
  vatReverseCharge: z.coerce.boolean().optional(),
  body: z.unknown().optional(),
  validUntilIso: z.string().datetime().optional(),
});

export async function editQuoteDraftAction(
  input: z.input<typeof editSchema>,
): Promise<QuoteActionResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  try {
    await requireAdmin();
  } catch (err) {
    return authErr(err);
  }

  try {
    const q = await prisma.quote.findUnique({
      where: { id: parsed.data.quoteId },
      select: {
        id: true,
        status: true,
        vatRate: true,
        vatReverseCharge: true,
        amountHtCents: true,
      },
    });
    if (!q) return { ok: false, error: "quote_not_found" };
    if (q.status !== "draft") return { ok: false, error: "quote_already_sent" };

    // Recalcul pricing si l'un des trois champs change.
    const newHt = parsed.data.amountHtCents ?? q.amountHtCents;
    const newRate = parsed.data.vatRate ?? Number(q.vatRate);
    const newReverse = parsed.data.vatReverseCharge ?? q.vatReverseCharge;
    const pricing = computeQuotePricing({
      amountHtCents: newHt,
      vatRate: newRate,
      vatReverseCharge: newReverse,
    });

    await prisma.quote.update({
      where: { id: parsed.data.quoteId },
      data: {
        amountHtCents: pricing.amountHtCents,
        vatRate: pricing.vatRate,
        vatReverseCharge: pricing.vatReverseCharge,
        vatMention: pricing.vatMention,
        amountTtcCents: pricing.amountTtcCents,
        ...(parsed.data.body !== undefined ? { body: parsed.data.body as object } : {}),
        ...(parsed.data.validUntilIso ? { validUntil: new Date(parsed.data.validUntilIso) } : {}),
      },
    });

    return { ok: true, quoteId: parsed.data.quoteId };
  } catch (err) {
    console.error("[editQuoteDraftAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// sendQuoteAction
// ============================================================

const sendSchema = z.object({ quoteId: z.string().uuid() });

export async function sendQuoteAction(
  input: z.input<typeof sendSchema>,
): Promise<QuoteActionResult> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  let admin: AdminContext;
  try {
    admin = await requireAdmin();
  } catch (err) {
    return authErr(err);
  }

  try {
    // -- 1. Pré-fetch hors transaction (lecture longue + DocuSeal call). ----
    const q = await prisma.quote.findUnique({
      where: { id: parsed.data.quoteId },
      select: {
        id: true,
        number: true,
        status: true,
        amountTtcCents: true,
        validUntil: true,
        bookingId: true,
        booking: {
          select: {
            locale: true,
            submission: { select: { contactEmail: true, contactName: true } },
          },
        },
      },
    });
    if (!q) return { ok: false, error: "quote_not_found" };
    if (q.status !== "draft") return { ok: false, error: "quote_already_sent" };

    const contactEmail = q.booking.submission?.contactEmail ?? null;
    const contactName = q.booking.submission?.contactName ?? "Client";

    // -- 2. DocuSeal createSubmission (best-effort, hors tx). --------------
    // Si DocuSeal n'est pas configuré OU si le template ID est absent OU si
    // l'API est down → on continue sans signature électronique (l'admin
    // pourra utiliser markQuoteSignedManuallyAction en fallback).
    const docusealTemplateId = process.env["DOCUSEAL_QUOTE_TEMPLATE_ID"];
    let submissionId: string | null = null;
    let embedUrl: string | null = null;

    if (isDocusealConfigured() && docusealTemplateId && contactEmail) {
      try {
        // Sprint X.7 final — pattern signature séquentielle B2B
        //   1. Client signe en 1er
        //   2. Axion-IA contre-signe en 2e
        // Configuré via DOCUSEAL_CONTRACT_TEMPLATE_ID env vars + le contre-
        // signataire via AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL (fallback
        // contact@axion-ia.com). Cf. _AUDIT/legal/DOCUSEAL-TEMPLATE-SETUP.md.
        const result = await createContractSubmission({
          templateId: docusealTemplateId,
          client: { email: contactEmail, name: contactName },
          fields: [
            { name: "quote_number", default_value: q.number },
            { name: "amount_ttc", default_value: (q.amountTtcCents / 100).toFixed(2) },
            { name: "valid_until", default_value: q.validUntil.toISOString().slice(0, 10) },
          ],
          sendEmail: false, // on envoie nous-mêmes via enqueueEmail
          metadata: {
            bookingId: q.bookingId,
            quoteId: q.id,
            kind: "quote",
          },
        });
        submissionId = result.submissionId;
        embedUrl = result.embedUrl;
      } catch (err) {
        if (err instanceof DocusealApiError) {
          // Log + Telegram alerte, mais on continue sans DocuSeal.
          sendTelegram({
            tag: "AUTO",
            body: `⚠️ DocuSeal indisponible (status=${err.statusCode}) lors du sendQuote ${q.number}. Fallback sans signature électronique.`,
          }).catch(() => {});
        } else {
          console.warn("[sendQuoteAction] DocuSeal call failed", err);
        }
      }
    }

    // -- 3. Transaction atomique : update Quote + Booking + transition. ----
    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: q.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          ...(submissionId ? { docusealSubmissionId: submissionId } : {}),
          ...(embedUrl ? { pdfUrl: embedUrl } : {}),
        },
      });
      // Lien actif côté Booking.quoteId (relation BookingActiveQuote).
      await tx.booking.update({
        where: { id: q.bookingId },
        data: { quoteId: q.id },
      });

      // Transition state machine quote_required → quote_sent (si applicable).
      // Si le booking n'est pas dans quote_required, on log warn mais on
      // ne bloque pas l'envoi du devis (les flows entry-points peuvent varier).
      try {
        await applyTransition(tx, q.bookingId, {
          to: "quote_sent",
          trigger: "admin.send_quote",
          triggeredBy: "admin",
          triggeredById: admin.userId,
        });
      } catch (e) {
        if (!(e instanceof StateMachineError)) throw e;
        // Soft warning : on continue
        console.warn(`[sendQuoteAction] transition skipped: ${e.code}`);
      }
    });

    // -- 4. Email visiteur (hors tx, best-effort). -------------------------
    if (contactEmail) {
      enqueueEmail("quote-sent", contactEmail, q.booking.locale, {
        contactName,
        quoteNumber: q.number,
        amountTtc: (q.amountTtcCents / 100).toFixed(2) + " € TTC",
        validUntil: q.validUntil.toISOString().slice(0, 10),
        ...(embedUrl ? { pdfUrl: embedUrl } : {}),
      }).catch(() => {});
    }

    return { ok: true, quoteId: q.id };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return {
        ok: false,
        error:
          err.code === "transition_duplicate" ? "quote_already_sent" : "transition_not_allowed",
      };
    }
    console.error("[sendQuoteAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// markQuoteSignedManuallyAction (super_admin)
// ============================================================

const signSchema = z.object({
  quoteId: z.string().uuid(),
  pdfUrl: z.string().url().optional(),
});

export async function markQuoteSignedManuallyAction(
  input: z.input<typeof signSchema>,
): Promise<QuoteActionResult> {
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  let admin: AdminContext;
  try {
    admin = await requireAdmin("super_admin");
  } catch (err) {
    return authErr(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const q = await tx.quote.findUnique({
        where: { id: parsed.data.quoteId },
        select: {
          status: true,
          bookingId: true,
          number: true,
          booking: {
            select: {
              locale: true,
              submission: { select: { contactEmail: true, contactName: true } },
            },
          },
        },
      });
      if (!q) throw new StateMachineError("Quote introuvable", "booking_not_found");
      if (q.status === "accepted")
        throw new StateMachineError("Quote déjà signé", "transition_duplicate");
      if (q.status !== "sent")
        throw new StateMachineError(
          `Quote status=${q.status} non éligible`,
          "transition_not_allowed",
        );

      await tx.quote.update({
        where: { id: parsed.data.quoteId },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
          ...(parsed.data.pdfUrl ? { pdfUrl: parsed.data.pdfUrl } : {}),
        },
      });

      try {
        await applyTransition(tx, q.bookingId, {
          to: "quote_signed",
          trigger: "admin.mark_quote_signed",
          triggeredBy: "admin",
          triggeredById: admin.userId,
        });
      } catch (e) {
        if (!(e instanceof StateMachineError)) throw e;
        console.warn(`[markQuoteSignedManuallyAction] transition skipped: ${e.code}`);
      }

      const email = q.booking.submission?.contactEmail;
      if (email) {
        enqueueEmail("quote-signed", email, q.booking.locale, {
          contactName: q.booking.submission?.contactName ?? "Client",
          quoteNumber: q.number,
        }).catch(() => {});
      }
    });
    return { ok: true, quoteId: parsed.data.quoteId };
  } catch (err) {
    if (err instanceof StateMachineError) {
      const code =
        err.code === "transition_duplicate" ? "quote_already_signed" : "transition_not_allowed";
      return { ok: false, error: code };
    }
    console.error("[markQuoteSignedManuallyAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// markQuoteDeclinedAction
// ============================================================

const declineSchema = z.object({
  quoteId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});

export async function markQuoteDeclinedAction(
  input: z.input<typeof declineSchema>,
): Promise<QuoteActionResult> {
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  let admin: AdminContext;
  try {
    admin = await requireAdmin();
  } catch (err) {
    return authErr(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const q = await tx.quote.findUnique({
        where: { id: parsed.data.quoteId },
        select: {
          status: true,
          bookingId: true,
          number: true,
          booking: {
            select: {
              locale: true,
              submission: { select: { contactEmail: true, contactName: true } },
            },
          },
        },
      });
      if (!q) throw new StateMachineError("Quote introuvable", "booking_not_found");
      if (q.status === "declined") return; // idempotent
      if (q.status === "accepted")
        throw new StateMachineError("Quote déjà signé", "transition_not_allowed");

      await tx.quote.update({
        where: { id: parsed.data.quoteId },
        data: { status: "declined" },
      });

      try {
        await applyTransition(tx, q.bookingId, {
          to: "quote_declined",
          trigger: "admin.mark_quote_declined",
          triggeredBy: "admin",
          triggeredById: admin.userId,
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        });
      } catch (e) {
        if (!(e instanceof StateMachineError)) throw e;
        console.warn(`[markQuoteDeclinedAction] transition skipped: ${e.code}`);
      }

      const email = q.booking.submission?.contactEmail;
      if (email) {
        enqueueEmail("quote-declined", email, q.booking.locale, {
          contactName: q.booking.submission?.contactName ?? "Client",
          quoteNumber: q.number,
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        }).catch(() => {});
      }
    });
    return { ok: true, quoteId: parsed.data.quoteId };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return { ok: false, error: "transition_not_allowed" };
    }
    console.error("[markQuoteDeclinedAction]", err);
    return { ok: false, error: "internal_error" };
  }
}
