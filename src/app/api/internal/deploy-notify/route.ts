/**
 * Notification de déploiement — route interne appelée par GitHub Actions
 * (`.github/workflows/deploy-coolify.yml`, job `notify`). 2026-07-29.
 *
 * POURQUOI PASSER PAR L'APPLICATION plutôt que d'appeler Telegram depuis le
 * workflow :
 *
 *   1. AUCUN NOUVEAU SECRET. `REVALIDATE_SECRET` est déjà configuré côté
 *      GitHub Actions ET côté conteneur — le premier jet demandait de poser
 *      `TELEGRAM_BOT_TOKEN` dans GitHub, donc de dupliquer un secret et
 *      d'attendre une action humaine avant que quoi que ce soit fonctionne.
 *   2. Les catégories `DEPLOY_SUCCESS` / `DEPLOY_FAILED` existaient depuis
 *      l'origine sans aucun émetteur. Elles sont enfin ÉMISES, par le hub —
 *      donc avec le routage vers le groupe « 🔔 Système », la déduplication et
 *      le rate-limit, ce qu'un `curl` direct dans le workflow n'aurait pas eu.
 *   3. Le format des messages reste celui de `format.ts`, cohérent avec toutes
 *      les autres alertes.
 *
 * Auth : header `X-Revalidate-Secret`, comparaison constante-temps — même
 * posture que `api/internal/revalidate`. Sans secret en env → 503.
 *
 * ⚠️ Cette route ne DÉCIDE de rien : elle rapporte le résultat que GitHub lui
 * transmet. C'est volontaire — l'application n'a aucun moyen de savoir si le
 * conteneur qui répond est l'ancien ou le nouveau.
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { notify } from "@/server/notifications";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  /** Résultat global : `true` si build ET deploy ont réussi. */
  success: z.boolean(),
  /** SHA court du commit déployé. */
  sha: z.string().max(64).optional(),
  branch: z.string().max(200).optional(),
  actor: z.string().max(120).optional(),
  /** Sujet du commit — tronqué, il finit dans un message Telegram. */
  subject: z.string().max(300).optional(),
  /** Conclusions GitHub des deux jobs (`success` / `failure` / `skipped`…). */
  buildResult: z.string().max(40).optional(),
  deployResult: z.string().max(40).optional(),
  /** Lien vers le run GitHub Actions. */
  runUrl: z.string().url().max(500).optional(),
});

/** Comparaison constante-temps (anti-timing), longueurs égalisées par SHA-256. */
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
  // Plafond bas : un déploiement légitime appelle cette route UNE fois.
  const rl = await checkRateLimit(`internal:deploy-notify:${ip}`, { limit: 10, windowSec: 60 });
  if (!rl.allowed) return new Response("rate_limited", { status: 429 });

  const headerSecret = req.headers.get("X-Revalidate-Secret");
  if (!headerSecret || !constantTimeEquals(headerSecret, secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response("invalid_json", { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return new Response("invalid_payload", { status: 400 });

  const d = parsed.data;
  const category = d.success ? "DEPLOY_SUCCESS" : "DEPLOY_FAILED";

  // En cas d'échec, on porte les conclusions GitHub dans `error` : c'est le
  // champ que le formateur met en avant, et savoir LEQUEL des deux jobs a
  // lâché oriente immédiatement le diagnostic (build ≠ deploy).
  const error = d.success
    ? undefined
    : `build=${d.buildResult ?? "?"} · deploy=${d.deployResult ?? "?"}`;

  await notify({
    category,
    payload: {
      sha: d.sha ?? "inconnu",
      ...(d.branch ? { branch: d.branch } : {}),
      ...(d.actor ? { actor: d.actor } : {}),
      ...(d.subject ? { subject: d.subject } : {}),
      ...(d.runUrl ? { runUrl: d.runUrl } : {}),
      ...(error ? { error } : {}),
    },
    // Dédup sur le SHA : un workflow relancé sur le même commit ne re-sonne
    // pas. Fenêtre courte — un vrai re-déploiement plus tard reste annonçable.
    dedupKey: `deploy-${d.success ? "ok" : "ko"}-${d.sha ?? "unknown"}`,
    dedupTtlSec: 600,
  });

  return Response.json({ ok: true, notified: category });
}
