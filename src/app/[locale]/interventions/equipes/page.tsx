import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Users, Wrench, Sparkles } from "lucide-react";
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
  const intervention = getIntervention("equipes");
  const c = intervention[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? intervention.pathFr : intervention.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: intervention.pathFr, en: intervention.pathEn },
  });
}

export default async function Equipes({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const intervention = getIntervention("equipes");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI consulting · teams",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
  ];
  const isFr = loc === "fr";
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
    },
    { href: "/interventions/equipes", label: copy.title },
  ];
  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? "Une journée type" : "A typical day"}
      title={isFr ? "Mise en pratique équipes" : "Team hands-on session"}
      accent="primary"
      blocks={[
        {
          icon: Users,
          prefix: isFr ? "Matin" : "Morning",
          label: isFr ? "Diagnostic métier" : "Field diagnostic",
          detail: isFr
            ? "Entretiens équipes, recensement des tâches répétitives concrètes."
            : "Team interviews, mapping of concrete repetitive tasks.",
        },
        {
          icon: Wrench,
          prefix: isFr ? "Midi" : "Noon",
          label: isFr ? "Atelier outils" : "Tools workshop",
          detail: isFr
            ? "Démos pratiques sur les outils IA prioritaires pour vos métiers."
            : "Hands-on demos on the priority AI tools for your roles.",
        },
        {
          icon: Sparkles,
          prefix: isFr ? "Après-midi" : "Afternoon",
          label: isFr ? "Plan d'autonomie" : "Autonomy plan",
          detail: isFr
            ? "Vos équipes repartent avec leur kit IA opérationnel personnel."
            : "Your teams leave with their personal operational AI toolkit.",
        },
      ]}
      ariaLabel={
        isFr
          ? "Schéma : journée type d'une intervention équipes — matin diagnostic métier, midi atelier outils, après-midi plan d'autonomie."
          : "Diagram: typical day of a team session — morning field diagnostic, noon tools workshop, afternoon autonomy plan."
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
        ctaPrimaryHref="/reserver?intervention=equipes"
        ctaSecondaryHref="/interventions/essentielle"
        heroSchema={heroSchema}
        jsonLd={jsonLd}
      />
    </>
  );
}
