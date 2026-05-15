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

import type { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return new Response("revalidate_secret_missing", { status: 503 });
  }
  const headerSecret = req.headers.get("X-Revalidate-Secret");
  if (headerSecret !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: { paths?: string[]; tags?: string[] };
  try {
    body = (await req.json()) as { paths?: string[]; tags?: string[] };
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const revalidatedPaths: string[] = [];
  const revalidatedTags: string[] = [];

  for (const path of body.paths ?? []) {
    if (typeof path === "string" && path.startsWith("/")) {
      try {
        revalidatePath(path);
        revalidatedPaths.push(path);
      } catch {
        // log silencieux — best-effort
      }
    }
  }
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
  });
}
