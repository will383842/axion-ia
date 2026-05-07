import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { getAudit } from "@/content/audit";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "cabinet" as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const a = getAudit(SLUG);
  const c = a[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? a.pathFr : a.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: a.pathFr, en: a.pathEn },
  });
}

export default async function AuditPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const a = getAudit(SLUG);
  const copy = a[loc];
  const path = loc === "fr" ? a.pathFr : a.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI audit · firm",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    buildBreadcrumbJsonLd({
      locale: loc,
      items: [
        { name: loc === "fr" ? "Accueil" : "Home", href: "/" },
        { name: loc === "fr" ? "Audit & optimisation" : "Audit & optimization", href: "/audit" },
        { name: copy.title, href: `/audit/${SLUG}` },
      ],
    }),
  ];
  return (
    <ProductPageTemplate
      accent="orange"
      copy={copy}
      ctaPrimaryHref="/audit/demande"
      ctaSecondaryHref="/audit"
      jsonLd={jsonLd}
    />
  );
}
