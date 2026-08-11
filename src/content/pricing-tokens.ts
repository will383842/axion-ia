// Résolveur de tokens prix — propagation SSOT dans la prose (Sprint Pricing SSOT 2026-05-29).
//
// Doctrine Will : `src/content/pricing.ts` est la SEULE source de vérité des
// tarifs. La couche « code » (pages, composants, configs .ts) dérive déjà via
// les helpers `formatPrice`/`formatAmount`/`getEntryLabel`. Ce module couvre
// l'AUTRE couche : la **prose stockée comme chaînes opaques** (copy villes,
// FAQ géolocalisées, contenu généré) où l'on ne peut pas appeler un helper
// directement. On y écrit des tokens `{{price:<tierId>}}` qui sont résolus au
// rendu depuis la SSOT — un prix qui change dans `pricing.ts` se propage
// automatiquement partout où le token apparaît.
//
// Syntaxe :
//   {{price:audit-flash}}              → formatPrice (mode `full`, défaut)
//   {{price:audit-flash|flat}}         → prix fixe seul (« 490 € HT »)
//   {{price:audit-flash|onsite}}       → split distance/sur site
//   {{price:audit-cible|range}}        → « 1 900 € → 3 900 € HT »
//   {{price:audit-cible|from}}         → « À partir de 1 900 € HT »
//   {{price:intervention-temps|entry}} → montant d'entrée brut formaté
//   {{price:audit-flash|full}}         → équivalent au mode par défaut
//
// `<tierId>` accepte tout id de tier OU de sous-tier présent dans pricing.ts.
// Un tier `onQuote` (ou un id sans prix) → « Sur devis » / « On request ».
// Un id inconnu ou un mode inconnu → token laissé en l'état + warning (le
// garde-fou CI `no-hardcoded-prices.spec.ts` détecte les tokens orphelins).

import type { Locale } from "@/i18n/routing";
import { fmtNumber } from "@/lib/intl";
import {
  MAINTENANCE_TIERS,
  PRICING_CATEGORIES,
  UN_A_UN_RECURRING_TIER,
  UN_A_UN_TIERS,
  formatAmount,
  formatAmountRange,
  formatPrice,
  formatPriceWithOnsite,
  type PricingSubTier,
  type PricingTier,
} from "@/content/pricing";

/**
 * Modes de rendu d'un token prix.
 * `num` = nombre seul SANS devise (« 1 900 ») — utile pour le 1er membre d'un
 * range écrit « entre 1 900 et … € » où le « € » est porté par le 2e membre.
 */
export type PriceTokenMode =
  "full" | "flat" | "onsite" | "range" | "from" | "entry" | "compact" | "num";

const VALID_MODES: ReadonlySet<string> = new Set<PriceTokenMode>([
  "full",
  "flat",
  "onsite",
  "range",
  "from",
  "entry",
  "compact",
  "num",
]);

/**
 * Reconnaît `{{price:<tierId>}}` et `{{price:<tierId>|<mode>}}`.
 * `<tierId>` est kebab-case ([a-z0-9-]+), `<mode>` est un mot ([a-z]+).
 * Le flag `g` est nécessaire pour `String.prototype.replace` global.
 */
export const PRICE_TOKEN_REGEX = /\{\{price:([a-z0-9-]+)(?:\|([a-z]+))?\}\}/g;

/** Détecte la présence d'au moins un token prix (non-global, sûr en boucle). */
export function hasPriceToken(text: string): boolean {
  return /\{\{price:[a-z0-9-]+(?:\|[a-z]+)?\}\}/.test(text);
}

/**
 * Reconnaît `{{label:<tierId>}}` — NOM d'affichage SSOT d'un tier/sous-tier
 * (libellé `labelFr`/`labelEn` de `pricing.ts`). Permet de tokeniser le nom d'un
 * format dans la prose (ex « le format {{label:intervention-dirigeants}} ») pour
 * qu'un renommage dans `pricing.ts` se propage. FR en pratique (EN désactivé).
 */
export const LABEL_TOKEN_REGEX = /\{\{label:([a-z0-9-]+)\}\}/g;

/** Détecte la présence d'au moins un token label (non-global, sûr en boucle). */
export function hasLabelToken(text: string): boolean {
  return /\{\{label:[a-z0-9-]+\}\}/.test(text);
}

/**
 * Entrée du registre plat : soit un tier complet, soit un sous-tier (qui n'a
 * qu'un `priceFlat`). On garde la distinction pour formater au plus juste.
 */
type RegistryEntry =
  { kind: "tier"; tier: PricingTier } | { kind: "subTier"; subTier: PricingSubTier };

