// Server Component — rendu d'une landing détail sites-web/SaaS depuis son slug.
// Pattern miroir de CollectiveTrainingPage : une route mince délègue tout ici.
// hero DetailHeroSchema + ProductPageTemplate + SitesWebContactBand (midBand) +
// SitesWebSubPageExtras + JSON-LD Service/FAQ. AUCUN prix affiché (forfait/devis).

import type { ReactNode } from "react";
import {
  MessageSquare,
  Search,
  Plug,
  Layers,
  Rocket,
  ShieldCheck,
  Sparkles,
  Database,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
import { SitesWebContactBand } from "@/components/services/sites-web/SitesWebContactBand";
import { SitesWebSubPageExtras } from "@/components/services/sites-web/SitesWebSubPageExtras";
import { getSitesWeb, type SitesWebSlug } from "@/content/sites-web";
import { buildServiceJsonLd, buildFaqJsonLd } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

const ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  Search,
  Plug,
  Layers,
  Rocket,
  ShieldCheck,
  Sparkles,
  Database,
};

export function SitesWebLandingPage({
  slug,
  locale,
}: {
  slug: SitesWebSlug;
  locale: Locale;
}): ReactNode {
  const isFr = locale === "fr";
  const content = getSitesWeb(slug);
  const copy = isFr ? content.fr : content.en;
  const path = isFr ? content.pathFr : content.pathEn;

  const breadcrumbItems = [
    { href: "/sites-web-augmentes", label: isFr ? "Sites web & SaaS IA" : "AI websites & SaaS" },
    { href: path, label: copy.title },
  ];

  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? content.hero.eyebrowFr : content.hero.eyebrowEn}
      title={isFr ? content.hero.titleFr : content.hero.titleEn}
      accent={content.accent}
      blocks={content.hero.blocks.map((b) => ({
        icon: ICONS[b.icon] ?? Sparkles,
        prefix: isFr ? b.prefixFr : b.prefixEn,
        label: isFr ? b.labelFr : b.labelEn,
        detail: isFr ? b.detailFr : b.detailEn,
      }))}
      ariaLabel={isFr ? content.hero.ariaFr : content.hero.ariaEn}
    />
  );

  const jsonLd = [
    buildServiceJsonLd({
      locale,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: isFr ? "Augmentation IA de site web & SaaS" : "AI website & SaaS augmentation",
      areasServed: buildServiceAreasServed(locale),
    }),
    buildFaqJsonLd({ items: copy.faqs }),
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <ProductPageTemplate
        isFr={isFr}
        accent={content.accent}
        copy={copy}
        ctaPrimaryHref={`/contact?type=sites-web&subType=${slug}`}
        ctaSecondaryHref="/sites-web-augmentes"
        heroSchema={heroSchema}
        midBand={<SitesWebContactBand isFr={isFr} variant="quote" />}
        jsonLd={jsonLd}
      />
      <SitesWebSubPageExtras isFr={isFr} slug={slug} />
    </>
  );
}
