import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { routing, STATIC_LOCALES, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { CategoryArticlesFilter } from "@/components/blog/CategoryArticlesFilter";
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
import {
  getCategoryHubContent,
  getCategoryCta,
} from "@/server/content-gen/lib/category-hub-content";
import {
  buildProductMetadata,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
  SITE_URL,
} from "@/lib/seo";

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
  return slugs.flatMap((slug) => STATIC_LOCALES.map((locale) => ({ locale, slug })));
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
    // Pas de « Axion-IA » ici : le template `%s · Axion-IA` l'appose (sinon doublon).
    title: isFr ? `${label} · Articles` : `${label} · Articles`,
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
  const hub = getCategoryHubContent(slug, loc);
  // CTA adapté à l'activité de cette catégorie (Formations→/formations,
  // Coaching→/un-a-un, Audits→/audit, etc.) — Will 2026-06-24.
  const activityCta = getCategoryCta(slug, loc);

  // Fraîcheur (audit AEO 2026-06-25) — date du dernier article de la catégorie
  // (max publishedAt, déjà chargé). Parité avec le hub /blog/categorie. Guard
  // ISO : si aucune date exploitable, les champs date sont omis (pas de crash).
  const latestDate = posts.reduce((max, p) => (p.publishedAt > max ? p.publishedAt : max), "");
  const hasIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(latestDate);
  const latestDateLabel = hasIsoDate
    ? new Intl.DateTimeFormat(isFr ? "fr-FR" : "en-GB", { dateStyle: "long" }).format(
        new Date(`${latestDate}T00:00:00Z`),
      )
    : null;

  // Maillage croisé (C, 2026-06-24) — les AUTRES catégories content-gen, pour
  // une navigation latérale entre hubs (renforce le maillage interne).
  const categoryBase = isFr ? "/blog/categorie" : "/blog/category";
  const otherCategories = DB_BLOG_CATEGORY_SLUGS.filter((s) => s !== slug).map((s) => ({
    slug: s,
    label: blogCategoryLabel(s, loc) ?? s,
    description: categoryDescription(s, loc) ?? null,
  }));

  // ItemList AEO/GEO (audit SEO 2026-06-24) — énumération ordonnée des articles
  // de la catégorie : les LLMs (AI Overviews) l'utilisent pour lister le contenu.
  const itemListJsonLd =
    posts.length > 0
      ? buildItemListJsonLd({
          locale: loc,
          path: `/blog/categorie/${slug}`,
          name: `${label} — ${isFr ? "Articles" : "Articles"}`,
          items: posts.map((p, i) => ({
            position: i + 1,
            name: p.title,
            url: `${SITE_URL}/${locale}/${p.route}/${p.slug}`,
            ...(p.excerpt ? { description: p.excerpt } : {}),
          })),
        })
      : null;

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: `/blog/categorie/${slug}`,
    name: `${label} — ${isFr ? "Articles Axion-IA" : "Axion-IA articles"}`,
    // Résumé answer-ready (schema.org `abstract`) — excerptable par Perplexity /
    // Claude / AI Overviews (audit AEO 2026-06-25, parité hub).
    abstract: isFr
      ? `${label} sur le blog Axion-IA : méthodologie et cas d'usage IA concrets pour TPE et PME françaises (${posts.length} article${posts.length > 1 ? "s" : ""}).`
      : `${label} on the Axion-IA blog: concrete AI methodology and use cases for French SMBs (${posts.length} article${posts.length > 1 ? "s" : ""}).`,
    // Fraîcheur + E-E-A-T (audit AEO 2026-06-25) — date du dernier article +
    // revue éditoriale rattachée au nœud Person canonique du fondateur (référence
    // `@id`, pas de duplication d'identité). Omis si aucune date ISO exploitable.
    ...(hasIsoDate
      ? {
          dateModified: latestDate,
          lastReviewed: latestDate,
          extra: {
            reviewedBy: { "@id": `${SITE_URL}/${locale}/equipe/williams#person` },
          },
        }
      : {}),
    // isPartOf omis → référence le nœud canonique `#website` (audit SEO 2026-06-24).
    // Speakable : intro answer-ready (#axion-direct-answer) citable voix/AI-Overview.
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
      {/* Héro 2 colonnes avec schéma orbital (parité /audit, /un-a-un) — Will
          2026-06-24 « un graphique dans le héro de chaque hub ». */}
      <ServiceHero
        eyebrow={isFr ? "Catégorie · Blog" : "Category · Blog"}
        title={isFr ? "Thématique" : "Topic"}
        titleEm={label}
        description={
          (categoryDescription(slug, loc) ??
            (isFr
              ? `Méthodologie & cas d'usage IA testés en mission.`
              : `Field-tested AI methodology & use cases.`)) +
          ` ${posts.length} article${posts.length > 1 ? "s" : ""}.`
        }
        ctas={
          <>
            <Cta href="/blog" size="lg">
              {isFr ? "Voir tous les articles" : "See all articles"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href={activityCta.href as never} variant="outline" size="lg">
              {activityCta.label}
            </Cta>
          </>
        }
        schemaCenterLabel={hub.centerLabel}
        schemaNodes={hub.nodes}
        schemaAriaLabel={hub.schemaAriaLabel}
      />
      {/* h2 d'introduction du contenu principal → hiérarchie propre h1→h2→h3
          (les cartes d'article sont des h3). Évite le saut h1→h3. */}
      <Section
        eyebrow={isFr ? "Articles" : "Articles"}
        title={isFr ? "Tous les articles" : "All articles"}
      >
        <Container>
          {/* Recherche texte + tri (client) + grille dense compacte (jusqu'à 4 col).
              Will 2026-06-24 : « barre de recherche » + « blocs trop gros ». */}
          <CategoryArticlesFilter
            isFr={isFr}
            items={posts.map((p) => ({
              slug: p.slug,
              title: p.title,
              excerpt: p.excerpt,
              publishedAt: p.publishedAt,
              readingTime: p.readingTime,
              route: p.route,
              featuredImage: p.featuredImage,
              featuredImageAlt: p.featuredImageAlt,
            }))}
          />
        </Container>
      </Section>
      {/* FAQ visible + FAQPage JSON-LD (AEO / featured snippets / AI Overviews). */}
      {hub.faq.length > 0 ? (
        <FaqBlock
          tone="paper"
          title={isFr ? "Questions" : "Questions"}
          titleEm={isFr ? "fréquentes" : "& answers"}
          items={hub.faq.map((f, i) => ({
            id: `cat-faq-${i}`,
            question: f.question,
            answer: f.answer,
          }))}
        />
      ) : null}
      {/* Maillage croisé (C) — refonte cartes (Will 2026-06-24 « design vieillot »). */}
      {otherCategories.length > 0 ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Naviguer" : "Browse"}
          title={isFr ? "Autres thématiques" : "Other topics"}
        >
          <Container>
            <ul className="xs:grid-cols-2 grid grid-cols-1 gap-6 md:grid-cols-3">
              {otherCategories.map((c, i) => {
                // Mapping littéral (Tailwind JIT ne détecte pas `bg-${var}`).
                const accentDot = ["bg-terracotta", "bg-primary", "bg-sage", "bg-mocha"][
                  i % 4
                ] as string;
                return (
                  <li key={c.slug}>
                    <a
                      href={`/${locale}${categoryBase}/${c.slug}`}
                      className="group border-border bg-paper hover:border-border-strong focus-visible:ring-primary shadow-subtle hover:shadow-card flex h-full flex-col gap-3 rounded-xl border p-5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`${accentDot} inline-block h-2.5 w-2.5 rounded-full`}
                        />
                        <span className="text-fg group-hover:text-terracotta-deep text-base font-semibold transition">
                          {c.label}
                        </span>
                      </span>
                      {c.description ? (
                        <span className="text-fg-soft line-clamp-2 text-sm leading-relaxed">
                          {c.description}
                        </span>
                      ) : null}
                      <span className="text-terracotta-deep mt-auto inline-flex items-center gap-1.5 text-sm font-medium">
                        {isFr ? "Lire les articles" : "Read articles"}
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
            <div className="mt-8">
              <Cta href="/blog/categorie" variant="outline" size="md">
                {isFr ? "Toutes les catégories" : "All categories"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Cta>
            </div>
          </Container>
        </Section>
      ) : null}
      {/* Synthèse answer-ready (#axion-direct-answer) + byline E-E-A-T en BAS de
          page (audit AEO 2026-06-25, parité hub) — contrat speakable position-
          indépendant, texte distinct du héro. */}
      <Container className="pb-2">
        <div className="border-border bg-paper shadow-subtle border-l-terracotta max-w-3xl rounded-xl border border-l-4 p-6">
          <p
            id="axion-direct-answer"
            data-answer="true"
            className="text-fg text-base leading-relaxed md:text-lg"
          >
            {isFr
              ? `Les articles « ${label} » d'Axion-IA réunissent une méthodologie éprouvée et des cas d'usage IA concrets, issus de missions réelles auprès des TPE et PME françaises. Parcourez les ${posts.length} article${posts.length > 1 ? "s" : ""} ci-dessous ou affinez votre recherche par mots-clés.`
              : `Axion-IA's « ${label} » articles bundle a proven methodology and concrete AI use cases drawn from real field missions with French SMBs. Browse the ${posts.length} article${posts.length > 1 ? "s" : ""} below or refine your search by keywords.`}
          </p>
          <p className="text-fg-muted mt-4 text-sm">
            {isFr ? "Sélection éditoriale supervisée par " : "Editorial selection overseen by "}
            <a
              href={`/${locale}/equipe/williams`}
              className="text-terracotta-deep font-medium underline-offset-2 hover:underline"
            >
              Williams Jullin
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
      {/* CTA de conversion ADAPTÉ à l'activité de la catégorie (Will 2026-06-24). */}
      <CtaBlock
        eyebrow={isFr ? "Passer à l'action" : "Take action"}
        title={isFr ? "Envie d'aller plus loin sur" : "Want to go further on"}
        titleEm={label}
        description={
          isFr
            ? "Au-delà des articles, transformez ces idées en résultats concrets pour votre organisation."
            : "Beyond the articles, turn these ideas into concrete results for your organization."
        }
        cta={
          <>
            <Cta href={activityCta.href as never} size="lg">
              {activityCta.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/reserver" variant="outline" size="lg">
              {isFr ? "Réserver un appel" : "Book a call"}
            </Cta>
          </>
        }
        tone="mocha"
      />
      {/* NB : le BreadcrumbList JSON-LD est émis par <Breadcrumbs> (avec l'item
          « Accueil », positions correctes). Ne PAS le ré-émettre ici — deux
          BreadcrumbList partageant le même @id = schéma ambigu (audit 2026-06-24). */}
      <JsonLd data={collectionJsonLd} />
      {itemListJsonLd ? <JsonLd data={itemListJsonLd} /> : null}
    </>
  );
}
