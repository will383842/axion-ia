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
  getAllBlogAuthorSlugs,
  getBlogPostsByAuthor,
  getBlogAuthorLabel,
} from "@/content/transversal";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllBlogAuthorSlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const author = getBlogAuthorLabel(slug);
  if (!author) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: `/blog/auteur/${slug}`,
    title: isFr ? `Articles de ${author} · AxionIA` : `Articles by ${author} · AxionIA`,
    description: isFr
      ? `Articles publiés par ${author} sur le blog AxionIA.`
      : `Articles by ${author} on the AxionIA blog.`,
  });
}

export default async function BlogAuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const author = getBlogAuthorLabel(slug);
  if (!author) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const posts = getBlogPostsByAuthor(slug);

  // ProfilePage Schema — E-E-A-T signal for Google.
  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: author,
      url: `${SITE_URL}/${locale}/blog/auteur/${slug}`,
      worksFor: { "@type": "Organization", name: "AxionIA" },
    },
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: "Blog", href: "/blog" },
      { name: author, href: `/blog/auteur/${slug}` },
    ],
  });

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Auteur" : "Author"}
        title={isFr ? "Articles de" : "Articles by"}
        titleEm={author}
        description={
          isFr
            ? `${posts.length} article${posts.length > 1 ? "s" : ""} publié${posts.length > 1 ? "s" : ""} par ${author}.`
            : `${posts.length} article${posts.length > 1 ? "s" : ""} published by ${author}.`
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
      <JsonLd data={profileJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
