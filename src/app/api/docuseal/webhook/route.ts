// POST /api/docuseal/webhook — DocuSeal webhook ingestion (main, light).
//
// Version minimale main : verify auth (HMAC ou plain secret) + log
// Telegram audit + return 200. Pas de persistence DB tant que les
// models DocusealWebhookEvent / ContractDocument ne sont pas mergés
// depuis feature/booking-v1.
//
// Quand feature/booking-v1 sera mergé, cette route sera étendue avec :
//   - Outbox idempotent (DocusealWebhookEvent UNIQUE event_id)
//   - Dispatch state machine pour quote_signed / quote_declined
//   - Fetch signed PDF + archive Hetzner Storage Box

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyWebhookAuth, isDocusealWebhookConfigured } from "@/lib/docuseal";
import { sendTelegram } from "@/lib/telegram";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isDocusealWebhookConfigured()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const signature = req.headers.get("x-docuseal-signature");
  const secret = req.headers.get("x-docuseal-secret");
  if (!verifyWebhookAuth(rawBody, { signature, secret })) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // Audit log Telegram (PII-light : pas de payload complet).
  let eventType = "unknown";
  let eventId = "unknown";
  try {
    const data = JSON.parse(rawBody) as Record<string, unknown>;
    eventType = (data["event_type"] as string) ?? "unknown";
    eventId = (data["event_id"] as string) ?? "unknown";
  } catch {
    // Body non-JSON : on continue, return 200 quand même pour éviter retry.
  }

  sendTelegram({
    tag: "AUTO",
    body: `DocuSeal webhook reçu — type: ${eventType}, event_id: ${eventId}`,
    silent: true,
  }).catch(() => {});

  return NextResponse.json({ ok: true }, { status: 200 });
}
