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

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/same-origin";
import { prisma } from "@/lib/prisma";
import { syncCalendlyEventToCrm } from "@/server/crm-sync";
import { notify } from "@/server/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { enrichCalendlyEvent } from "@/server/calendly/enrich";
import { isCalendlyApiConfigured } from "@/server/calendly/api";
import {
  canalDuRendezVous,
  COULEUR_GOOGLE_CANAL,
  type CanalRendezVous,
} from "@/server/calendly/canal";
import { colorerReservationCalendly } from "@/server/google-calendar/events";

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

/**
 * Même plafond que le jumeau `api/calendly/webhook` — un évènement pèse quelques
 * kilo-octets.
 *
 * ⚠️ Et comme lui, mesuré DEUX FOIS : l'en-tête déclaré (refus précoce), puis
 * les octets réellement lus. Le premier seul ne borne rien — `content-length`
 * absent (`Transfer-Encoding: chunked`, HTTP/2) ou non numérique le saute, et le
 * corps entier finit dans la colonne `raw_payload`, qui n'est pas bornée.
 */
const MAX_BODY_BYTES = 128 * 1024;

/**
 * Les PII que le payload peut porter — bornées, et JAMAIS bloquantes.
 *
 * 🔴 Elles étaient lues par un simple `typeof === "string"`, sans plafond ni
 * validation, puis écrites telles quelles. Un `invitee.name` de 300 caractères
 * dépassait le `@db.VarChar(255)` : Postgres levait `22001`, que le `catch`
 * n'interceptait pas (seul `P2002` l'était) — la route rendait **500**.
 *
 * ⚠️ MAIS LE REMÈDE NE DOIT PAS COÛTER LA RÉSERVATION. Une première version de
 * ce correctif rendait 400 sur toute valeur hors bornes — y compris sur une
 * chaîne VIDE, que le formulaire Calendly produit quand un champ facultatif
 * n'est pas rempli. Elle perdait donc la ligne, la synchro CRM et l'alerte, sur
 * la seule route qui capte des prospects. C'est plus grave que le 500 qu'elle
 * corrigeait.
 *
 * `.catch(undefined)` par champ : une valeur illisible, vide ou trop longue
 * devient ABSENTE, et la réservation est enregistrée quand même. C'est cohérent
 * avec le contrat de ce fichier — les PII y sont best-effort, l'enrichissement
 * Calendly repose le vrai nom une minute plus tard. Ce qu'on empêche, c'est
 * l'écriture d'une valeur qui fait tomber Postgres ; pas la capture du lead.
 */
const InviteePiiSchema = z.object({
  name: z.string().trim().min(1).max(255).optional().catch(undefined),
  email: z.string().trim().email().max(255).optional().catch(undefined),
});

/**
 * Clé de déduplication d'alerte, dérivée du FAIT et non de la ligne écrite.
 *
 * L'ancienne clé était `event.id` : l'identifiant de la ligne qu'on venait de
 * créer, donc différent à chaque appel. Le dédoublonnage du hub ne pouvait
 * jamais s'appliquer, et une route publique pouvait donc émettre autant
 * d'alertes que de lignes fabriquées.
 *
 * ⚠️ Le repli SANS `inviteeUri` inclut le JOUR, pas l'instant : deux
 * signalements du même rendez-vous à quelques minutes d'écart doivent tomber
 * sur la même clé. Il n'inclut pas non plus l'IP — sinon deux sources
 * différentes rapportant le même fait rouvriraient deux alertes.
 *
 * ⚠️ LA GRANULARITÉ RÉELLE N'EST PAS LA JOURNÉE : le hub applique un TTL de
 * déduplication de **300 secondes** (`server/notifications/index.ts`,
 * `dedupTtlSec ?? 300`). Inclure le jour dans la clé ne fait donc pas taire une
 * alerte pendant 24 h — il évite seulement qu'une même clé change en cours de
 * fenêtre. Deux réservations distinctes du même type, sans adresse et sans URI,
 * partagent la clé pendant ces 5 minutes : la seconde alerte est ravalée, mais
 * les deux LIGNES existent. Cas dégénéré, mesuré, assumé.
 *
 * L'adresse est hachée : une clé de déduplication traverse Redis et les
 * journaux, elle n'a pas à y porter une adresse en clair.
 */
