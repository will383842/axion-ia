/**
 * Qualiopi — Inférence OPCO depuis le code NAF (APE).
 *
 * Map statique préfixe NAF (5 caractères exact ou 4 sans lettre) → OPCO.
 * Retourne `null` si inconnu (à déterminer manuellement côté CRM).
 *
 * Sources : liste officielle des branches par OPCO (DGEFP 2024).
 * Module PUR (pas d'import Prisma/next) — testable sans DB.
 */

/**
 * Map : code NAF exact (5 caractères, ex. "6201Z") → identifiant OPCO.
 *
 * Couverture :
 * - Atlas       : informatique, numérique, conseil
 * - Akto        : HCR, services à la personne
 * - Opcommerce  : commerce de détail / gros
 * - OPCO 2i     : industrie métallurgie
 * - Constructys : construction / BTP
 */
export const NAF_OPCO_MAP: Record<string, string> = {
  // ── Atlas (informatique, numérique, conseil, pub) ──
  "6201Z": "atlas",
  "6202A": "atlas",
  "6202B": "atlas",
  "6203Z": "atlas",
  "6209Z": "atlas",
  "6311Z": "atlas",
  "7022Z": "atlas",
  "7311Z": "atlas",
  // Édition logiciel / SaaS adjacent
  "5821Z": "atlas",
  "5829A": "atlas",
  "5829B": "atlas",
  "5829C": "atlas",
  // Traitement de données / hébergement
  "6312Z": "atlas",
  "6319Z": "atlas",
  // Ingénierie & études techniques (numérique)
  "7112B": "atlas",
  // Conseils en systèmes & logiciels
  "6204Z": "atlas",

  // ── Akto (HCR, services à la personne, propreté) ──
  "5510Z": "akto",
  "5520Z": "akto",
  "5530Z": "akto",
  "5590Z": "akto",
  "5610A": "akto",
  "5610B": "akto",
  "5610C": "akto",
  "5621Z": "akto",
  "5629A": "akto",
  "5629B": "akto",
  "5630Z": "akto",
  "9602A": "akto",
  "9602B": "akto",
  "8810A": "akto",
  "8810C": "akto",

  // ── Opcommerce (commerce de détail et gros) ──
  "4711A": "opcommerce",
  "4711B": "opcommerce",
  "4711C": "opcommerce",
  "4711D": "opcommerce",
  "4711E": "opcommerce",
  "4711F": "opcommerce",
  "4719A": "opcommerce",
  "4719B": "opcommerce",
  "4726Z": "opcommerce",
  "4741Z": "opcommerce",
  "4742Z": "opcommerce",
  "4743Z": "opcommerce",
  "4751Z": "opcommerce",
  "4752A": "opcommerce",
  "4752B": "opcommerce",
  "4753Z": "opcommerce",
  "4754Z": "opcommerce",
  "4759A": "opcommerce",
  "4759B": "opcommerce",
  "4771Z": "opcommerce",
  "4772A": "opcommerce",
  "4772B": "opcommerce",
  "4773Z": "opcommerce",
  "4774Z": "opcommerce",
  "4775Z": "opcommerce",
  "4776Z": "opcommerce",
  "4777Z": "opcommerce",
  "4778A": "opcommerce",
  "4778B": "opcommerce",
  "4779Z": "opcommerce",
  "4781Z": "opcommerce",
  "4782Z": "opcommerce",
  "4789Z": "opcommerce",

  // ── OPCO 2i (industrie métallurgie, chimie, plasturgie) ──
  "2562B": "opco2i",
  "2599B": "opco2i",
  "2849Z": "opco2i",
  "2410Z": "opco2i",
  "2420Z": "opco2i",
  "2431Z": "opco2i",
  "2432Z": "opco2i",
  "2433Z": "opco2i",
  "2434Z": "opco2i",
  "2441Z": "opco2i",
  "2442Z": "opco2i",
  "2443Z": "opco2i",
  "2444Z": "opco2i",
  "2445Z": "opco2i",
  "2446Z": "opco2i",
  "2451Z": "opco2i",
  "2452Z": "opco2i",
  "2453Z": "opco2i",
  "2454Z": "opco2i",
  "2511Z": "opco2i",
  "2512Z": "opco2i",
  "2521Z": "opco2i",
  "2529Z": "opco2i",
  "2530Z": "opco2i",
  "2540Z": "opco2i",
  "2550A": "opco2i",
  "2550B": "opco2i",
  "2561Z": "opco2i",
  "2562A": "opco2i",
  "2591Z": "opco2i",
  "2592Z": "opco2i",
  "2593Z": "opco2i",
  "2594Z": "opco2i",
  "2599A": "opco2i",

  // ── Constructys (BTP, construction) ──
  "4120A": "constructys",
  "4120B": "constructys",
  "4211Z": "constructys",
  "4212Z": "constructys",
  "4213A": "constructys",
  "4213B": "constructys",
  "4221Z": "constructys",
  "4222Z": "constructys",
  "4291Z": "constructys",
  "4299Z": "constructys",
  "4311Z": "constructys",
  "4312A": "constructys",
  "4312B": "constructys",
  "4313Z": "constructys",
  "4321A": "constructys",
  "4321B": "constructys",
  "4322A": "constructys",
  "4322B": "constructys",
  "4329A": "constructys",
  "4329B": "constructys",
  "4331Z": "constructys",
  "4332A": "constructys",
  "4332B": "constructys",
  "4332C": "constructys",
  "4333Z": "constructys",
  "4334Z": "constructys",
  "4339Z": "constructys",
  "4391A": "constructys",
  "4391B": "constructys",
  "4399A": "constructys",
  "4399B": "constructys",
  "4399C": "constructys",
  "4399D": "constructys",
  "4399E": "constructys",
  "7111Z": "constructys",
} as const;

/**
 * Infère l'OPCO depuis un code NAF (APE).
 *
 * - Recherche d'abord la correspondance exacte 5 caractères.
 * - Retourne `null` si inconnu ou si `naf` est null/undefined/vide.
 *
 * @param naf  Code NAF/APE (ex. "6201Z", "62.01Z" accepté — le point est ignoré).
 */
export function inferOpcoFromNaf(naf: string | null | undefined): string | null {
  if (!naf) return null;
  // Normaliser : retirer le point éventuel (ex. "62.01Z" → "6201Z"), majuscules
  const normalized = naf.replace(".", "").toUpperCase().trim();
  if (normalized.length === 0) return null;

  // Correspondance exacte (5 caractères)
  const exact = NAF_OPCO_MAP[normalized];
  if (exact !== undefined) return exact;

  // Correspondance par préfixe 4 caractères (fallback)
  const prefix4 = normalized.slice(0, 4);
  for (const [key, opco] of Object.entries(NAF_OPCO_MAP)) {
    if (key.startsWith(prefix4)) return opco;
  }

  return null;
}
