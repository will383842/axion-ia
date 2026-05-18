/**
 * Same-Origin guard — defense-in-depth CSRF pour API routes custom.
 *
 * City Domination 2026-05-18 P1-8 (audit A10 doctrine SOC2 hardening).
 *
 * Posture CSRF globale projet documentée dans `src/server/actions/content-gen/
 * _auth.ts` (3 couches : Server Actions Next 16 + Auth.js v5 + HMAC API).
 * Ce helper est UN SUPPLÉMENT optionnel à appeler depuis des API routes custom
 * qui n'ont pas de HMAC token (rare) et veulent malgré tout un guard CSRF.
 *
 * Stratégie :
 *   1. Lit `Origin` header (envoyé par tous les browsers modernes pour POST/
 *      PUT/PATCH/DELETE depuis Chrome 76+, Firefox 70+, Safari 14+).
 *   2. Fallback sur `Referer` si Origin absent (anciens browsers / proxies).
 *   3. Compare au `Host` header (avec gestion HTTPS forward-proto via Caddy /
 *      Cloudflare → `X-Forwarded-Host` privilégié si présent).
 *
 * Si origin ≠ host → throw `cross_origin_forbidden`. Le caller doit catch et
 * retourner 403.
 *
 * Cas particuliers :
 *   - Origin: null → request fetch sans credentials OU same-origin top-level
 *     nav. On tolère (les attaques CSRF typiques émettent un Origin custom).
 *   - Referer manquant + Origin manquant → on REFUSE (suspect, request POST
 *     sans context = très probablement bot/CLI sans credentials valides).
 *
 * Usage type :
 *   import { requireSameOrigin } from "@/lib/same-origin";
 *   export async function POST(req: NextRequest) {
 *     try { requireSameOrigin(req); } catch { return new Response("forbidden", { status: 403 }); }
 *     // ... business logic
 *   }
 */

import type { NextRequest } from "next/server";

const TRUSTED_ORIGINS = new Set<string>([
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com",
  "https://axion-ia.com",
  "https://www.axion-ia.com",
  // Dev local — toléré uniquement si NODE_ENV=development
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
]);

function normalizeOriginUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function hostFromRequest(req: NextRequest): string | null {
  // Caddy + Cloudflare ajoutent X-Forwarded-Host. On le privilégie pour éviter
  // les bypass via Host header spoofing au niveau de l'origin Hetzner CPX42.
  const xfh = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!xfh) return null;
  const proto =
    req.headers.get("x-forwarded-proto") ?? (req.url.startsWith("https://") ? "https" : "http");
  return `${proto}://${xfh}`;
}

export interface SameOriginOptions {
  /** Tolère Origin: null (default true — fetch sans credentials, same-origin nav). */
  readonly allowMissingOrigin?: boolean;
  /** Origins additionnels (ex. preview deployments Coolify branch). */
  readonly extraTrustedOrigins?: ReadonlyArray<string>;
}

/**
 * Throw `cross_origin_forbidden` si le request semble venir d'un autre origin.
 * Caller responsable de catch et retourner 403.
 */
export function requireSameOrigin(req: NextRequest, options?: SameOriginOptions): void {
  const allowMissingOrigin = options?.allowMissingOrigin ?? true;
  const trusted = new Set(TRUSTED_ORIGINS);
  if (options?.extraTrustedOrigins) {
    for (const o of options.extraTrustedOrigins) {
      const n = normalizeOriginUrl(o);
      if (n) trusted.add(n);
    }
  }

  const originHeader = normalizeOriginUrl(req.headers.get("origin"));
  const refererHeader = normalizeOriginUrl(req.headers.get("referer"));
  const hostUrl = normalizeOriginUrl(hostFromRequest(req));

  if (hostUrl) trusted.add(hostUrl);

  // Priorité Origin (plus fiable que Referer, non-spoofable côté browser).
  if (originHeader) {
    if (!trusted.has(originHeader)) {
      throw new Error("cross_origin_forbidden");
    }
    return;
  }

  // Fallback Referer (browsers anciens / privacy modes qui suppriment Origin).
  if (refererHeader) {
    if (!trusted.has(refererHeader)) {
      throw new Error("cross_origin_forbidden");
    }
    return;
  }

  // Aucun Origin ni Referer.
  if (!allowMissingOrigin) {
    throw new Error("cross_origin_forbidden");
  }
}
