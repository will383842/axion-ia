/**
 * Webhook Calendly — livraison instantanée des réservations (2026-08-09).
 *
 * ⚠️ CETTE ROUTE EST INERTE PAR DÉFAUT, ET C'EST VOULU.
 *
 * Les abonnements webhook Calendly exigent un plan **Standard** minimum
 * (~12 €/mois) ; le plan gratuit n'y a pas droit. Tant que Will n'a pas
 * souscrit, `CALENDLY_WEBHOOK_SIGNING_KEY` est absent et cette route répond 200
 * sans rien faire. Le sondage BullMQ (≤ 60 s) reste alors le chemin nominal.
 *
 * Le jour où l'abonnement est pris :
 *   1. `pnpm calendly:webhook:subscribe` — crée l'abonnement, affiche la clé.
 *   2. Poser `CALENDLY_WEBHOOK_SIGNING_KEY` dans Coolify (application WEB).
 *   3. La route s'active seule. Latence : ~2 s au lieu de ~60 s.
 *
 * POURQUOI CETTE ROUTE NE PERSISTE RIEN ELLE-MÊME
 * -----------------------------------------------
 * Elle ne crée aucune ligne et n'émet aucune notification directement : elle
 * appelle `discoverNewCalendlyEvents()` / `refreshUpcomingCalendlyEvents()`,
 * exactement les fonctions que le worker appelle déjà.
 *
 * C'est un choix, pas un raccourci. Réimplémenter ici la création de ligne et
 * l'alerte donnerait un SECOND chemin d'écriture à maintenir en parallèle du
 * premier — deux façons de fabriquer un `CalendlyEvent`, deux formats de
 * `dedupKey`, et la certitude qu'ils divergeront. En déléguant :
 *
 *   · une réservation vue par le webhook ET par le sondage ne produit qu'une
 *     ligne (contrainte UNIQUE sur `invitee_uri`) et qu'une alerte (la clé de
 *     dédup Redis est la même, puisque c'est le même code qui l'émet) ;
 *   · le webhook peut être activé ou coupé sans rien changer d'autre ;
 *   · il n'y a qu'un seul endroit où corriger un bug d'enrichissement.
 *
 * Coût : 2 à 3 appels API Calendly par livraison. Négligeable devant le quota
 * de 60 requêtes/minute.
 */

import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCalendlySignature } from "@/server/calendly/webhook-signature";
import { discoverNewCalendlyEvents } from "@/server/calendly/discover";
import { refreshUpcomingCalendlyEvents } from "@/server/calendly/refresh";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { notify } from "@/server/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Taille maximale acceptée — un webhook Calendly pèse quelques kilo-octets. */
const MAX_BODY_BYTES = 128 * 1024;

export async function POST(req: NextRequest): Promise<Response> {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim();

  // Non configuré → 200 muet. Un 404 ou un 500 ferait désabonner Calendly au
  // bout de quelques échecs consécutifs ; un 200 laisse l'abonnement en vie si
  // quelqu'un l'a créé avant de poser la clé.
  if (!signingKey) {
    return Response.json({ ok: true, skipped: "not_configured" });
  }

  // Garde-fou de volume, AVANT toute vérification cryptographique : inutile de
  // calculer un HMAC sur un corps de 50 Mo envoyé par n'importe qui.
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response("payload_too_large", { status: 413 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = await checkRateLimit(`calendly-webhook:${ip}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return new Response("rate_limited", { status: 429 });

  // 🔴 `text()` et surtout PAS `json()` : la signature porte sur les octets
  // exacts. Cf. `webhook-signature.ts`.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response("unreadable_body", { status: 400 });
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return new Response("payload_too_large", { status: 413 });
  }

  const verdict = verifyCalendlySignature(
    rawBody,
    req.headers.get("Calendly-Webhook-Signature"),
    signingKey,
  );
  if (!verdict.ok) {
    // Une signature invalide sur un endpoint public, c'est soit une clé
    // désynchronisée après rotation, soit quelqu'un qui tente sa chance. Les
    // deux méritent d'être vus — mais l'alerte est plafonnée par le
    // `rateLimitPerHour` de la catégorie, sinon un scanner ferait 1000 alertes.
    void notify({
      category: "SECURITY_ALERT",
      payload: {
        kind: "calendly_webhook_signature_invalid",
        // IP hachée et pas en clair : une alerte de sécurité n'a pas besoin de
        // l'adresse elle-même pour être exploitable, seulement de savoir si
        // c'est toujours la même source. Cohérent avec le reste du projet
        // (`lib/security/ip-hash.ts`, registre RGPD).
        details: { reason: verdict.reason, ipHash: hashIp(ip) ?? "unknown" },
      },
    });
    return new Response("invalid_signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const eventType =
    body && typeof body === "object" && typeof (body as { event?: unknown }).event === "string"
      ? (body as { event: string }).event
      : null;

  try {
    if (eventType === "invitee.created") {
      // Couvre AUSSI le déplacement : Calendly émet un `invitee.created` portant
      // `old_invitee` quand un invité change de créneau. `discover` crée la
      // nouvelle ligne, et le `refresh` qui suit constate l'annulation de
      // l'ancienne — le couple d'alertes est donc correct sans cas particulier ici.
      await discoverNewCalendlyEvents();
    } else if (eventType === "invitee.canceled" || eventType === "invitee_no_show.created") {
      // `invitee_no_show.created` = l'hôte a coché « Mark as no-show ». Même
      // traitement qu'une annulation : le refresh re-interroge l'invitee, y lit
      // `no_show`, pose le statut et émet l'évènement CRM. Sans cette ligne, la
      // déclaration n'arrivait qu'au prochain sondage — ou jamais, si elle
      // tombait hors de la fenêtre de rattrapage.
      //
      // `invitee_no_show.deleted` (l'hôte se ravise) n'est VOLONTAIREMENT pas
      // traité : `enrich.ts` refuse de rétrograder un statut terminal, donc le
      // rejouer ne produirait rien. Rétablir un rendez-vous déclaré absent reste
      // un geste de console.
      await refreshUpcomingCalendlyEvents();
    } else {
      // Type inconnu (Calendly en ajoute au fil du temps) : 200 pour ne pas
      // provoquer de désabonnement, mais on le dit.
      return Response.json({ ok: true, ignored: eventType ?? "unknown" });
    }
  } catch (e) {
    // On ne renvoie PAS 500 : Calendly réessaie, et un échec transitoire côté
    // base produirait une tempête de rejeux. Le sondage rattrapera de toute façon
    // sous 60 s — c'est tout l'intérêt de garder les deux chemins.
    Sentry.captureException(e);
    return Response.json({ ok: false, error: "processing_failed" });
  }

  return Response.json({ ok: true, event: eventType });
}
