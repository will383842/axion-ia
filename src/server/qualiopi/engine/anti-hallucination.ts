/**
 * Qualiopi — Formation Engine T4 : Détection d'allégations non sourcées.
 *
 * Module PUR — zéro dépendance externe. Detects :
 * - Chiffres avec % (ex : « 80% de gains »)
 * - Montants € / $ (ex : « 500€ », « $200 »)
 * - ROI
 * - Promesses absolues : « garantir », « assurer », « certifier »,
 *   « promettre », « aucun risque »
 *
 * Conforme AI Act art. 50 : les contenus générés par IA ne doivent pas
 * contenir d'allégations non sourcées ou trompeuses.
 */

export interface UnsourcedClaim {
  claim: string;
  /** Position du match dans le texte (index de début, compat worker BullMQ). */
  position: number;
  /** Type sémantique de l'allégation (ex: chiffre_pourcentage, roi_non_source). */
  type: string;
}

// ── Patterns de détection ─────────────────────────────────────────────────────

const PATTERNS: ReadonlyArray<{ regex: RegExp; type: string }> = [
  // Chiffres avec pourcentage
  {
    regex: /\b\d+\s*%/g,
    type: "chiffre_pourcentage",
  },
  // Montants monétaires — NNN€ ou NNN $
  {
    regex: /\d+\s*[€]/g,
    type: "montant_monetaire",
  },
  // Montants monétaires — $NNN ou $ NNN ($ avant le chiffre)
  {
    regex: /\$\s*\d+/g,
    type: "montant_monetaire",
  },
  // ROI (retour sur investissement)
  {
    regex: /\bROI\b/gi,
    type: "roi_non_source",
  },
  // Promesses absolues
  {
    regex: /\b(garantir|garanti[e]?|garantissons|garantit|garantirons)\b/gi,
    type: "promesse_absolue_garantir",
  },
  {
    regex: /\b(assurer|assurons|assure[sz]?|assur[ée][e]?s?)\b/gi,
    type: "promesse_absolue_assurer",
  },
  {
    regex: /\b(certifi(?:er|ons|e[sz]?|[ée][e]?s?))\b/gi,
    type: "promesse_absolue_certifier",
  },
  {
    regex: /\b(promettre|promettons|promettez|promis)\b/gi,
    type: "promesse_absolue_promettre",
  },
  {
    regex: /\baucun\s+risque\b/gi,
    type: "promesse_zero_risque",
  },
];

// ── Détection principale ──────────────────────────────────────────────────────

/**
 * Retourne la liste des allégations non sourcées détectées dans le texte.
 * Chaque entrée contient le fragment `claim`, sa `position` et son `type`.
 */
export function detectUnsourcedClaims(texte: string): UnsourcedClaim[] {
  const results: UnsourcedClaim[] = [];

  for (const { regex, type } of PATTERNS) {
    // Réinitialise lastIndex pour les regex avec flag `g`
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(texte)) !== null) {
      results.push({ claim: match[0], position: match.index, type });
    }
  }

  return results;
}

/**
 * Retourne `true` si au moins une allégation non sourcée est détectée.
 * Raccourci pour les gates de publication.
 */
export function hasUnsourcedClaims(texte: string): boolean {
  return detectUnsourcedClaims(texte).length > 0;
}
