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
//        - Si `metadata.kind === "devis"` → dispatch Devis (CRM Qualiopi).
//        - Sinon → Telegram only.
//   5. Marquer l'event `processedAt` après dispatch réussi.
//   6. Return 200 OK immédiat (DocuSeal retry exponentiel sinon).
//
// SÉCURITÉ :
//   - Pas de log du body en clair (peut contenir PII signataire).
//   - Sentry capture seulement les erreurs internes, pas le payload.

import * as Sentry from "@sentry/nextjs";
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
import { emettreDevisSigne, transactionDevisSigne } from "@/server/partners-sync/producteurs/devis";
import { faireMonterLesFichesDesDevisSignes } from "@/features/dossier-client/devis-signe-fait-client";

// Le canal Partners est importé (INT-T04) : jamais évaluée au build (garde d'inertie R4).
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

  // -- 5. Dispatch event critique --------------------------------------
  try {
    const kind = event.metadata["kind"];
    const isCompleted =
      event.eventType === "form.completed" || event.eventType === "submission.completed";
    const isDeclined = event.eventType === "form.declined";

    if (kind === "devis" && (isCompleted || isDeclined)) {
      await dispatchDevisEvent(event, isCompleted);
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
 * Dispatch un event DocuSeal lié à un Devis CRM Qualiopi (« bon pour accord »).
 *
 * - `form.completed` / `submission.completed` : Devis → accepte + acceptedAt.
 * - `form.declined` : Devis → refuse + declinedAt.
 *
 * Idempotence applicative : un replay sur un devis déjà dans l'état cible (ou
 * déjà transformé en convention) est un no-op. Best-effort : aucune state
 * machine, aucun email — le CRM devis est piloté côté admin.
 */
async function dispatchDevisEvent(
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
    select: { id: true, numero: true, statut: true, docusealSubmissionId: true },
  });
  if (!devis) {
    throw new Error(`[docuseal-webhook] devis ${devisId} not found`);
  }

  // Liaison forte : l'événement doit porter LA soumission enregistrée sur ce devis.
  // `metadata.devisId` vient du corps ; sans cette égalité, une soumission étrangère
  // (ou un devis signé par le canal maison, sans soumission DocuSeal) pourrait
  // faire basculer le devis. Alerte SANS donnée personnelle (numéro de devis seulement).
  if (!devis.docusealSubmissionId || devis.docusealSubmissionId !== event.submissionId) {
    sendTelegram({
      tag: "AUTO",
      body: `⚠️ Webhook DocuSeal ignoré : la soumission ne correspond pas à celle du devis ${devis.numero}. Aucune modification.`,
    }).catch(() => {});
    return;
  }

  // Un devis déjà accepté ou transformé en convention n'est JAMAIS modifié par un
  // événement DocuSeal, ni rétrogradé en « refusé » (refus tardif), ni ré-accepté.
  if (devis.statut === "accepte" || devis.statut === "transforme_convention") return;
  // Idempotence : replay sur un devis déjà refusé → no-op.
  if (!isCompleted && devis.statut === "refuse") return;
  // Revue M7 : un devis EXPIRÉ (remplacé par une révision, ou périmé) ne se
  // signe plus — le client a peut-être signé la VIEILLE soumission d'une
  // version remplacée. On ignore + Telegram interne pour arbitrage humain.
  if (devis.statut === "expire") {
    sendTelegram({
      tag: "AUTO",
      body: `⚠️ Signature DocuSeal reçue sur le devis EXPIRÉ ${devis.numero} — ignorée (révision probable). Vérifier avec le client quelle version fait foi.`,
    }).catch(() => {});
    return;
  }

  if (isCompleted) {
    // INT-T04 (REQ-INT-007) : l'acceptation et l'événement `devis.signe` dans UNE transaction.
    await transactionDevisSigne(prisma, async (tx) => {
      await tx.devis.update({
        where: { id: devis.id },
        data: { statut: "accepte", acceptedAt: new Date() },
      });
      await emettreDevisSigne(tx, devis.id);
    });
    // Un prospect passe en client lorsqu'un devis est signé (Will, 04/11/2026) : APRÈS le COMMIT,
    // hors transaction (B1) ; une erreur ne touche jamais l'acceptation.
    try {
      await faireMonterLesFichesDesDevisSignes(prisma, [devis.id], { origine: "docuseal" });
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "devis_signe_fait_client" } });
    }
    sendTelegram({
      tag: "OPTION CONFIRMÉE",
      body: `📑 Devis ${devis.numero} signé (bon pour accord) via DocuSeal`,
    }).catch(() => {});
  } else {
    await prisma.devis.update({
      where: { id: devis.id },
      data: { statut: "refuse", declinedAt: new Date() },
    });
    sendTelegram({
      tag: "OPTION REFUSÉE",
      body: `📑 Devis ${devis.numero} refusé via DocuSeal`,
    }).catch(() => {});
  }
}
