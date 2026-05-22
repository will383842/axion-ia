/**
 * Geo-keyword → cityIds resolver — V-12 P1 correction (2026-05-22).
 *
 * Extrait les codes INSEE des villes mentionnées dans le keyword (ou urlCible).
 * Source de vérité : `prisma/seeds/cities/cities-france-5000plus.json` (225 villes
 * pilote ≥5000 hab — extensible 2100 villes via INSEE complet).
 *
 * Convention `cityIds[]` : on stocke des **codes INSEE** (clé stable, non
 * dépendante des cuid générés à l'upsert + alignée avec `City.inseeCode`).
 *
 * Stratégie matching (ordre) :
 *   1. urlCible contient le slug ville (ex: `/fr/audit/paris` → 75056)
 *   2. keyword contient le nom ville (case-insensitive, frontières mot-mot)
 *      - tri longueur décroissante pour éviter "Le Mans" capturé par "Mans"
 *      - exclusions des mots-courts ambigus (Sète, Ax, Aix, Eu, etc.)
 *
 * Performance : import JSON statique → pas de I/O au seed time.
 */
import citiesRaw from "../../../prisma/seeds/cities/cities-france-5000plus.json";

interface CityRecord {
  slug: string;
  name: string;
  inseeCode: string;
}

const CITIES: readonly CityRecord[] = citiesRaw as readonly CityRecord[];

/**
 * Villes dont le nom est un mot trop ambigu (collision FR fréquente).
 * Inclues UNIQUEMENT si urlCible contient le slug (signal fort).
 */
const AMBIGUOUS_NAMES = new Set<string>([
  "ax",
  "aix",
  "eu",
  "sète",
  "sete",
  "pau",
  "auch",
  "alès",
  "ales",
  "albi",
  "agen",
]);

/**
 * Index slug → city (lookup urlCible rapide).
 */
const BY_SLUG = new Map<string, CityRecord>(CITIES.map((c) => [c.slug.toLowerCase(), c]));

/**
 * Index nom (lowercase, sans accents) → city, trié longueur décroissante.
 * Évite "Le Mans" matchant "Mans" : on tente "Le Mans" d'abord.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

const BY_NAME_SORTED: ReadonlyArray<{ name: string; nameNorm: string; record: CityRecord }> = CITIES
  .map((c) => ({ name: c.name, nameNorm: normalize(c.name), record: c }))
  .sort((a, b) => b.nameNorm.length - a.nameNorm.length);

/**
 * Échappe une string pour usage dans une regex.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cache : pour chaque nom normalisé, regex pré-compilée frontière-mot.
 * Les frontières utilisent (^|[\s\-,]) et ([\s\-,]|$) car \b ne fonctionne pas
 * correctement avec les caractères accentués + tirets en français.
 */
const NAME_REGEXES = new Map<string, RegExp>();
for (const { nameNorm } of BY_NAME_SORTED) {
  NAME_REGEXES.set(nameNorm, new RegExp(`(^|[\\s\\-,])${escapeRegex(nameNorm)}([\\s\\-,]|$)`, "i"));
}

/**
 * Extrait les codes INSEE des villes mentionnées dans un keyword/urlCible.
 *
 * @param keyword   Texte du keyword (ex: "audit IA Paris Île-de-France")
 * @param urlCible  URL cible (ex: "/fr/audit/paris")
 * @returns         Codes INSEE uniques triés (ex: ["75056"])
 */
export function extractCityInseeCodes(keyword: string, urlCible: string): string[] {
  const found = new Set<string>();

  // 1. urlCible : extraire le dernier segment (slug ville probable)
  const urlLower = urlCible.toLowerCase();
  const segments = urlLower.split("/").filter(Boolean);
  for (const seg of segments) {
    const city = BY_SLUG.get(seg);
    if (city) found.add(city.inseeCode);
  }

  // 2. keyword : matcher noms (longueur décroissante, frontière mot)
  const keywordNorm = normalize(keyword);
  for (const { nameNorm, record } of BY_NAME_SORTED) {
    // Skip noms ambigus sauf si déjà trouvé via urlCible
    if (AMBIGUOUS_NAMES.has(nameNorm) && !found.has(record.inseeCode)) continue;

    const re = NAME_REGEXES.get(nameNorm);
    if (re && re.test(keywordNorm)) {
      found.add(record.inseeCode);
    }
  }

  return [...found].sort();
}

/** Total villes connues. */
export const KNOWN_CITIES_COUNT = CITIES.length;
