import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Layers, Wrench, Target } from "lucide-react";
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
  const intervention = getIntervention("approfondie");
  const c = intervention[locale as Locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? intervention.pathFr : intervention.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: intervention.pathFr, en: intervention.pathEn },
  });
}

export default async function Approfondie({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const intervention = getIntervention("approfondie");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI deep-dive training (2 days)",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
  ];
  const isFr = loc === "fr";
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
    },
    { href: "/interventions/approfondie", label: copy.title },
  ];
  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? "2 journées consécutives" : "2 consecutive days"}
      title={isFr ? "Aller au fond en 2 jours" : "Go deep in 2 days"}
      accent="primary"
      blocks={[
        {
          icon: Layers,
          prefix: isFr ? "Jour 1" : "Day 1",
          label: isFr ? "Panorama + ateliers" : "Panorama + workshops",
          detail: isFr
            ? "Découverte des outils IA + ateliers pratiques sur leurs vraies tâches métier."
            : "AI tools panorama + hands-on workshops on their real domain tasks.",
        },
        {
          icon: Wrench,
          prefix: isFr ? "Jour 2" : "Day 2",
          label: isFr ? "Co-construction" : "Co-build",
          detail: isFr
            ? "10 à 20 automatisations construites en direct sur vos vrais outils métier."
            : "10 to 20 automations built live on your real domain tools.",
        },
        {
          icon: Target,
          prefix: isFr ? "Fin J2" : "End D2",
          label: isFr ? "Plan d'action 30 jours" : "30-day action plan",
          detail: isFr
            ? "Plan partagé : qui fait quoi, quand, avec quels outils, quels gains attendus."
            : "Shared plan: who does what, when, which tools, expected gains.",
        },
      ]}
      ariaLabel={
        isFr
          ? "Schéma : Approfondie 2 jours — Jour 1 panorama et ateliers, Jour 2 co-construction d'automatisations, fin du jour 2 plan d'action 30 jours partagé."
          : "Diagram: Deep Dive 2 days — Day 1 panorama and workshops, Day 2 automation co-build, end of day 2 shared 30-day action plan."
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
        ctaPrimaryHref="/reserver?intervention=approfondie"
        ctaSecondaryHref="/interventions/essentielle"
        heroSchema={heroSchema}
        jsonLd={jsonLd}
      />
    </>
  );
}
