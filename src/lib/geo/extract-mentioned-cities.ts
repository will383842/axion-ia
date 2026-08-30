/**
 * extractMentionedCitiesFromText — détection automatique villes mentionnées
 * dans le body d'un article ou d'une landing page.
 *
 * City Domination Sprint S+2 — Phase C strat ville (cohérence pages ville
 * perfection 2026, ROI auto-tagging géographique).
 *
 * Stratégie :
 *   1. Parcours `VILLES` array (~2150 communes INSEE >5K hab France métro)
 *   2. Pour chaque ville, match `name` (FR + accents) en mode "mot-frontière"
 *      via regex `\b<name>\b` insensible casse + diacritiques
 *   3. Le slug est ajouté au Set résultat si match
 *   4. Garde-fou faux positifs : exige le name avec MAJUSCULE en première
 *      lettre (différencie "paris" mot commun de "Paris" nom propre)
 *
 * Limitations connues :
 *   - Homonymes (ex: "Vitry" peut référer à Vitry-sur-Seine OU Vitry-le-François)
 *     → on tag les 2, le hub ville filtrera côté affichage
 *   - Faux positifs noms communs ressemblant à villes (ex: "Auch" verbe "ouvre"
 *     conjugué d'autre langue) → improbable en FR mais possible
 *   - Pas d'analyse contextuelle (ex: "vacances à Paris" tag Paris alors
 *     que pas pertinent SEO IA) → acceptable, le filtre côté hub vérifie
 *     que l'article est marqué publié + tier-1
 *
 * Performance :
 *   - O(n × m) où n = body length, m = VILLES count (~2150)
 *   - Pour body ~5000 mots × 2150 regex tests ≈ ~10 ms (négligeable)
 *   - Appelé au publish, pas en hot path render
 */

import { VILLES_CORE, type VilleData } from "@/content/villes/core";

/**
 * Échappe les caractères regex spéciaux dans le nom d'une ville (ex: "L'Haÿ-les-Roses").
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalise une chaîne en retirant les diacritiques (accents) — utile pour
 * comparer "Île-de-France" vs "Ile-de-France" tolérance saisie LLM.
 */
function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

interface ExtractOptions {
  /**
   * Si fourni, ajout obligatoire de ce slug en première position (cas landing-ville
   * où l'anchorVilleSlug doit toujours figurer même si le body ne mentionne pas
   * explicitement le nom de la ville).
   */
  readonly forceInclude?: string;
  /**
   * Cap nombre max villes mentionnées (anti-spam SEO). Default 20.
   * Au-delà, on garde les 20 premières dans l'ordre VILLES_CORE (Paris, Lyon, etc.).
   */
  readonly maxCities?: number;
}

/**
 * Extrait les slugs des villes mentionnées dans un body texte.
 *
 * @param text - Body article ou landing page (HTML strippé recommandé)
 * @param options - Options optionnelles (forceInclude, maxCities)
 * @returns Array de slugs villes uniques (déduplicaté, max `maxCities`)
 *
 * @example
 *   extractMentionedCitiesFromText("Notre intervention à Paris et Lyon...")
 *   // → ["paris", "lyon"]
 *
 *   extractMentionedCitiesFromText("Audit IA PME", { forceInclude: "marseille" })
 *   // → ["marseille"] (pas de match dans le body mais forceInclude)
 */
export function extractMentionedCitiesFromText(text: string, options?: ExtractOptions): string[] {
  const maxCities = options?.maxCities ?? 20;
  const result = new Set<string>();

  if (options?.forceInclude) {
    result.add(options.forceInclude);
  }

  if (!text || text.length === 0) {
    return Array.from(result).slice(0, maxCities);
  }

  // Normalize body : retire diacritics ET case-fold pour tolérance LLM
  // (le LLM peut écrire "ile-de-france" sans accent dans son output).
  const normalizedBody = stripDiacritics(text).toLowerCase();

  for (const ville of VILLES_CORE) {
    if (result.size >= maxCities) break;
    if (result.has(ville.slug)) continue; // déjà ajouté via forceInclude

    // Match prioritaire : slug exact (`paris`, `boulogne-billancourt`, etc.)
    // Le slug est déjà normalisé (lowercase, no accents) côté VilleData source.
    const slugPattern = new RegExp(`\\b${escapeRegex(ville.slug)}\\b`, "i");
    if (slugPattern.test(normalizedBody)) {
      result.add(ville.slug);
      continue;
    }

    // Match fallback : nameFr normalisé (sans accents, lowercase) dans body
    // normalisé. Évite les false positives en exigeant mot entier (\b…\b).
    const normalizedName = stripDiacritics(ville.nameFr).toLowerCase();
    // Skip si nom trop court (3 chars max — risque false positif sur mots communs)
    if (normalizedName.length < 4) continue;
    const namePattern = new RegExp(`\\b${escapeRegex(normalizedName)}\\b`, "i");
    if (namePattern.test(normalizedBody)) {
      result.add(ville.slug);
    }
  }

  return Array.from(result).slice(0, maxCities);
}

/**
 * Détecte les villes mentionnées avec leur position (offset texte). Utile
 * pour debugger ou highlighter les mentions côté UI.
 */
export function findMentionedCitiesWithOffsets(
  text: string,
): Array<{ slug: string; villeName: string; offset: number }> {
  const matches: Array<{ slug: string; villeName: string; offset: number }> = [];
  const seen = new Set<string>();
  const normalized = stripDiacritics(text).toLowerCase();

  for (const ville of VILLES_CORE) {
    if (seen.has(ville.slug)) continue;
    const normalizedName = stripDiacritics(ville.nameFr).toLowerCase();
    if (normalizedName.length < 4) continue;
    const pattern = new RegExp(`\\b${escapeRegex(normalizedName)}\\b`, "i");
    const match = pattern.exec(normalized);
    if (match) {
      seen.add(ville.slug);
      matches.push({ slug: ville.slug, villeName: ville.nameFr, offset: match.index });
    }
  }

  return matches.sort((a, b) => a.offset - b.offset);
}

/**
 * Utilitaire helper : prend une `VilleData` source et retourne les autres slugs
 * mentionnés dans un texte (exclut la source). Utile pour générer le cross-link
 * mesh "Articles blog parlant aussi de Lyon, Marseille…" depuis hub Paris.
 */
export function getMentionedCitiesExcluding(text: string, excludeSlug: string): string[] {
  return extractMentionedCitiesFromText(text).filter((s) => s !== excludeSlug);
}

export type { VilleData };
