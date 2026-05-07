import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Sunrise, Compass, ClipboardCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
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
  const intervention = getIntervention("dirigeants");
  const c = intervention[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? intervention.pathFr : intervention.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: intervention.pathFr, en: intervention.pathEn },
  });
}

export default async function Dirigeants({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const intervention = getIntervention("dirigeants");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI strategy · executives",
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
        { name: copy.title, href: "/interventions/dirigeants" },
      ],
    }),
  ];
  const isFr = loc === "fr";
  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? "Une journée type" : "A typical day"}
      title={isFr ? "Cadrage stratégique dirigeants" : "Executive strategy session"}
      accent="primary"
      blocks={[
        {
          icon: Sunrise,
          prefix: isFr ? "Matin" : "Morning",
          label: isFr ? "Vision business" : "Business vision",
          detail: isFr
            ? "Enjeux stratégiques, contraintes, ambitions IA à 12-24 mois."
            : "Strategic stakes, constraints, 12-24 month AI ambitions.",
        },
        {
          icon: Compass,
          prefix: isFr ? "Midi" : "Noon",
          label: isFr ? "Démos sur vos données" : "Demos on your data",
          detail: isFr
            ? "Cas d'usage IA prioritaires testés en live, anonymisés."
            : "Priority AI use cases tested live, anonymised.",
        },
        {
          icon: ClipboardCheck,
          prefix: isFr ? "Après-midi" : "Afternoon",
          label: isFr ? "Plan d'action 90 jours" : "90-day action plan",
          detail: isFr
            ? "Quick-wins identifiés + roadmap chiffrée prête à arbitrer."
            : "Quick-wins identified + costed roadmap ready to arbitrate.",
        },
      ]}
      ariaLabel={
        isFr
          ? "Schéma : journée type d'une intervention dirigeants — matin vision business, midi démos sur vos données, après-midi plan d'action 90 jours."
          : "Diagram: typical day of an executive session — morning business vision, noon demos on your data, afternoon 90-day action plan."
      }
    />
  );

  return (
    <ProductPageTemplate
      isFr={isFr}
      accent="primary"
      copy={copy}
      ctaPrimaryHref="/reserver?intervention=dirigeants"
      ctaSecondaryHref="/interventions/essentielle"
      heroSchema={heroSchema}
      jsonLd={jsonLd}
    />
  );
}
