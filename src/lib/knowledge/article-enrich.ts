/**
 * Enrichissements éditoriaux pour `/connaissances/[slug]` (AEO/GEO).
 *
 * Fonctions PURES, sans dépendance DOM (parse regex linéaire — cohérent avec
 * `sanitizeTiptapHtml`). Toutes dégradent proprement (`null` / `[]`) quand rien
 * n'est détecté : garde-fou anti-doorway → une entrée thin reste thin, on ne
 * fabrique jamais de richesse artificielle.
 *
 * ⚠️ Contrat d'usage côté page :
 *  - `extractKeyFact` / `extractSources` lisent le **body brut** (`entry.body`),
 *    car `sanitizeTiptapHtml` strippe TOUS les attributs (dont `href`) → les
 *    sources ne sont récupérables qu'avant sanitize.
 *  - `buildToc` opère sur le **body sanitisé** (les `id` injectés doivent
 *    matcher le HTML réellement rendu).
 */

// ============================================================
// 1. Chiffre-clé (encart "qui claque" — entrées fact / industry_use_case)
// ============================================================

export interface KeyFact {
  /** Le chiffre brut, normalisé pour l'affichage géant (ex: "19 %", "×4", "2,5 milliards"). */
  readonly value: string;
  /** Phrase porteuse nettoyée (contexte sous le chiffre). */
  readonly context: string;
  /** Source citée si détectée dans le titre/excerpt (sinon null → carte sans source). */
  readonly source: string | null;
}

/** Types KB éligibles à l'encart chiffre-clé (énoncés factuels). */
const KEY_FACT_TYPES: ReadonlySet<string> = new Set(["fact", "industry_use_case"]);

// Cœur numérique FR : milliers séparés par espace (fine   / insécable  )
// ou point ; décimale virgule/point.
const NUM = "\\d{1,4}(?:[\\s\\u202f\\u00a0.]\\d{3})*(?:[.,]\\d+)?";

/**
 * Matchers essayés DANS L'ORDRE (le plus "parlant" d'abord). `format` reçoit le
 * match et reconstruit la valeur affichée AVEC son unité — sinon "19 %"
 * deviendrait "19" (l'unité EST le sens du chiffre).
 */
const VALUE_MATCHERS: ReadonlyArray<{
  readonly re: RegExp;
  readonly format: (m: RegExpExecArray) => string;
}> = [
  // Pourcentage — signal AEO le plus fort ("19 %", "30%", "12 pour cent").
  {
    re: new RegExp(`(${NUM})\\s?(%|‰|pour\\s?cent|points?\\sde\\spourcentage)`, "i"),
    format: (m) => `${m[1]} ${/‰/.test(m[2] ?? "") ? "‰" : "%"}`,
  },
  // Multiplicateur préfixé : ×4, x3.5
  {
    re: new RegExp(`[×x]\\s?(${NUM})(?=\\b)`, "i"),
    format: (m) => `×${m[1]}`,
  },
  // Multiplicateur suffixé : "3 fois", "multiplié par 4"
  {
    re: new RegExp(`(?:multipli[ée]e?\\spar\\s)?(${NUM})\\s?fois`, "i"),
    format: (m) => `×${m[1]}`,
  },
  // Monétaire avec échelle / symbole.
  {
    re: new RegExp(
      `(${NUM})\\s?(milliards?|millions?|milliers?|Md€|M€|k€|€|\\$|euros?|dollars?)`,
      "i",
    ),
    format: (m) => `${m[1]} ${m[2]}`,
  },
  // Durée / volume métier ("12 heures", "3 jours", "6 mois", "2 ans", "150 points").
  {
    re: new RegExp(
      `(${NUM})\\s?(heures?|jours?|semaines?|mois|ans?|ann[ée]es?|minutes?|points?|pts?)(?=\\b)`,
      "i",
    ),
    format: (m) => `${m[1]} ${m[2]}`,
  },
  // Grand nombre nu ≥ 1000 avec séparateur de milliers ("17 629 routes").
  {
    re: new RegExp(`(\\d{1,3}(?:[\\s\\u202f\\u00a0.]\\d{3})+)`),
    format: (m) => (m[1] ?? "").replace(/\s+/g, " "),
  },
];