/**
 * Registre `id → entrée`, construit une seule fois en aplatissant
 * `PRICING_CATEGORIES` + `UN_A_UN_TIERS` + tous les `subTiers`. Réutilisé par
 * le garde-fou CI pour construire l'allowlist des montants SSOT.
 */
export const PRICE_TOKEN_REGISTRY: ReadonlyMap<string, RegistryEntry> = (() => {
  const map = new Map<string, RegistryEntry>();
  const allTierGroups: ReadonlyArray<ReadonlyArray<PricingTier>> = [
    ...Object.values(PRICING_CATEGORIES),
    UN_A_UN_TIERS,
    // Tiers hors PRICING_CATEGORIES mais tokenisables (KB facts, prose) :
    // coaching récurrent 1-to-1 + maintenance post-livraison.
    [UN_A_UN_RECURRING_TIER],
    MAINTENANCE_TIERS,
  ];
  for (const group of allTierGroups) {
    for (const tier of group) {
      // Premier gagnant : les groupes peuvent partager un tier (UN_A_UN_TIERS
      // réexpose intervention-dirigeants) — on ne réécrit pas.
      if (!map.has(tier.id)) map.set(tier.id, { kind: "tier", tier });
      for (const sub of tier.subTiers ?? []) {
        if (!map.has(sub.id)) map.set(sub.id, { kind: "subTier", subTier: sub });
      }
    }
  }
  return map;
})();

const onQuoteLabel = (locale: Locale): string => (locale === "fr" ? "Sur devis" : "On request");

const fromPrefix = (locale: Locale): string => (locale === "fr" ? "À partir de" : "From");

/** Prix d'entrée brut d'un tier (fixe sinon borne basse). */
function tierEntryPrice(tier: PricingTier): number | undefined {
  return tier.priceFlat ?? tier.priceMin;
}

/** Résout une entrée du registre selon le mode demandé. */
function renderEntry(entry: RegistryEntry, mode: PriceTokenMode, locale: Locale): string {
  if (entry.kind === "subTier") {
    // Un sous-tier n'a qu'un prix fixe — tous les modes retombent dessus.
    const sub = entry.subTier;
    if (mode === "from") return `${fromPrefix(locale)} ${formatAmount(sub.priceFlat, locale)}`;
    if (mode === "compact") return formatAmount(sub.priceFlat, locale, { compact: true });
    if (mode === "num") return fmtNumber(sub.priceFlat, locale);
    return formatAmount(sub.priceFlat, locale);
  }

  const tier = entry.tier;
  switch (mode) {
    case "flat":
      return typeof tier.priceFlat === "number"
        ? formatAmount(tier.priceFlat, locale)
        : formatPrice(tier, locale);
    case "onsite":
      return formatPriceWithOnsite(tier, locale);
    case "range":
      return typeof tier.priceMin === "number" && typeof tier.priceMax === "number"
        ? formatAmountRange(tier.priceMin, tier.priceMax, locale)
        : formatPrice(tier, locale);
    case "from": {
      const entryPrice = tierEntryPrice(tier);
      if (entryPrice == null) return onQuoteLabel(locale);
      return `${fromPrefix(locale)} ${formatAmount(entryPrice, locale)}`;
    }
    case "entry": {
      const entryPrice = tierEntryPrice(tier);
      if (entryPrice == null) return onQuoteLabel(locale);
      return formatAmount(entryPrice, locale);
    }
    case "compact": {
      const entryPrice = tierEntryPrice(tier);
      if (entryPrice == null) return onQuoteLabel(locale);
      return formatAmount(entryPrice, locale, { compact: true });
    }
    case "num": {
      const entryPrice = tierEntryPrice(tier);
      if (entryPrice == null) return onQuoteLabel(locale);
      return fmtNumber(entryPrice, locale);
    }
    case "full":
    default:
      return formatPrice(tier, locale);
  }
}

/**
 * Recolle la prose après résolution d'un token en mode `range`/`entry`.
 *
 * ⚠️ AUDIT 2026-07-21 — le mode `range` rend « À partir de 1 900 € HT ». Or la
 * plupart des phrases rédigées autour de ces tokens portent DÉJÀ leur propre
 * amorce : « le coût commence à … », « l'audit débute à … », « démarre à … ».
 * Une fois le token résolu, on lisait donc en clair sur le site :
 *
 *     « Un audit standard PME commence à À partir de 1 900 € HT »
 *
 * Ce défaut était explicitement listé comme interdit dans l'inventaire de purge
 * (« ❌ Laisser À partir de À partir de »). Mesuré : 10 formulations sur 12.
 *
 * On corrige à l'affichage plutôt qu'en base : le contenu reste porteur d'un
 * token dynamique, et toute rédaction future est couverte sans nouvelle purge.
 * `à À partir de` n'est jamais du français correct — la collision est donc sûre
 * à réduire, sans besoin d'analyser la phrase.
 */
