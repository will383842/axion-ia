// Distance Haversine + travelBufferDays — Sprint X.16 / Booking V1.
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.16 § « Périmètre — Distance Haversine »
//   - Agent 5 P0-4/5 + Agent 11 P0-5
//
// Pure — sans dépendance ni I/O. Performant (O(1) trigonométrie).

const EARTH_RADIUS_KM = 6371;

/**
 * Distance grand-cercle entre 2 points GPS (degrés décimaux), formule Haversine.
 * Précision ~0,5 % suffisante pour calcul buffer trajet (pas pour GPS sub-mètre).
 */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Buffer jours bloqués par Will autour d'une intervention selon distance hub.
 *
 * Règles V1 :
 *   - < 50 km   → 0 jour (Paris intra-muros ou banlieue, retour J même)
 *   - < 500 km  → 0.5 jour (trajet aller OU retour matin/soir adjacent)
 *   - >= 500 km → 1 jour complet (avion ou train + nuitée hôtel)
 *
 * V1.5 : surcharge override par SiteSetting (admin peut ajuster les seuils).
 */
export type TravelBufferDays = 0 | 0.5 | 1;

export function computeTravelBufferDays(distance: number): TravelBufferDays {
  if (distance < 50) return 0;
  if (distance < 500) return 0.5;
  return 1;
}

/**
 * Hub Will (Paris par défaut, paramétrable via SiteSetting.hubLat/hubLng).
 * Coordonnées centrées Paris-1er (Châtelet).
 */
export const DEFAULT_HUB = {
  lat: 48.858844,
  lng: 2.347625,
  city: "Paris",
} as const;

/**
 * Calcule la distance d'une ville cible au hub + le buffer associé.
 * Helper haut niveau pour les Server Actions (createBookingAction, etc.).
 */
export function distanceAndBufferFromHub(
  targetLat: number,
  targetLng: number,
  hub: { lat: number; lng: number } = DEFAULT_HUB,
): { distanceKm: number; travelBufferDays: TravelBufferDays } {
  const d = distanceKm(hub.lat, hub.lng, targetLat, targetLng);
  return {
    distanceKm: d,
    travelBufferDays: computeTravelBufferDays(d),
  };
}
