/**
 * Content Generator — Claims extractor (Sprint 12.5 V2).
 *
 * Extrait les "claims" vérifiables d'un article HTML/markdown :
 *   - Pourcentages (« 75 % », « +12 % »)
 *   - Montants € / $ / k€ / M€
 *   - Statistiques chiffrées (« 3 entreprises sur 10 »)
 *   - Attributions « selon X » sans citation à proximité
 *   - Dates précises (« en 2024 ») dans une affirmation chiffrée
 *
 * Le worker `content-fact-check-worker` passe ces claims à Perplexity (`role:"data"`)
 * qui retourne validate/refute/unclear + sources. Le score final est dérivé du
 * ratio (claims validés ∪ claims sans risque) / total claims.
 *
 * Fonction pure : 0 I/O, testable.
 */

export interface ExtractedClaim {
  /** Phrase source contenant le claim (max ~280 chars pour rester économique). */
  readonly sentence: string;
  /** Type de claim détecté. */
  readonly kind: "percentage" | "amount" | "ratio" | "attribution" | "stat_year";
  /** Pattern trouvé (la sous-chaîne déclenchante). */
  readonly match: string;
}

const MAX_SENTENCE_CHARS = 280;
const MAX_CLAIMS_PER_ARTICLE = 30;

const PATTERN_PERCENT = /\b\d{1,3}(?:[,.]\d{1,2})?\s*%/g;
const PATTERN_AMOUNT_EUR =
  /\b\d{1,3}(?:[\s.,]\d{3})*(?:[,.]\d+)?\s*(?:€|EUR|euros?|\$|USD|dollars?|k€|M€|k\$|M\$)/gi;
const PATTERN_RATIO = /\b\d+(?:\s+\p{L}+){0,4}\s+(?:sur|out\s+of|of)\s+\d+\b/giu;
const PATTERN_ATTRIBUTION = /\bselon\s+[A-ZÉÈÀÔÎ][^.,;]{2,40}/gi;
const PATTERN_STAT_YEAR =
  /\b(?:en|in|année|year)\s+(?:20\d{2}|19\d{2})\b.{0,80}\b\d{1,3}(?:[,.]\d{1,2})?\s*%?/gi;

function splitSentences(text: string): ReadonlyArray<string> {
  return text
    .replace(/<[^>]+>/g, " ") // strip HTML tags
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÀÉÈÔÎÂÊÎÔÛ])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function extractClaims(body: string): ReadonlyArray<ExtractedClaim> {
  const sentences = splitSentences(body);
  const claims: ExtractedClaim[] = [];
  const seen = new Set<string>();

  for (const fullSentence of sentences) {
    if (claims.length >= MAX_CLAIMS_PER_ARTICLE) break;
    const sentence =
      fullSentence.length > MAX_SENTENCE_CHARS
        ? `${fullSentence.slice(0, MAX_SENTENCE_CHARS)}…`
        : fullSentence;

    const checks: Array<{ kind: ExtractedClaim["kind"]; pattern: RegExp }> = [
      { kind: "percentage", pattern: PATTERN_PERCENT },
      { kind: "amount", pattern: PATTERN_AMOUNT_EUR },
      { kind: "ratio", pattern: PATTERN_RATIO },
      { kind: "attribution", pattern: PATTERN_ATTRIBUTION },
      { kind: "stat_year", pattern: PATTERN_STAT_YEAR },
    ];

    for (const { kind, pattern } of checks) {
      const matches = sentence.matchAll(pattern);
      for (const m of matches) {
        if (claims.length >= MAX_CLAIMS_PER_ARTICLE) break;
        const key = `${kind}::${m[0]}::${sentence.slice(0, 50)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        claims.push({ sentence, kind, match: m[0].trim() });
      }
    }
  }

  return claims;
}

/**
 * Compute le score factCheck final (0-100) à partir des verdicts Perplexity.
 *
 * Formule : (validated + neutral) / total * 100. Si total=0 → score=100
 * (aucun claim chiffré = pas de risque factuel par défaut).
 */
export interface ClaimVerdict {
  readonly status: "validated" | "refuted" | "unclear";
}

export function computeFactCheckScore(verdicts: ReadonlyArray<ClaimVerdict>): number {
  if (verdicts.length === 0) return 100;
  const refuted = verdicts.filter((v) => v.status === "refuted").length;
  const validated = verdicts.filter((v) => v.status === "validated").length;
  // Refuted compte -1, unclear compte 0, validated compte +1, total normalisé.
  const score = ((validated - refuted) / verdicts.length + 1) / 2;
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}
