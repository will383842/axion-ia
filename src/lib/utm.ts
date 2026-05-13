// UTM helpers — Sprint X.18 / Booking V1.
//
// Extraction des params UTM depuis URL + persistance cookie pour préserver
// l'attribution multi-pages (visiteur arrive sur /interventions via Google
// Ads → 3 clics plus tard à /reserver → on veut garder utm_source=google).
//
// Pas de PII collectée. Doctrine privacy-first cohérente avec Plausible
// (qui ignore par défaut les UTM sauf si activés).
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.18 § « Périmètre — Persistence tracking »

const UTM_COOKIE = "axion_utm";
const COOKIE_TTL_DAYS = 30; // standard attribution window

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

const UTM_KEYS: ReadonlyArray<keyof UtmParams> = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
];

/**
 * Parse UTM params depuis une URLSearchParams ou string.
 * Retourne `{}` si aucun param UTM trouvé.
 */
export function parseUtmFromUrl(input: URLSearchParams | URL | string): UtmParams {
  const params =
    input instanceof URLSearchParams
      ? input
      : input instanceof URL
        ? input.searchParams
        : new URL(input, "http://placeholder").searchParams;

  const out: UtmParams = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v && v.length > 0 && v.length <= 200) {
      // Sanitize : alphanum + tirets/underscores/points/espaces. Reject injection.
      const sanitized = v.replace(/[^\w\s.\-/+]/g, "").trim();
      if (sanitized) out[key] = sanitized;
    }
  }
  return out;
}

/**
 * Sérialise UtmParams en cookie value (base64url de JSON).
 * Format léger pour respecter la limite cookie 4KB.
 */
export function serializeUtmCookie(utm: UtmParams): string {
  const json = JSON.stringify(utm);
  // Use btoa (Edge runtime + browser) — base64 simple suffit ici (pas signé).
  if (typeof btoa === "function") {
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // Fallback Node : Buffer
  return Buffer.from(json, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function deserializeUtmCookie(value: string): UtmParams {
  try {
    const padded = value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
    const json =
      typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object") {
      const out: UtmParams = {};
      for (const key of UTM_KEYS) {
        const v = (parsed as Record<string, unknown>)[key];
        if (typeof v === "string" && v.length > 0 && v.length <= 200) out[key] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Header `Set-Cookie` à émettre depuis middleware/Server Action quand on
 * détecte des UTM params dans l'URL (et pas déjà cookies).
 *
 * Attribution window : 30 jours (standard marketing).
 *
 * Attributes :
 *   - SameSite=Lax  → suit navigation depuis ads cross-site
 *   - Secure        → HTTPS only
 *   - HttpOnly      → indispo JS client (anti-XSS vol attribution)
 *   - Path=/        → toutes les routes
 */
export function buildUtmSetCookie(utm: UtmParams): string {
  const value = serializeUtmCookie(utm);
  const maxAge = COOKIE_TTL_DAYS * 24 * 60 * 60;
  return `${UTM_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure; HttpOnly`;
}

/**
 * Lecture côté Server Action (depuis `cookies()` Next).
 */
export function readUtmCookie(cookieValue: string | undefined): UtmParams {
  if (!cookieValue) return {};
  return deserializeUtmCookie(cookieValue);
}

export const UTM_COOKIE_NAME = UTM_COOKIE;
