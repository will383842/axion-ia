// Garde-fou de sortie (T-39, doc 16 §7 G-4, DoD §10.a #3/#4).
//
// AVANT d'émettre une réponse, vérifie la garantie ZÉRO-HALLUCINATION :
//   - tout montant « X € » cité ∈ prix réels de pricing.ts (SSOT) ;
//   - toute URL/chemin cité(e) ∈ routes FR connues (routing.pathnames) ;
//   - aucun interdit de la doctrine de publication (Qualiopi, CPF, « 100 % financé »…),
//     via `detecterInterditsSurface` (même source que les contenus générés).
// Si violation → l'orchestrateur corrige (re-grounding) ou escalade. Le guard
// ne réécrit pas : il DÉTECTE et liste les violations (décision côté orchestrateur).

import {
  JOURNEE_IA_TIER,
  PRICING_CATEGORIES,
  UN_A_UN_RECURRING_TIER,
  prixAffichable,
} from "@/content/pricing";
import { isKnownFrUrl, KNOWN_FR_PATHS } from "@/lib/offer-url";
import { detecterInterditsSurface } from "@/lib/contenu/interdits-publication";

/** Étiquette « TPE/PME » (barre, tiret ou tiret typographique, espaces tolérés). */
const ETIQUETTE_TPE_PME = /\bTPE[\s\u00a0]*[/\-\u2010-\u2015][\s\u00a0]*PME\b/i;

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

/**
 * R7 (ordre de Williams du 08/11/2026) — les seuls montants que le chatbot peut DIRE :
 * ceux des paliers dont le prix reste affichable au public (aujourd'hui la Journée IA,
 * 1 490 € HT). Un montant de la grille interne (`KNOWN_PRICES`) n'est plus citable : sa
 * présence en sortie est une violation, et l'orchestrateur oriente vers le rendez-vous.
 */
export const PRIX_CITABLES: ReadonlySet<number> = (() => {
  const set = new Set<number>();
  const paliers = [
    ...Object.values(PRICING_CATEGORIES).flat(),
    UN_A_UN_RECURRING_TIER,
    JOURNEE_IA_TIER,
  ];
  for (const t of paliers) {
    if (!prixAffichable(t)) continue;
    for (const n of [t.priceFlat, t.priceFlatOnsite, t.priceMin, t.priceMax]) {
      if (typeof n === "number") set.add(n);
    }
  }
  return set;
})();

/** Premiers segments de route connus (ex. « audit », « interventions »…). */
const KNOWN_TOP_SEGMENTS: ReadonlySet<string> = new Set(
  [...KNOWN_FR_PATHS].map((p) => p.split("/")[1]).filter((s): s is string => Boolean(s)),
);

export interface OutputViolation {
  readonly type: "price" | "url" | "interdit";
  readonly value: string;
  readonly reason: string;
}

export interface OutputGuardResult {
  readonly ok: boolean;
  readonly violations: ReadonlyArray<OutputViolation>;
}

const PRICE_RE = /(\d[\d   ]*\d|\d)\s*(?:€|euros?\b|EUR\b)/gi;

/**
 * R7 — formes que `PRICE_RE` ne lit pas : abrégées (« 8-50 K€ », « 5k€ », « 1,2 M€ »)
 * ou devise en tête (« €490 HT »). Toute occurrence est un montant dit au public.
 */
const PRIX_ABREGE_RE = /\d\s*[kKM]\s*€|€\s?\d[\d\s.,]*/g;

/** Montants abrégés ou à devise en tête non citables (seule la Journée IA l'est). */
function extractPrixAbreges(text: string): string[] {
  return [...text.matchAll(PRIX_ABREGE_RE)]
    .map((m) => m[0].trim())
    .filter((brut) => {
      if (!brut.startsWith("€")) return true; // K€ / M€ : jamais un prix citable
      const n = parseInt(brut.replace(/[^\d]/g, ""), 10);
      return !PRIX_CITABLES.has(n);
    });
}

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
    if (!PRIX_CITABLES.has(price)) {
      violations.push({
        type: "price",
        value: `${price} €`,
        reason: KNOWN_PRICES.has(price)
          ? "montant masqué au public (R7) : « sur devis, parlons-en lors du rendez-vous gratuit de 45 minutes »"
          : "prix absent de pricing.ts (SSOT) — possible hallucination",
      });
    }
  }

  for (const brut of extractPrixAbreges(text)) {
    violations.push({
      type: "price",
      value: brut,
      reason:
        "montant masqué au public (R7) : « sur devis, parlons-en lors du rendez-vous gratuit de 45 minutes »",
    });
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

  // Doctrine des interdits : un chatbot ne doit pas dire en direct ce qu'un
  // article n'a pas le droit de publier. Le code de l'interdit sert de valeur.
  // « reservation-paiement » est exclu : le chatbot oriente justement vers la
  // réservation du rendez-vous (« Réservez votre créneau de 45 minutes »).
  const interdits = detecterInterditsSurface(
    { reponse: text },
    // Axion-IA ne propose pas de financement : le chatbot ne le cite jamais (et la
    // garde n'importe pas le domaine Qualiopi, cf. pnpm qualiopi:isolation-check).
    { actualite: false, financementPublicAutorise: false },
  )
    .filter((i) => i.code !== "reservation-paiement")
    // « TPE et PME » est la forme autorisée (règle du 07/11) ; seule l'étiquette
    // « TPE/PME » (barre ou tiret) est interdite. On ne retient donc ce code que si
    // l'étiquette est réellement présente : le chatbot reste juste quel que soit
    // l'ordre de fusion avec le lot R6, qui resserre le même motif à la source.
    .filter((i) => i.code !== "etiquette-tpe-pme" || ETIQUETTE_TPE_PME.test(text));
  for (const i of interdits) {
    violations.push({
      type: "interdit",
      value: i.code,
      reason: `interdit de publication (${i.code}) : « ${i.extrait} »`,
    });
  }

  return { ok: violations.length === 0, violations };
}
