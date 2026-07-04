import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, Building2, BarChart3, ShieldCheck } from "lucide-react";
import { routing, STATIC_LOCALES, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getAllIndustrySlugs,
  getCaseStudiesByIndustry,
  getIndustryLabel,
} from "@/content/case-studies";
import { buildProductMetadata, buildCollectionPageJsonLd, SITE_URL } from "@/lib/seo";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllIndustrySlugs().flatMap((slug) =>
    STATIC_LOCALES.map((locale) => ({ locale, slug })),
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
    title:
      locale === "fr" ? `Cas concrets ${label} · Axion-IA` : `${label} case studies · Axion-IA`,
    description:
      locale === "fr"
        ? `Cas concrets Axion-IA dans le secteur ${label}. Résultats chiffrés et témoignages.`
        : `Axion-IA case studies in the ${label} sector. Quantified results and testimonials.`,
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

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: `/cas-concrets/secteur/${slug}`,
    name: isFr ? `Cas concrets ${label}` : `${label} case studies`,
    inLanguage: locale,
    isPartOf: { "@type": "WebSite", name: "Axion-IA", url: SITE_URL },
    hasPart: studies.map((s) => ({
      "@type": "Article",
      headline: s[loc].title,
      url: `${SITE_URL}/${locale}/cas-concrets/${s.slug}`,
      about: { "@type": "Thing", name: loc === "fr" ? s.industry : s.industryEn },
    })),
  });

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
            ? `${studies.length} cas concret${studies.length > 1 ? "s" : ""} dans ce secteur. Résultats chiffrés, temps de mise en œuvre, ROI documenté.`
            : `${studies.length} case stud${studies.length > 1 ? "ies" : "y"} in this industry. Quantified results, implementation timelines, documented ROI.`
        }
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              {
                icon: FileText,
                label: `${studies.length} ${isFr ? "cas concrets" : "case studies"}`,
              },
              { icon: Building2, label: label },
              { icon: BarChart3, label: isFr ? "ROI chiffré" : "Quantified ROI" },
              { icon: ShieldCheck, label: isFr ? "Données anonymisées" : "Anonymised data" },
            ].map((pill) => {
              const Icon = pill.icon;
              return (
                <li
                  key={pill.label}
                  className="text-fg-soft inline-flex items-center gap-2 text-sm"
                >
                  <Icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                  <span>{pill.label}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Cta href="/cas-concrets" size="lg">
              {isFr ? "Voir tous les cas" : "See all case studies"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg">
              {isFr ? "Demander un audit" : "Request an audit"}
            </Cta>
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <ul className="xs:grid-cols-2 grid grid-cols-1 gap-6 md:grid-cols-3">
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
      <AiContentDisclaimer locale={loc} />
      <JsonLd data={collectionJsonLd} />
    </>
  );
}
