import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  GraduationCap,
  MessagesSquare,
  ClipboardCheck,
  Workflow,
  Globe,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { BLOG_CATEGORY_SLUGS, blogCategoryLabel } from "@/server/content-gen/lib/category-mapper";
import { getBlogCategoryCounts } from "@/server/content-gen/blog/category-loader";
import { CATEGORY_DESCRIPTIONS } from "@/server/content-gen/lib/category-descriptions";
import { getBlogHubHero, getBlogHubFaq } from "@/server/content-gen/lib/category-hub-content";
import {
  buildProductMetadata,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
  SITE_URL,
} from "@/lib/seo";

// Hub des catégories de blog (2026-06-24). Liste STABLE des 5 catégories
// content-gen (depuis BLOG_CATEGORY_SLUGS, pas dérivée de la DB) → toujours
// complète même au build stub. ISR horaire pour rafraîchir les comptes.
export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const base = buildProductMetadata({
    locale,
    path: "/blog/categorie",
    title: isFr ? "Catégories du blog · Axion-IA" : "Blog categories · Axion-IA",
    description: isFr
      ? "Toutes les thématiques du blog Axion-IA : formations, coaching, audits, implémentation et sites web augmentés par l'IA."
      : "All Axion-IA blog topics: training, coaching, audits, implementation and AI-enhanced websites.",
  });
  // Anti-thin (audit SEO 2026-06-24) — parité avec la page catégorie : si AUCUN
  // article (toutes catégories vides) en runtime réel (hors build stub, où la DB
  // renvoie 0 → l'ISR repeuple sous 1 h), noindex/follow pour ne pas indexer un
  // hub sans contenu. En prod (1000+ articles) ce cas ne se produit pas.
  const isStubBuild = process.env.DATABASE_URL?.includes("stub.invalid") ?? false;
  if (!isStubBuild) {
    const counts = await getBlogCategoryCounts();
    const total = Object.values(counts).reduce((acc, n) => acc + n, 0);
    if (total === 0) return { ...base, robots: { index: false, follow: true } };
  }
  return base;
}

// Visuel par catégorie : icône thématique + pastille de couleur (rend la grille
// moins textuelle / plus moderne). Server-rendered, zéro image à charger.
// `bar` = barre colorée en haut de carte (identité couleur par catégorie → contraste).
const CATEGORY_VISUAL: Record<
  string,
  { Icon: LucideIcon; tile: string; icon: string; bar: string }
