/**
 * KB V4 (Sprint KB-14) — Génération auto-SEO/AEO/GEO.
 *
 * V1 : stub déterministe (provider="stub", providerVersion="v1") — pas d'appel LLM.
 * Produit des sorties cohérentes basées sur le contenu existant. Cache persisté
 * dans `knowledge_seo_cache` pour éviter re-génération.
 *
 * V2 : wire provider OpenAI/Claude via env `KB_SEO_PROVIDER` (deferred).
 *
 * 3 fonctions :
 * - generateSeoMeta(translation) → title/description optimisés (60/160 chars)
 * - extractFaqQA(bodyText) → array {question, answer} pour FAQPage JSON-LD
 * - detectGeoEntities(bodyText) → array {kind, name, code} pour areaServed
 */

export const SEO_PROVIDER_STUB = "stub";
export const SEO_PROVIDER_VERSION = "v1";

const SEO_TITLE_MAX = 60; // sweet spot Google ; DB column = 70 (marge UTF-8)
const SEO_DESC_MAX = 158; // sweet spot Google ; DB column = 200

const FR_STOP_WORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "et",
  "ou",
  "à",
  "au",
  "aux",
  "en",
  "pour",
  "par",
  "sur",
  "avec",
  "sans",
  "dans",
  "ce",
  "cet",
  "cette",
  "ces",
  "que",
  "qui",
  "quoi",
  "dont",
  "où",
  "est",
  "sont",
  "été",
  "être",
  "avoir",
  "comme",
  "plus",
  "moins",
]);

export interface SeoMetaInput {
  readonly title: string;
  readonly excerpt?: string | null;
  readonly bodyText?: string | null;
  readonly locale: "fr" | "en";
}

export interface SeoMetaOutput {
  readonly seoTitle: string;
  readonly seoDescription: string;
}

/**
 * Génère un seoTitle ≤ 60 chars + seoDescription ≤ 158 chars.
 * Stub V1 : déterministe à partir du title + excerpt/bodyText.
 */
export function generateSeoMeta(input: SeoMetaInput): SeoMetaOutput {
  const title = input.title.trim();
  const seoTitle =
    title.length <= SEO_TITLE_MAX ? title : `${title.slice(0, SEO_TITLE_MAX - 1).trimEnd()}…`;

  const sourceForDesc = (
    input.excerpt && input.excerpt.trim().length > 0 ? input.excerpt : (input.bodyText ?? "")
  ).trim();

  if (sourceForDesc.length === 0) {
    return { seoTitle, seoDescription: seoTitle };
  }

  // Premier paragraphe / premières phrases
  const firstSentences = sourceForDesc
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ")
    .trim();

  const seoDescription =
    firstSentences.length <= SEO_DESC_MAX
      ? firstSentences
      : `${firstSentences.slice(0, SEO_DESC_MAX - 1).trimEnd()}…`;

  return { seoTitle, seoDescription };
}

export interface FaqQA {
  readonly question: string;
  readonly answer: string;
}

/**
 * Extrait des paires Q&A depuis le HTML/text pour FAQPage JSON-LD.
 *
 * Heuristique V1 :
 *  - Patterns "Q : ... R : ..." ou "Question ... Réponse ..."
 *  - H3/H4 qui terminent par "?" suivi du paragraphe
 *  - Limite : 5 QA max pour éviter spam FAQ
 *
 * Pour KB type=faq, l'entry elle-même devient l'unique QA (title = question).
 */
export function extractFaqQA(
  bodyText: string | null | undefined,
  title?: string,
): readonly FaqQA[] {
  if (!bodyText || bodyText.trim().length === 0) return [];

  const text = bodyText.replace(/\s+/g, " ").trim();
  const matches: FaqQA[] = [];

  // Pattern Q&A explicite
  const qaRegex =
    /(?:Q(?:uestion)?\s*[:.\-]\s*)([^?]{5,200}\?)\s*(?:R(?:éponse)?\s*[:.\-]\s*)([^Q]{20,400})/gi;
  for (const m of text.matchAll(qaRegex)) {
    matches.push({ question: m[1]!.trim(), answer: m[2]!.trim().replace(/\.$/, ".") });
    if (matches.length >= 5) break;
  }

  // Fallback titres se terminant par "?"
  if (matches.length === 0 && title && title.trim().endsWith("?")) {
    const firstParagraph = text.split(/\.\s+/)[0];
    if (firstParagraph && firstParagraph.length >= 20) {
      matches.push({ question: title.trim(), answer: `${firstParagraph}.` });
    }
  }

  return matches;
}

export interface GeoEntity {
  readonly kind: "region" | "city" | "country";
  readonly name: string;
  readonly code?: string;
}

const FRENCH_REGIONS_HINT = [
  "Île-de-France",
  "Auvergne-Rhône-Alpes",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Hauts-de-France",
  "Grand Est",
  "Provence-Alpes-Côte d'Azur",
  "Pays de la Loire",
  "Bretagne",
  "Normandie",
  "Bourgogne-Franche-Comté",
  "Centre-Val de Loire",
  "Corse",
];

const FRENCH_MAJOR_CITIES = [
  "Paris",
  "Marseille",
  "Lyon",
  "Toulouse",
  "Nice",
  "Nantes",
  "Strasbourg",
  "Montpellier",
  "Bordeaux",
  "Lille",
  "Rennes",
  "Reims",
  "Saint-Étienne",
  "Le Havre",
];

/**
 * Détecte régions/villes FR dans le texte → areaServed JSON-LD.
 *
 * Heuristique V1 :
 *  - Match exact (case-sensitive) sur 13 régions INSEE + top 14 villes
 *  - Si « France » mentionnée seule, fallback country=FR
 */
export function detectGeoEntities(
  bodyText: string | null | undefined,
  title?: string,
): readonly GeoEntity[] {
  const haystack = `${title ?? ""} ${bodyText ?? ""}`;
  if (haystack.trim().length === 0) return [];

  const found: GeoEntity[] = [];

  for (const region of FRENCH_REGIONS_HINT) {
    if (haystack.includes(region)) {
      found.push({ kind: "region", name: region });
    }
  }
  for (const city of FRENCH_MAJOR_CITIES) {
    // Word boundary pour éviter "Niçois" matchant Nice
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u");
    if (re.test(haystack)) {
      found.push({ kind: "city", name: city });
    }
  }

  if (found.length === 0 && /\bFrance\b/.test(haystack)) {
    found.push({ kind: "country", name: "France", code: "FR" });
  }

  // Dedup par name
  const seen = new Set<string>();
  return found.filter((g) => {
    if (seen.has(g.name)) return false;
    seen.add(g.name);
    return true;
  });
}

/**
 * Score « keywords density » utilisé par detectFromBody (helper interne — non exposé).
 * Gardé minimal pour V1, extensible V2 (TF-IDF, etc.).
 */
export function topKeywords(text: string, limit: number = 5): readonly string[] {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !FR_STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}
