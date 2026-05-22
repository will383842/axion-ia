/**
 * V-14 sprint UX 2026-05-22 — Trust tier policy pour liens externes injectés.
 *
 * Sans cette doctrine, tous les liens citations Perplexity sortent dofollow
 * vers des domaines inconnus → PageRank leak + risque association SEO négatif
 * (V-14 audit gap F03 + F04).
 *
 * Curation manuelle (zéro dep externe Ahrefs/Moz/SemRush) :
 *   - official  : .gouv.fr, .europa.eu, organismes publics FR/EU canoniques
 *   - high      : grandes institutions stables, presse historique, normes ISO
 *   - standard  : domaines connus crédibles mais sans signal d'autorité formel
 *   - low       : blogs spécialisés non vérifiés (nofollow conseillé)
 *   - excluded  : domaines exclus (UGC, spam) — citation refusée
 *
 * Mapping vers attribut HTML rel :
 *   - official + high + standard : dofollow (rel="noopener noreferrer" si target=_blank)
 *   - low + unknown : rel="nofollow noopener noreferrer"
 *   - excluded : ne pas émettre le lien (le sanitizer doit le rejeter en amont)
 */

import type { TrustTier } from "../../../../prisma/generated/client";

const OFFICIAL_DOMAINS = new Set([
  // Administration française
  "service-public.fr",
  "data.gouv.fr",
  "legifrance.gouv.fr",
  "economie.gouv.fr",
  "cnil.fr",
  "ssi.gouv.fr",
  "ademe.fr",
  "ansm.sante.fr",
  "cnam.fr",
  "urssaf.fr",
  "impots.gouv.fr",
  "insee.fr",
  "francenum.gouv.fr",
  "entreprise.gouv.fr",
  // Union européenne
  "europa.eu",
  "ec.europa.eu",
  "europarl.europa.eu",
  "edpb.europa.eu",
  "eur-lex.europa.eu",
  // Données ouvertes et standards FR/EU
  "etalab.gouv.fr",
  "agencebio.org",
  "cae.fr",
]);

const HIGH_TRUST_DOMAINS = new Set([
  // Standards et normes
  "iso.org",
  "w3.org",
  "ietf.org",
  "schema.org",
  "nist.gov",
  // Recherche académique reconnue
  "arxiv.org",
  "hal.science",
  "nature.com",
  "science.org",
  "acm.org",
  "ieee.org",
  // Presse de référence
  "lemonde.fr",
  "lesechos.fr",
  "lefigaro.fr",
  "ft.com",
  "reuters.com",
  "bloomberg.com",
  // Documentation tech canonique
  "developer.mozilla.org",
  "nextjs.org",
  "react.dev",
  "typescriptlang.org",
  "openai.com",
  "anthropic.com",
  "mistral.ai",
  // Open source standards
  "github.com",
  "gitlab.com",
  "wikipedia.org",
]);

const EXCLUDED_DOMAINS = new Set([
  // Pas de citation depuis UGC / forums / spam
  "reddit.com",
  "quora.com",
  "medium.com",
  "pinterest.com",
  "tiktok.com",
]);

/**
 * Calcule le trust tier d'un domaine via curation manuelle (pas de fetch externe).
 * Fallback "standard" si domaine inconnu mais syntaxiquement valide.
 * "excluded" si domaine dans la liste noire.
 */
export function computeTrustTier(domain: string): TrustTier {
  const cleaned = domain
    .toLowerCase()
    .trim()
    .replace(/^www\./, "");
  if (EXCLUDED_DOMAINS.has(cleaned)) return "excluded";
  if (OFFICIAL_DOMAINS.has(cleaned)) return "official";
  if (HIGH_TRUST_DOMAINS.has(cleaned)) return "high";
  // Heuristique TLD : .gouv.fr / .europa.eu → official (catch domaines secondaires)
  if (cleaned.endsWith(".gouv.fr") || cleaned.endsWith(".europa.eu")) return "official";
  return "standard";
}

/**
 * Détermine la valeur de l'attribut HTML rel d'un lien externe selon son trust tier.
 * Doctrine V-14 : nofollow pour les domaines inconnus/non vérifiés (low/standard
 * peuvent rester dofollow si Will a curé manuellement le contenu, mais par défaut
 * les citations LLM Perplexity injectées sortent nofollow tant que `trustTier`
 * reste dans le pool des incertains).
 *
 * @param tier trust tier de la ressource (DB ExternalReference.trustTier ou
 *   computeTrustTier(domain) si pas encore enrichi)
 * @returns chaîne pour l'attribut rel, ex. "nofollow noopener noreferrer"
 */
export function relAttrForExternalLink(tier: TrustTier): string {
  const baseRel = ["noopener", "noreferrer"];
  if (tier === "official" || tier === "high") {
    // Confiance haute → dofollow (link juice transmis).
    return baseRel.join(" ");
  }
  // standard / low / excluded → nofollow par défaut (V-14 audit gap F03).
  // excluded : le sanitizer doit en théorie rejeter le lien avant ce point.
  return ["nofollow", ...baseRel].join(" ");
}

/**
 * Extrait le domaine canonique d'une URL absolue ou relative protocol-relative.
 * Retourne null si l'input est manifestement invalide (utilisé pour fallback).
 */
export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url, "https://placeholder.invalid");
    if (u.hostname === "placeholder.invalid") return null;
    return u.hostname;
  } catch {
    return null;
  }
}
