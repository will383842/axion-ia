// Garde-fou de sortie (T-39, doc 16 §7 G-4, DoD §10.a #3/#4).
//
// AVANT d'émettre une réponse, vérifie la garantie ZÉRO-HALLUCINATION :
//   - tout montant « X € » cité ∈ prix réels de pricing.ts (SSOT) ;
//   - toute URL/chemin cité(e) ∈ routes FR connues (routing.pathnames).
// Si violation → l'orchestrateur corrige (re-grounding) ou escalade. Le guard
// ne réécrit pas : il DÉTECTE et liste les violations (décision côté orchestrateur).

import { PRICING_CATEGORIES, UN_A_UN_RECURRING_TIER } from "@/content/pricing";
import { isKnownFrUrl, KNOWN_FR_PATHS } from "@/lib/offer-url";

/** Tous les prix légitimes (€ HT) de la SSOT pricing.ts (tiers + sous-tiers). */
export const KNOWN_PRICES: ReadonlySet<number> = (() => {
  const set = new Set<number>();
  const add = (n?: number) => {
    if (typeof n === "number") set.add(n);
  };
  const addTier = (t: {
    priceFlat?: number;
    priceFlatOnsite?: number;
    priceMin?: number;
    priceMax?: number;
    subTiers?: ReadonlyArray<{ priceFlat: number }>;
  }) => {
    add(t.priceFlat);
    add(t.priceFlatOnsite);
    add(t.priceMin);
    add(t.priceMax);
    for (const sub of t.subTiers ?? []) add(sub.priceFlat);
  };
  for (const tiers of Object.values(PRICING_CATEGORIES)) for (const t of tiers) addTier(t);
  addTier(UN_A_UN_RECURRING_TIER);
  return set;
})();

/** Premiers segments de route connus (ex. « audit », « interventions »…). */
const KNOWN_TOP_SEGMENTS: ReadonlySet<string> = new Set(
  [...KNOWN_FR_PATHS].map((p) => p.split("/")[1]).filter((s): s is string => Boolean(s)),
);

export interface OutputViolation {
  readonly type: "price" | "url";
  readonly value: string;
  readonly reason: string;
}

export interface OutputGuardResult {
  readonly ok: boolean;
  readonly violations: ReadonlyArray<OutputViolation>;
}

const PRICE_RE = /(\d[\d   ]*\d|\d)\s*(?:€|euros?\b|EUR\b)/gi;

/** Normalise « 1 190 » / « 30 000 » → 1190 / 30000. */
function toInt(raw: string): number {
  return parseInt(raw.replace(/[   ]/g, ""), 10);
}

/** Montants cités avec € / euros dans le texte. */
export function extractCitedPrices(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(PRICE_RE)) {
    const n = toInt(m[1]!);
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

/**
 * URLs/chemins cités à vérifier : URLs http(s) + chemins commençant par /fr/ ou
 * dont le 1er segment est une route connue (évite les faux positifs comme
 * « 290 €/mois » → « /mois », ignoré).
 */
export function extractCitedUrls(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/[^\s)\]]+/gi)) out.add(m[0]);
  for (const m of text.matchAll(/\/[\w/-]+/g)) {
    const path = m[0];
    const first = path.split("/")[1] ?? "";
    if (path.startsWith("/fr/") || KNOWN_TOP_SEGMENTS.has(first)) out.add(path);
  }
  return [...out];
}

export interface VerifyOutputOptions {
  /**
   * URLs supplémentaires réputées VALIDES (ex. lien d'une ressource publiée
   * remontée par `chercher_ressource`, déjà vérifiée en DB). Permet d'autoriser
   * un chemin de contenu dynamique (`/fr/blog/<slug>`, `/fr/cas-concrets/<slug>`)
   * SANS ouvrir la porte aux URLs inventées : seules les URLs DB-vérifiées passent.
   */
  readonly extraKnownUrls?: ReadonlyArray<string>;
}

/** Vérifie qu'un texte ne cite QUE des prix SSOT et des URLs existantes. */
export function verifyOutput(text: string, opts: VerifyOutputOptions = {}): OutputGuardResult {
  const violations: OutputViolation[] = [];
  const allowed = new Set((opts.extraKnownUrls ?? []).map((u) => u.replace(/\/+$/, "")));

  for (const price of extractCitedPrices(text)) {
    if (!KNOWN_PRICES.has(price)) {
      violations.push({
        type: "price",
        value: `${price} €`,
        reason: "prix absent de pricing.ts (SSOT) — possible hallucination",
      });
    }
  }

  for (const url of extractCitedUrls(text)) {
    // On ne vérifie que notre domaine / chemins internes (liens externes laissés).
    const isInternal = url.startsWith("/") || /axion-ia\.com/i.test(url);
    if (isInternal && !isKnownFrUrl(url) && !allowed.has(url.replace(/\/+$/, ""))) {
      violations.push({
        type: "url",
        value: url,
        reason: "URL absente des routes FR connues — lien mort / inventé",
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
