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
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { enrichCalendlyEvent } from "@/server/calendly/enrich";
import { isCalendlyApiConfigured } from "@/server/calendly/api";
import { updateTag } from "next/cache";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nombre maximum de réservations revues par passage.
 *
 * Borne dure, pour deux raisons : ne pas marteler l'API Calendly (qui applique
 * ses propres quotas), et garantir une durée d'exécution prévisible. Avec un
 * passage horaire, 25 couvre très largement le flux réel — et si un jour ça
 * déborde, le compteur `restants` de la réponse le dira au lieu de tronquer en
 * silence.
 */
const MAX_PER_RUN = 25;

/**
 * Fenêtre de rattrapage après l'heure prévue.
 *
 * On continue de surveiller un créneau jusqu'à 2 h APRÈS son début : une
 * annulation de dernière minute est précisément celle qu'on veut connaître.
 * Au-delà, le rendez-vous a eu lieu (ou non) et ce n'est plus l'API qui le dira.
 */
const GRACE_HOURS = 2;

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

  const cutoff = new Date(Date.now() - GRACE_HOURS * 3600_000);

  // Candidats : ce qui peut ENCORE changer.
  //   • statut `scheduled` — un rendez-vous déjà annulé ou terminé est figé ;
  //   • une URI d'invitee — sans elle, rien à demander à Calendly ;
  //   • à venir, OU sans horaire connu (capture jamais enrichie : c'est
  //     justement le cas qu'on veut rattraper).
  let candidates: Array<{ id: string; startTime: Date | null }>;
  try {
    candidates = await prisma.calendlyEvent.findMany({
      where: {
        status: "scheduled",
        inviteeUri: { not: null },
        OR: [{ startTime: null }, { startTime: { gte: cutoff } }],
      },
      // Les plus proches d'abord : c'est là que l'information a le plus de valeur.
      orderBy: [{ startTime: "asc" }, { capturedAt: "desc" }],
      take: MAX_PER_RUN + 1,
      select: { id: true, startTime: true },
    });
  } catch {
    return Response.json({ ok: false, error: "db_read_failed" }, { status: 500 });
  }

  const overflow = candidates.length > MAX_PER_RUN;
  const batch = candidates.slice(0, MAX_PER_RUN);

  let updated = 0;
  let unchanged = 0;
  const failures: Record<string, number> = {};

  // Séquentiel et non parallèle : on préfère être lent et poli avec l'API
  // Calendly plutôt que rapide et rate-limité. 25 appels valent quelques
  // secondes, largement dans le budget d'un cron horaire.
  for (const c of batch) {
    const res = await enrichCalendlyEvent(c.id);
    if (res.ok) {
      if (res.updatedFields.length > 0) updated += 1;
      else unchanged += 1;
    } else {
      failures[res.reason] = (failures[res.reason] ?? 0) + 1;
    }
  }

  // Un statut qui bascule change le compteur « à traiter » de la sidebar.
  if (updated > 0) {
    try {
      updateTag(INBOX_COUNTS_TAG);
    } catch {
      // Hors contexte de requête cachée : sans conséquence, le cache expire seul.
    }
  }

  return Response.json({
    ok: true,
    examined: batch.length,
    updated,
    unchanged,
    ...(Object.keys(failures).length > 0 ? { failures } : {}),
    // Signalé explicitement : une troncature muette ferait croire à une
    // couverture complète alors que des réservations n'ont pas été vues.
    ...(overflow ? { remaining: "cap atteint — augmenter MAX_PER_RUN ou la fréquence" } : {}),
  });
}
