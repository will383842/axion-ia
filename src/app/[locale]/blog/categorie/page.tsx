import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Layers, FileText, RefreshCw } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  BLOG_CATEGORY_SLUGS,
  blogCategoryLabel,
} from "@/server/content-gen/lib/category-mapper";
import { getBlogCategoryCounts } from "@/server/content-gen/blog/category-loader";
import { buildProductMetadata, buildCollectionPageJsonLd, SITE_URL } from "@/lib/seo";

// Hub des catégories de blog (2026-06-24). Liste STABLE des 5 catégories
// content-gen (depuis BLOG_CATEGORY_SLUGS, pas dérivée de la DB) → toujours
// complète même au build stub. ISR horaire pour rafraîchir les comptes.
export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

/** Descriptions éditoriales courtes par catégorie (FR/EN). */
const CATEGORY_DESCRIPTIONS: Record<string, { readonly fr: string; readonly en: string }> = {
  "blog-formations-ia": {
    fr: "Monter en compétence sur l'IA : méthodologie de formation, quick-wins et cas d'usage testés en mission.",
    en: "Upskilling on AI: training methodology, quick-wins and field-tested use cases.",
  },
  "blog-coaching-1-to-1": {
    fr: "Accompagnement individuel : trancher une décision IA, débloquer un projet, structurer une pratique.",
    en: "One-on-one support: settling an AI decision, unblocking a project, structuring a practice.",
  },
  "blog-audits-ia": {
    fr: "Diagnostiquer le potentiel IA d'une organisation : cadrage, priorisation, ROI et feuille de route.",
    en: "Diagnosing an organisation's AI potential: scoping, prioritisation, ROI and roadmap.",
  },
  "blog-implementations-ia": {
    fr: "Déployer et automatiser : intégration concrète, mise en production et industrialisation de l'IA.",
    en: "Deploying and automating: concrete integration, production rollout and AI industrialisation.",
  },
  "blog-sites-web-augmentes": {
    fr: "Sites web augmentés par l'IA : contenu, conversion, SEO/AEO et expérience utilisateur.",
    en: "AI-enhanced websites: content, conversion, SEO/AEO and user experience.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/blog/categorie",
    title: isFr
      ? "Catégories du blog · Axion-IA"
      : "Blog categories · Axion-IA",
    description: isFr
      ? "Toutes les thématiques du blog Axion-IA : formations, coaching, audits, implémentation et sites web augmentés par l'IA."
      : "All Axion-IA blog topics: training, coaching, audits, implementation and AI-enhanced websites.",
  });
}

export default async function BlogCategoriesHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const counts = await getBlogCategoryCounts();
  const categoryBase = isFr ? "/blog/categorie" : "/blog/category";

  const categories = BLOG_CATEGORY_SLUGS.map((slug) => ({
    slug,
    label: blogCategoryLabel(slug, loc) ?? slug,
    description: CATEGORY_DESCRIPTIONS[slug]?.[loc] ?? "",
    count: counts[slug] ?? 0,
  }));
  const totalArticles = categories.reduce((acc, c) => acc + c.count, 0);

  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: "/blog/categorie", label: isFr ? "Catégories" : "Categories" },
  ];

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/blog/categorie",
    name: isFr ? "Catégories du blog Axion-IA" : "Axion-IA blog categories",
    isPartOf: { "@type": "WebSite", name: "Axion-IA", url: SITE_URL },
    hasPart: categories.map((c) => ({
      "@type": "CollectionPage",
      name: c.label,
      url: `${SITE_URL}/${locale}${categoryBase}/${c.slug}`,
      description: c.description,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Blog" : "Blog"}
        title={isFr ? "Toutes les " : "All "}
        titleEm={isFr ? "thématiques" : "topics"}
        description={
          isFr
            ? `${categories.length} catégories, ${totalArticles} article${totalArticles > 1 ? "s" : ""} au total. Choisissez une thématique pour explorer la méthodologie & les cas d'usage IA correspondants.`
            : `${categories.length} categories, ${totalArticles} article${totalArticles > 1 ? "s" : ""} total. Pick a topic to explore the matching AI methodology & use cases.`
        }
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              { icon: Layers, label: `${categories.length} ${isFr ? "catégories" : "categories"}` },
              { icon: FileText, label: `${totalArticles} ${isFr ? "articles" : "articles"}` },
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
            {categories.map((cat) => (
              <li key={cat.slug}>
                <a
                  href={`/${locale}${categoryBase}/${cat.slug}`}
                  className="focus-visible:ring-primary group block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <Card className="cta-lift h-full">
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between gap-3">
                        <span>{cat.label}</span>
                        <ArrowRight
                          className="text-fg-muted group-hover:text-primary mt-1 h-4 w-4 shrink-0 transition"
                          aria-hidden="true"
                        />
                      </CardTitle>
                      <CardDescription>
                        {cat.count}{" "}
                        {isFr ? `article${cat.count > 1 ? "s" : ""}` : `article${cat.count > 1 ? "s" : ""}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-fg-soft text-sm leading-relaxed">{cat.description}</p>
                      <p className="text-primary mt-4 text-sm font-medium">
                        {isFr ? "Voir les articles" : "See articles"} →
                      </p>
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
