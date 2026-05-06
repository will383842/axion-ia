import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { BLOG_POSTS } from "@/content/transversal";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/blog",
    title:
      locale === "fr"
        ? "Blog · méthodologie & cas d'usage IA · AxionIA"
        : "Blog · methodology & AI use cases · AxionIA",
    description:
      locale === "fr"
        ? "Articles AxionIA : méthodologie d'audit IA, quick-wins opérationnels, stratégie IA Custom."
        : "AxionIA articles: AI audit methodology, operational quick-wins, custom AI strategy.",
  });
}

export default async function BlogListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: "Blog", href: "/blog" },
    ],
  });

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow="Blog"
        title={isFr ? "Méthodologie & cas d'usage IA" : "Methodology & AI use cases"}
        description={
          isFr
            ? "Retours terrain, méthodologie d'audit IA, quick-wins opérationnels, stratégie IA Custom."
            : "Field reports, AI audit methodology, operational quick-wins, custom AI strategy."
        }
      />

      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BLOG_POSTS.map((post) => {
            const c = post[loc];
            return (
              <li key={post.slug}>
                <ArticleCard
                  href={`/blog/${post.slug}`}
                  title={c.title}
                  excerpt={c.excerpt}
                  publishedAt={post.publishedAt}
                  readingTime={post.readingTime}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      <CtaBlock
        title={isFr ? "Démarrer concrètement" : "Start concretely"}
        description={
          isFr
            ? "L'Essentielle 490 € pose le diagnostic + le plan d'action."
            : "The Essential €490 frames the diagnostic and the action plan."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle" : "See the Essential"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
