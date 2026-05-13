// POST /api/docuseal/webhook — DocuSeal webhook ingestion (Sprint X.3 + X.7 final).
//
// SOURCE :
//   - ADR 0014 — DocuSeal self-hosted vs Yousign
//   - 03-ARCHITECTURE-CIBLE §5.6 (signature contrat)
//   - 04-PLAN-EXECUTION Sprint X.3 (squelette) + X.7 final (full dispatch Quote)
//
// PIPELINE :
//   1. Lire le body RAW (DocuSeal exige bytes-exact pour HMAC-SHA256).
//   2. Vérifier `X-Docuseal-Signature` via `verifyWebhookSignature`.
//   3. Parse JSON → idempotency outbox INSERT `DocusealWebhookEvent` avec
//      `docusealEventId` UNIQUE. Si conflict P2002 → 200 OK (déjà reçu).
//   4. Pour les events critiques (`form.completed`, `submission.completed`,
//      `form.declined`) :
//        - Si `metadata.kind === "quote"` → dispatch Quote (X.7 final).
//        - Sinon (contract signature) → V1 light : Telegram only. Le wiring
//          ContractDocument complet viendra avec
//          `sendContractAndDepositRequestAction` (Sprint X.8 admin UI).
//   5. Marquer l'event `processedAt` après dispatch réussi.
//   6. Return 200 OK immédiat (DocuSeal retry exponentiel sinon).
//
// SÉCURITÉ :
//   - Pas de log du body en clair (peut contenir PII signataire).
//   - Sentry capture seulement les erreurs internes, pas le payload.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  parseWebhookPayload,
  verifyWebhookAuth,
  isDocusealWebhookConfigured,
  getSubmission,
  type DocusealWebhookPayload,
} from "@/lib/docuseal";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { applyTransition, StateMachineError } from "@/features/booking/state-machine";
import { enqueueEmail } from "@/server/queue/queues";

