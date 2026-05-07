import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getAllIndustrySlugs,
  getCaseStudiesByIndustry,
  getIndustryLabel,
} from "@/content/case-studies";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllIndustrySlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const label = getIndustryLabel(slug, locale as Locale);
  if (!label) return {};
  return buildProductMetadata({
    locale,
    path: `/cas-concrets/secteur/${slug}`,
    title: locale === "fr" ? `Cas concrets ${label} · AxionIA` : `${label} case studies · AxionIA`,
    description:
      locale === "fr"
        ? `Cas concrets AxionIA dans le secteur ${label}. Résultats chiffrés et témoignages.`
        : `AxionIA case studies in the ${label} sector. Quantified results and testimonials.`,
    alternates: {
      fr: `/cas-concrets/secteur/${slug}`,
      en: `/case-studies/industry/${slug}`,
    },
  });
}

export default async function CaseStudiesIndustryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const label = getIndustryLabel(slug, locale as Locale);
  if (!label) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const studies = getCaseStudiesByIndustry(slug);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: isFr ? `Cas concrets ${label}` : `${label} case studies`,
    url: `${SITE_URL}/${locale}/cas-concrets/secteur/${slug}`,
    inLanguage: locale,
  } as const;

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/cas-concrets", label: isFr ? "Cas concrets" : "Case studies" },
    {
      href: isFr ? `/cas-concrets/secteur/${slug}` : `/case-studies/industry/${slug}`,
      label,
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Secteur" : "Industry"}
        title={isFr ? "Cas concrets en" : "Case studies in"}
        titleEm={label}
        description={
          isFr
            ? `${studies.length} cas concret${studies.length > 1 ? "s" : ""} dans ce secteur.`
            : `${studies.length} case stud${studies.length > 1 ? "ies" : "y"} in this industry.`
        }
      />
      <Section>
        <Container>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {studies.map((s) => (
              <li key={s.slug}>
                <CaseStudyCard
                  href={`/cas-concrets/${s.slug}`}
                  title={s[loc].title}
                  excerpt={s[loc].excerpt}
                  industry={loc === "fr" ? s.industry : s.industryEn}
                  metric={s.metric}
                />
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <JsonLd data={collectionJsonLd} />
    </>
  );
}
