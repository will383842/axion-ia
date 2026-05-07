import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getAllHelpCategorySlugs,
  getHelpArticlesByCategory,
  getHelpCategoryLabel,
} from "@/content/transversal";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllHelpCategorySlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const label = getHelpCategoryLabel(slug);
  if (!label) return {};
  return buildProductMetadata({
    locale,
    path: `/centre-aide/categorie/${slug}`,
    title: locale === "fr" ? `${label} · Aide AxionIA` : `${label} · AxionIA help`,
    description:
      locale === "fr"
        ? `Articles d'aide AxionIA dans la catégorie ${label}.`
        : `AxionIA help articles in the ${label} category.`,
    alternates: {
      fr: `/centre-aide/categorie/${slug}`,
      en: `/help/category/${slug}`,
    },
  });
}

export default async function HelpCategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const label = getHelpCategoryLabel(slug);
  if (!label) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const articles = getHelpArticlesByCategory(slug);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} — ${isFr ? "Aide AxionIA" : "AxionIA help"}`,
    url: `${SITE_URL}/${locale}/centre-aide/categorie/${slug}`,
    inLanguage: locale,
  } as const;

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
      />
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
    </>
  );
}
