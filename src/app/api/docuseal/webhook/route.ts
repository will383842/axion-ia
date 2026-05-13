// POST /api/docuseal/webhook — DocuSeal webhook ingestion (Sprint X.3 — Booking V1)
//
// SOURCE :
//   - ADR 0014 — DocuSeal self-hosted vs Yousign
//   - 03-ARCHITECTURE-CIBLE §5.6 (signature contrat)
//   - 04-PLAN-EXECUTION Sprint X.3
//
// PIPELINE :
//   1. Lire le body RAW (DocuSeal exige bytes-exact pour HMAC-SHA256).
//   2. Vérifier `X-Docuseal-Signature` via `verifyWebhookSignature`.
//   3. Parse JSON → idempotency outbox INSERT `DocusealWebhookEvent` avec
//      `docusealEventId` UNIQUE. Si conflict P2002 → 200 OK (déjà reçu).
//   4. Pour les events critiques (`form.completed`, `form.declined`,
//      `submission.completed`) : dispatcher la state machine côté Quote
//      / ContractDocument. V1 : sync inline (workers BullMQ Sprint X.12
//      pour la version finale).
//   5. Return 200 OK immédiat (DocuSeal retry exponentiel sinon).
//
// SÉCURITÉ :
//   - Pas de log du body en clair (peut contenir PII signataire).
//   - Sentry capture seulement les erreurs internes, pas le payload.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  parseWebhookPayload,
  verifyWebhookSignature,
  isDocusealWebhookConfigured,
  type DocusealWebhookPayload,
} from "@/lib/docuseal";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";

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

  // -- 3. Signature verification --------------------------------------
  const sig = req.headers.get("x-docuseal-signature");
  if (!verifyWebhookSignature(rawBody, sig)) {
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

  try {
    await prisma.docusealWebhookEvent.create({
      data: {
        docusealEventId: event.eventId,
        type: event.eventType,
        payload: event.raw as object,
      },
    });
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

  // -- 5. Dispatch event critique (sync V1 — async BullMQ Sprint X.12) -
  // Pour V1 on log + Telegram seulement. Le wiring state machine côté
  // ContractDocument + Quote sera implémenté dans Sprint X.7 final.
  if (event.eventType === "form.completed" || event.eventType === "submission.completed") {
    sendTelegram({
      tag: "OPTION CONFIRMÉE",
      body: `DocuSeal submission ${event.submissionId} signée. Booking metadata: ${JSON.stringify(event.metadata).slice(0, 200)}`,
    }).catch(() => {});
  } else if (event.eventType === "form.declined") {
    sendTelegram({
      tag: "OPTION REFUSÉE",
      body: `DocuSeal submission ${event.submissionId} refusée. Booking metadata: ${JSON.stringify(event.metadata).slice(0, 200)}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
