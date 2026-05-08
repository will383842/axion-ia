import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getAllBlogTagSlugs, getBlogPostsByTag } from "@/content/transversal";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllBlogTagSlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: `/blog/tag/${slug}`,
    title: isFr ? `Tag #${slug} · Axion-IA` : `Tag #${slug} · Axion-IA`,
    description: isFr ? `Articles Axion-IA tagués #${slug}.` : `Axion-IA articles tagged #${slug}.`,
  });
}

export default async function BlogTagPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const posts = getBlogPostsByTag(slug);
  if (posts.length === 0) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `#${slug} — ${isFr ? "Articles Axion-IA" : "Axion-IA articles"}`,
    url: `${SITE_URL}/${locale}/blog/tag/${slug}`,
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
    { href: `/blog/tag/${slug}`, label: `#${slug}` },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow="Tag"
        title={isFr ? "Articles taggés" : "Tagged"}
        titleEm={`#${slug}`}
        description={
          isFr
            ? `${posts.length} article${posts.length > 1 ? "s" : ""} tagué${posts.length > 1 ? "s" : ""}.`
            : `${posts.length} tagged article${posts.length > 1 ? "s" : ""}.`
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
    </>
  );
}
