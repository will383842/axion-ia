// POST /api/docuseal/webhook — DocuSeal webhook ingestion (Sprint X.3 + X.7 final).
//
// SOURCE :
//   - ADR 0014 — DocuSeal self-hosted vs Yousign
//   - 03-ARCHITECTURE-CIBLE §5.6 (signature contrat)
//   - 04-PLAN-EXECUTION Sprint X.3 (squelette) + X.7 final (full dispatch Quote)
//
// PIPELINE :
//   1. Lire le body RAW (DocuSeal exige bytes-exact pour HMAC-SHA256).
//   2. Plafonner le corps (256 Ko → 413) puis vérifier `X-Docuseal-Signature` (v2 seul).
//   3. Parse JSON → idempotency outbox INSERT `DocusealWebhookEvent` avec
//      `docusealEventId` UNIQUE. Si conflict P2002 → 200 OK (déjà reçu).
//   4. Pour les events critiques (`form.completed`, `submission.completed`,
//      `form.declined`) :
//        - Alerte Telegram interne uniquement (numéro de devis, aucune donnée client).
//        - AUCUNE écriture sur Devis (CGV art. 5.1, 6.2, 6.3).
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
  verifyWebhookSignature,
  isDocusealWebhookConfigured,
  type DocusealWebhookPayload,
} from "@/lib/docuseal";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Prisma error codes (string literals — pas d'import Prisma runtime ici car edge-friendly).
const PRISMA_UNIQUE_CONSTRAINT = "P2002";

/** Plafond du corps accepté (un webhook DocuSeal légitime pèse quelques Ko). */
const MAX_BODY_BYTES = 256 * 1024;

/** Lit le corps en flux ; `null` dès que le plafond est dépassé (on arrête de lire). */
async function lireCorpsPlafonne(req: NextRequest): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // -- 1. Configuration check -----------------------------------------
  if (!isDocusealWebhookConfigured()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  // -- 2. Raw body plafonné (REQUIRED pour HMAC) ----------------------
  // Le plafond s'applique AVANT toute lecture complète / vérification HMAC :
  // un POST anonyme ne doit pas pouvoir nous faire bufferiser un corps géant.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  let rawBody: string;
  try {
    const lu = await lireCorpsPlafonne(req);
    if (lu === null) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    rawBody = lu;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // -- 3. Signature v2 `<ts>.<hmac>` (seul format accepté) -------------
  if (!verifyWebhookSignature(rawBody, req.headers.get("x-docuseal-signature"))) {
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

  // -- 5. Alerte interne (AUCUNE écriture métier) ------------------------
  try {
    const kind = event.metadata["kind"];
    const isCompleted =
      event.eventType === "form.completed" || event.eventType === "submission.completed";
    const isDeclined = event.eventType === "form.declined";

    if (kind === "devis" && (isCompleted || isDeclined)) {
      await alerterEvenementDevis(event, isCompleted);
    } else if (isCompleted) {
      // Aucune donnée client vers Telegram : ni métadonnées, ni identité.
      sendTelegram({
        tag: "AUTO",
        body: `DocuSeal : soumission ${event.submissionId} signée (kind=${kind ?? "unknown"}).`,
      }).catch(() => {});
    } else if (isDeclined) {
      sendTelegram({
        tag: "AUTO",
        body: `DocuSeal : soumission ${event.submissionId} refusée (kind=${kind ?? "unknown"}).`,
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
// Alerte interne
// ============================================================

/**
 * Un événement DocuSeal sur un devis N'ÉCRIT JAMAIS `Devis.statut`, n'émet pas
 * `devis.signe` vers Partners et ne fait pas monter les fiches.
 *
 * Raison (CGV art. 5.1, 6.2, 6.3) : le contrat n'est formé que lorsqu'Axion-IA
 * a contresigné, après acceptation des CGV par le client. Une signature
 * DocuSeal seule n'est donc pas une acceptation. L'événement est conservé dans
 * `docuseal_webhook_events` (idempotence) et un humain est alerté avec le seul
 * numéro de devis (aucune donnée client vers Telegram).
 */
async function alerterEvenementDevis(
  event: DocusealWebhookPayload,
  isCompleted: boolean,
): Promise<void> {
  const devisId = event.metadata["devisId"];
  if (!devisId) {
    throw new Error(
      `[docuseal-webhook] missing devisId in metadata for submission ${event.submissionId}`,
    );
  }
  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    select: { numero: true },
  });
  if (!devis) {
    throw new Error(`[docuseal-webhook] devis ${devisId} not found`);
  }
  sendTelegram({
    tag: "AUTO",
    body: isCompleted
      ? `📑 Événement DocuSeal « signé » sur le devis ${devis.numero} : aucun changement de statut. Vérifier la contresignature (CGV art. 6.2).`
      : `📑 Événement DocuSeal « refusé » sur le devis ${devis.numero} : aucun changement de statut.`,
  }).catch(() => {});
}
