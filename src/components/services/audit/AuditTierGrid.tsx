/**
 * AuditTierGrid — Grille 4 niveaux d'audit (Flash / Ciblé / PME / ETI) (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extraction de la section « Par taille »
 * du toggle `/audit` (l.236-257). Utilise la SSOT `AUDIT_TIERS` (pricing.ts) +
 * `AUDIT_TIERS_META` (audit-taxonomy.ts). Émet un JSON-LD ItemList de 4 Service
 * items. Quand `villeContext` est fourni, les liens injectent `?ville=` pour
 * pré-remplir le wizard de demande de cadrage.
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  AUDIT_TIERS,
  formatAmount,
  formatAmountRange,
  getTierById,
  type PricingTier,
} from "@/content/pricing";
import { AUDIT_TIERS_META, auditTierPath } from "@/content/audit-taxonomy";
import { SITE_URL } from "@/lib/seo";
import type { VilleContext } from "@/components/services/types";

const TIGHT_X = "lg:px-6 xl:px-10";

export interface AuditTierGridProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

/** Formate le prix d'affichage d'un tier (compact, sans HT). */
function tierPriceLabel(tier: PricingTier, isFr: boolean): string {
  const loc: "fr" | "en" = isFr ? "fr" : "en";
  if (typeof tier.priceFlat === "number" && typeof tier.priceFlatOnsite === "number") {
    return isFr
      ? `${formatAmount(tier.priceFlat, "fr", { compact: true })} → ${formatAmount(tier.priceFlatOnsite, "fr", { compact: true })}`
      : `${formatAmount(tier.priceFlat, "en", { compact: true })} → ${formatAmount(tier.priceFlatOnsite, "en", { compact: true })}`;
  }
  if (typeof tier.priceFlat === "number") {
    return formatAmount(tier.priceFlat, loc, { compact: true });
  }
  if (typeof tier.priceMin === "number" && typeof tier.priceMax === "number") {
    return formatAmountRange(tier.priceMin, tier.priceMax, loc, { compact: true });
  }
  if (typeof tier.priceMin === "number") {
    return isFr
      ? `À partir de ${formatAmount(tier.priceMin, "fr", { compact: true })}`
      : `From ${formatAmount(tier.priceMin, "en", { compact: true })}`;
  }
  return isFr ? "Sur devis" : "On request";
}

export function AuditTierGrid({ isFr, villeContext }: AuditTierGridProps): ReactNode {
  const loc: "fr" | "en" = isFr ? "fr" : "en";
  const villeQS = villeContext ? `?ville=${encodeURIComponent(villeContext.villeSlug)}` : "";

  const tiers = AUDIT_TIERS_META.map((meta) => {
    const pricingTier = getTierById(AUDIT_TIERS, meta.id);
    const path = auditTierPath(meta, loc);
    return {
      id: meta.id,
      label: isFr ? meta.labelFr : meta.labelEn,
      tagline: isFr ? meta.taglineFr : meta.taglineEn,
      description: isFr ? pricingTier.descriptionFr : pricingTier.descriptionEn,
      price: tierPriceLabel(pricingTier, isFr),
      path,
      url: `${SITE_URL}/${loc}${path}`,
    };
  });

  // JSON-LD ItemList : 4 Service items. Aide les LLMs (Claude / Perplexity)
  // à énumérer les niveaux d'audit dans leurs réponses.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: villeContext
      ? isFr
        ? `Niveaux d'audit IA à ${villeContext.name}`
        : `AI audit levels in ${villeContext.name}`
      : isFr
        ? "Niveaux d'audit IA Axion-IA"
        : "Axion-IA AI audit levels",
    numberOfItems: tiers.length,
    itemListElement: tiers.map((t, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "Service",
        name: t.label,
        description: t.tagline,
        url: t.url + villeQS,
      },
    })),
  } as const;

  const description = villeContext
    ? isFr
      ? `Du diagnostic Flash à l'audit Stratégique ETI : 4 niveaux calibrés selon la taille de l'entreprise. Sélectionnez celui qui correspond à votre profil — accessible aux entreprises de ${villeContext.name} et sa région.`
      : `From Flash diagnosis to Strategic mid-cap audit: 4 levels calibrated to company size. Pick the one matching your profile — available for ${villeContext.name}-area companies.`
    : isFr
      ? "Du diagnostic Flash à l'audit Stratégique ETI : 4 niveaux calibrés selon la taille de l'entreprise. Sélectionnez celui qui correspond à votre profil."
      : "From Flash diagnosis to Strategic mid-cap audit: 4 levels calibrated to company size. Pick the one matching your profile.";

  return (
    <Section
      eyebrow={isFr ? "4 niveaux d'audit" : "4 audit levels"}
      title={isFr ? "Du diagnostic rapide à" : "From quick diagnosis to"}
      titleEm={isFr ? "la gouvernance IA multi-BU" : "multi-BU AI governance"}
      description={description}
      contentClassName={TIGHT_X}
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <article
            key={tier.id}
            className="bg-paper border-border hover:border-terracotta/60 group relative flex flex-col rounded-2xl border p-6 transition"
          >
            <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
              {tier.price}
            </p>
            <h3 className="text-fg mt-2 text-lg leading-snug font-semibold">{tier.label}</h3>
            <p className="text-fg-soft mt-3 flex-1 text-sm leading-relaxed">{tier.tagline}</p>
            <Link
              href={(tier.path + villeQS) as never}
              data-cta={`audit-tier-grid-${tier.id}`}
              className="text-terracotta-deep hover:text-terracotta mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition"
            >
              {isFr ? "Voir le format" : "See format"}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </article>
        ))}
      </div>
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId={
          villeContext
            ? `jsonld-audit-tier-grid-${villeContext.villeSlug}`
            : "jsonld-audit-tier-grid"
        }
      />
    </Section>
  );
}
