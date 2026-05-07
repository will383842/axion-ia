import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { getBlogPost, getAllBlogSlugs } from "@/content/transversal";
import { buildProductMetadata, buildArticleJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const post = getBlogPost(slug);
  if (!post) return {};
  const c = post[locale];
  return buildProductMetadata({
    locale,
    path: `/blog/${slug}`,
    title: `${c.title} · AxionIA`,
    description: c.excerpt,
  });
}

export default async function BlogArticle({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const post = getBlogPost(slug);
  if (!post) notFound();
  const copy = post[loc];

  // Article JSON-LD spec AEO/GEO 2026 : Person author + dateModified +
  // mainEntityOfPage + image dynamique + keywords + section + wordCount.
  // Cible Google AI Overviews + Perplexity + Claude.ai citations.
  const wordCount = copy.body.trim().split(/\s+/).length;
  const articleJsonLd = buildArticleJsonLd({
    locale: loc,
    path: `/blog/${slug}`,
    headline: copy.title,
    description: copy.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    articleBody: copy.body,
    authorName: post.author,
    authorSlug: post.author.toLowerCase(),
    keywords: post.tags,
    articleSection: post.category,
    wordCount,
  });

  // Breadcrumb visuel + JSON-LD intégré (composant unique). Le composant
  // Breadcrumbs ajoute automatiquement l'item "Accueil" — on passe juste
  // le path tail.
  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: `/blog/${slug}`, label: copy.title },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section titleAs="h1" eyebrow={post.category} title={copy.title} description={copy.excerpt}>
        <Container className="text-fg-muted flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="neutral">{post.category}</Badge>
          <Link
            href={`/blog/auteur/${post.author.toLowerCase()}` as never}
            className="hover:text-terracotta-deep focus-visible:ring-terracotta rounded-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Par" : "By"} {post.author}
          </Link>
          <span aria-hidden="true">·</span>
          <time dateTime={post.publishedAt} className="tabular-nums">
            {isFr ? "Publié le" : "Published"} {post.publishedAt}
          </time>
          {post.updatedAt && post.updatedAt !== post.publishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={post.updatedAt} className="tabular-nums">
                {isFr ? "Mis à jour le" : "Updated"} {post.updatedAt}
              </time>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{post.readingTime}</span>
        </Container>
      </Section>

      <Section>
        <Container className="text-fg max-w-3xl text-lg leading-relaxed">
          <p>{copy.body}</p>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Mettre en pratique" : "Put it to work"}
        description={
          isFr
            ? "Démarrez par une intervention Essentielle 490 €."
            : "Start with an Essential session €490."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle" : "See the Essential"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={articleJsonLd} />
    </>
  );
}
