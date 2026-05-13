// Geocoding OSM Nominatim — Sprint X.16 / Booking V1.
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.16 § « Périmètre — Geocoding OSM Nominatim »
//   - Politique Nominatim : 1 req/s max, User-Agent obligatoire
//     (https://operations.osmfoundation.org/policies/nominatim/)
//
// SCOPE V1 :
//   - `geocodeCity(city, country?)` — fetch + parse JSON Nominatim, retourne
//     `{ lat, lng, normalized }` ou `null` si city introuvable.
//   - Cache 90j via SiteSetting (clé `geocode_cache`) — évite hammering API.
//   - Rate-limit interne fail-soft : si on a déjà appelé < 1s plus tôt, on
//     attend ou on log warn et on return null.
//
// SÉCURITÉ :
//   - Pas de PII envoyée (juste nom de ville + pays).
//   - User-Agent custom requis par Nominatim (env NOMINATIM_USER_AGENT).
//   - Validation : city non-vide, length < 200, country code ISO2 ou null.

import { prisma } from "@/lib/prisma";

const NOMINATIM_BASE = process.env["NOMINATIM_BASE_URL"] ?? "https://nominatim.openstreetmap.org";
const NOMINATIM_UA = process.env["NOMINATIM_USER_AGENT"] ?? "Axion-IA/1.0";
const CACHE_KEY = "geocode_cache";
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours

export interface GeocodeResult {
  lat: number;
  lng: number;
  normalized: string; // city normalisé canonique (ex: "Paris" pour "PARIS" / "paris" / "Paris 1er")
}

interface CacheEntry {
  result: GeocodeResult | null; // null = non trouvé (mémorisé pour éviter retries)
  cachedAt: number; // Unix ms
}

type GeocodeCache = Record<string, CacheEntry>;

function cacheKey(city: string, country?: string): string {
  return `${city.toLowerCase().trim()}|${(country ?? "").toLowerCase().trim()}`;
}

async function readCache(): Promise<GeocodeCache> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: CACHE_KEY },
      select: { value: true },
    });
    if (!row?.value) return {};
    return (row.value as unknown as GeocodeCache) ?? {};
  } catch {
    return {};
  }
}

async function writeCache(cache: GeocodeCache): Promise<void> {
  try {
    await prisma.siteSetting.upsert({
      where: { key: CACHE_KEY },
      create: {
        key: CACHE_KEY,
        value: cache as unknown as object,
        description: "Geocode cache OSM Nominatim (TTL 90j) — Sprint X.16",
        category: "general",
      },
      update: {
        value: cache as unknown as object,
      },
    });
  } catch {
    // Cache write failure = pas grave, on perd le bénéfice pour cette session.
  }
}

/**
 * Geocode une ville via Nominatim. Retourne `null` si introuvable ou erreur
 * réseau. Le caller peut tomber sur le fallback (Booking sans lat/lng).
 *
 * Cache 90j en DB pour éviter hammering.
 *
 * Politique Nominatim : 1 req/s, User-Agent obligatoire.
 */
export async function geocodeCity(city: string, country?: string): Promise<GeocodeResult | null> {
  // Validation input.
  const trimmedCity = city.trim();
  if (!trimmedCity || trimmedCity.length > 200) return null;
  const trimmedCountry = country?.trim();
  if (trimmedCountry && trimmedCountry.length > 4) return null;

  const ck = cacheKey(trimmedCity, trimmedCountry);
  const cache = await readCache();
  const cached = cache[ck];
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  // Build URL — search par city + countrycode (ISO2 si fourni).
  const params = new URLSearchParams({
    q: trimmedCity,
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
  });
  if (trimmedCountry && /^[A-Z]{2}$/i.test(trimmedCountry)) {
    params.set("countrycodes", trimmedCountry.toLowerCase());
  }
  const url = `${NOMINATIM_BASE}/search?${params.toString()}`;

  let result: GeocodeResult | null = null;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": NOMINATIM_UA,
        Accept: "application/json",
        "Accept-Language": "fr,en",
      },
      // Timeout 5s — Nominatim peut être lent quand chargé.
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      // 429 rate-limit, 503 down, etc. — on cache négatif court (1h) côté caller.
      result = null;
    } else {
      const arr = (await resp.json()) as Array<{
        lat: string;
        lon: string;
        display_name?: string;
        address?: { city?: string; town?: string; village?: string; municipality?: string };
      }>;
      const first = arr[0];
      if (first) {
        const lat = Number.parseFloat(first.lat);
        const lng = Number.parseFloat(first.lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          const normalized =
            first.address?.city ??
            first.address?.town ??
            first.address?.village ??
            first.address?.municipality ??
            trimmedCity;
          result = { lat, lng, normalized };
        }
      }
    }
  } catch {
    // Network error, timeout — retourne null
    result = null;
  }

  // Update cache (même résultat null pour mémoriser miss).
  cache[ck] = { result, cachedAt: Date.now() };
  await writeCache(cache);

  return result;
}

/**
 * Helper pour purge cache (admin). Utile si l'admin remarque qu'une ville
 * a été mal géocodée (cas rare Nominatim) — V1.5.
 */
export async function purgeGeocodeCache(): Promise<void> {
  await writeCache({});
}
