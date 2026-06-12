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
import {
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildImageGraphJsonLd,
  buildHowToJsonLd,
} from "@/lib/seo";
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

  // ImageObject @graph — visibilité Google Images + AI Overviews (réutilise les
  // visuels home équipe + fondateur, comme les pages formation/implementation).
  const label = [copy.title, copy.titleEm, copy.titleTail].filter(Boolean).join(" ").trim();
  const imagesJsonLd = buildImageGraphJsonLd({
    locale,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? `Équipe Axion-IA — ${label} pour sites web et SaaS`
          : `Axion-IA team — ${label} for websites and SaaS`,
        alt: isFr
          ? `Équipe Axion-IA en conception de site web augmenté IA : ${copy.answer}`
          : `Axion-IA team designing an AI-augmented website: ${copy.answer}`,
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "Williams — Fondateur Axion-IA, architecte sites web IA"
          : "Williams — Axion-IA founder, AI website architect",
        alt: isFr
          ? "Portrait de Williams, fondateur d'Axion-IA, qui pilote l'intégration IA des sites web et SaaS pour TPE, PME et ETI françaises."
          : "Portrait of Williams, Axion-IA founder, driving AI integration of websites and SaaS for French SMEs and mid-caps.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });

  // HowTo JSON-LD — signal AEO « comment intégrer cette brique » dérivé des
  // étapes process de la landing (distinct par brique → pas de duplicate).
  // Aligne les landings sites-web/SaaS sur le standard /implementation.
  const howToJsonLd = buildHowToJsonLd({
    locale,
    path,
    name: isFr
      ? `Intégrer ${copy.title.toLowerCase()} avec Axion-IA`
      : `Integrate ${copy.title.toLowerCase()} with Axion-IA`,
    description: copy.answer,
    steps: copy.processSteps.map((s) => ({ name: s.title, text: s.description })),
  });

  const jsonLd = [
    buildServiceJsonLd({
      locale,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: isFr ? "Augmentation IA de site web & SaaS" : "AI website & SaaS augmentation",
      areasServed: buildServiceAreasServed(locale),
      speakable: true,
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    howToJsonLd,
    imagesJsonLd,
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
