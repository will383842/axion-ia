/**
 * Route publique NewsArticle (Pipeline 2 RSS — § 28 master prompt v1.7).
 *
 * - FR uniquement (doctrine v1.2 — contenus content-gen). Locale !== "fr" → 404.
 * - Source : table Prisma `Article` filtrée `isNews=true` + slug match via
 *   `ArticleTranslation` (locale=fr, slug). Pas de fallback FS (DB-driven dès V1).
 * - ISR Next 16 : `revalidate = 3600` (régénération horaire — news fraîches).
 * - JSON-LD : `buildNewsArticleJsonLd` (Schema.org NewsArticle + dateline +
 *   isBasedOn source RSS).
 * - Anti-doorway HCU : meta robots dérivé de `Article.indexationTier` (tier-1
 *   index, tier-2/3 noindex).
 * - Pass B fix P0-2 (2026-05-14) : `content-publish-worker.ts:184` construit
 *   l'URL `/fr/actualites/<slug>` et appelle `revalidatePath` dessus → cette
 *   route rend l'article publié accessible publiquement (avant fix la route
 *   n'existait pas → 404 + IndexNow ping mort).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { buildProductMetadata } from "@/lib/seo";
import { buildNewsArticleJsonLd } from "@/lib/seo-content-gen-factories";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";

// ISR pure : revalidate toutes les heures + on-demand generation au premier
// hit pour les nouveaux slugs (audit 2026-05-15 P1-15 fix). `force-static`
// retiré car contradictoire avec ISR sans `generateStaticParams` — provoquait
// 404 sur le premier article post-deploy jusqu'à la fenêtre revalidate.
export const revalidate = 3600;
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

async function loadNewsArticle(slug: string) {
  const translation = await prisma.articleTranslation.findFirst({
    where: {
      locale: "fr",
      slug,
      article: {
        isNews: true,
        status: "published",
      },
    },
    include: {
      article: {
        include: { author: true, category: true },
      },
    },
  });
  return translation;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (locale !== "fr") return {};
  const t = await loadNewsArticle(slug);
  if (!t) return {};

  const meta = buildProductMetadata({
    locale,
    path: `/actualites/${slug}`,
    title: t.metaTitle ?? `${t.title} · Axion-IA`,
    description: t.metaDescription ?? t.excerpt ?? t.title,
  });

  // Anti-doorway HCU 2024 — robots dérivé du tier (cohérence § 28.5 + § 21).
  const tier = t.article.indexationTier;
  if (tier === "tier_2_noindex_follow") {
    return { ...meta, robots: { index: false, follow: true } };
  }
  if (tier === "tier_3_noindex_nofollow") {
    return { ...meta, robots: { index: false, follow: false } };
  }
  return meta;
}

export default async function NewsArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // FR-only (doctrine v1.2) — EN redirigé vers FR.
  if (locale !== "fr") redirect(`/fr/actualites/${slug}`);
  setRequestLocale(locale);

  const t = await loadNewsArticle(slug);
  if (!t) notFound();

  const article = t.article;
  const wordCount = (t.bodyText ?? t.body).trim().split(/\s+/).length;
  const sourceUrl = article.newsSourceUrl;
  const sourceName = article.newsSourceName;

  // NewsArticle JSON-LD ne s'émet que si la source RSS est tracée (compliance
  // § 28.3 — citation source obligatoire).
  const imageUrl = t.ogImage ?? article.featuredImage ?? undefined;
  const authorIdRef = article.author?.slug
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com"}/fr/equipe/${article.author.slug}#person`
    : undefined;
  const section = article.newsCategory ?? article.category?.id ?? undefined;

  const newsJsonLd =
    sourceUrl && sourceName
      ? buildNewsArticleJsonLd({
          title: t.title,
          description: t.excerpt ?? t.metaDescription ?? t.title,
          slug,
          locale: "fr",
          publishedAt: article.publishedAt ?? article.createdAt,
          updatedAt: article.updatedAt,
          wordCount,
          urlSegment: "actualites",
          sourceUrl,
          sourceName,
          ...(imageUrl ? { imageUrl } : {}),
          ...(authorIdRef ? { authorIdRef } : {}),
          ...(section ? { section } : {}),
          ...(article.publishedAtDateline ? { dateline: article.publishedAtDateline } : {}),
        })
      : null;

  const breadcrumbItems = [
    { href: "/actualites", label: "Actualités" },
    { href: `/actualites/${slug}`, label: t.title },
  ];

  const paragraphs = (t.bodyText ?? t.body)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const tierBadge =
    article.indexationTier === "tier_1_indexable"
      ? "Actualité vérifiée"
      : article.indexationTier === "tier_2_noindex_follow"
        ? "Brève (non indexée)"
        : "Archive";

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={article.newsCategory ?? "Actualité IA"}
        title={t.title}
        description={t.excerpt ?? undefined}
      >
        <Container className="text-fg-muted mt-8 flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="neutral">{tierBadge}</Badge>
          {article.author ? (
            <Link
              href={`/equipe/${article.author.slug}` as never}
              className="hover:text-terracotta-deep focus-visible:ring-terracotta rounded-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Par {article.author.name}
            </Link>
          ) : null}
          {article.publishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={article.publishedAt.toISOString()} className="tabular-nums">
                Publié le {article.publishedAt.toLocaleDateString("fr-FR")}
              </time>
            </>
          ) : null}
          {sourceName ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Source :{" "}
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-terracotta-deep underline"
                  >
                    {sourceName}
                  </a>
                ) : (
                  sourceName
                )}
              </span>
            </>
          ) : null}
        </Container>
      </Section>

      <Section>
        <Container className="text-fg max-w-3xl space-y-6 text-lg leading-relaxed">
          {paragraphs.map((p, idx) => (
            <p key={`p-${idx}`}>{p}</p>
          ))}
        </Container>
      </Section>

      <CtaBlock
        title="Mettre en pratique"
        description={`Démarrez par une intervention Essentielle ${formatAmount(
          getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
          "fr",
          { compact: true },
        )}.`}
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            Voir l&apos;Essentielle →
          </Cta>
        }
        tone="dark"
      />

      {newsJsonLd ? <JsonLd data={newsJsonLd} /> : null}
    </>
  );
}
