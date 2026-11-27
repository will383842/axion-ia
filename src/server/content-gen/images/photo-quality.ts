/**
 * Content Generator — règles de qualité des photos Unsplash (logique PURE).
 *
 * Interrupteur `CONTENT_IMAGES_QUALITE` : actif par défaut ; seule la valeur
 * exacte "false" rétablit le comportement d'avant (premier résultat, aucune
 * mesure de pertinence, aucune mémoire anti-doublon).
 *
 * Doctrine : Unsplash UNIQUEMENT (aucune image générée par IA), attribution du
 * photographe conservée (CGU Unsplash). Aucun appel au modèle de langue ici :
 * la pertinence se mesure sur les résultats déjà reçus (zéro appel en plus).
 */

export const MIN_PHOTO_WIDTH = 1600;
export const MIN_LANDSCAPE_RATIO = 1.2;
/** Part minimale des mots du sujet retrouvés dans la description de la photo. */
export const MIN_RELEVANCE = 0.25;

export function imageQualityEnabled(): boolean {
  return process.env["CONTENT_IMAGES_QUALITE"] !== "false";
}

/** Champs d'une photo Unsplash utiles au tri (sous-ensemble structurel). */
export interface CandidatePhoto {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly likes: number;
  readonly description?: string | null;
  readonly alt_description?: string | null;
  readonly tags?: ReadonlyArray<{ readonly title?: string | null }> | null;
  readonly urls: { readonly regular: string };
}

/**
 * Clé stable d'une photo, lue dans l'URL `images.unsplash.com/photo-<ts>-<hash>`.
 * Le base ne stocke que l'URL (pas l'id d'API) : c'est la seule clé commune
 * entre `Article.featuredImage`, le HTML du corps et les résultats de recherche.
 */
export const PHOTO_KEY_REGEX_SOURCE = "images\\.unsplash\\.com/((?:premium_)?photo-[A-Za-z0-9_-]+)";

export function photoKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = new RegExp(PHOTO_KEY_REGEX_SOURCE).exec(url);
  return m?.[1] ?? null;
}

export function photoKeysFromHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const re = new RegExp(PHOTO_KEY_REGEX_SOURCE, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) if (m[1]) out.push(m[1]);
  return out;
}

const REJECT_DESCRIPTION =
  /\b(screenshot|screen shot|screen capture|text|logo|mockup|mock-up|mock up|typography|font|lettering|poster|slide|presentation slide|user interface|ui design|capture)\b/i;

/** Texte descriptif de la photo (alt + description + tags), minuscule. */
function haystack(p: CandidatePhoto): string {
  return [p.alt_description, p.description, ...(p.tags ?? []).map((t) => t.title)]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" ");
}

/** Écarte petite photo, non paysage, ou capture d'écran / texte / logo / maquette. */
export function isPhotoEligible(p: CandidatePhoto): boolean {
  if (!(p.width >= MIN_PHOTO_WIDTH)) return false;
  if (!(p.height > 0) || p.width / p.height < MIN_LANDSCAPE_RATIO) return false;
  if (REJECT_DESCRIPTION.test(haystack(p))) return false;
  return true;
}

// ─── Requête / sujet ─────────────────────────────────────────────────────────

/**
 * Petit dictionnaire FR → EN (Unsplash comprend mal le français). Premier
 * élément = mot utilisé dans la requête ; les suivants = équivalents acceptés
 * pour mesurer la pertinence.
 */