// Prisma error codes (string literals — pas d'import Prisma runtime ici car edge-friendly).
const PRISMA_UNIQUE_CONSTRAINT = "P2002";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // -- 1. Configuration check -----------------------------------------
  if (!isDocusealWebhookConfigured()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  // -- 2. Raw body (REQUIRED pour HMAC) -------------------------------
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // -- 3. Signature verification (dual-mode HMAC v1.x ou plaintext v2.x) -
  const signatureHeader = req.headers.get("x-docuseal-signature");
  const secretHeader = req.headers.get("x-docuseal-secret");
  if (!verifyWebhookAuth(rawBody, { signature: signatureHeader, secret: secretHeader })) {
    // Pas de log détaillé pour éviter d'aider un attaquant.
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // -- 4. Parse + idempotency outbox ----------------------------------
  let event: DocusealWebhookPayload;
  try {
    event = parseWebhookPayload(rawBody);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_payload", detail: (err as Error).message.slice(0, 200) },
      { status: 400 },
    );
  }

  let webhookEventId: string;
  try {
    const inserted = await prisma.docusealWebhookEvent.create({
      data: {
        docusealEventId: event.eventId,
        type: event.eventType,
        payload: event.raw as object,
      },
      select: { id: true },
    });
    webhookEventId = inserted.id;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === PRISMA_UNIQUE_CONSTRAINT) {
      // Event déjà reçu → idempotent return 200.
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
    // Erreur DB inattendue : 500 → DocuSeal retry exponentiel.
    console.error("[docuseal-webhook] outbox insert failed", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  // -- 5. Dispatch event critique --------------------------------------
  try {
    const kind = event.metadata["kind"];
    const isCompleted =
      event.eventType === "form.completed" || event.eventType === "submission.completed";
    const isDeclined = event.eventType === "form.declined";

    if (kind === "quote" && (isCompleted || isDeclined)) {
      await dispatchQuoteEvent(event, isCompleted);
    } else if (isCompleted) {
      sendTelegram({
        tag: "OPTION CONFIRMÉE",
        body: `DocuSeal submission ${event.submissionId} signée (kind=${kind ?? "unknown"}). Metadata: ${JSON.stringify(event.metadata).slice(0, 200)}`,
      }).catch(() => {});
    } else if (isDeclined) {
      sendTelegram({
        tag: "OPTION REFUSÉE",
        body: `DocuSeal submission ${event.submissionId} refusée (kind=${kind ?? "unknown"}). Metadata: ${JSON.stringify(event.metadata).slice(0, 200)}`,
      }).catch(() => {});
    }

    // Marque l'event comme traité (idempotence côté retry).
    await prisma.docusealWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    // Erreur de dispatch : on log mais on retourne 200 pour éviter le replay
    // infini de DocuSeal. L'event reste dans la table avec processedAt=NULL
    // pour reprocessing manuel admin.
    console.error("[docuseal-webhook] dispatch failed", err);
    await prisma.docusealWebhookEvent
      .update({
        where: { id: webhookEventId },
        data: { error: (err as Error).message.slice(0, 500), retryCount: { increment: 1 } },
      })
      .catch(() => {});
    sendTelegram({
      tag: "AUTO",
      body: `⚠️ DocuSeal webhook dispatch error ${event.eventType} ${event.submissionId}: ${(err as Error).message.slice(0, 200)}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ============================================================
// Dispatchers internes
// ============================================================

/**
 * Dispatch un event DocuSeal lié à un Quote (X.7 final).
 *
 * - `form.completed` / `submission.completed` :
 *   1. Fetch submission DocuSeal (signed PDF URL + audit trail).
 *   2. Update Quote (status=accepted, acceptedAt, pdfUrl, hashSha256).
 *   3. applyTransition(quote_signed) — si booking en quote_sent.
 *   4. Enqueue email `quote-signed` au visiteur.
 *
 * - `form.declined` :
 *   1. Update Quote (status=declined, declinedAt).
 *   2. applyTransition(quote_declined) — si booking en quote_sent.
 *   3. Enqueue email `quote-declined` au visiteur.
 *
 * Idempotence : la state machine refuse les transitions backward, donc un
 * replay sur Quote déjà signé/refusé est no-op côté Booking.status.
 */
async function dispatchQuoteEvent(
  event: DocusealWebhookPayload,
  isCompleted: boolean,
): Promise<void> {
  const quoteId = event.metadata["quoteId"];
  if (!quoteId) {
    throw new Error(
      `[docuseal-webhook] missing quoteId in metadata for submission ${event.submissionId}`,
    );
  }

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      number: true,
      status: true,
      bookingId: true,
      booking: {
        select: {
          locale: true,
          submission: { select: { contactEmail: true, contactName: true } },
        },
      },
    },
  });
  if (!quote) {
    throw new Error(`[docuseal-webhook] quote ${quoteId} not found`);
  }

  // Idempotence applicative : si Quote déjà dans l'état cible, no-op.
  if (isCompleted && quote.status === "accepted") return;
  if (!isCompleted && quote.status === "declined") return;

  if (isCompleted) {
    // Fetch détails submission (signed PDF + hash + IP signataire).
    const sub = await getSubmission(event.submissionId);

    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: "accepted",
          acceptedAt: sub.signedAt ? new Date(sub.signedAt) : new Date(),
          ...(sub.signedPdfUrl ? { pdfUrl: sub.signedPdfUrl } : {}),
          ...(sub.signedPdfSha256 ? { hashSha256: sub.signedPdfSha256 } : {}),
        },
      });

      try {
        await applyTransition(tx, quote.bookingId, {
          to: "quote_signed",
          trigger: `docuseal.${event.eventType}:${event.submissionId}`,
          triggeredBy: "webhook",
          ignoreDuplicate: true,
        });
      } catch (e) {
        // Si la transition n'est pas autorisée (ex: booking pas dans quote_sent),
        // on log mais on ne bloque pas la persistance du Quote signé.
        if (!(e instanceof StateMachineError)) throw e;
        console.warn(`[docuseal-webhook] quote_signed transition skipped: ${e.code}`);
      }
    });

    const email = quote.booking.submission?.contactEmail;
    if (email) {
      enqueueEmail("quote-signed", email, quote.booking.locale, {
        contactName: quote.booking.submission?.contactName ?? "Client",
        quoteNumber: quote.number,
      }).catch(() => {});
    }
    sendTelegram({
      tag: "OPTION CONFIRMÉE",
      body: `📑 Devis ${quote.number} signé via DocuSeal (booking ${quote.bookingId})`,
    }).catch(() => {});
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: "declined", declinedAt: new Date() },
      });

      try {
        await applyTransition(tx, quote.bookingId, {
          to: "quote_declined",
          trigger: `docuseal.${event.eventType}:${event.submissionId}`,
          triggeredBy: "webhook",
          ignoreDuplicate: true,
        });
      } catch (e) {
        if (!(e instanceof StateMachineError)) throw e;
        console.warn(`[docuseal-webhook] quote_declined transition skipped: ${e.code}`);
      }
    });

    const email = quote.booking.submission?.contactEmail;
    if (email) {
      enqueueEmail("quote-declined", email, quote.booking.locale, {
        contactName: quote.booking.submission?.contactName ?? "Client",
        quoteNumber: quote.number,
      }).catch(() => {});
    }
    sendTelegram({
      tag: "OPTION REFUSÉE",
      body: `📑 Devis ${quote.number} refusé via DocuSeal (booking ${quote.bookingId})`,
    }).catch(() => {});
  }
}
