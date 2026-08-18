/**
 * Hub `/fr/actualites` — listing publié par la factory Content-Gen V1.0.3.
 *
 * - FR uniquement (doctrine v1.2 — contenus content-gen). Locale !== "fr" → 404,
 *   strict miroir de `/actualites/[slug]/page.tsx`.
 * - Source : table Prisma `Article` filtrée `isNews=true status=published`
 *   `indexationTier=tier_1_indexable`, tri publishedAt desc, take 48.
 *   Pas de fallback FS — DB-driven dès V1 comme la route détail.
 * - ISR Next 16 : `revalidate = 3600` (régen horaire — alignée sur `[slug]`).
 * - JSON-LD : CollectionPage (BreadcrumbList délégué au composant Breadcrumbs).
 * - P0-5 audit E2E NAV+CTA 2026-05-15 — la factory pousse des slugs
 *   `/fr/actualites/<slug>` mais le hub manquait → silo orphelin SEO.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Rss, Newspaper, ShieldCheck, CalendarClock } from "lucide-react";
import { routing } from "@/i18n/routing";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_URL, buildProductMetadata, buildCollectionPageJsonLd } from "@/lib/seo";

export const revalidate = 3600;

const HUB_TAKE = 48;

interface Props {
  params: Promise<{ locale: string }>;
}

async function countPublishedNews(): Promise<number> {
  try {
    return await prisma.article.count({
      where: { status: "published", isNews: true, indexationTier: "tier_1_indexable" },
    });
  } catch {
    // P2021 (table absente bootstrap) / stub.invalid build → traité comme vide
    return 0;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (locale !== "fr") return { robots: { index: false, follow: false } };
  const base = await buildProductMetadata({
    locale,
    path: "/actualites",
    title: "Actualités IA · Veille opérationnelle · Axion-IA",
    description:
      "Veille hebdomadaire sur l'IA opérationnelle pour dirigeants de PME et ETI : décisions Search Console, sorties produits Anthropic/Mistral/OpenAI, retours terrain.",
    alternates: { fr: "/actualites", en: "/actualites" },
    // SEO news 2026 — autodiscovery du flux RSS de la section (Feedly/Apple News/
    // navigateurs) via <link rel="alternate" type="application/rss+xml">.
    rssFeed: `${SITE_URL}/fr/actualites/feed.xml`,
  });
  // Anti-yoyo (audit indexation 2026-06-17) : au build GH Actions
  // (DATABASE_URL=stub.invalid), `countPublishedNews()` renvoie 0 → on figerait un
  // `noindex` dans la page pré-rendue, exposé à Googlebot pendant la fenêtre 0-1h
  // post-deploy avant que l'ISR repeuple. Fail-OPEN : on garde `index` au build stub ;
  // l'ISR (revalidate=3600) recalcule la vraie décision en prod (DATABASE_URL réel).
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return base;
  // Soft-404 fix (2026-06-14) : si 0 actualité publiée, le hub n'a aucun contenu
  // à indexer → noindex,follow (évite le soft-404). L'ISR (revalidate=3600)
  // repassera index dès qu'un article est publié.
  if ((await countPublishedNews()) === 0) {
    return { ...base, robots: { index: false, follow: true } };
  }
  return base;
}

interface NewsItem {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  readingTime: number | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  newsCategory: string | null;
}

async function fetchPublishedNews(): Promise<NewsItem[]> {
  try {
    const rows = await prisma.article.findMany({
      where: {
        status: "published",
        isNews: true,
        indexationTier: "tier_1_indexable",
      },
      orderBy: { publishedAt: "desc" },
      take: HUB_TAKE,
      select: {
        publishedAt: true,
        readingTime: true,
        featuredImage: true,
        featuredImageAltFr: true,
        newsCategory: true,
        translations: {
          where: { locale: "fr" },
          select: { slug: true, title: true, excerpt: true },
          take: 1,
        },
      },
    });
    return rows
      .map((r) => {
        const t = r.translations[0];
        if (!t || !t.slug) return null;
        return {
          slug: t.slug,
          title: t.title,
          excerpt: t.excerpt,
          publishedAt: r.publishedAt,
          readingTime: r.readingTime,
          featuredImage: r.featuredImage,
          featuredImageAlt: r.featuredImageAltFr,
          newsCategory: r.newsCategory,
        };
      })
      .filter((x): x is NewsItem => x !== null);
  } catch {
    // P2021 (table absente bootstrap) — fail-soft listing vide
    return [];
  }
}

function formatPublishedAt(date: Date | null): string | undefined {
  if (!date) return undefined;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatReadingTime(minutes: number | null): string | undefined {
  if (!minutes || minutes < 1) return undefined;
  return `${minutes} min de lecture`;
}

export default async function ActualitesHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") notFound();
  setRequestLocale(locale);

  const items = await fetchPublishedNews();

  // ItemList JSON-LD — expose chaque actualité VISIBLE au crawler + ancre la
  // collection pour la citation LLM (parité hub /blog, audit AEO 2026-07-03).
  // Aligné sur le contenu rendu (les news affichées) pour éviter tout mismatch
  // schéma/contenu (risque rich-results).
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE_URL}/fr/actualites#itemlist`,
    name: "Actualités IA Axion-IA · veille hebdomadaire",
    itemListElement: items.slice(0, 12).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/fr/actualites/${item.slug}`,
      name: item.title,
    })),
  } as const;

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: "fr",
    path: "/actualites",
    id: `${SITE_URL}/fr/actualites#collection`,
    name: "Actualités IA — Axion-IA",
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${SITE_URL}/fr#website` },
    description: "Veille hebdomadaire sur l'IA opérationnelle pour dirigeants de PME et ETI.",
    // Résumé answer-ready (schema.org `abstract`, 40-60 mots) — excerptable par
    // Perplexity / Claude / AI Overviews (parité hub /blog, audit AEO 2026-07-03).
    abstract:
      "Les Actualités IA d'Axion-IA proposent une veille hebdomadaire sur l'IA opérationnelle : sorties produits, mises à jour Search Console et décisions techniques qui changent les arbitrages des dirigeants de PME et ETI. Chaque brève cite sa source primaire — pas de hype, uniquement ce qui impacte vos décisions cette semaine.",
    speakable: true,
    mainEntity: { "@id": `${SITE_URL}/fr/actualites#itemlist` },
    hasPart: items.slice(0, 12).map((item) => ({
      "@type": "NewsArticle",
      headline: item.title,
      url: `${SITE_URL}/fr/actualites/${item.slug}`,
      datePublished: item.publishedAt?.toISOString(),
    })),
    // E-E-A-T : revue éditoriale rattachée au nœud Person canonique du fondateur
    // (référence `@id`, pas de duplication d'identité). Parité hub /blog.
    extra: {
      reviewedBy: { "@id": FOUNDER_PERSON_ID },
    },
  });

  // FAQ hub — AEO/GEO (réponses answer-first citables) + parité /blog. FAQPage
  // JSON-LD émis pour l'extraction par les moteurs de réponse (rich-result
  // FAQPage déprécié Google mai 2026, mais toujours exploité Perplexity/Claude/AIO).
  const faqItems = [
    {
      question: "À quelle fréquence les actualités IA sont-elles publiées ?",
      answer:
        "En continu : le pipeline traite chaque jour les actualités IA marquantes des flux de référence, dans la limite du volume éditorial quotidien. La veille reste fraîche, sans hype.",
    },
    {
      question: "Ces actualités sont-elles sourcées et fiables ?",
      answer:
        "Oui. Chaque brève part d'une source primaire réelle, puis est intégralement réécrite en analyse autonome, avec attribution machine (JSON-LD isBasedOn) et liens d'autorité. Aucune copie, aucune donnée inventée.",
    },
    {
      question: "Pour qui est conçue cette veille IA ?",
      answer:
        "Pour les dirigeants de PME et d'ETI : l'angle est toujours l'impact opérationnel concret — ce que l'actualité change pour vos arbitrages —, pas la prouesse technique.",
    },
    {
      question: "Comment suivre les actualités IA d'Axion-IA ?",
      answer:
        "Via cette page, mise à jour en continu, ou en vous abonnant au flux RSS de la section (axion-ia.com/fr/actualites/feed.xml) depuis votre lecteur (Feedly, Apple News…).",
    },
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/fr/actualites#faq`,
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } as const;

  return (
    <>
      <Section tone="paper" className="pt-8 lg:pt-12">
        <Container>
          <Breadcrumbs items={[{ href: "/actualites", label: "Actualités" }]} />
        </Container>
      </Section>

      <Section tone="paper" className="pt-6 pb-16 lg:pt-10 lg:pb-24">
        <Container>
          {/* Eyebrow → pastille centrée sur la page, au-dessus du contenu. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            Veille IA opérationnelle
          </HeroBadge>
          <div className="max-w-3xl">
            <h1 className="display-editorial text-fg">
              Actualités{" "}
              <em className="italic-editorial text-terracotta not-italic">
                <span className="italic">IA pour dirigeants</span>
              </em>
            </h1>
            <p
              data-answer
              className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
            >
              Veille hebdomadaire sur les sorties produits, mises à jour Search Console et décisions
              techniques qui impactent l&apos;IA opérationnelle des PME et ETI. Pas de hype —
              uniquement ce qui change vos arbitrages cette semaine.
            </p>

            {items.length > 0 ? (
              <ul className="text-fg-soft mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <li className="inline-flex items-center gap-1.5">
                  <Newspaper className="text-terracotta h-4 w-4" aria-hidden="true" />
                  {items.length} actualité{items.length > 1 ? "s" : ""} IA
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CalendarClock className="text-terracotta h-4 w-4" aria-hidden="true" />
                  Mise à jour en continu
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="text-terracotta h-4 w-4" aria-hidden="true" />
                  Sources primaires citées
                </li>
              </ul>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="border-border/60 bg-halo-warm/40 mt-12 rounded-2xl border px-6 py-14 text-center">
              <Newspaper className="text-terracotta mx-auto h-8 w-8" aria-hidden="true" />
              <p className="text-fg mt-4 text-lg font-medium">La veille arrive</p>
              <p className="text-fg-soft mx-auto mt-2 max-w-md text-base">
                Les premières actualités IA sont en préparation. Abonnez-vous au flux pour être
                prévenu, ou explorez le blog éditorial en attendant.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
                <a
                  href="/fr/actualites/feed.xml"
                  className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1.5 font-medium"
                >
                  <Rss className="h-4 w-4" aria-hidden="true" /> S&apos;abonner au flux RSS
                </a>
                <Link
                  href="/blog"
                  className="text-fg-soft hover:text-fg inline-flex items-center gap-1 underline"
                >
                  Voir le blog <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : (
            <ul className="xs:grid-cols-2 mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {items.map((item) => {
                const publishedStr = formatPublishedAt(item.publishedAt);
                const readingStr = formatReadingTime(item.readingTime);
                return (
                  <li key={item.slug}>
                    <ArticleCard
                      href={`/actualites/${item.slug}`}
                      title={item.title}
                      excerpt={item.excerpt ?? ""}
                      compact
                      {...(item.featuredImage ? { imageUrl: item.featuredImage } : {})}
                      {...(item.featuredImageAlt ? { imageAlt: item.featuredImageAlt } : {})}
                      {...(publishedStr ? { publishedAt: publishedStr } : {})}
                      {...(readingStr ? { readingTime: readingStr } : {})}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <a
              href="/fr/actualites/feed.xml"
              className="text-fg-soft hover:text-fg inline-flex items-center gap-1.5"
            >
              <Rss className="h-4 w-4" aria-hidden="true" /> Flux RSS des actualités
            </a>
            <Link
              href="/blog"
              className="text-fg-soft hover:text-fg inline-flex items-center gap-1 underline"
            >
              Voir aussi le blog éditorial <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {/* FAQ hub — réponses answer-first citables (AEO/GEO). Chaque réponse en
              .faq-answer (speakable-ready). Rendu seulement si des news existent. */}
          {items.length > 0 ? (
            <section className="mt-20 max-w-3xl" aria-labelledby="actualites-faq-title">
              <h2 id="actualites-faq-title" className="text-fg text-2xl font-medium sm:text-3xl">
                Questions fréquentes
              </h2>
              <dl className="mt-8 space-y-6">
                {faqItems.map((f) => (
                  <div key={f.question} className="border-border/60 border-b pb-6">
                    <dt className="text-fg text-base font-medium">{f.question}</dt>
                    <dd className="faq-answer text-fg-soft mt-2 text-base leading-relaxed">
                      {f.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </Container>
      </Section>

      <CtaBlock
        title="Transformer la veille en arbitrages"
        titleEm="concrets"
        description="Réservez une intervention IA — formats 4 h, 1 jour ou 1 mois selon vos enjeux."
        cta={
          <Cta href="/appel" size="lg">
            Réserver un appel →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={collectionJsonLd} />
      <JsonLd data={itemListJsonLd} />
      {/* FAQPage émis uniquement quand la FAQ est réellement rendue (items>0) —
          cohérence schéma↔contenu (anti rich-results mismatch). */}
      {items.length > 0 ? <JsonLd data={faqJsonLd} /> : null}
    </>
  );
}
