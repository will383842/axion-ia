/**
 * Rafraîchissement automatique des réservations Calendly (2026-07-30).
 *
 * POURQUOI CETTE ROUTE EXISTE
 * ───────────────────────────
 * L'enrichissement sait détecter une annulation ou un déplacement — mais il ne
 * tournait qu'à DEUX moments : à la capture d'une nouvelle réservation, et au
 * clic manuel du bouton « Enrichir depuis Calendly ».
 *
 * Autrement dit, la détection existait sans jamais se déclencher. Constaté en
 * conditions réelles : un rendez-vous annulé côté Calendly restait « Planifié »
 * dans la console, et aucune alerte ne partait. Will l'a résumé mieux que moi —
 * un bouton qu'il faut penser à cliquer n'est pas une fonctionnalité.
 *
 * Calendly (plan gratuit) n'envoie AUCUN webhook : il ne préviendra jamais le
 * site. La seule voie possible est donc l'interrogation périodique, avec le
 * même jeton API qui sert déjà à l'enrichissement. Aucun abonnement requis.
 *
 * Appelée toutes les heures par `.github/workflows/calendly-refresh.yml`.
 *
 * Auth : header `X-Revalidate-Secret` (même patron que `api/internal/revalidate`
 * et `api/internal/deploy-notify`) — secret DÉJÀ configuré des deux côtés, donc
 * rien à poser.
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isCalendlyApiConfigured } from "@/server/calendly/api";
import { discoverNewCalendlyEvents } from "@/server/calendly/discover";
import { refreshUpcomingCalendlyEvents } from "@/server/calendly/refresh";
import { updateTag } from "next/cache";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ⚠️ Depuis le 2026-08-09, cette route n'est PLUS le chemin nominal. Le sondage
// tourne toutes les minutes sur le worker BullMQ (`calendly-poll-worker.ts`), et
// le cron GitHub qui appelle cette route est passé toutes les 6 h : il ne sert
// plus que de filet si le worker meurt. La logique elle-même vit dans
// `server/calendly/{discover,refresh}.ts`, partagée par les deux appelants —
// ne pas la ré-inliner ici, les deux chemins divergeraient.

function constantTimeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return new Response("revalidate_secret_missing", { status: 503 });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = await checkRateLimit(`internal:calendly-refresh:${ip}`, { limit: 12, windowSec: 60 });
  if (!rl.allowed) return new Response("rate_limited", { status: 429 });

  const headerSecret = req.headers.get("X-Revalidate-Secret");
  if (!headerSecret || !constantTimeEquals(headerSecret, secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  // Sans jeton API, il n'y a rien à interroger. On répond 200 : ce n'est pas
  // une erreur, c'est une configuration — le workflow ne doit pas rougir.
  if (!isCalendlyApiConfigured()) {
    return Response.json({ ok: true, skipped: "calendly_api_not_configured" });
  }

  // ÉTAPE 1 — découvrir ce qu'on ne connaît pas encore (ADR 0038).
  //
  // Doit passer AVANT le rafraîchissement : une réservation prise sur
  // calendly.com n'existe dans aucune ligne, donc la boucle ci-dessous ne
  // pourrait jamais la voir. Depuis que /appel affiche des créneaux qui mènent
  // à calendly.com dans un nouvel onglet, c'est devenu le chemin principal.
  // Ne throw jamais ; un échec ici ne doit pas empêcher le rafraîchissement.
  const discovery = await discoverNewCalendlyEvents();

  // ÉTAPE 2 — rafraîchir les réservations connues (annulations, déplacements).
  const refresh = await refreshUpcomingCalendlyEvents();
  if (!refresh.ok) {
    return Response.json({ ok: false, error: refresh.reason ?? "refresh_failed" }, { status: 500 });
  }
  const { examined, updated, unchanged, failures, overflow } = refresh;

  // Un statut qui bascule — ou une réservation découverte — change le compteur
  // « à traiter » de la sidebar.
  if (updated > 0 || discovery.created > 0) {
    try {
      updateTag(INBOX_COUNTS_TAG);
    } catch {
      // Hors contexte de requête cachée : sans conséquence, le cache expire seul.
    }
  }

  return Response.json({
    ok: true,
    discovered: discovery.created,
    ...(discovery.ok ? {} : { discoveryError: discovery.reason ?? "unknown" }),
    ...(discovery.remaining ? { discoveryRemaining: discovery.remaining } : {}),
    examined,
    updated,
    unchanged,
    ...(Object.keys(failures).length > 0 ? { failures } : {}),
    // Signalé explicitement : une troncature muette ferait croire à une
    // couverture complète alors que des réservations n'ont pas été vues.
    ...(overflow ? { remaining: "cap atteint — augmenter MAX_PER_RUN ou la fréquence" } : {}),
  });
}