const FR_EN: Readonly<Record<string, readonly string[]>> = {
  formation: ["training", "workshop", "learning", "class"],
  formations: ["training", "workshop", "learning", "class"],
  former: ["training", "learning"],
  ia: ["ai", "artificial", "intelligence", "robot", "technology"],
  intelligence: ["intelligence", "ai", "artificial"],
  artificielle: ["artificial", "ai"],
  entreprise: ["business", "company", "office", "corporate"],
  entreprises: ["business", "company", "office", "corporate"],
  equipe: ["team", "colleagues", "meeting"],
  equipes: ["team", "colleagues", "meeting"],
  bureau: ["office", "desk", "workspace"],
  travail: ["work", "office", "workspace"],
  juridique: ["legal", "law", "lawyer", "justice"],
  droit: ["law", "legal", "lawyer", "justice"],
  avocat: ["lawyer", "law", "legal"],
  avocats: ["lawyer", "law", "legal"],
  comptable: ["accounting", "accountant", "finance", "calculator"],
  comptabilite: ["accounting", "finance", "calculator"],
  finance: ["finance", "money", "banking", "business"],
  sante: ["health", "medical", "healthcare", "doctor"],
  medecin: ["doctor", "medical", "health"],
  batiment: ["construction", "building", "architecture", "site"],
  immobilier: ["real estate", "house", "building", "property"],
  marketing: ["marketing", "advertising", "social", "business"],
  vente: ["sales", "business", "retail"],
  commerce: ["retail", "shop", "store", "business"],
  restaurant: ["restaurant", "food", "chef", "kitchen"],
  industrie: ["industry", "factory", "manufacturing", "production"],
  usine: ["factory", "industry", "manufacturing"],
  automatisation: ["automation", "robot", "technology", "machine"],
  donnees: ["data", "analytics", "chart", "computer"],
  securite: ["security", "lock", "protection"],
  conformite: ["compliance", "law", "legal", "regulation"],
  reglementation: ["regulation", "law", "legal", "compliance"],
  ecole: ["school", "education", "classroom", "students"],
  education: ["education", "school", "learning", "students"],
  recrutement: ["recruitment", "hiring", "interview", "job"],
  ressources: ["resources", "team", "office"],
  humaines: ["human", "people", "team", "office"],
  service: ["service", "customer", "support"],
  client: ["customer", "client", "service"],
  clients: ["customer", "client", "service"],
  chatbot: ["chatbot", "robot", "assistant", "conversation", "ai"],
  assistant: ["assistant", "ai", "robot", "technology"],
  outil: ["tool", "software", "technology"],
  outils: ["tool", "software", "technology"],
  strategie: ["strategy", "planning", "business", "team"],
  gestion: ["management", "business", "planning", "office"],
  projet: ["project", "planning", "team", "business"],
  conseil: ["consulting", "advice", "meeting", "business"],
  accompagnement: ["consulting", "coaching", "support", "meeting"],
  productivite: ["productivity", "work", "office", "laptop"],
  ordinateur: ["computer", "laptop", "technology"],
  futur: ["future", "technology", "innovation"],
  innovation: ["innovation", "technology", "startup", "future"],
  loi: ["law", "legal", "regulation"],
  europe: ["europe", "european", "flag"],
  europeenne: ["europe", "european", "flag"],
};

const QUERY_STOP = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "en",
  "et",
  "ou",
  "au",
  "aux",
  "ce",
  "se",
  "sa",
  "ses",
  "nos",
  "vos",
  "pour",
  "avec",
  "sur",
  "par",
  "dans",
  "the",
  "and",
  "for",
  "with",
  "your",
  "pme",
  "tpe",
  "comment",
  "quel",
  "quelle",
  "est",
  "sont",
  "que",
  "qui",
]);

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !QUERY_STOP.has(t));
}

/** Un mot du sujet et ses équivalents anglais acceptés. */
export interface TopicTerm {
  readonly words: readonly string[];
}

/** Requête anglaise (4 mots max) et termes de pertinence dérivés d'une requête. */
export function buildTopic(rawQuery: string): { query: string; terms: TopicTerm[] } {
  const seen = new Set<string>();
  const queryWords: string[] = [];
  const terms: TopicTerm[] = [];
  for (const tok of tokens(rawQuery)) {
    const equiv = FR_EN[tok];
    const primary = equiv ? equiv[0]! : tok;
    if (seen.has(primary)) continue;
    seen.add(primary);
    queryWords.push(primary);
    terms.push({ words: equiv ? [tok, ...equiv] : [tok] });
    if (queryWords.length >= 4) break;
  }
  return { query: queryWords.join(" "), terms };
}

/** Part (0..1) des termes du sujet retrouvés dans la description de la photo. */
export function relevanceScore(p: CandidatePhoto, terms: readonly TopicTerm[]): number {
  if (terms.length === 0) return 0;
  const bag = new Set(tokens(haystack(p)));
  if (bag.size === 0) return 0; // aucune description → pertinence inconnue → refus
  // Tolère les pluriels simples (« robots » ↔ « robot »).
  const has = (w: string): boolean =>
    bag.has(w) || bag.has(`${w}s`) || bag.has(w.replace(/s$/, ""));
  let hit = 0;
  for (const t of terms) if (t.words.some(has)) hit++;
  return hit / terms.length;
}

export interface RankedPhoto<T extends CandidatePhoto> {
  readonly photo: T;
  readonly score: number;
}

/**
 * Candidates éligibles ET pertinentes, de la meilleure à la moins bonne :
 * pertinence d'abord (arrondie à 2 décimales), puis likes.
 */
export function rankPhotos<T extends CandidatePhoto>(
  photos: readonly T[],
  terms: readonly TopicTerm[],
  minRelevance: number = MIN_RELEVANCE,
): RankedPhoto<T>[] {
  const out: RankedPhoto<T>[] = [];
  for (const photo of photos) {
    if (!isPhotoEligible(photo)) continue;
    const score = relevanceScore(photo, terms);
    if (score < minRelevance) continue;
    out.push({ photo, score });
  }
  return out.sort((a, b) => {
    const ds = Math.round(b.score * 100) - Math.round(a.score * 100);
    return ds !== 0 ? ds : b.photo.likes - a.photo.likes;
  });
}
