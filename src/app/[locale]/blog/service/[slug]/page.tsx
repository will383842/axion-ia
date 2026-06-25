import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { routing, STATIC_LOCALES, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getAllBlogServiceTypeSlugs,
  getBlogPostsByServiceType,
  getServiceTypeLabel,
  resolveTier,
  type BlogServiceType,
} from "@/content/blog";
import {
  buildProductMetadata,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  SITE_URL,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Sprint 14.10 (2026-05-08) — page taxonomie service (3 services).

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBlogServiceTypeSlugs().flatMap((slug) =>
    STATIC_LOCALES.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const serviceSlugs = getAllBlogServiceTypeSlugs();
  if (!serviceSlugs.includes(slug as BlogServiceType)) return {};
  const label = getServiceTypeLabel(slug as BlogServiceType, isFr ? "fr" : "en");
  return buildProductMetadata({
    locale,
    path: `/blog/service/${slug}`,
    title: isFr ? `${label} · Articles Axion-IA` : `${label} · Axion-IA articles`,
    description: isFr
      ? `Tous les articles Axion-IA dédiés au service ${label.toLowerCase()}. Méthodologie, cas d'usage, comparatifs, retours d'expérience.`
      : `All Axion-IA articles dedicated to ${label.toLowerCase()}. Methodology, use cases, comparisons, field feedback.`,
    alternates: { fr: `/blog/service/${slug}`, en: `/blog/service/${slug}` },
  });
}

export default async function BlogServicePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const serviceSlugs = getAllBlogServiceTypeSlugs();
  if (!serviceSlugs.includes(slug as BlogServiceType)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const label = getServiceTypeLabel(slug as BlogServiceType, isFr ? "fr" : "en");
  const posts = getBlogPostsByServiceType(slug as BlogServiceType);
  const tier1Posts = posts.filter((p) => resolveTier(p) === "tier-1-indexable");

  const canonicalServiceHref =
    slug === "audit" ? "/audit" : slug === "interventions" ? "/interventions" : "/implementation";

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: `/blog/service/${slug}`,
    name: `${label} — ${isFr ? "Articles Axion-IA" : "Axion-IA articles"}`,
    isPartOf: { "@type": "WebSite", name: "Axion-IA", url: SITE_URL },
    about: {
      "@type": "Service",
      name: label,
      url: `${SITE_URL}/${locale}${canonicalServiceHref}`,
    },
    hasPart: tier1Posts.map((p) => ({
      "@type": "Article",
      headline: p[loc].title,
      url: `${SITE_URL}/${locale}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      ...(p.updatedAt ? { dateModified: p.updatedAt } : {}),
      author: { "@type": "Person", name: p.author },
    })),
  });

  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: `/blog/service/${slug}`, label },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Service Axion-IA" : "Axion-IA service"}
        title={isFr ? "Articles dédiés à" : "Articles about"}
        titleEm={label}
        description={
          isFr
            ? `${posts.length} article${posts.length > 1 ? "s" : ""} sur ${label.toLowerCase()}. Méthodologie, cas d'usage, comparatifs et retours d'expérience documentés en mission.`
            : `${posts.length} article${posts.length > 1 ? "s" : ""} on ${label.toLowerCase()}. Methodology, use cases, comparisons and field-tested feedback.`
        }
      >
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Cta href={canonicalServiceHref as never} size="lg">
            {isFr ? `Voir le service ${label}` : `See the ${label} service`}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
          <Cta href="/blog" variant="outline" size="lg">
            {isFr ? "Tous les articles" : "All articles"}
          </Cta>
        </div>
      </Section>
      <Section>
        <Container>
          {posts.length > 0 ? (
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
          ) : (
            <p className="text-fg-soft text-center text-base leading-relaxed">
              <FileText aria-hidden="true" className="text-fg-muted mx-auto mb-3 h-8 w-8" />
              {isFr
                ? "Pas encore d'article dédié à ce service. Le contenu arrive."
                : "No article yet for this service. Content coming soon."}
            </p>
          )}
        </Container>
      </Section>
      <JsonLd
        data={buildBreadcrumbJsonLd({
          locale: loc,
          items: [
            { name: "Blog", href: "/blog" },
            { name: label, href: `/blog/service/${slug}` },
          ],
        })}
        scriptId="jsonld-breadcrumb-blog-service"
      />
      <JsonLd data={collectionJsonLd} />
    </>
  );
}