function dedupKeyDuFait(
  inviteeUri: string | undefined,
  email: string | null | undefined,
  slug: string,
): string {
  if (inviteeUri) return `cal-created:${inviteeUri}`;
  const jour = new Date().toISOString().slice(0, 10);
  const empreinte = crypto
    .createHash("sha256")
    .update(`${(email ?? "").toLowerCase()}|${slug}|${jour}`)
    .digest("hex")
    .slice(0, 32);
  return `cal-created:${empreinte}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 0. CONTRÔLE D'ORIGINE — ajouté le 2026-08-27.
  //
  // Cette route écrit sans authentification : une requête portant l'adresse d'un
  // tiers crée une ligne `calendly_events`, **une personne dans le CRM** avec un
  // évènement « réservé » dans sa chronologie (écriture asynchrone via l'outbox,
  // donc irréversible), et une alerte sur le téléphone du gérant.
  //
  // 🔴 CE QUE CETTE GARDE FERME, ET CE QU'ELLE NE FERME PAS. À écrire noir sur
  // blanc, parce qu'une première rédaction de ce bloc annonçait « porte fermée »
  // et un contradicteur l'a démentie EN L'EXÉCUTANT :
  //
  //   ✅ elle ferme le CSRF navigateur — une page tierce ne peut pas poser
  //      d'`Origin` mensonger, le navigateur l'impose ;
  //   ✅ elle ferme le balayage automatisé naïf et le `curl` nu ;
  //   ❌ elle NE ferme PAS l'appel scripté informé. `TRUSTED_ORIGINS` contient
  //      `https://axion-ia.com` en dur : `curl -H 'Origin: https://axion-ia.com'`
  //      passe. Le scénario « fabriquer une fiche CRM au nom d'un tiers » reste
  //      donc atteignable par qui prend la peine d'ajouter un en-tête.
  //
  // Fermer vraiment demanderait un jeton court signé, émis par la page `/appel`
  // — le patron existe déjà dans le dépôt, sur les Server Actions du pipeline
  // éditorial. C'est un lot à part, mais il ne fallait PAS laisser croire le
  // sujet clos : une porte qu'on croit fermée cesse d'être surveillée.
  //
  // ⚠️ `allowMissingOrigin: false` est indispensable : le défaut du helper est
  // `true`, et tolère l'absence d'`Origin` ET de `Referer` — avec lui, cette
  // garde n'aurait rien gardé du tout. Un `fetch()` de navigateur en POST envoie
  // toujours `Origin`, même same-origin (spécification Fetch : tout ce qui n'est
  // pas GET/HEAD). Seul appelant légitime : `CalendlyEventCapture.tsx`.
  //
  // Placé AVANT le compteur de débit, à dessein : il est gratuit et sans état,
  // là où le compteur écrit dans Redis.
  try {
    requireSameOrigin(req, { allowMissingOrigin: false });
  } catch {
    return NextResponse.json({ error: "cross_origin_forbidden" }, { status: 403 });
  }

  // 0 bis. Plafond de volume — DEUX mesures, comme le jumeau webhook.
  //
  // ⚠️ LE CONTRÔLE D'EN-TÊTE SEUL NE BORNE RIEN, et une première version de ce
  // correctif ne faisait que ça en annonçant « même plafond que le jumeau ».
  // `content-length` est déclaré par l'appelant : absent (`Transfer-Encoding:
  // chunked`), menteur, ou non numérique, et le contrôle est sauté — après quoi
  // `req.json()` lit le corps entier, qui finit dans la colonne `raw_payload`.
  //
  // Le refus précoce reste utile (il évite de lire 50 Mo quand l'appelant est
  // honnête), mais la mesure qui compte est celle d'APRÈS lecture.
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

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

  // 2. Parse JSON — après la SECONDE mesure de taille, celle qui borne vraiment.
  let brut: string;
  try {
    brut = await req.text();
  } catch {
    return NextResponse.json({ error: "unreadable_body" }, { status: 400 });
  }
  // `Buffer.byteLength` et non `.length` : une chaîne de 128 000 caractères
  // accentués pèse le double en octets, et c'est en octets que la colonne se
  // remplit.
  if (Buffer.byteLength(brut, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(brut) as unknown;
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
  // 🔴 VALIDÉES, pas seulement typées (cf. `InviteePiiSchema`). Une valeur
  // présente mais hors bornes est un REFUS explicite : la tronquer écrirait en
  // base une donnée que l'appelant n'a pas envoyée, et la laisser passer rendait
  // 500 sur une contrainte Postgres.
  // `parse` et non `safeParse` : chaque champ porte son `.catch`, le schéma ne
  // peut donc plus lever, et l'entrée est un objet littéral construit ici même.
  // Un `safeParse` ajouterait une branche morte.
  const pii = InviteePiiSchema.parse({
    ...(typeof invitee["name"] === "string" ? { name: invitee["name"] } : {}),
    ...(typeof invitee["email"] === "string" ? { email: invitee["email"] } : {}),
  });
  const inviteeName = pii.name;
  const inviteeEmail = pii.email;
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

  // 7 bis. Synchro CRM (lot L2). Sans adresse d'invité, on ne peut pas
  // calculer la clé de personne : on n'émet rien plutôt que d'inventer une
  // fiche anonyme. L'enrichissement API (étape 8) la récupérera peut-être, et
  // c'est le passage `discover` qui portera alors l'événement.
  if (inviteeEmail) {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: `site:calendly_event:${event.id}`,
      sourceSlug: "calendly",
      person: { email: inviteeEmail, fullName: inviteeName ?? null },
      payload: {
        eventTypeSlug: parsed.data.eventTypeSlug,
        pageUrl: parsed.data.pageUrl,
        ...(parsed.data.utmSource ? { utmSource: parsed.data.utmSource } : {}),
        ...(parsed.data.utmCampaign ? { utmCampaign: parsed.data.utmCampaign } : {}),
        ...(parsed.data.utmMedium ? { utmMedium: parsed.data.utmMedium } : {}),
      },
    });
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
  // Le format n'est connaissable qu'APRÈS l'enrichissement : le postMessage de
  // l'embed ne transmet aucun lieu. Tant qu'on ne l'a pas, il vaut « inconnu »
  // — et l'alerte se tait alors sur le sujet plutôt que d'affirmer.
  let format: CanalRendezVous = "inconnu";
  let debutRdv: Date | null = null;
  if (enriched?.ok) {
    const fresh = await prisma.calendlyEvent
      .findUnique({
        where: { id: event.id },
        select: {
          inviteeName: true,
          inviteeEmail: true,
          startTime: true,
          location: true,
          rawPayload: true,
        },
      })
      .catch(() => null);
    if (fresh) {
      notifyName = fresh.inviteeName ?? notifyName;
      notifyEmail = fresh.inviteeEmail ?? notifyEmail;
      notifyStart = fresh.startTime?.toISOString() ?? null;
      format = canalDuRendezVous(fresh.location, fresh.rawPayload);
      debutRdv = fresh.startTime;
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
      // Omis quand il n'est pas établi : l'alerte préfère se taire à affirmer.
      ...(format === "inconnu" ? {} : { format }),
      ...(parsed.data.pageUrl ? { pageUrl: parsed.data.pageUrl } : {}),
      ...(parsed.data.utmSource ? { utmSource: parsed.data.utmSource } : {}),
      ...(parsed.data.utmCampaign ? { utmCampaign: parsed.data.utmCampaign } : {}),
      ...(enriched?.ok && enriched.answersText ? { answersText: enriched.answersText } : {}),
    },
    // 🔴 La clé était `event.id` — l'identifiant de la ligne qu'on VIENT de
    // créer, donc neuf à chaque appel. Elle ne pouvait rien dédoublonner : la
    // route pouvait émettre autant d'alertes que de lignes fabriquées.
    // Dérivée du FAIT désormais : la réservation identifiée par son URI
    // d'invité quand Calendly la fournit, sinon par le triplet
    // adresse + type + jour. Deux signalements du même rendez-vous n'émettent
    // qu'une alerte, quel que soit le nombre de lignes créées.
    dedupKey: dedupKeyDuFait(inviteeUri, notifyEmail, parsed.data.eventTypeSlug),
  });

  // 10. Couleur du format dans l'agenda Google — best-effort, jamais bloquant.
  //     Même raisonnement qu'en `discover.ts` : Calendly met quelques secondes
  //     à écrire son événement, une couleur manquante n'empêche rien.
  if (debutRdv) {
    try {
      await colorerReservationCalendly(debutRdv, COULEUR_GOOGLE_CANAL[format]);
    } catch {
      // Une coloration ratée n'a jamais empêché un rendez-vous d'avoir lieu.
    }
  }

  return NextResponse.json({ ok: true, eventId: event.id });
}
