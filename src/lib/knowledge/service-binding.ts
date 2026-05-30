/**
 * KB V4.1 Service Binding — Vagues B+C (code-only, SANS migration DB).
 *
 * Pont entre une entrée KB rattachée à un service (tag `service:*` posé en Vague A)
 * et l'offre commerciale correspondante. Tout est dérivé :
 *   - du SSOT services (`src/content/knowledge/services.ts`) ;
 *   - du SSOT tarifs (`src/content/pricing.ts`) — ZÉRO tarif hardcodé.
 *
 * Aucune table `KnowledgeServiceBinding` : la table n'est requise que pour le
 * sprint complet (override admin + variantes par cible). Ici, le rendu vendeur
 * (Offer/Service JSON-LD + CTA contextuel + tarif live) est produit à 100 % en
 * code à partir des données déjà présentes → zéro risque de migration prod.
 *
 * Doctrine respectée :
 *   - tarif TOUJOURS via `pricing.ts` (jamais de montant en dur) ;
 *   - `sites-web-augmentes` n'a pas de tiers dédiés → pas d'Offer avec prix
 *     (décision Will : « Offer seulement si tarif existe »).
 */

import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_TIERS,
  formatAmount,
  getEntryPriceEur,
  type PricingTier,
} from "@/content/pricing";
import { getServiceDef, type ServiceSlug } from "@/content/knowledge/services";
import { SITE_URL } from "@/lib/seo";

/**
 * Mapping service → grille tarifaire SSOT (`pricing.ts`).
 * `null` = pas de tiers dédiés (sites-web-augmentes) → pas d'Offer avec prix.
 */
const SERVICE_TIERS: Record<ServiceSlug, readonly PricingTier[] | null> = {
  audit: AUDIT_TIERS,
  implementation: IMPLEMENTATION_TIERS,
  "interventions-formations": INTERVENTION_TIERS,
  "un-a-un": UN_A_UN_TIERS,
  "sites-web-augmentes": null,
};

export interface ServiceOffer {
  readonly serviceSlug: ServiceSlug;
  /** Libellé FR du service (depuis le SSOT services). */
  readonly labelFr: string;
  /** Route de la page service (CTA). */
  readonly pageHref: string;
  /** Prix d'entrée EUR (null si pas de tiers dédiés). */
  readonly fromPriceEur: number | null;
  /** Prix d'entrée formaté FR (ex. « 890 € »), null si pas de tarif. */
  readonly fromPriceLabel: string | null;
}

/**
 * Construit l'offre d'un service depuis les SSOT. Retourne `null` si le service
 * est inconnu. `fromPriceEur`/`fromPriceLabel` valent `null` pour les services
 * sans tiers dédiés (sites-web-augmentes) — l'appelant n'émet alors PAS d'Offer.
 */
export function getServiceOffer(slug: ServiceSlug): ServiceOffer | null {
  const def = getServiceDef(slug);
  if (!def) return null;
  const tiers = SERVICE_TIERS[slug];
  // getEntryPriceEur renvoie number | undefined → on normalise en number | null.
  const fromPriceEur = tiers ? (getEntryPriceEur(tiers) ?? null) : null;
  return {
    serviceSlug: slug,
    labelFr: def.labelFr,
    pageHref: def.pageHref,
    fromPriceEur,
    fromPriceLabel: fromPriceEur !== null ? formatAmount(fromPriceEur, "fr") : null,
  };
}

/**
 * schema.org `Offer` pour un service — émis UNIQUEMENT si un tarif existe
 * (décision Will). Retourne `null` sinon (pas d'Offer sans prix → signal honnête).
 * Le `price` est exprimé en EUR (lowPrice = prix d'entrée), `priceCurrency=EUR`.
 */
export function buildServiceOfferJsonLd(slug: ServiceSlug): Record<string, unknown> | null {
  const offer = getServiceOffer(slug);
  if (!offer || offer.fromPriceEur === null) return null;
  const url = `${SITE_URL}/fr${offer.pageHref}`;
  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    "@id": `${url}#offer`,
    name: offer.labelFr,
    url,
    priceCurrency: "EUR",
    price: offer.fromPriceEur,
    priceSpecification: {
      "@type": "PriceSpecification",
      priceCurrency: "EUR",
      minPrice: offer.fromPriceEur,
    },
    availability: "https://schema.org/InStock",
    seller: {
      "@type": "Organization",
      name: "Axion-IA",
      url: SITE_URL,
    },
  };
}

export interface ServiceCta {
  readonly href: string;
  readonly labelFr: string;
  /** Sous-texte tarif (« dès 890 € »), null si pas de tarif. */
  readonly fromLabelFr: string | null;
}

/**
 * CTA contextuel vers la page service, avec sous-texte tarif live si dispo.
 * Utilisé par le bloc « Aller plus loin » des pages ressources KB.
 */
export function getServiceCta(slug: ServiceSlug): ServiceCta | null {
  const offer = getServiceOffer(slug);
  if (!offer) return null;
  return {
    href: offer.pageHref,
    labelFr: `Découvrir ${offer.labelFr}`,
    fromLabelFr: offer.fromPriceLabel ? `dès ${offer.fromPriceLabel}` : null,
  };
}
