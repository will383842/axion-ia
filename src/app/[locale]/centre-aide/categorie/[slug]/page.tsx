import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, HelpCircle, Compass, Clock } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  listHelpCategorySlugs,
  listHelpArticlesByCategory,
  getHelpCategoryLabel,
} from "@/lib/help-articles/reader";
import { buildProductMetadata, buildCollectionPageJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
// P0-5 2026-05-18 — slugs viennent du reader unifié (DB ou fallback hardcode).
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await listHelpCategorySlugs();
  return slugs.flatMap((slug) => routing.locales.map((locale) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const label = await getHelpCategoryLabel(slug);
  if (!label) return {};
  return buildProductMetadata({
    locale,
    path: `/centre-aide/categorie/${slug}`,
    title: locale === "fr" ? `${label} · Aide Axion-IA` : `${label} · Axion-IA help`,
    description:
      locale === "fr"
        ? `Articles d'aide Axion-IA dans la catégorie ${label}.`
        : `Axion-IA help articles in the ${label} category.`,
    alternates: {
      fr: `/centre-aide/categorie/${slug}`,
      en: `/help/category/${slug}`,
    },
  });
}

export default async function HelpCategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const label = await getHelpCategoryLabel(slug);
  if (!label) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const articles = await listHelpArticlesByCategory(slug);

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: `/centre-aide/categorie/${slug}`,
    name: `${label} — ${isFr ? "Aide Axion-IA" : "Axion-IA help"}`,
    inLanguage: locale,
    isPartOf: { "@type": "WebSite", name: "Axion-IA", url: SITE_URL },
    speakable: { selectors: ["[data-aeo='category-desc']"] },
    hasPart: articles.map((a) => ({
      "@type": "Article",
      headline: a[loc].title,
      description: a[loc].excerpt,
      url: `${SITE_URL}/${locale}/centre-aide/${a.slug}`,
    })),
  });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? `Centre d'aide · ${label}` : `Help centre · ${label}`,
    numberOfItems: articles.length,
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: isFr ? a.fr.title : a.en.title,
      url: `${SITE_URL}/${loc}/centre-aide/${a.slug}`,
    })),
  };

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
    {
      href: isFr ? `/centre-aide/categorie/${slug}` : `/help/category/${slug}`,
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
        eyebrow={isFr ? "Catégorie" : "Category"}
        title={isFr ? "Catégorie" : "Category"}
        titleEm={label}
        description={
          <span data-aeo="category-desc">
            {isFr
              ? `${articles.length} article${articles.length > 1 ? "s" : ""} d'aide dans cette catégorie. Réponses courtes, sources vérifiées, mise à jour régulière.`
              : `${articles.length} help article${articles.length > 1 ? "s" : ""} in this category. Short answers, verified sources, regular updates.`}
          </span>
        }
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              { icon: FileText, label: `${articles.length} ${isFr ? "articles" : "articles"}` },
              { icon: Compass, label: label },
              { icon: HelpCircle, label: isFr ? "Réponses courtes" : "Short answers" },
              { icon: Clock, label: isFr ? "Lecture < 5 min" : "< 5 min read" },
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
            <Cta href="/centre-aide" size="lg">
              {isFr ? "Tout le centre d'aide" : "Full help center"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/contact" variant="outline" size="lg">
              {isFr ? "Poser une question" : "Ask a question"}
            </Cta>
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2">
            {articles.map((a) => (
              <li key={a.slug}>
                <a href={`/${locale}/centre-aide/${a.slug}`} className="block">
                  <Card className="cta-lift h-full">
                    <CardHeader>
                      <CardTitle className="text-lg">{a[loc].title}</CardTitle>
                      <CardDescription>{a[loc].excerpt}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-primary text-sm font-medium">{isFr ? "Lire" : "Read"} →</p>
                    </CardContent>
                  </Card>
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <JsonLd data={collectionJsonLd} />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-centre-aide-categorie-itemlist"
      />
    </>
  );
}
