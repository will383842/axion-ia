import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { INTERVENTIONS } from "@/content/interventions";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/interventions",
    title:
      locale === "fr"
        ? "Interventions entreprise · 5 formats · AxionIA"
        : "Corporate AI sessions · 5 formats · AxionIA",
    description:
      locale === "fr"
        ? "5 formats d'intervention IA opérationnelle : Essentielle 490 €, équipes, managers, conférence ½ journée, dirigeants. Tous secteurs."
        : "5 operational AI session formats: Essential €490, teams, managers, half-day talk, executives. All industries.",
  });
}

export default async function InterventionsListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: loc === "fr" ? "Accueil" : "Home", href: "/" },
      {
        name: loc === "fr" ? "Interventions entreprise" : "Corporate AI sessions",
        href: "/interventions",
      },
    ],
  });

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={loc === "fr" ? "Module 1" : "Module 1"}
        title={loc === "fr" ? "Interventions entreprise" : "Corporate AI sessions"}
        description={
          loc === "fr"
            ? "5 formats d'intervention IA opérationnelle. Sur site, résultats dès le lendemain. Page phare : l'Essentielle 490 €."
            : "5 operational AI session formats. On site, results from day two. Flagship: the Essential €490."
        }
      />

      <Section eyebrow={loc === "fr" ? "Choisir le format" : "Pick a format"}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INTERVENTIONS.map((item) => {
            const c = item[loc];
            const href = `/interventions/${item.slug}`;
            return (
              <li key={item.slug}>
                <CaseStudyCard
                  href={href}
                  title={c.title}
                  excerpt={c.answer.slice(0, 160) + (c.answer.length > 160 ? "…" : "")}
                  industry={c.eyebrow}
                  {...(c.priceEur ? { metric: `${c.priceEur} € HT` } : {})}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      <CtaBlock
        eyebrow={loc === "fr" ? "Démarrer" : "Start"}
        title={loc === "fr" ? "Réservez l'Essentielle 490 €" : "Book the Essential €490"}
        description={
          loc === "fr"
            ? "Conversion principale : une journée d'intervention concrète, plan d'action chiffré, 30 j de support."
            : "Main conversion: one operational day, costed action plan, 30 days of support."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {loc === "fr" ? "Voir l'Essentielle" : "See the Essential"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
