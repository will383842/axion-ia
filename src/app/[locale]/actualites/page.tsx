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
import { ArrowRight } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_URL, buildProductMetadata } from "@/lib/seo";

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
  const base = buildProductMetadata({
    locale,
    path: "/actualites",
    title: "Actualités IA · Veille opérationnelle · Axion-IA",
    description:
      "Veille hebdomadaire sur l'IA opérationnelle pour dirigeants de PME et ETI : décisions Search Console, sorties produits Anthropic/Mistral/OpenAI, retours terrain.",
    alternates: { fr: "/actualites", en: "/actualites" },
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

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/fr/actualites#collection`,
    name: "Actualités IA — Axion-IA",
    url: `${SITE_URL}/fr/actualites`,
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${SITE_URL}/fr#website` },
    description: "Veille hebdomadaire sur l'IA opérationnelle pour dirigeants de PME et ETI.",
    hasPart: items.slice(0, 12).map((item) => ({
      "@type": "NewsArticle",
      headline: item.title,
      url: `${SITE_URL}/fr/actualites/${item.slug}`,
      datePublished: item.publishedAt?.toISOString(),
    })),
  };

  return (
    <>
      <Section tone="paper" className="pt-8 lg:pt-12">
        <Container>
          <Breadcrumbs items={[{ href: "/actualites", label: "Actualités" }]} />
        </Container>
      </Section>

      <Section tone="paper" className="pt-6 pb-16 lg:pt-10 lg:pb-24">
        <Container>
          <div className="max-w-3xl">
            <p className="text-fg-muted mb-6 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              Veille IA opérationnelle
            </p>
            <h1 className="display-editorial text-fg">
              Actualités{" "}
              <em className="italic-editorial text-terracotta not-italic">
                <span className="italic">IA pour dirigeants</span>
              </em>
            </h1>
            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              Veille hebdomadaire sur les sorties produits, mises à jour Search Console et décisions
              techniques qui impactent l&apos;IA opérationnelle des PME et ETI. Pas de hype —
              uniquement ce qui change vos arbitrages cette semaine.
            </p>
          </div>

          {items.length === 0 ? (
            <p className="text-fg-soft mt-12 text-base">
              Aucune actualité publiée pour le moment. Revenez bientôt — la veille est hebdomadaire.
            </p>
          ) : (
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const publishedStr = formatPublishedAt(item.publishedAt);
                const readingStr = formatReadingTime(item.readingTime);
                return (
                  <li key={item.slug}>
                    <ArticleCard
                      href={`/actualites/${item.slug}`}
                      title={item.title}
                      excerpt={item.excerpt ?? ""}
                      {...(publishedStr ? { publishedAt: publishedStr } : {})}
                      {...(readingStr ? { readingTime: readingStr } : {})}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-16 flex flex-wrap items-center gap-4 text-sm">
            <Link
              href="/blog"
              className="text-fg-soft hover:text-fg inline-flex items-center gap-1 underline"
            >
              Voir aussi le blog éditorial <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </Section>

      <CtaBlock
        title="Transformer la veille en arbitrages"
        titleEm="concrets"
        description="Réservez une intervention IA — formats 4 h, 1 jour ou 1 mois selon vos enjeux."
        cta={
          <Cta href="/reserver" size="lg">
            Réserver une intervention →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={collectionJsonLd} />
    </>
  );
}