// Source explicite dans le titre/excerpt : "(selon X)", "d'après X", "source : X".
const SOURCE_IN_TEXT =
  /(?:selon|d['’]apr[èe]s|source\s*:?|étude\s+(?:de\s+)?)\s+([A-ZÉÀÂÎÔÛ][^.,;:()<]{2,60})/u;

/**
 * Extrait un chiffre-clé d'une entrée factuelle pour l'encart vedette.
 * Retourne `null` si le type n'est pas éligible OU si aucun chiffre n'est
 * détecté (fallback propre : la page n'affiche alors pas d'encart).
 */
export function extractKeyFact(input: {
  readonly type: string;
  readonly title: string;
  readonly excerpt: string | null;
}): KeyFact | null {
  if (!KEY_FACT_TYPES.has(input.type)) return null;

  // L'excerpt est privilégié comme phrase porteuse (souvent = l'énoncé condensé),
  // mais on cherche le chiffre dans excerpt PUIS titre.
  const candidates = [input.excerpt?.trim(), input.title.trim()].filter((c): c is string =>
    Boolean(c && c.length > 0),
  );

  for (const text of candidates) {
    for (const matcher of VALUE_MATCHERS) {
      const m = matcher.re.exec(text);
      if (m) {
        const value = matcher.format(m).replace(/\s+/g, " ").trim();
        // Contexte = la phrase porteuse, plafonnée (la carte doit rester lisible).
        const context = text.length > 170 ? `${text.slice(0, 167).trimEnd()}…` : text;
        const srcMatch = SOURCE_IN_TEXT.exec(text);
        const source = srcMatch?.[1] ? srcMatch[1].replace(/\s+/g, " ").trim() : null;
        return { value, context, source };
      }
    }
  }
  return null;
}

// ============================================================
// 2. Sources / références (citabilité GEO/AEO — Article.citation[])
// ============================================================

export interface SourceRef {
  /** Libellé lisible de la source. */
  readonly label: string;
  /** URL externe si présente dans le body brut (sinon null → référence non cliquable). */
  readonly href: string | null;
}

const SITE_HOSTS = new Set(["axion-ia.com", "www.axion-ia.com"]);

/** Lien http(s) externe (≠ Axion-IA, ≠ relatif, ≠ ancre). */
function isExternalHttp(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return !SITE_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false; // relatif (/...), ancre (#...), mailto:, tel: → pas une source citable
  }
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s—–-]+|[\s—–.;,:]+$/g, "")
    .trim();
}

/**
 * Extrait les sources/références citées d'un body Tiptap **BRUT** (pré-sanitize,
 * car `sanitizeTiptapHtml` strippe les `href`). Deux signaux complémentaires :
 *  1. liens `<a href>` externes (deviennent des `CreativeWork` dans le JSON-LD) ;
 *  2. mentions éditoriales « Source(s) : … » / « Référence(s) : … » (souvent
 *     sans lien → référence textuelle, citable mais non cliquable).
 *
 * Retourne `[]` si rien → la section Sources n'est pas rendue (anti-doorway).
 */
export function extractSources(rawBody: string): SourceRef[] {
  const out: SourceRef[] = [];
  const seen = new Set<string>();
  const add = (label: string, href: string | null): void => {
    const clean = cleanLabel(label) || href || "";
    if (clean.length < 3) return;
    const key = (href ?? clean).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label: clean, href });
  };

  // 1. Liens externes.
  const A = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = A.exec(rawBody)) !== null) {
    const href = (m[1] ?? "").trim();
    if (isExternalHttp(href)) add(m[2] ?? href, href);
  }

  // 2. Mentions « Source(s) : » / « Référence(s) : » (sur le texte aplati pour
  //    ne pas re-capturer le markup). Le « : » est requis → faible faux-positif.
  const flat = rawBody
    .replace(/<\/(p|li|h[1-6]|blockquote|figcaption)>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  const S = /\b(?:sources?|r[ée]f[ée]rences?)\s*:\s+([^\n<]{3,180})/gi;
  while ((m = S.exec(flat)) !== null) {
    add(m[1] ?? "", null);
  }

  return out;
}

/**
 * Sous-ensemble citable en JSON-LD `Article.citation[]` (factory attend une
 * `url`) — seules les sources liées (href externe) sont éligibles.
 */
export function sourcesToCitations(
  sources: ReadonlyArray<SourceRef>,
): ReadonlyArray<{ url: string; title: string }> {
  return sources
    .filter((s): s is SourceRef & { href: string } => Boolean(s.href))
    .map((s) => ({ url: s.href, title: s.label }));
}
