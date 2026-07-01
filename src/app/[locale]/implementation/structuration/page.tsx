import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { ImplementationSubPageExtras } from "@/components/services/implementation/ImplementationSubPageExtras";
import { IntentionHeroSchema } from "@/components/sections/IntentionHeroSchema";
import { INTENTION_HERO_ARIA } from "@/content/intention-hero-configs";
import { ImplementationContactBand } from "@/components/services/implementation/ImplementationContactBand";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getImplementation } from "@/content/implementation";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  buildWebPageJsonLd,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "structuration" as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const a = getImplementation(SLUG);
  const c = a[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? a.pathFr : a.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: a.pathFr, en: a.pathEn },
  });
}

export default async function StructurationPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const a = getImplementation(SLUG);
  const copy = a[loc];
  const path = loc === "fr" ? a.pathFr : a.pathEn;
  const isFr = loc === "fr";
  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « structuration des données IA », « data prep IA entreprise ».
  const imagesJsonLd = buildPageImageGraphJsonLd({
    locale: loc,
    path: "/implementation/structuration",
  });
  // Nœud WebPage — porteur du `speakable` (h1/h2 + réponses) et du
  // `primaryImageOfPage`. Réutilise titre/description meta (pas de réécriture).
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/implementation/structuration",
    name: copy.metaSeo.title,
    description: copy.metaSeo.description,
    speakable: true,
    ...(buildPrimaryImageOfPage("/implementation/structuration")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/implementation/structuration") } }
      : {}),
  });
  const jsonLd = [
    webPageJsonLd,
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI implementation · structuration",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    ...(imagesJsonLd ? [imagesJsonLd] : []),
  ];
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/implementation", label: isFr ? "Implémentation IA" : "AI implementation" },
    { href: `/implementation/${SLUG}`, label: copy.title },
  ];
  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <ProductPageTemplate
        isFr={isFr}
        accent="orange"
        hideFinalCta
        hideFaq
        copy={copy}
        heroSchema={<IntentionHeroSchema variant={SLUG} ariaLabel={INTENTION_HERO_ARIA[SLUG]} />}
        midBand={<ImplementationContactBand isFr={isFr} trackSuffix={`-${SLUG}`} />}
        ctaPrimaryHref="/contact?type=implementation&subType=structuration"
        ctaSecondaryHref="/cas-concrets"
        jsonLd={jsonLd}
      />

      <ImplementationSubPageExtras isFr={isFr} slug={SLUG} />
    </>
  );
}