export function collapsePriceProseDuplicates(text: string): string {
  if (typeof text !== "string" || !text.includes("partir de")) return text;
  // ⚠️ Pas de `\b` : en JS il est ASCII, donc « à » y compte comme NON-mot et
  // `\bà` ne matche jamais. On ancre explicitement sur début/espace/parenthèse.
  // Ordre important : les motifs les plus longs d'abord.
  return (
    text
      // « à partir de À partir de X » → « à partir de X »
      .replace(/(^|[\s(])à\s+partir\s+de\s+À\s+partir\s+de\s+/gi, "$1à partir de ")
      // « compris entre À partir de X » — « entre » attend deux bornes, or le
      // tier n'en expose qu'une : on retombe sur la formulation correcte.
      .replace(/(^|[\s(])comprise?\s+entre\s+À\s+partir\s+de\s+/gi, "$1à partir de ")
      // « commence à À partir de X » → « commence à X ». Sensible à la casse :
      // c'est la collision préposition minuscule + amorce rendue majuscule.
      .replace(/(^|[\s(])à\s+À\s+partir\s+de\s+/g, "$1à ")
  );
}

/**
 * Remplace tous les tokens `{{price:…}}` d'une chaîne par leur valeur SSOT.
 * Tokens à id ou mode inconnu : laissés en l'état + warning (détectés par le
 * garde-fou CI). Renvoie la chaîne inchangée si aucun token.
 */
export function resolvePriceTokens(text: string, locale: Locale = "fr"): string {
  if (typeof text !== "string" || !hasPriceToken(text)) return text;
  return text.replace(PRICE_TOKEN_REGEX, (match, rawId: string, rawMode?: string) => {
    const entry = PRICE_TOKEN_REGISTRY.get(rawId);
    if (!entry) {
      console.warn(`[pricing-tokens] tier inconnu dans le token « ${match} » — laissé en l'état`);
      return match;
    }
    const mode = (rawMode ?? "full") as PriceTokenMode;
    if (!VALID_MODES.has(mode)) {
      console.warn(
        `[pricing-tokens] mode inconnu « ${rawMode} » dans « ${match} » — laissé en l'état`,
      );
      return match;
    }
    return renderEntry(entry, mode, locale);
  });
}

/** Nom d'affichage SSOT d'une entrée registre selon la locale. */
function renderEntryLabel(entry: RegistryEntry, locale: Locale): string {
  if (entry.kind === "subTier") {
    return locale === "fr" ? entry.subTier.labelFr : entry.subTier.labelEn;
  }
  return locale === "fr" ? entry.tier.labelFr : entry.tier.labelEn;
}

/**
 * Remplace tous les tokens `{{label:…}}` d'une chaîne par le libellé SSOT du
 * tier/sous-tier. Id inconnu : laissé en l'état + warning. Renvoie la chaîne
 * inchangée si aucun token.
 */
export function resolveLabelTokens(text: string, locale: Locale = "fr"): string {
  if (typeof text !== "string" || !hasLabelToken(text)) return text;
  return text.replace(LABEL_TOKEN_REGEX, (match, rawId: string) => {
    const entry = PRICE_TOKEN_REGISTRY.get(rawId);
    if (!entry) {
      console.warn(`[pricing-tokens] tier inconnu dans le token « ${match} » — laissé en l'état`);
      return match;
    }
    return renderEntryLabel(entry, locale);
  });
}

/**
 * Walker récursif : applique `resolvePriceTokens` à toutes les chaînes d'une
 * valeur arbitraire (string / array / objet plain), en profondeur. Conserve la
 * structure ; ne touche pas aux non-strings. Utilisé pour résoudre les objets
 * copy villes (`resolveVilleWithCopy`) en un seul passage.
 *
 * Note : retourne une nouvelle structure (immutable), ne mute pas l'entrée.
 */
export function resolvePriceTokensDeep<T>(value: T, locale: Locale = "fr"): T {
  if (typeof value === "string") {
    // Résout d'abord les tokens prix, puis les tokens label (SSOT noms).
    return resolveLabelTokens(resolvePriceTokens(value, locale), locale) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolvePriceTokensDeep(item, locale)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    // Ne walke que les objets « plain » (copy data). Laisse intacts Date, Map,
    // class instances, etc. — improbable dans la copy mais on reste prudent.
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = resolvePriceTokensDeep(v, locale);
      }
      return out as unknown as T;
    }
  }
  return value;
}
