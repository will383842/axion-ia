import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  getAllBlogCategorySlugs,
  getBlogPostsByCategory,
  getBlogCategoryLabel,
} from "@/content/transversal";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

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
    title: isFr ? `${label} · Articles AxionIA` : `${label} · AxionIA articles`,
    description: isFr
      ? `Articles AxionIA dans la catégorie ${label}.`
      : `AxionIA articles in the ${label} category.`,
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
    name: `${label} — ${isFr ? "Articles AxionIA" : "AxionIA articles"}`,
    url: `${SITE_URL}/${locale}/blog/categorie/${slug}`,
    inLanguage: locale,
    isPartOf: { "@type": "WebSite", name: "AxionIA", url: SITE_URL },
    hasPart: posts.map((p) => ({
      "@type": "Article",
      headline: p[loc].title,
      url: `${SITE_URL}/${locale}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      author: { "@type": "Person", name: p.author },
    })),
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: "Blog", href: "/blog" },
      { name: label, href: `/blog/categorie/${slug}` },
    ],
  });

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Catégorie" : "Category"}
        title={label}
        description={
          isFr
            ? `${posts.length} article${posts.length > 1 ? "s" : ""} dans cette catégorie.`
            : `${posts.length} article${posts.length > 1 ? "s" : ""} in this category.`
        }
      />
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
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
