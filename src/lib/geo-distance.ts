// Distance grand-cercle entre deux points WGS84 (formule de Haversine).
//
// Module SANS AUCUN import (lot L2c du chantier formateurs) : la console et le
// worker l'appellent sans charger le contenu SEO de `lib/geo.ts`, qui le
// ré-exporte — une seule source, aucun appelant ne change.

const EARTH_RADIUS_KM = 6371;

/** Distance grand-cercle en kilomètres (formule de Haversine). */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
