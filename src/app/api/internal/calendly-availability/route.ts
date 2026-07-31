/**
 * Diagnostic des disponibilités Calendly (2026-07-31).
 *
 * POURQUOI CETTE ROUTE EXISTE
 * ───────────────────────────
 * Le 2026-07-31, `/appel` s'arrêtait au vendredi 21 août alors que le code
 * interroge 28 jours. Impossible de dire, depuis l'extérieur, laquelle de ces
 * deux causes s'appliquait :
 *   • l'agenda Calendly ne va pas plus loin (réglage « date range ») ;
 *   • notre 4ᵉ fenêtre a échoué, et le code avale volontairement l'échec d'une
 *     fenêtre lointaine pour ne pas perdre les créneaux proches.
 * Les deux produisent exactement la même page. Il a fallu inférer depuis le
 * HTML public, sans pouvoir conclure.
 *
 * Cette route rend la réponse immédiate : elle relance la vraie résolution et
 * renvoie le diagnostic, sans toucher à la page ni à son cache.
 *
 * CE QU'ELLE NE RENVOIE PAS — aucun créneau nominatif, aucune donnée d'invité,
 * jamais le jeton. Uniquement des compteurs, les bornes de l'horizon, et le
 * résumé d'erreur renvoyé par Calendly. Les horaires libres sont de toute façon
 * publics sur `/appel` : il n'y a pas de fuite, et on s'en tient au strict
 * nécessaire au diagnostic.
 *
 * Auth : header `X-Revalidate-Secret`, même patron que `api/internal/revalidate`
 * et `api/internal/calendly-refresh` — secret déjà configuré, rien à poser.
 *
 * Usage :
 *   curl -s -X POST https://axion-ia.com/api/internal/calendly-availability \
 *        -H "X-Revalidate-Secret: $REVALIDATE_SECRET" | jq
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchAvailableSlots, parisDayKey } from "@/server/calendly/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const rl = await checkRateLimit(`internal:calendly-availability:${ip}`, {
    limit: 12,
    windowSec: 60,
  });
  if (!rl.allowed) return new Response("rate_limited", { status: 429 });

  const headerSecret = req.headers.get("X-Revalidate-Secret");
  if (!headerSecret || !constantTimeEquals(headerSecret, secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  const res = await fetchAvailableSlots({
    schedulingUrl: process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL,
  });

  if (!res.ok) {
    return Response.json({
      ok: false,
      reason: res.reason,
      ...(res.failure ? { failure: res.failure } : {}),
      ...(res.diagnostics ? { diagnostics: res.diagnostics } : {}),
    });
  }

  const creneaux = res.days.reduce((total, d) => total + d.slots.length, 0);
  const dernierJour = res.days.at(-1)?.dateKey ?? null;
  const { horizonEndIso } = res.diagnostics;

  return Response.json({
    ok: true,
    jours: res.days.length,
    creneaux,
    premierJour: res.days[0]?.dateKey ?? null,
    dernierJour,
    // La comparaison qui répond à la question « pourquoi ça s'arrête là ? » :
    // si le dernier jour réservable précède la fin de l'horizon SANS qu'aucune
    // fenêtre n'ait échoué, alors la limite vient bien de Calendly.
    finHorizonJour: parisDayKey(new Date(horizonEndIso)),
    couvertureComplete: dernierJour === parisDayKey(new Date(horizonEndIso)),
    diagnostics: res.diagnostics,
    // Répartition par jour : rend visible d'un coup d'œil une journée tronquée
    // par `maxSlotsPerDay` (le piège qui avait supprimé les après-midi).
    parJour: res.days.map((d) => ({
      jour: d.dateKey,
      creneaux: d.slots.length,
      premier: d.slots[0]?.startIso ?? null,
      dernier: d.slots.at(-1)?.startIso ?? null,
    })),
  });
}
