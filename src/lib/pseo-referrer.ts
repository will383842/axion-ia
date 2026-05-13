// Helper cookie referrerCity pSEO — Sprint X.18 / Booking V1.
//
// Quand un visiteur arrive sur une page pSEO ville (ex.
// `/fr/audit/par-ville/lyon` ou `/fr/implantations/auvergne-rhone-alpes/lyon`),
// on persiste la ville d'arrivée dans un cookie. Si plus tard il soumet
// une demande (booking/contact/devis), on peut attribuer la conversion à
// cette source pSEO.
//
// Doctrine privacy-first :
//   - Pas de PII visiteur. Juste le slug ville/région (déjà public côté URL).
//   - SameSite=Lax (suit navigation cross-pages mais pas POST cross-site)
//   - HttpOnly (indispo JS client — anti-XSS vol attribution)
//   - 30 jours TTL (attribution window standard marketing)

export const REFERRER_CITY_COOKIE_NAME = "axion_ref_city";
export const REFERRER_REGION_COOKIE_NAME = "axion_ref_region";
export const REFERRER_PHASE_COOKIE_NAME = "axion_ref_phase";

const COOKIE_TTL_DAYS = 30;

export interface PseoReferrer {
  city?: string;
  region?: string;
  /** Phase pSEO (paris-pilote, tier1, tier2). */
  phase?: string;
}

/**
 * Construit les `Set-Cookie` headers à émettre depuis un middleware ou
 * un Server Component pSEO (via response.cookies.set).
 *
 * @param ref valeurs à persister (cookies déjà settées prennent le pas
 *            sauf override explicit ici).
 */
export function buildPseoReferrerCookies(ref: PseoReferrer): string[] {
  const out: string[] = [];
  const maxAge = COOKIE_TTL_DAYS * 24 * 60 * 60;
  const attrs = `Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure; HttpOnly`;
  if (ref.city) {
    out.push(`${REFERRER_CITY_COOKIE_NAME}=${encodeURIComponent(ref.city)}; ${attrs}`);
  }
  if (ref.region) {
    out.push(`${REFERRER_REGION_COOKIE_NAME}=${encodeURIComponent(ref.region)}; ${attrs}`);
  }
  if (ref.phase) {
    out.push(`${REFERRER_PHASE_COOKIE_NAME}=${encodeURIComponent(ref.phase)}; ${attrs}`);
  }
  return out;
}

/**
 * Sanitize une valeur cookie attendue (slug kebab-case).
 * Garde-fou anti-injection si jamais le cookie est tampered.
 */
export function sanitizeSlugValue(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  // Slug kebab-case : a-z, 0-9, tiret. Max 120 chars.
  const cleaned = decoded.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (cleaned.length === 0 || cleaned.length > 120) return undefined;
  return cleaned;
}

/**
 * Lecture côté Server Action (extraite proprement du store cookies).
 */
export interface ReadPseoReferrerInput {
  city: string | undefined;
  region: string | undefined;
  phase: string | undefined;
}

export function readPseoReferrer(input: ReadPseoReferrerInput): PseoReferrer {
  const out: PseoReferrer = {};
  const city = sanitizeSlugValue(input.city);
  const region = sanitizeSlugValue(input.region);
  const phase = sanitizeSlugValue(input.phase);
  if (city) out.city = city;
  if (region) out.region = region;
  if (phase) out.phase = phase;
  return out;
}
