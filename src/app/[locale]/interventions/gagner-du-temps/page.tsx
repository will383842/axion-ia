import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Sunrise, Wrench, Rocket } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getIntervention } from "@/content/interventions";
import { buildProductMetadata, buildServiceJsonLd, buildFaqJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const intervention = getIntervention("gagner-du-temps");
  const c = intervention[locale as Locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? intervention.pathFr : intervention.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: intervention.pathFr, en: intervention.pathEn },
  });
}

export default async function GagnerDuTemps({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const intervention = getIntervention("gagner-du-temps");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI productivity training",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
  ];
  const isFr = loc === "fr";
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
    },
    { href: "/interventions/gagner-du-temps", label: copy.title },
  ];
  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? "Une journée type" : "A typical day"}
      title={isFr ? "Gagner du temps en 1 journée" : "Save time in 1 day"}
      accent="primary"
      blocks={[
        {
          icon: Sunrise,
          prefix: isFr ? "Matin" : "Morning",
          label: isFr ? "Audit des chronophages" : "Time-sink audit",
          detail: isFr
            ? "Cartographie collaborative des tâches répétitives qui mangent leurs heures."
            : "Collaborative mapping of the repetitive tasks eating their hours.",
        },
        {
          icon: Wrench,
          prefix: isFr ? "Midi" : "Noon",
          label: isFr ? "Ateliers automatisations" : "Automation workshops",
          detail: isFr
            ? "Tests live de 5 à 10 automatisations IA sur leurs propres outils."
            : "Live tests of 5 to 10 AI automations on their own tools.",
        },
        {
          icon: Rocket,
          prefix: isFr ? "Après-midi" : "Afternoon",
          label: isFr ? "Plan d'application" : "Application plan",
          detail: isFr
            ? "Bibliothèque de prompts + plan d'usage personnel par participant."
            : "Prompt library + personal usage plan per participant.",
        },
      ]}
      ariaLabel={
        isFr
          ? "Schéma : journée type Gagner du temps — matin audit chronophages, midi ateliers automatisations, après-midi plan d'application personnel."
          : "Diagram: typical Save Time day — morning time-sink audit, noon automation workshops, afternoon personal application plan."
      }
    />
  );

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <ProductPageTemplate
        isFr={isFr}
        accent="primary"
        copy={copy}
        ctaPrimaryHref="/reserver?intervention=gagner-du-temps"
        ctaSecondaryHref="/interventions/essentielle"
        heroSchema={heroSchema}
        jsonLd={jsonLd}
      />
    </>
  );
}
