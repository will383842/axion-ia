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
import { FOUNDER, FOUNDER_PERSON_ID } from "@/lib/brand";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { BLOG_CATEGORY_SLUGS, blogCategoryLabel } from "@/server/content-gen/lib/category-mapper";
import {
  getBlogCategoryCounts,
  getBlogLatestArticleDate,
} from "@/server/content-gen/blog/category-loader";
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

  const [counts, latestDate] = await Promise.all([
    getBlogCategoryCounts(),
    getBlogLatestArticleDate(),
  ]);
  const categoryBase = isFr ? "/blog/categorie" : "/blog/category";
  // Date de dernière mise à jour, formatée pour l'affichage (« 24 juin 2026 »).
  // Stub-safe : latestDate null (build stub / DB vide) → pas de mention visible.
  const latestDateLabel = latestDate
    ? new Intl.DateTimeFormat(isFr ? "fr-FR" : "en-GB", { dateStyle: "long" }).format(
        new Date(`${latestDate}T00:00:00Z`),
      )
    : null;

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
    // Résumé answer-ready (schema.org `abstract`) — excerptable par Perplexity /
    // Claude / AI Overviews (audit AEO 2026-06-25).
    abstract: isFr
      ? "Le blog Axion-IA en 5 thématiques (formations, coaching 1-to-1, audits, implémentation, sites web augmentés) : méthodologie et cas d'usage IA testés auprès des TPE et PME françaises."
      : "The Axion-IA blog across 5 topics (training, 1-to-1 coaching, audits, implementation, AI-enhanced websites): AI methodology and use cases tested with French SMBs.",
    // Fraîcheur (audit SEO 2026-06-25) — date du dernier article mis à jour.
    // Stub-safe : latestDate null → champs omis par la factory.
    ...(latestDate ? { dateModified: latestDate, lastReviewed: latestDate } : {}),
    // E-E-A-T : revue éditoriale rattachée au nœud Person canonique du fondateur
    // (référence `@id` — PAS de duplication d'identité ; le nœud est défini par
    // l'Organization du layout). Pair avec `lastReviewed`.
    ...(latestDate
      ? {
          extra: {
            // `@id` canonique, jamais interpolé par la locale : la fiche `/equipe/[slug]`
            // 404 hors FR, donc `…/en/equipe/williams#person` désignait une entité sans page.
            reviewedBy: { "@id": FOUNDER_PERSON_ID },
          },
        }
      : {}),
    // isPartOf omis → la factory référence le nœud canonique `#website`
    // (évite de créer un second WebSite inline plus faible — audit SEO 2026-06-24).
    // Speakable : l'intro answer-ready (#axion-direct-answer) devient citable voix/AI-Overview.
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
            <Cta href="/appel" variant="outline" size="lg">
              {isFr ? "Réserver un appel" : "Book a call"}
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
          <ul className="xs:grid-cols-2 grid grid-cols-1 gap-6 md:grid-cols-3">
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
                      <span className="text-fg-soft line-clamp-2 text-sm leading-relaxed">
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
      {/* Synthèse answer-ready (#axion-direct-answer) + byline E-E-A-T en BAS de
          page (audit AEO 2026-06-25) : remplit le contrat speakable de la
          CollectionPage — position-indépendant, donc citable position 0 / AI
          Overview / vocal sans alourdir le haut de page. */}
      <Container className="pb-2">
        <div className="border-border bg-paper shadow-subtle border-l-terracotta max-w-3xl rounded-xl border border-l-4 p-6">
          <p
            id="axion-direct-answer"
            data-answer="true"
            className="text-fg text-base leading-relaxed md:text-lg"
          >
            {isFr
              ? `Le blog Axion-IA réunit ${totalArticles} article${totalArticles > 1 ? "s" : ""} répartis en ${categories.length} thématiques IA — formations, coaching 1-to-1, audits, implémentation et sites web augmentés. Chaque thématique regroupe une méthodologie éprouvée et des cas d'usage concrets testés en mission auprès des TPE et PME françaises. Choisissez un thème pour accéder directement aux articles correspondants.`
              : `The Axion-IA blog gathers ${totalArticles} article${totalArticles > 1 ? "s" : ""} across ${categories.length} AI topics — training, 1-to-1 coaching, audits, implementation and AI-enhanced websites. Each topic bundles a proven methodology and concrete use cases field-tested with French SMBs. Pick a topic to jump straight to the matching articles.`}
          </p>
          <p className="text-fg-muted mt-4 text-sm">
            {isFr ? "Sélection éditoriale supervisée par " : "Editorial selection overseen by "}
            <a
              href={`/${locale}/equipe/williams`}
              className="text-terracotta-deep font-medium underline-offset-2 hover:underline"
            >
              {FOUNDER.displayName}
            </a>
            {isFr ? ", fondateur d'Axion-IA" : ", founder of Axion-IA"}
            {latestDateLabel
              ? isFr
                ? ` · Mis à jour le ${latestDateLabel}`
                : ` · Updated ${latestDateLabel}`
              : ""}
            .
          </p>
        </div>
      </Container>
      {/* CTA de conversion en fin de hub (couvre les 5 activités). */}
      <CtaBlock
        eyebrow={isFr ? "Passer à l'action" : "Take action"}
        title={isFr ? "Prêt à activer l'IA dans" : "Ready to bring AI to"}
        titleEm={isFr ? "votre organisation" : "your organization"}
        description={
          isFr
            ? "Formation, coaching, audit, implémentation ou site augmenté : on vous oriente vers la bonne approche pour votre situation."
            : "Training, coaching, audit, implementation or augmented site: we point you to the right approach for your situation."
        }
        cta={
          <>
            <Cta href="/appel" size="lg">
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/tarifs" variant="outline" size="lg">
              {isFr ? "Voir nos offres" : "See our offers"}
            </Cta>
          </>
        }
        tone="mocha"
      />
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
