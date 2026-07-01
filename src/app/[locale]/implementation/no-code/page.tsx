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

const SLUG = "no-code" as const;

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

export default async function NoCodePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const a = getImplementation(SLUG);
  const copy = a[loc];
  const path = loc === "fr" ? a.pathFr : a.pathEn;
  const isFr = loc === "fr";
  // ImageObject @graph — Sprint AEO Phase 5. Positionnement honnête : Axion-IA
  // fait du code custom par défaut ; intégration IA dans no-code existant
  // (n8n, Make, Zapier, Bubble, Airtable) uniquement sur demande client.
  const imagesJsonLd = buildPageImageGraphJsonLd({
    locale: loc,
    path: "/implementation/no-code",
  });
  // Nœud WebPage — porteur VALIDE du `speakable` (h1/h2 + réponses) + `primaryImageOfPage`.
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/implementation/no-code",
    name: copy.metaSeo.title,
    description: copy.metaSeo.description,
    speakable: true,
    ...(buildPrimaryImageOfPage("/implementation/no-code")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/implementation/no-code") } }
      : {}),
  });
  const jsonLd = [
    webPageJsonLd,
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI implementation · no-code",
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
        ctaPrimaryHref="/contact?type=implementation&subType=no-code"
        ctaSecondaryHref="/cas-concrets"
        jsonLd={jsonLd}
      />

      <ImplementationSubPageExtras isFr={isFr} slug={SLUG} />
    </>
  );
}
