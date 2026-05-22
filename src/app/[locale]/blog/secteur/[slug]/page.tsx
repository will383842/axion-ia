import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getAllBlogSectorSlugs,
  getBlogPostsBySector,
  getSectorLabel,
  resolveTier,
  type BlogSector,
} from "@/content/blog";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Sprint 14.10 (2026-05-08) — page taxonomie secteur (16 secteurs).
// Anti-doorway HCU 2024 : tier-2/3 articles affichés en lien interne mais
// CollectionPage JSON-LD ne contient que tier-1 (signal qualité Google).

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBlogSectorSlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const sectorSlugs = getAllBlogSectorSlugs();
  if (!sectorSlugs.includes(slug as BlogSector)) return {};
  const label = getSectorLabel(slug as BlogSector, isFr ? "fr" : "en");
  return buildProductMetadata({
    locale,
    path: `/blog/secteur/${slug}`,
    title: isFr
      ? `${label} · Articles IA Axion-IA par secteur`
      : `${label} · Axion-IA AI articles by sector`,
    description: isFr
      ? `Articles Axion-IA dédiés au secteur ${label.toLowerCase()} : audit IA, interventions, implémentation, cas d'usage métier.`
      : `Axion-IA articles dedicated to the ${label.toLowerCase()} sector: AI audit, sessions, implementation, sector-specific use cases.`,
    alternates: { fr: `/blog/secteur/${slug}`, en: `/blog/sector/${slug}` },
  });
}

export default async function BlogSectorPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const sectorSlugs = getAllBlogSectorSlugs();
  if (!sectorSlugs.includes(slug as BlogSector)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const label = getSectorLabel(slug as BlogSector, isFr ? "fr" : "en");
  const posts = getBlogPostsBySector(slug as BlogSector);
  const tier1Posts = posts.filter((p) => resolveTier(p) === "tier-1-indexable");

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} — ${isFr ? "Articles Axion-IA" : "Axion-IA articles"}`,
    url: `${SITE_URL}/${locale}/blog/${isFr ? "secteur" : "sector"}/${slug}`,
    inLanguage: locale,
    isPartOf: { "@type": "WebSite", name: "Axion-IA", url: SITE_URL },
    hasPart: tier1Posts.map((p) => ({
      "@type": "Article",
      headline: p[loc].title,
      url: `${SITE_URL}/${locale}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      ...(p.updatedAt ? { dateModified: p.updatedAt } : {}),
      author: { "@type": "Person", name: p.author },
    })),
  } as const;

  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: `/blog/secteur/${slug}`, label },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Secteur" : "Sector"}
        title={isFr ? "Articles IA pour le secteur" : "AI articles for the"}
        titleEm={label}
        titleTail={isFr ? "" : " sector"}
        description={
          isFr
            ? `${posts.length} article${posts.length > 1 ? "s" : ""} dédié${posts.length > 1 ? "s" : ""} aux entreprises du secteur ${label.toLowerCase()}. Audit IA, interventions, implémentation et cas d'usage métiers documentés par Axion-IA.`
            : `${posts.length} article${posts.length > 1 ? "s" : ""} dedicated to ${label.toLowerCase()} sector businesses. AI audit, sessions, implementation and sector-specific use cases documented by Axion-IA.`
        }
      >
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Cta href="/blog" size="lg">
            {isFr ? "Voir tous les articles" : "See all articles"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
          <Cta href="/audit" variant="outline" size="lg">
            {isFr
              ? `Demander un audit Flash · ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
              : `Request a Flash audit · ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}
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
                ? "Pas encore d'article dédié à ce secteur. Le contenu arrive."
                : "No article yet for this sector. Content coming soon."}
            </p>
          )}
        </Container>
      </Section>
      <JsonLd
        data={buildBreadcrumbJsonLd({
          locale: loc,
          items: [
            { name: "Blog", href: "/blog" },
            { name: label, href: `/blog/secteur/${slug}` },
          ],
        })}
        scriptId="jsonld-breadcrumb-blog-secteur"
      />
      <JsonLd data={collectionJsonLd} />
    </>
  );
}
