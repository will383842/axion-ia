import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { getImplementation } from "@/content/implementation";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "agents" as const;

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

export default async function AgentsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const a = getImplementation(SLUG);
  const copy = a[loc];
  const path = loc === "fr" ? a.pathFr : a.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI implementation · agents",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    buildBreadcrumbJsonLd({
      locale: loc,
      items: [
        { name: loc === "fr" ? "Accueil" : "Home", href: "/" },
        { name: loc === "fr" ? "Implémentation IA" : "AI implementation", href: "/implementation" },
        { name: copy.title, href: `/implementation/${SLUG}` },
      ],
    }),
  ];
  return (
    <ProductPageTemplate
      isFr={loc === "fr"}
      accent="purple"
      copy={copy}
      ctaPrimaryHref="/contact"
      ctaSecondaryHref="/cas-concrets"
      jsonLd={jsonLd}
    />
  );
}
