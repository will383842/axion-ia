// /api/calendly/client-event — POST endpoint pour capture Embed JS Calendly.
//
// Sprint Notif Infra 2026-05-26 / Chantier 3 — appele par
// `<CalendlyEventCapture />` cote client a chaque `event_scheduled`. Persiste
// dans `CalendlyEvent` + declenche notif Telegram via hub typé (`notify()`).
//
// Garanties :
//   - Rate-limit IP (anti-spam : 5 events/min/IP)
//   - Zod validation stricte (rejette payload anormaux)
//   - Dedup logique 60s (meme eventTypeSlug + meme IP)
//   - Soft-fail : 200 deduped silencieux si doublon
//   - 400 sur invalid_json / invalid_payload
//   - 429 sur rate_limited

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";

const ClientEventSchema = z.object({
  eventName: z.literal("calendly.event_scheduled"),
  // payload Calendly libre (forme varie selon configuration event-type)
  payload: z.unknown(),
  eventTypeSlug: z.string().min(1).max(100),
  utmSource: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  referrer: z.string().max(500).optional(),
  pageUrl: z.string().url().max(500),
});

export const runtime = "nodejs"; // Prisma + ioredis requis (pas Edge)

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Rate limit par IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip) ?? "unknown";
  const rl = await checkRateLimit(`calendly-client-event:${ipHash}`, {
    limit: 5,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 2. Parse JSON
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 3. Zod validate
  const parsed = ClientEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // 4. Dedup logique : si meme eventTypeSlug + meme IP capture dans les 60s
  //    → skip. Le payload Embed JS n'etant pas signe, on dedupe par fenetre
  //    temporelle + IP plutot que par hash payload.
  const recentDup = await prisma.calendlyEvent.findFirst({
    where: {
      eventTypeSlug: parsed.data.eventTypeSlug,
      capturedAt: { gte: new Date(Date.now() - 60_000) },
      // path JSON sur _ipHash injecte dans rawPayload ci-dessous
      rawPayload: { path: ["_ipHash"], equals: ipHash } as never,
    },
    select: { id: true },
  });
  if (recentDup) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // 5. Tenter d'extraire invitee.{name,email} depuis le payload Calendly
  //    (best-effort — Calendly Embed JS ne fournit pas systematiquement les
  //    PII cote client pour des raisons RGPD).
  const rawPayload = (parsed.data.payload ?? {}) as Record<string, unknown>;
  const invitee = (rawPayload["invitee"] ?? {}) as Record<string, unknown>;
  const inviteeName = typeof invitee["name"] === "string" ? (invitee["name"] as string) : undefined;
  const inviteeEmail =
    typeof invitee["email"] === "string" ? (invitee["email"] as string) : undefined;

  // 6. Persiste
  const event = await prisma.calendlyEvent.create({
    data: {
      // Will pourra renommer eventTypeName manuellement via admin
      eventTypeName: parsed.data.eventTypeSlug,
      eventTypeSlug: parsed.data.eventTypeSlug,
      status: "scheduled",
      source: "embed_js",
      ...(inviteeName ? { inviteeName } : {}),
      ...(inviteeEmail ? { inviteeEmail } : {}),
      pageUrl: parsed.data.pageUrl,
      ...(parsed.data.utmSource ? { utmSource: parsed.data.utmSource } : {}),
      ...(parsed.data.utmCampaign ? { utmCampaign: parsed.data.utmCampaign } : {}),
      ...(parsed.data.utmMedium ? { utmMedium: parsed.data.utmMedium } : {}),
      ...(parsed.data.referrer ? { referrer: parsed.data.referrer } : {}),
      // _ipHash injecté pour dedup ; consomme par la query findFirst ci-dessus
      rawPayload: { ...rawPayload, _ipHash: ipHash } as never,
    },
    select: { id: true },
  });

  // 7. Notif Telegram via hub
  await notify({
    category: "CALENDLY_INVITEE_CREATED",
    payload: {
      eventUri: event.id,
      inviteeEmail: inviteeEmail ?? "(non communiqué par Calendly Embed)",
      inviteeName: inviteeName ?? "(non communiqué)",
      eventStartTime: "(voir mail Calendly)",
      eventName: parsed.data.eventTypeSlug,
      ...(parsed.data.pageUrl ? { pageUrl: parsed.data.pageUrl } : {}),
      ...(parsed.data.utmSource ? { utmSource: parsed.data.utmSource } : {}),
      ...(parsed.data.utmCampaign ? { utmCampaign: parsed.data.utmCampaign } : {}),
    },
    dedupKey: event.id,
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
