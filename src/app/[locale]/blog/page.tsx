import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, Layers, Clock, RefreshCw } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { BlogHeroSchema } from "@/components/sections/BlogHeroSchema";
import { JsonLd } from "@/components/marketing/JsonLd";
import { loadBlogIndexForView } from "@/server/content-gen/blog/loader";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { BlogSearch } from "@/components/blog/BlogSearch";

// ISR Next 16 — pré-rendue au build, revalidée toutes les heures pour que les
// articles DB publiés par la factory apparaissent automatiquement sans rebuild.
// 2026-06-21 (P1) : l'index est désormais DB-FIRST (loadBlogIndexForView fusionne
// DB tier-1+2 + FS). Au build stub.invalid → FS-only, l'ISR repeuple sous 1h.
export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

// V-02 sprint UX 2026-05-22 — pagination v1.
const ARTICLES_PER_PAGE = 20;

function parsePage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  if (!hasLocale(routing.locales, locale)) return {};
  const titleBase =
    locale === "fr"
      ? "Blog · méthodologie & cas d'usage IA · Axion-IA"
      : "Blog · methodology & AI use cases · Axion-IA";
  const title = page > 1 ? `${titleBase} · page ${page}` : titleBase;
  const meta = buildProductMetadata({
    locale,
    path: page > 1 ? `/blog?page=${page}` : "/blog",
    title,
    description:
      locale === "fr"
        ? "Articles Axion-IA : méthodologie d'audit IA, quick-wins opérationnels, stratégie IA Custom."
        : "Axion-IA articles: AI audit methodology, operational quick-wins, custom AI strategy.",
  });
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      types: { "application/rss+xml": `/${locale}/blog/feed.xml` },
    },
  };
}

