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
import { EXPIRATION_IMMEDIATE } from "@/server/cache/expiration-immediate";

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

  let body: { paths?: string[]; tags?: string[]; purgeEdge?: boolean };
  try {
    body = (await req.json()) as { paths?: string[]; tags?: string[]; purgeEdge?: boolean };
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  // 🔴 `purgeEdge: false` — ajouté le 2026-08-27 avec l'invalidation des créneaux.
  //
  // Purger l'edge est le bon défaut pour l'éditorial : ces pages SONT en cache
  // chez Cloudflare, et `revalidatePath` seul les laisserait périmées pour le
  // public (défaut GEO-120). Mais `/fr/appel` répond `private, no-store` et sort
  // en `cf-cache-status: BYPASS` — il n'y a aucune copie d'edge à purger.
  //
  // Sans cette option, brancher l'invalidation des créneaux sur le cron de deux
  // minutes émettrait **720 purges Cloudflare par jour pour rien**, à même le
  // quota du plan gratuit. L'appelant qui SAIT que sa page n'est pas à l'edge le
  // dit ; le défaut reste `true`, donc aucun appelant existant ne change de
  // comportement.
  const purgerLEdge = body.purgeEdge !== false;

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
    purgerLEdge,
  );
  const revalidatedPaths = invalidation.cheminsRevalides;
  const revalidatedTags: string[] = [];

  // 🔴 CE BLOC NE PURGEAIT RIEN, ET SE TAISAIT SUR SES ÉCHECS — corrigé le
  // 2026-08-27.
  //
  // Deux défauts distincts, qui se couvraient l'un l'autre :
  //
  // 1. `revalidateTag(tag, "default")` ne purge pas. Le commentaire retiré
  //    affirmait qu'il « reproduit `revalidateTag(tag)` des versions 14/15 » —
  //    c'est l'inverse, cf. `@/server/cache/expiration-immediate`. L'entrée
  //    était marquée périmée, et le visiteur suivant recevait quand même
  //    l'ancienne réponse.
  // 2. Le `catch {}` vide. Un échec d'invalidation rendait **200** avec
  //    l'étiquette absente de `revalidatedTags` — et personne ne lisait ce
  //    tableau. Une invalidation morte se lit exactement comme un cache à jour.
  const tagsEnEchec: Array<{ tag: string; raison: string }> = [];
  for (const tag of body.tags ?? []) {
    if (typeof tag === "string" && tag.length > 0) {
      try {
        revalidateTag(tag, EXPIRATION_IMMEDIATE);
        revalidatedTags.push(tag);
      } catch (e) {
        const raison = e instanceof Error ? e.message : String(e);
        tagsEnEchec.push({ tag, raison });
        console.error(
          JSON.stringify({
            event: "revalidate_tag_failed",
            tag,
            raison,
            contexte: "api/internal/revalidate",
          }),
        );
      }
    }
  }

  return Response.json({
    revalidated: { paths: revalidatedPaths, tags: revalidatedTags },
    // Diffusion conditionnelle et non `: undefined` — `exactOptionalPropertyTypes`
    // distingue « clé absente » de « clé à undefined », et l'appelant teste la
    // présence. Une étiquette en échec n'entre JAMAIS dans `revalidatedTags` :
    // c'est ce qui permet à `revalidateContent` de dégrader son verdict.
    ...(tagsEnEchec.length > 0 ? { tagsEnEchec } : {}),
    // Rendu explicite pour que l'appelant distingue « edge non configuré » (dev,
    // build stub) d'« edge purgé » — et voie ce que le plafond a écarté.
    edge: {
      configured: invalidation.edgeConfigure,
      purged: invalidation.urlsPurgees.length,
      skipped: invalidation.urlsEcartees,
    },
  });
}
