/**
 * Content Generator — Auth guard partagé pour Server Actions admin.
 *
 * Pattern : toute Server Action content-gen DOIT appeler `requireAdmin()`
 * en première ligne. Si la session est absente ou n'a pas le rôle admin,
 * on throw "unauthorized" ou "forbidden" (compat existing knowledge guards).
 *
 * Doctrine § 4.1bis : tout effet de bord côté admin DOIT passer par une
 * Server Action (pas d'appel client → API direct).
 *
 * --------------------------------------------------------------------------
 * POSTURE CSRF (City Domination 2026-05-18 P1-8 — audit A10 doctrine SOC2)
 * --------------------------------------------------------------------------
 * Le projet est protégé contre CSRF par 3 couches indépendantes :
 *
 *   1. Server Actions Next.js 16 (toutes les routes /[locale]/(admin)/* qui
 *      appellent des actions content-gen) — Next 16 enforce automatiquement
 *      `Origin === Host` + encrypted action IDs. Référence officielle :
 *      https://nextjs.org/docs/app/building-your-application/data-fetching/
 *      server-actions-and-mutations#security. Aucun token CSRF explicit
 *      requis — Next 16 le gère côté framework.
 *
 *   2. Auth.js v5 (NextAuth) — CSRF token built-in pour les forms auth
 *      (`/api/auth/*`). Cf. `authConfig` + session cookie HttpOnly +
 *      SameSite=Lax. Audit B5 2026-05-15 a validé cette couche.
 *
 *   3. API routes mutantes hors Server Actions (`/api/internal/*`,
 *      `/api/gdpr-*`, `/api/indexnow`, `/api/docuseal/webhook`,
 *      `/api/stripe/webhook`, `/api/unsubscribe`) — protégées par HMAC
 *      secret dans header/body OU webhook signature externe. Le browser
 *      d'une victime ne dispose PAS du secret HMAC (stocké en env worker
 *      BullMQ ou côté provider externe), donc CSRF cross-site impossible
 *      même si la victime a une session admin active.
 *
 * Aucun ajout de token CSRF explicit n'est nécessaire au-delà de ces 3
 * couches. Pour defense-in-depth additionnelle (rare cas API custom
 * future), utiliser `requireSameOrigin(req)` ci-dessous comme guard
 * supplémentaire.
 */

"use server";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export interface AdminSession {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, email: session.user.email, role };
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.role !== "super_admin") throw new Error("forbidden");
  return session;
}

/**
 * City Domination 2026-05-18 P1-30 (audit A10) — Wrapper auth + rate-limit
 * sliding window pour Server Actions admin de WRITE.
 *
 * Cap par défaut : 60 writes/min/admin. Couvre l'usage humain UI courant
 * (un admin n'écrit pas 60 settings/min en clic-UI) et bloque les abus
 * script/bot (loop curl-like sur Server Action endpoint).
 *
 * Throws Error("rate_limited") avec count/limit pour log côté caller.
 * Fail-open si Redis down (cf. `checkRateLimit` failOpen — préserve UX en
 * cas de panne infra, alerte Sentry à venir M11).
 *
 * Key Redis : `admin:write:${userId}:${actionId}` — un compteur par admin
 * × par action, pas un compteur global (évite qu'un admin bloque les autres).
 *
 * Exemple usage :
 *   const session = await requireAdminWriteRateLimited("update-batch-settings");
 *   await prisma.contentGenConfig.upsert(...);
 */
export async function requireAdminWriteRateLimited(
  actionId: string,
  options?: { limit?: number; windowSec?: number },
): Promise<AdminSession> {
  const session = await requireAdmin();
  const limit = options?.limit ?? 60;
  const windowSec = options?.windowSec ?? 60;
  const result = await checkRateLimit(`admin:write:${session.userId}:${actionId}`, {
    limit,
    windowSec,
  });
  if (!result.allowed) {
    throw new Error(`rate_limited:${actionId}:${result.count}/${limit}`);
  }
  return session;
}
