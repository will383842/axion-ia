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
  getAllBlogCompanySizeSlugs,
  getBlogPostsByCompanySize,
  getCompanySizeLabel,
  resolveTier,
  type BlogCompanySize,
} from "@/content/blog";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Sprint 14.10 (2026-05-08) — page taxonomie taille entreprise (5 tailles).

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBlogCompanySizeSlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const sizeSlugs = getAllBlogCompanySizeSlugs();
  if (!sizeSlugs.includes(slug as BlogCompanySize)) return {};
  const label = getCompanySizeLabel(slug as BlogCompanySize, isFr ? "fr" : "en");
  return buildProductMetadata({
    locale,
    path: `/blog/taille/${slug}`,
    title: isFr ? `${label} · Articles IA Axion-IA` : `${label} · Axion-IA AI articles`,
    description: isFr
      ? `Articles Axion-IA dédiés aux ${label} : cas d'usage IA, audit, interventions, implémentation adaptés à votre taille d'entreprise.`
      : `Axion-IA articles for ${label} businesses: AI use cases, audit, sessions, implementation tailored to your company size.`,
    alternates: { fr: `/blog/taille/${slug}`, en: `/blog/size/${slug}` },
  });
}

export default async function BlogCompanySizePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const sizeSlugs = getAllBlogCompanySizeSlugs();
  if (!sizeSlugs.includes(slug as BlogCompanySize)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const label = getCompanySizeLabel(slug as BlogCompanySize, isFr ? "fr" : "en");
  const posts = getBlogPostsByCompanySize(slug as BlogCompanySize);
  const tier1Posts = posts.filter((p) => resolveTier(p) === "tier-1-indexable");

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} — ${isFr ? "Articles Axion-IA" : "Axion-IA articles"}`,
    url: `${SITE_URL}/${locale}/blog/${isFr ? "taille" : "size"}/${slug}`,
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
    { href: `/blog/taille/${slug}`, label },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Taille entreprise" : "Company size"}
        title={isFr ? "Articles IA pour" : "AI articles for"}
        titleEm={label}
        description={
          isFr
            ? `${posts.length} article${posts.length > 1 ? "s" : ""} adapté${posts.length > 1 ? "s" : ""} aux ${label} (TPE, PME, grandes PME, ETI ou grands comptes selon le filtre). Cas d'usage IA, audit, interventions et implémentation calibrés selon vos contraintes.`
            : `${posts.length} article${posts.length > 1 ? "s" : ""} tailored for ${label} businesses. AI use cases, audit, sessions and implementation calibrated to your constraints.`
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
                ? "Pas encore d'article calibré pour cette taille d'entreprise."
                : "No article yet for this company size."}
            </p>
          )}
        </Container>
      </Section>
      <JsonLd
        data={buildBreadcrumbJsonLd({
          locale: loc,
          items: [
            { name: "Blog", href: "/blog" },
            { name: label, href: `/blog/taille/${slug}` },
          ],
        })}
        scriptId="jsonld-breadcrumb-blog-taille"
      />
      <JsonLd data={collectionJsonLd} />
    </>
  );
}
