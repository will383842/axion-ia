import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, Clock, RefreshCw, Tag } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getAllBlogCategorySlugs,
  getBlogPostsByCategory,
  getBlogCategoryLabel,
} from "@/content/transversal";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Audit indexation 2026-05-18 P0-7 — dynamicParams=false force Next 16 à 404
// les slugs inconnus sans exécuter la page function (vs default `true` qui
// rendait la page on-demand avec status 200 + meta noindex = soft 404 GSC).
// Safe ici car generateStaticParams retourne TOUS les slugs valides FS.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBlogCategorySlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const label = getBlogCategoryLabel(slug);
  if (!label) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: `/blog/categorie/${slug}`,
    title: isFr ? `${label} · Articles Axion-IA` : `${label} · Axion-IA articles`,
    description: isFr
      ? `Articles Axion-IA dans la catégorie ${label}.`
      : `Axion-IA articles in the ${label} category.`,
  });
}

export default async function BlogCategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const label = getBlogCategoryLabel(slug);
  if (!label) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const posts = getBlogPostsByCategory(slug);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} — ${isFr ? "Articles Axion-IA" : "Axion-IA articles"}`,
    url: `${SITE_URL}/${locale}/blog/categorie/${slug}`,
    inLanguage: locale,
    isPartOf: { "@type": "WebSite", name: "Axion-IA", url: SITE_URL },
    hasPart: posts.map((p) => ({
      "@type": "Article",
      headline: p[loc].title,
      url: `${SITE_URL}/${locale}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      author: { "@type": "Person", name: p.author },
    })),
  } as const;

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: `/blog/categorie/${slug}`, label },
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
          isFr
            ? `${posts.length} article${posts.length > 1 ? "s" : ""} dans cette catégorie. Méthodologie & cas d'usage IA testés en mission.`
            : `${posts.length} article${posts.length > 1 ? "s" : ""} in this category. Field-tested AI methodology & use cases.`
        }
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              { icon: FileText, label: `${posts.length} ${isFr ? "articles" : "articles"}` },
              { icon: Tag, label: label },
              { icon: Clock, label: isFr ? "Lecture 6-12 min" : "6-12 min read" },
              { icon: RefreshCw, label: isFr ? "MAJ mensuelle" : "Monthly updates" },
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
            <Cta href="/blog" size="lg">
              {isFr ? "Voir tous les articles" : "See all articles"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/formations" variant="outline" size="lg">
              {isFr ? "Voir nos formations" : "See our trainings"}
            </Cta>
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <li key={p.slug}>
                <ArticleCard
                  href={`/blog/${p.slug}`}
                  title={p[loc].title}
                  excerpt={p[loc].excerpt}
                  publishedAt={p.publishedAt}
                  readingTime={p.readingTime}
                />
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <JsonLd
        data={buildBreadcrumbJsonLd({
          locale: loc,
          items: [
            { name: "Blog", href: "/blog" },
            { name: label, href: `/blog/categorie/${slug}` },
          ],
        })}
        scriptId="jsonld-breadcrumb-blog-categorie"
      />
      <JsonLd data={collectionJsonLd} />
    </>
  );
}
