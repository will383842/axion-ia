import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { ImplementationSubPageExtras } from "@/components/services/implementation/ImplementationSubPageExtras";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getImplementation } from "@/content/implementation";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildImageGraphJsonLd,
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
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — intégration IA dans vos outils no-code existants"
          : "Axion-IA team — AI integration into your existing no-code tools",
        alt: isFr
          ? "Équipe Axion-IA intègre l'IA dans vos outils no-code existants (n8n, Make, Zapier, Bubble, Airtable) pour TPE et PME — sur demande client uniquement, notre approche par défaut reste le code custom souverain."
          : "Axion-IA team integrates AI into your existing no-code tools (n8n, Make, Zapier, Bubble, Airtable) for small businesses and SMEs — on client request only, our default approach is sovereign custom code.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr ? "William — Fondateur Axion-IA" : "William — Axion-IA founder",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Pilote les projets d'intégration IA dans vos outils no-code existants pour dirigeants TPE et PME — analyse de l'existant, design des flows, transfert d'autonomie aux équipes."
          : "Portrait of William, Axion-IA founder. Drives AI integration projects into your existing no-code tools for small business and SME executives — analysis of existing setup, flow design, autonomy transfer to teams.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI implementation · no-code",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    imagesJsonLd,
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
        accent="purple"
        copy={copy}
        ctaPrimaryHref="/contact?type=implementation&subType=no-code"
        ctaSecondaryHref="/cas-concrets"
        jsonLd={jsonLd}
      />

      <ImplementationSubPageExtras isFr={isFr} slug={SLUG} />
    </>
  );
}
