/**
 * A/B test meta title/description (Sprint v7 Phase 13).
 *
 * Pattern simple : rotation server-side stable (hash URL) entre 2 variants
 * de title/description pour mesurer impact CTR sur SERP via GSC.
 *
 * V1 scope :
 *   - selectMetaVariant(url, variantA, variantB) → 1 variant déterministe
 *   - getActiveMetaABTest(url) → lit ContentGenConfig key="meta_ab_test"
 *     pour permettre activation/désactivation admin sans deploy
 *
 * Sessions 10+ :
 *   - Worker GSC impression+CTR delta par variant → choisir vainqueur
 *   - Admin UI activation par batch d'URLs
 *   - Auto-merge variant gagnant après 30j (impression > 1000 + p-value)
 */

import crypto from "node:crypto";

export interface MetaVariant {
  readonly title: string;
  readonly description: string;
}

export interface MetaABTestState {
  readonly enabled: boolean;
  /** URLs concernées (canonical paths). Vide = tout le site. */
  readonly urlPatterns: ReadonlyArray<string>;
  /** ID test pour reporting (UUID ou slug court). */
  readonly testId: string;
  readonly startedAt: string;
}

/**
 * Sélectionne A ou B déterministe à partir de l'URL.
 * Hash SHA-256 du path → modulo 2 → variant.
 *
 * Pourquoi déterministe : Googlebot peut crawler la même URL plusieurs fois
 * sur des serveurs différents. Un user qui partage la SERP voit toujours le
 * même variant (cohérent reporting GSC).
 */
export function selectMetaVariant(
  url: string,
  variantA: MetaVariant,
  variantB: MetaVariant,
): { variant: MetaVariant; label: "A" | "B" } {
  const hash = crypto.createHash("sha256").update(url).digest();
  const isA = hash[0]! % 2 === 0;
  return { variant: isA ? variantA : variantB, label: isA ? "A" : "B" };
}

/**
 * Vérifie si une URL est éligible à un test actif. Patterns supportés :
 *   - "/blog/*"               → tous les articles blog
 *   - "/implantations/*"      → toutes les pages villes
 *   - "/audit"                → match exact
 *   - "" (vide)               → wildcard tout le site
 */
export function isUrlEligible(url: string, urlPatterns: ReadonlyArray<string>): boolean {
  if (urlPatterns.length === 0) return true;
  for (const pattern of urlPatterns) {
    if (pattern === "") return true;
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (url.startsWith(prefix)) return true;
    } else if (pattern === url) {
      return true;
    }
  }
  return false;
}
