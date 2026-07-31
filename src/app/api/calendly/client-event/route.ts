// /api/calendly/client-event — POST endpoint pour capture Embed JS Calendly.
//
// Sprint Notif Infra 2026-05-26 / Chantier 3 — appele par
// `<CalendlyEventCapture />` cote client a chaque `event_scheduled`. Persiste
// dans `CalendlyEvent` + declenche notif Telegram via hub typé (`notify()`).
//
// Garanties :
//   - Rate-limit IP (anti-spam : 5 events/min/IP)
//   - Zod validation stricte (rejette payload anormaux)
//   - Dedup par `invitee.uri` (identite stable de la reservation), avec repli
//     sur l'ancienne heuristique 60s + IP quand l'URI est absente
//   - Soft-fail : 200 deduped silencieux si doublon
//   - 400 sur invalid_json / invalid_payload
//   - 429 sur rate_limited
//
// ⚠️ CE QUE LE PAYLOAD CONTIENT REELLEMENT (corrige 2026-07-29, ADR 0036)
// ----------------------------------------------------------------------
// Le postMessage `calendly.event_scheduled` ne transmet QUE :
//   { event: { uri }, invitee: { uri } }
// Le code d'origine lisait `payload.invitee.name` / `.email` / `event.location`
// — ces champs n'existent PAS dans ce payload (Calendly retient les PII cote
// navigateur). Resultat : toutes les reservations captees depuis la mise en
// service etaient vides de contact et d'horaire, a ressaisir a la main.
// On persiste desormais les deux URI, seules donnees reelles disponibles, puis
// on tente de les resoudre via l'API Calendly (`src/server/calendly/`), ce qui
// n'a lieu que si `CALENDLY_API_TOKEN` est pose. L'extraction best-effort des
// champs PII est conservee : elle ne coute rien et couvrirait un futur payload
// plus riche.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { enrichCalendlyEvent } from "@/server/calendly/enrich";
import { isCalendlyApiConfigured } from "@/server/calendly/api";

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

  // 4. Extraction des URI — les deux seuls champs reellement transmis.
  const rawPayload = (parsed.data.payload ?? {}) as Record<string, unknown>;
  const invitee = (rawPayload["invitee"] ?? {}) as Record<string, unknown>;
  const eventObj = (rawPayload["event"] ?? {}) as Record<string, unknown>;
  const asUri = (v: unknown): string | undefined =>
    typeof v === "string" && v.startsWith("https://api.calendly.com/")
      ? v.slice(0, 255)
      : undefined;
  const eventUri = asUri(eventObj["uri"]);
  const inviteeUri = asUri(invitee["uri"]);

  // 5. Dedup. `invitee.uri` identifie une reservation de maniere stable : c'est
  //    la cle fiable, et elle est doublee d'une contrainte UNIQUE en base (donc
  //    aucune course entre deux requetes simultanees ne peut creer un doublon).
  //    L'ancienne heuristique (meme slug + meme IP dans les 60 s) reste en repli
  //    pour les payloads sans URI ; elle est volontairement reservee a ce cas
  //    car elle rejette a tort deux reservations legitimes prises coup sur coup
  //    depuis le meme poste.
  if (inviteeUri) {
    const existing = await prisma.calendlyEvent.findUnique({
      where: { inviteeUri },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ ok: true, deduped: true });
  } else {
    const recentDup = await prisma.calendlyEvent.findFirst({
      where: {
        eventTypeSlug: parsed.data.eventTypeSlug,
        capturedAt: { gte: new Date(Date.now() - 60_000) },
        // path JSON sur _ipHash injecte dans rawPayload ci-dessous
        rawPayload: { path: ["_ipHash"], equals: ipHash } as never,
      },
      select: { id: true },
    });
    if (recentDup) return NextResponse.json({ ok: true, deduped: true });
  }

  // 6. Extraction best-effort des PII. Absentes du payload Embed JS actuel
  //    (cf. bandeau en tete de fichier) — conservee au cas ou Calendly
  //    enrichirait le payload, et pour les tests de non-regression.
  const inviteeName = typeof invitee["name"] === "string" ? (invitee["name"] as string) : undefined;
  const inviteeEmail =
    typeof invitee["email"] === "string" ? (invitee["email"] as string) : undefined;
  // Sprint Notif Infra 2026-05-26 / fix P1-4 audit 2026-05-27 — location
  // peut être string (URL Meet) ou objet { type, location } selon config Calendly.
  const locationRaw = eventObj["location"];
  const location =
    typeof locationRaw === "string"
      ? locationRaw.slice(0, 500)
      : typeof locationRaw === "object" && locationRaw !== null
        ? JSON.stringify(locationRaw).slice(0, 500)
        : undefined;

  // 7. Persiste. La contrainte UNIQUE sur `invitee_uri` peut lever P2002 si
  //    deux requetes concurrentes portent la meme reservation (double emission
  //    du postMessage) : la verification de l'etape 5 est alors passee deux
  //    fois avant la premiere ecriture. C'est exactement le doublon qu'on veut
  //    eviter → on le traite comme tel, pas comme une erreur 500.
  let event: { id: string };
  try {
    event = await prisma.calendlyEvent.create({
      data: {
        // Will pourra renommer eventTypeName manuellement via admin
        eventTypeName: parsed.data.eventTypeSlug,
        eventTypeSlug: parsed.data.eventTypeSlug,
        status: "scheduled",
        source: "embed_js",
        ...(eventUri ? { eventUri } : {}),
        ...(inviteeUri ? { inviteeUri } : {}),
        ...(inviteeName ? { inviteeName } : {}),
        ...(inviteeEmail ? { inviteeEmail } : {}),
        ...(location ? { location } : {}),
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
  } catch (e) {
    const code = (e as { code?: unknown })?.code;
    if (code === "P2002") return NextResponse.json({ ok: true, deduped: true });
    throw e;
  }

  // 8. Enrichissement API — inerte sans `CALENDLY_API_TOKEN` (aucun appel
  //    reseau emis dans ce cas). Jamais bloquant : la capture est deja
  //    persistee, et `enrichCalendlyEvent` ne throw pas. On l'attend (plutot
  //    que de detacher la promesse) parce qu'un runtime serverless peut geler
  //    l'execution des la reponse renvoyee — une promesse orpheline y serait
  //    perdue silencieusement. Le cout est plafonne a 5 s (AbortSignal).
  const enriched = isCalendlyApiConfigured() ? await enrichCalendlyEvent(event.id) : null;

  // Relit les champs que l'enrichissement vient eventuellement de remplir, pour
  // que la notification porte le vrai contact plutot que « (non communique) ».
  let notifyName = inviteeName;
  let notifyEmail = inviteeEmail;
  let notifyStart: string | null = null;
  if (enriched?.ok) {
    const fresh = await prisma.calendlyEvent
      .findUnique({
        where: { id: event.id },
        select: { inviteeName: true, inviteeEmail: true, startTime: true },
      })
      .catch(() => null);
    if (fresh) {
      notifyName = fresh.inviteeName ?? notifyName;
      notifyEmail = fresh.inviteeEmail ?? notifyEmail;
      notifyStart = fresh.startTime?.toISOString() ?? null;
    }
  }

  // 9. Notif Telegram via hub
  await notify({
    category: "CALENDLY_INVITEE_CREATED",
    payload: {
      eventUri: event.id,
      inviteeEmail: notifyEmail ?? "(non communiqué par Calendly Embed)",
      inviteeName: notifyName ?? "(non communiqué)",
      eventStartTime: notifyStart ?? "(voir mail Calendly)",
      eventName: parsed.data.eventTypeSlug,
      ...(parsed.data.pageUrl ? { pageUrl: parsed.data.pageUrl } : {}),
      ...(parsed.data.utmSource ? { utmSource: parsed.data.utmSource } : {}),
      ...(parsed.data.utmCampaign ? { utmCampaign: parsed.data.utmCampaign } : {}),
    },
    dedupKey: event.id,
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