> = {
  "blog-formations-ia": {
    Icon: GraduationCap,
    tile: "bg-terracotta-soft",
    icon: "text-terracotta",
    bar: "border-t-terracotta",
  },
  "blog-coaching-1-to-1": {
    Icon: MessagesSquare,
    tile: "bg-primary-soft",
    icon: "text-primary",
    bar: "border-t-primary",
  },
  "blog-audits-ia": {
    Icon: ClipboardCheck,
    tile: "bg-sage-soft",
    icon: "text-sage",
    bar: "border-t-sage",
  },
  "blog-implementations-ia": {
    Icon: Workflow,
    tile: "bg-sand",
    icon: "text-mocha",
    bar: "border-t-mocha",
  },
  "blog-sites-web-augmentes": {
    Icon: Globe,
    tile: "bg-terracotta-soft",
    icon: "text-terracotta",
    bar: "border-t-terracotta",
  },
};
const FALLBACK_VISUAL = {
  Icon: Sparkles,
  tile: "bg-sand",
  icon: "text-mocha",
  bar: "border-t-mocha",
} as const;

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
  const hubHero = getBlogHubHero(loc);

  // ItemList AEO/GEO (audit SEO 2026-06-24) — énumération ordonnée des 5 hubs de
  // catégorie (manquait sur le hub : seul hasPart était émis).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/blog/categorie",
    name: isFr ? "Catégories du blog Axion-IA" : "Axion-IA blog categories",
    items: categories.map((c, i) => ({
      position: i + 1,
      name: c.label,
      url: `${SITE_URL}/${locale}${categoryBase}/${c.slug}`,
      ...(c.description ? { description: c.description } : {}),
    })),
  });

  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: "/blog/categorie", label: isFr ? "Catégories" : "Categories" },
  ];

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/blog/categorie",
    name: isFr ? "Catégories du blog Axion-IA" : "Axion-IA blog categories",
    // isPartOf omis → la factory référence le nœud canonique `#website`
    // (évite de créer un second WebSite inline plus faible — audit SEO 2026-06-24).
    // Speakable : l'intro answer-ready (h1 + description) devient citable voix/AI-Overview.
    speakable: true,
    hasPart: categories.map((c) => ({
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/${locale}${categoryBase}/${c.slug}#collectionpage`,
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
      {/* Héro 2 colonnes avec schéma orbital (parité /audit, /un-a-un). */}
      <ServiceHero
        eyebrow={isFr ? "Blog" : "Blog"}
        title={isFr ? "Toutes les" : "All"}
        titleEm={isFr ? "thématiques" : "topics"}
        description={
          isFr
            ? `${categories.length} catégories, ${totalArticles} article${totalArticles > 1 ? "s" : ""} au total. Choisissez une thématique pour explorer la méthodologie & les cas d'usage IA correspondants.`
            : `${categories.length} categories, ${totalArticles} article${totalArticles > 1 ? "s" : ""} total. Pick a topic to explore the matching AI methodology & use cases.`
        }
        ctas={
          <>
            <Cta href="/blog" size="lg">
              {isFr ? "Voir tous les articles" : "See all articles"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/formations" variant="outline" size="lg">
              {isFr ? "Voir nos formations" : "See our trainings"}
            </Cta>
          </>
        }
        schemaCenterLabel={hubHero.centerLabel}
        schemaNodes={hubHero.nodes}
        schemaAriaLabel={hubHero.schemaAriaLabel}
      />
      {/* h2 d'introduction → hiérarchie propre h1→h2 (cartes = liens, pas headings). */}
      <Section
        eyebrow={isFr ? "Thématiques" : "Topics"}
        title={isFr ? "Les 5 catégories" : "The 5 categories"}
      >
        <Container>
          {/* Cartes catégorie modernisées : accent couleur + compteur + flèche. */}
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const visual = CATEGORY_VISUAL[cat.slug] ?? FALLBACK_VISUAL;
              const { Icon } = visual;
              return (
                <li key={cat.slug}>
                  <a
                    href={`/${locale}${categoryBase}/${cat.slug}`}
                    className={`group border-border bg-paper hover:border-border-strong focus-visible:ring-primary shadow-subtle hover:shadow-card flex h-full flex-col gap-3 rounded-xl border border-t-4 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${visual.bar}`}
                  >
                    {/* Pastille-icône thématique + compteur (visuel, moins textuel). */}
                    <span className="flex items-start justify-between gap-3">
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl transition group-hover:scale-105 ${visual.tile}`}
                      >
                        <Icon className={`h-6 w-6 ${visual.icon}`} strokeWidth={1.75} />
                      </span>
                      <span className="border-border text-fg-muted rounded-full border px-2.5 py-1 text-xs tabular-nums">
                        {cat.count}{" "}
                        {isFr
                          ? `article${cat.count > 1 ? "s" : ""}`
                          : `article${cat.count > 1 ? "s" : ""}`}
                      </span>
                    </span>
                    <span
                      className="text-fg group-hover:text-terracotta-deep mt-1 text-lg font-semibold transition"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {cat.label}
                    </span>
                    {cat.description ? (
                      <span className="text-fg-soft line-clamp-3 text-sm leading-relaxed">
                        {cat.description}
                      </span>
                    ) : null}
                    <span className="text-terracotta-deep mt-auto inline-flex items-center gap-1.5 text-sm font-medium">
                      {isFr ? "Voir les articles" : "See articles"}
                      <ArrowRight
                        className="h-4 w-4 transition group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>
      {/* FAQ visible + FAQPage JSON-LD (AEO / featured snippets / AI Overviews). */}
      <FaqBlock
        tone="paper"
        title={isFr ? "Questions" : "Questions"}
        titleEm={isFr ? "fréquentes" : "& answers"}
        items={getBlogHubFaq(loc).map((f, i) => ({
          id: `hub-faq-${i}`,
          question: f.question,
          answer: f.answer,
        }))}
      />
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
