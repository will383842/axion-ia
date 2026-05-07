import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { getComparison, getAllComparisonSlugs } from "@/content/comparaisons";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllComparisonSlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const c = getComparison(slug);
  if (!c) return {};
  const copy = c[locale as Locale];
  return buildProductMetadata({
    locale,
    path: `/comparaisons/${slug}`,
    title: `${copy.title} · AxionIA`,
    description: copy.excerpt,
  });
}

export default async function ComparisonPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const c = getComparison(slug);
  if (!c) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const copy = c[loc];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.title,
    description: copy.excerpt,
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/comparaisons/${slug}`,
    publisher: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Comparaisons" : "Comparisons", href: "/comparaisons" },
      { name: copy.title, href: `/comparaisons/${slug}` },
    ],
  });

  // Split sur " vs " pour mettre "vs" en italique terracotta éditorial.
  // Si le titre ne contient pas " vs ", on garde le titre tel quel.
  const vsMatch = copy.title.match(/^(.+?)\s+vs\s+(.+)$/i);

  return (
    <>
      {vsMatch ? (
        <Section
          titleAs="h1"
          eyebrow={isFr ? "Comparaison" : "Comparison"}
          title={vsMatch[1]}
          titleEm="vs"
          titleTail={` ${vsMatch[2]}`}
          description={copy.excerpt}
        />
      ) : (
        <Section
          titleAs="h1"
          eyebrow={isFr ? "Comparaison" : "Comparison"}
          title={copy.title}
          description={copy.excerpt}
        />
      )}
      <Section>
        <Container className="max-w-3xl">
          <p className="text-base leading-relaxed text-gray-700">{copy.body}</p>
        </Container>
      </Section>
      <CtaBlock
        title={isFr ? "Besoin d'arbitrer pour votre cas ?" : "Need to arbitrate for your case?"}
        description={
          isFr
            ? "L'audit IA AxionIA livre une recommandation chiffrée en 5 jours."
            : "The AxionIA AI audit delivers a costed recommendation in 5 days."
        }
        cta={
          <Cta href="/audit" size="lg">
            {isFr ? "Voir l'audit IA" : "See AI audit"} →
          </Cta>
        }
        tone="dark"
      />
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
