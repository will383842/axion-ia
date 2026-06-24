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
import {
  getDbArticlesByCategorySlug,
  DB_BLOG_CATEGORY_SLUGS,
} from "@/server/content-gen/blog/category-loader";
import { blogCategoryLabel } from "@/server/content-gen/lib/category-mapper";
import { categoryDescription } from "@/server/content-gen/lib/category-descriptions";
import { buildProductMetadata, buildCollectionPageJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Catégorisation content-gen 2026-06-16 — la page liste désormais aussi les
// articles DB (content-gen) de la catégorie. ISR horaire pour refléter les
// nouvelles publications sans rebuild. dynamicParams=false : seuls les slugs
// FS + les 5 catégories DB content-gen sont valides (autres → 404).
export const dynamicParams = false;
export const revalidate = 3600;

interface CategoryItem {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly publishedAt: string;
  readonly readingTime: string;
  readonly author: string;
  readonly route: "blog" | "actualites" | "guides";
  readonly featuredImage: string | null;
  readonly featuredImageAlt: string | null;
}

export async function generateStaticParams() {
  const slugs = Array.from(new Set([...getAllBlogCategorySlugs(), ...DB_BLOG_CATEGORY_SLUGS]));
  return slugs.flatMap((slug) => routing.locales.map((locale) => ({ locale, slug })));
}

async function resolveLabel(slug: string, locale: Locale): Promise<string | null> {
  // Label sans requête DB (build stub-safe, cf. ADR 0026) : FS legacy, sinon
  // label statique de la catégorie content-gen.
  return getBlogCategoryLabel(slug) ?? blogCategoryLabel(slug, locale);
}

async function loadItems(slug: string, locale: Locale): Promise<CategoryItem[]> {
  const fsPosts: CategoryItem[] = getBlogPostsByCategory(slug).map((p) => ({
    slug: p.slug,
    title: p[locale].title,
    excerpt: p[locale].excerpt,
    publishedAt: p.publishedAt,
    readingTime: p.readingTime,
    author: p.author,
    route: "blog",
    // Articles FS legacy (hardcodés) : pas de hero → placeholder de marque.
    featuredImage: null,
    featuredImageAlt: null,
  }));
  const dbArticles: CategoryItem[] = (await getDbArticlesByCategorySlug(slug, locale)).map((a) => ({
    ...a,
    author: "Manon",
  }));
  // Content-gen (DB) en premier (contenu le plus récent), puis FS legacy.
  return [...dbArticles, ...fsPosts];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const label = await resolveLabel(slug, locale as Locale);
  if (!label) return {};
  const isFr = locale === "fr";
  // Description éditoriale riche (110-140 car., SSOT partagé avec le hub) plutôt
  // qu'une meta thin/générique identique sur 5 pages (audit SEO 2026-06-24).
  // Fallback générique pour les catégories FS legacy hors content-gen.
  const richDescription = categoryDescription(slug, locale as Locale);
  const base = buildProductMetadata({
    locale,
    path: `/blog/categorie/${slug}`,
    title: isFr ? `${label} · Articles Axion-IA` : `${label} · Axion-IA articles`,
    description:
      richDescription ??
      (isFr
        ? `Articles Axion-IA dans la catégorie ${label}.`
        : `Axion-IA articles in the ${label} category.`),
  });
  // Anti-thin (audit e2e 2026-06-17) : noindex une catégorie réellement vide
  // (runtime, hors build stub) pour éviter qu'une page hub sans article soit
  // indexée. follow:true conserve le maillage interne. Au build stub (ADR 0026)
  // la requête renvoie [] → on ne noindex PAS (sinon toutes les catégories le
  // seraient au build) ; l'ISR (revalidate 3600) réévalue avec la vraie DB.
  const isStubBuild = process.env.DATABASE_URL?.includes("stub.invalid") ?? false;
  if (!isStubBuild) {
    const posts = await loadItems(slug, locale as Locale);
    if (posts.length === 0) {
      return { ...base, robots: { index: false, follow: true } };
    }
  }
  return base;
}

export default async function BlogCategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const loc = locale as Locale;
  const label = await resolveLabel(slug, loc);
  if (!label) notFound();
  setRequestLocale(locale);
  const isFr = loc === "fr";
  const posts = await loadItems(slug, loc);

  // Maillage croisé (C, 2026-06-24) — les AUTRES catégories content-gen, pour
  // une navigation latérale entre hubs (renforce le maillage interne).
  const categoryBase = isFr ? "/blog/categorie" : "/blog/category";
  const otherCategories = DB_BLOG_CATEGORY_SLUGS.filter((s) => s !== slug).map((s) => ({
    slug: s,
    label: blogCategoryLabel(s, loc) ?? s,
  }));

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: `/blog/categorie/${slug}`,
    name: `${label} — ${isFr ? "Articles Axion-IA" : "Axion-IA articles"}`,
    // isPartOf omis → référence le nœud canonique `#website` (audit SEO 2026-06-24).
    // Speakable : intro answer-ready (h1 + description) citable voix/AI-Overview.
    speakable: true,
    hasPart: posts.map((p) => ({
      "@type": "Article",
      headline: p.title,
      url: `${SITE_URL}/${locale}/${p.route}/${p.slug}`,
      datePublished: p.publishedAt,
      author: { "@type": "Person", name: p.author },
    })),
  });

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant. Hiérarchie alignée sur l'URL
  // (`/blog/categorie/<slug>`) : le niveau hub « Catégories » est inclus →
  // reflète la structure + ajoute un lien montant vers le hub (maillage).
  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: "/blog/categorie", label: isFr ? "Catégories" : "Categories" },
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
                  href={`/${p.route}/${p.slug}`}
                  title={p.title}
                  excerpt={p.excerpt}
                  publishedAt={p.publishedAt}
                  readingTime={p.readingTime}
                  imageUrl={p.featuredImage}
                  imageAlt={p.featuredImageAlt}
                />
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      {/* Maillage croisé (C) — navigation vers les autres thématiques + le hub. */}
      {otherCategories.length > 0 ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Naviguer" : "Browse"}
          title={isFr ? "Autres thématiques" : "Other topics"}
        >
          <Container>
            <ul className="flex flex-wrap gap-3">
              {otherCategories.map((c) => (
                <li key={c.slug}>
                  <a
                    href={`/${locale}${categoryBase}/${c.slug}`}
                    className="border-border bg-paper text-fg-soft hover:border-border-strong hover:text-fg focus-visible:ring-primary inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <Tag
                      aria-hidden="true"
                      className="text-terracotta h-3.5 w-3.5"
                      strokeWidth={2}
                    />
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <Cta href="/blog/categorie" variant="outline" size="md">
                {isFr ? "Toutes les catégories" : "All categories"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Cta>
            </div>
          </Container>
        </Section>
      ) : null}
      {/* NB : le BreadcrumbList JSON-LD est émis par <Breadcrumbs> (avec l'item
          « Accueil », positions correctes). Ne PAS le ré-émettre ici — deux
          BreadcrumbList partageant le même @id = schéma ambigu (audit 2026-06-24). */}
      <JsonLd data={collectionJsonLd} />
    </>
  );
}
