import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { getIntervention } from "@/content/interventions";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const intervention = getIntervention("managers");
  const c = intervention[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? intervention.pathFr : intervention.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: intervention.pathFr, en: intervention.pathEn },
  });
}

export default async function Managers({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const intervention = getIntervention("managers");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI consulting · managers",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    buildBreadcrumbJsonLd({
      locale: loc,
      items: [
        { name: loc === "fr" ? "Accueil" : "Home", href: "/" },
        {
          name: loc === "fr" ? "Interventions entreprise" : "Corporate AI sessions",
          href: "/interventions",
        },
        { name: copy.title, href: "/interventions/managers" },
      ],
    }),
  ];
  return (
    <ProductPageTemplate
      isFr={loc === "fr"}
      accent="primary"
      copy={copy}
      ctaPrimaryHref="/reserver?intervention=managers"
      ctaSecondaryHref="/interventions/essentielle"
      jsonLd={jsonLd}
    />
  );
}
