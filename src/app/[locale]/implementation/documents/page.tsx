import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { ImplementationSubPageExtras } from "@/components/services/implementation/ImplementationSubPageExtras";
import { IntentionHeroSchema } from "@/components/sections/IntentionHeroSchema";
import { INTENTION_HERO_ARIA } from "@/content/intention-hero-configs";
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

const SLUG = "documents" as const;

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

export default async function DocumentsPage({ params }: Props) {
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
  // requêtes « traitement documents IA », « OCR LLM extraction PDF entreprise ».
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — traitement de documents par IA"
          : "Axion-IA team — AI document processing",
        alt: isFr
          ? "Équipe Axion-IA conçoit et déploie des pipelines IA de traitement documentaire pour TPE, PME et ETI — OCR, extraction structurée, classification, résumé, RAG sur PDF, contrats, factures, courriers."
          : "Axion-IA team designs and deploys AI document processing pipelines for small businesses, SMEs and mid-caps — OCR, structured extraction, classification, summarization, RAG on PDFs, contracts, invoices, mail.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, expert traitement documents IA"
          : "William — Axion-IA founder, AI document processing expert",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Pilote personnellement les projets de traitement documentaire IA pour dirigeants TPE et PME — architecture, choix LLM multimodal, qualité d'extraction, supervision humaine."
          : "Portrait of William, Axion-IA founder. Personally drives AI document processing projects for small business and SME executives — architecture, multimodal LLM selection, extraction quality, human oversight.",
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
      serviceType: "AI implementation · documents",
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
        accent="orange"
        hideFinalCta
        copy={copy}
        heroSchema={<IntentionHeroSchema variant={SLUG} ariaLabel={INTENTION_HERO_ARIA[SLUG]} />}
        ctaPrimaryHref="/contact?type=implementation&subType=documents"
        ctaSecondaryHref="/cas-concrets"
        jsonLd={jsonLd}
      />

      <ImplementationSubPageExtras isFr={isFr} slug={SLUG} />
    </>
  );
}
