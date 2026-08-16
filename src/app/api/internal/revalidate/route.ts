/**
 * Content Generator — Revalidate trigger (Fix P1-16 audit opérationnel
 * 2026-05-14).
 *
 * Route interne appelée par les workers BullMQ background pour invalider
 * le cache Next 16 ISR (`revalidatePath` ne fonctionne PAS en worker bg
 * car nécessite un request context).
 *
 * Auth : HMAC via header `X-Revalidate-Secret` (env `REVALIDATE_SECRET`).
 * Sans secret en env, la route retourne 503 (anti-bypass public).
 *
 * Body JSON : `{ paths: string[], tags?: string[] }`.
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidateAndPurge } from "@/server/cache/revalidate-and-purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Comparaison constante-temps de deux secrets (anti-timing attack). On hashe
 * d'abord les deux côtés en SHA-256 (buffers de longueur fixe = 32 octets)
 * afin d'égaliser les longueurs : `timingSafeEqual` throw si les buffers ont
 * des tailles différentes, et comparer les longueurs brutes leak déjà de
 * l'info. Même posture que `verifyKbSignature` (src/lib/knowledge/hmac.ts).
 */
function constantTimeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return new Response("revalidate_secret_missing", { status: 503 });
  }

  // Rate-limit best-effort (sliding window Redis, fail-open si Redis down).
  // Cap par IP : un worker légitime envoie quelques revalidations/min ; au-delà
  // c'est un abus/brute-force du secret. Clé par IP forwarded (Caddy/Cloudflare).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = await checkRateLimit(`internal:revalidate:${ip}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) {
    return new Response("rate_limited", { status: 429 });
  }

  const headerSecret = req.headers.get("X-Revalidate-Secret");
  if (!headerSecret || !constantTimeEquals(headerSecret, secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: { paths?: string[]; tags?: string[] };
  try {
    body = (await req.json()) as { paths?: string[]; tags?: string[] };
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  // 🔴 GEO-120 — invalider l'origine NE SUFFIT PAS. `revalidatePath()` ne touche
  // que le cache Next ; Cloudflare continue de servir sa copie jusqu'à
  // expiration du `s-maxage` (1 h sur les hubs, 24 h sur l'éditorial). Mesuré à
  // l'audit du 2026-08-14 : aucune mutation de contenu ne purgeait l'edge, donc
  // publier rendait la page fraîche à l'origine et **périmée pour le public et
  // les crawlers** pendant tout ce délai. On passe désormais par le helper
  // partagé, qui enchaîne origine puis edge — dans cet ordre, jamais l'inverse.
  const invalidation = await revalidateAndPurge(
    body.paths ?? [],
    revalidatePath,
    "api/internal/revalidate",
  );
  const revalidatedPaths = invalidation.cheminsRevalides;
  const revalidatedTags: string[] = [];

  for (const tag of body.tags ?? []) {
    if (typeof tag === "string" && tag.length > 0) {
      try {
        // Next 16 requires a profile arg : `'default'` = cacheLife profile par
        // défaut (révalidation immédiate côté serveur, comportement identique
        // à `revalidateTag(tag)` Next 14/15). Profiles disponibles : default /
        // max / minutes / hours / days / weeks (cf. Next 16 cacheLife API).
        revalidateTag(tag, "default");
        revalidatedTags.push(tag);
      } catch {
        // log silencieux
      }
    }
  }

  return Response.json({
    revalidated: { paths: revalidatedPaths, tags: revalidatedTags },
    // Rendu explicite pour que l'appelant distingue « edge non configuré » (dev,
    // build stub) d'« edge purgé » — et voie ce que le plafond a écarté.
    edge: {
      configured: invalidation.edgeConfigure,
      purged: invalidation.urlsPurgees.length,
      skipped: invalidation.urlsEcartees,
    },
  });
}