export default async function BlogListing({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [{ href: "/blog", label: "Blog" }];

  // P1 (2026-06-21) — index DB-FIRST : la liste fusionne les articles DB
  // (factory content-gen, tier-1+2) ET les articles FS éditoriaux, dédupliqués
  // par slug et triés par date (cf. loadBlogIndexForView). Avant : FS-only → les
  // contenus générés (ex. Grenoble) n'apparaissaient JAMAIS dans le hub /blog.
  // Cap index = scalabilité : on liste les N plus récents (archive profonde via
  // les hubs catégorie + le sitemap, pas via une pagination infinie ici).
  const INDEX_MAX = 300;
  const sortedPosts = (await loadBlogIndexForView(loc)).slice(0, INDEX_MAX);

  // Catégories agrégées (count par catégorie) — dérivées de la liste fusionnée.
  // On utilise le `categorySlug` RÉEL (slug DB `blog-formations-ia` pour les
  // articles factory, slugify(nom) pour les FS) afin que les liens pointent vers
  // une page catégorie valide (les slugs DB ≠ slugify(nom)). Skip si pas de
  // catégorie résoluble (évite tout lien 404).
  const categoriesMap = new Map<string, { label: string; slug: string; count: number }>();
  for (const post of sortedPosts) {
    const slug = post.categorySlug;
    if (!slug) continue;
    const existing = categoriesMap.get(slug);
    if (existing) {
      categoriesMap.set(slug, { ...existing, count: existing.count + 1 });
    } else {
      categoriesMap.set(slug, { label: post.category, slug, count: 1 });
    }
  }
  const categories = [...categoriesMap.values()];
  const categoryBase = isFr ? "/blog/categorie" : "/blog/category";
  // V-02 sprint UX 2026-05-22 — Pagination v1 (offset/limit).
  const totalPages = Math.max(1, Math.ceil(sortedPosts.length / ARTICLES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * ARTICLES_PER_PAGE;
  const paginatedPosts = sortedPosts.slice(offset, offset + ARTICLES_PER_PAGE);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const heroSchemaPosts = sortedPosts.slice(0, 3).map((p) => ({
    slug: p.slug,
    category: p.category,
    readingTime: p.readingTime,
    title: p.title,
  }));

  // ItemList JSON-LD — expose chaque article au crawler depuis l'index
  // (BlogPosting per article + BlogPosting JSON-LD individuel sur /blog/[slug]
  // déjà émis ailleurs). @id (2026-06-21) : ancre la collection pour la citation
  // LLM (Perplexity/Claude « selon le blog Axion-IA »).
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE_URL}/${locale}/blog#itemlist`,
    name: isFr ? "Articles Axion-IA · ligne éditoriale" : "Axion-IA articles · editorial line",
    itemListElement: sortedPosts.map((post, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/${locale}/blog/${post.slug}`,
      name: post.title,
    })),
  } as const;

  // Pills réassurance (count dynamique)
  const pills = isFr
    ? [
        { icon: FileText, label: `${sortedPosts.length} articles` },
        { icon: Layers, label: `${categories.length} catégories` },
        { icon: Clock, label: "Lecture 6-12 min" },
        { icon: RefreshCw, label: "MAJ mensuelle" },
      ]
    : [
        { icon: FileText, label: `${sortedPosts.length} articles` },
        { icon: Layers, label: `${categories.length} categories` },
        { icon: Clock, label: "6-12 min read" },
        { icon: RefreshCw, label: "Monthly updates" },
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2-col — texte à gauche, BlogHeroSchema (3 articles récents) à droite */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                Blog
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Méthodologie & " : "Methodology & "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "cas d'usage" : "AI use cases"}
                </span>
                {isFr ? " IA" : ""}
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Retours terrain, méthodologie d'audit IA, quick-wins opérationnels, stratégie IA Custom. Chaque article est rédigé après une mission réelle — pas de spéculation, pas de hype."
                  : "Field reports, AI audit methodology, operational quick-wins, custom AI strategy. Each article is written after a real engagement — no speculation, no hype."}
              </p>
              {/* Pills réassurance */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {pills.map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
              {/* CTAs hero */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="#articles" size="lg">
                  {isFr ? "Lire les articles" : "Read articles"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                {/* P0 (2026-06-21) — href locale-relatif : le <Cta> utilise le
                    Link next-intl qui PRÉFIXE déjà la locale. Passer
                    `/${locale}/blog/feed.xml` produisait `/fr/fr/blog/feed.xml`
                    (double locale). `/blog/feed.xml` → next-intl ajoute `/fr`. */}
                <Cta href="/blog/feed.xml" variant="outline" size="lg">
                  {isFr ? "S'abonner RSS" : "Subscribe RSS"}
                </Cta>
                {/* V-02 sprint UX 2026-05-22 — search Cmd+K autocomplete (gap audit 74 → +15 pts). */}
                <BlogSearch
                  items={sortedPosts.map((p) => ({
                    slug: p.slug,
                    title: p.title,
                    category: p.category,
                    tags: p.tags,
                  }))}
                  placeholder={isFr ? "Rechercher un article…" : "Search articles…"}
                  emptyLabel={isFr ? "Aucun résultat" : "No results"}
                  triggerLabel={isFr ? "Rechercher" : "Search"}
                />
              </div>
            </div>
            <BlogHeroSchema
              isFr={isFr}
              posts={heroSchemaPosts}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Schéma : 3 derniers articles Axion-IA avec leur catégorie (méthodologie, cas d'usage, stratégie) et temps de lecture."
                  : "Diagram: 3 latest Axion-IA articles with their category (methodology, use cases, strategy) and reading time."
              }
            />
          </div>
        </Container>
      </section>

      {/* Pillar copy — ligne éditoriale */}
      <Section eyebrow={isFr ? "Ligne éditoriale" : "Editorial line"} tone="paper">
        <Container className="max-w-3xl">
          <p className="text-fg-soft text-lg leading-relaxed">
            {isFr
              ? "Axion-IA n'écrit que sur des sujets éprouvés en mission. Les articles documentent une méthodologie qui a fonctionné, un cas client qui a livré du ROI, ou une décision technique tranchée par l'expérience. Pas de revue de presse, pas de hot takes IA — chaque billet a vocation à rester actionnable 12 mois après publication. Si un sujet est pris dans la hype et n'a pas encore de réponse stable, on attend qu'il ait mûri avant d'en parler."
              : "Axion-IA writes only about topics tested in the field. Articles document a methodology that worked, a client case that delivered ROI, or a technical decision settled by experience. No press review, no AI hot takes — every post is meant to remain actionable 12 months after publication. If a topic is caught in the hype and has no stable answer, we wait for it to mature before writing about it."}
          </p>
        </Container>
      </Section>

      {/* Catégories */}
      {categories.length > 0 ? (
        <Section eyebrow={isFr ? "Thématiques" : "Topics"} tone="sand">
          <Container>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <a href={`/${locale}${categoryBase}/${cat.slug}`} className="group block h-full">
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
                          {isFr
                            ? `article${cat.count > 1 ? "s" : ""}`
                            : `article${cat.count > 1 ? "s" : ""}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-primary text-sm font-medium">
                          {isFr ? "Voir les articles" : "See articles"} â†’
                        </p>
                      </CardContent>
                    </Card>
                  </a>
                </li>
              ))}
            </ul>
            {/* Lien vers le hub des catégories (navigation taxonomique, 2026-06-24). */}
            <div className="mt-7">
              <Cta href="/blog/categorie" variant="outline" size="md">
                {isFr ? "Toutes les catégories" : "All categories"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Cta>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* Articles */}
      <Section
        id="articles"
        eyebrow={isFr ? "Tous les articles" : "All articles"}
        title={isFr ? "Derniers articles" : "Latest articles"}
      >
        <Container>
          {hasPrev || hasNext ? (
            // V-02 sprint UX — prev/next link headers (SEO discovery).
            <>
              {hasPrev ? (
                <link rel="prev" href={`/${locale}/blog?page=${currentPage - 1}`} />
              ) : null}
              {hasNext ? (
                <link rel="next" href={`/${locale}/blog?page=${currentPage + 1}`} />
              ) : null}
            </>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedPosts.map((post) => (
              <li key={post.slug}>
                <ArticleCard
                  href={`/blog/${post.slug}`}
                  title={post.title}
                  excerpt={post.excerpt}
                  publishedAt={post.publishedAt}
                  readingTime={post.readingTime}
                  imageUrl={post.featuredImage}
                  imageAlt={post.featuredImageAlt}
                />
              </li>
            ))}
          </ul>
          {totalPages > 1 ? (
            <nav
              aria-label={isFr ? "Pagination des articles" : "Articles pagination"}
              className="mt-10 flex items-center justify-between"
            >
              {hasPrev ? (
                <Cta
                  href={`/blog${currentPage - 1 === 1 ? "" : `?page=${currentPage - 1}`}` as never}
                  variant="outline"
                  size="md"
                >
                  ← {isFr ? "Précédent" : "Previous"}
                </Cta>
              ) : (
                <span />
              )}
              <span className="text-fg-muted text-sm tabular-nums">
                {isFr
                  ? `Page ${currentPage} sur ${totalPages}`
                  : `Page ${currentPage} of ${totalPages}`}
              </span>
              {hasNext ? (
                <Cta href={`/blog?page=${currentPage + 1}` as never} variant="outline" size="md">
                  {isFr ? "Suivant" : "Next"} →
                </Cta>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Démarrer concrètement" : "Start concretely"}
        description={
          isFr
            ? `Le format collectif (1 journée) pose le diagnostic + le plan d'action.`
            : `The one-day format frames the diagnostic and the action plan.`
        }
        cta={
          <Cta href="/formations" size="lg">
            {isFr ? "Voir nos formations" : "See our trainings"} â†’
          </Cta>
        }
        tone="dark"
      />

      <JsonLd
        data={buildBreadcrumbJsonLd({
          locale: loc,
          items: [{ name: "Blog", href: "/blog" }],
        })}
        scriptId="jsonld-breadcrumb-blog"
      />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
