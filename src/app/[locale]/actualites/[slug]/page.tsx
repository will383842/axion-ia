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
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { buildProductMetadata } from "@/lib/seo";
import { buildNewsArticleJsonLd } from "@/lib/seo-content-gen-factories";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import { findArticleTombstone } from "@/server/content-gen/tombstone";
import { Tombstone } from "@/components/content-gen/Tombstone";
import { findArticleSlugRedirect } from "@/server/content-gen/slug-history";

// ISR pure : revalidate toutes les heures + on-demand generation au premier
// hit pour les nouveaux slugs. Ni `force-static` (incompatible avec dynamic
// params sans generateStaticParams → 404 post-deploy) ni `force-dynamic`
// (annule silencieusement `revalidate` → SSR pur, perte cache CDN + ISR).
// `dynamicParams = true` est le défaut Next 16 ; explicité pour clarté.
export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Dérive le texte TL;DR (Canonical Answer pattern AEO/GEO 2026 § 3.5).
 * Priorité : `excerpt` (champ Prisma curé éditorialement) → fallback 2
 * premières phrases du body. Retourne `null` si rien d'exploitable
 * (AnswerCard alors omise).
 */
function deriveTldr(excerpt: string | null | undefined, body: string): string | null {
  const trimmed = (excerpt ?? "").trim();
  if (trimmed.length > 0) return trimmed;
  const sentences = body
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÀÉÈÔÎÊ])/)
    .filter((s) => s.length > 0)
    .slice(0, 2)
    .join(" ");
  return sentences.length > 0 ? sentences : null;
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

/**
 * P1-18 (audit re-run 2026-05-15 AGENT 3) — charge les ContentCitation
 * persistées pour un article + leur ExternalReference associée.
 *
 * Query séparée (pas via Article.include) car le model Article n'expose
 * pas la relation inverse `citations` côté Prisma. ContentCitation a
 * `articleId` nullable + relation `externalReference`. Skippe les
 * références mortes (`isAlive=false`) signalées par le link-checker cron V2.
 */
async function loadArticleCitations(
  articleId: string,
): Promise<
  ReadonlyArray<{ url: string; title: string; publisher?: string; publishedAt?: string }>
> {
  const rows = await prisma.contentCitation.findMany({
    where: { articleId, externalReference: { isAlive: true } },
    include: { externalReference: true },
  });
  return rows.map((c) => ({
    url: c.externalReference.url,
    title: c.externalReference.title,
    ...(c.externalReference.publisher ? { publisher: c.externalReference.publisher } : {}),
    ...(c.externalReference.publishedAt
      ? { publishedAt: c.externalReference.publishedAt.toISOString() }
      : {}),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (locale !== "fr") return {};
  const t = await loadNewsArticle(slug);
  if (!t) {
    // Audit indexation 2026-05-15 P0-7 — si l'article est archivé/rollback, on
    // émet une metadata "tombstone" avec robots noindex,nofollow pour signaler
    // la disparition à Google (soft-410). Cf. `server/content-gen/tombstone.ts`.
    const tombstone = await findArticleTombstone(slug);
    if (tombstone) {
      return {
        title: `${tombstone.title} · Ressource retirée · Axion-IA`,
        robots: { index: false, follow: false },
      };
    }
    return {};
  }

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
  if (!t) {
    // Audit indexation 2026-05-15 P0-5 — chercher dans ArticleSlugHistory avant
    // de rendre Tombstone/404. Si rename slug, redirect 301 vers le slug courant
    // (préserve SEO accumulé). Doit être avant le tombstone (slug renommé peut
    // toujours être published).
    const redirectInfo = await findArticleSlugRedirect(slug, "fr");
    if (redirectInfo && redirectInfo.isNews) {
      redirect(`/fr/actualites/${redirectInfo.newSlug}`);
    }

    // Audit indexation 2026-05-15 P0-7 — soft-410 si l'article est archived ou
    // rolled-back en draft. Render un Tombstone avec noindex,nofollow plutôt
    // qu'un 404 silent. IndexNow URL_DELETED ping déjà envoyé par
    // archiveArticle()/deleteArticle() côté server action.
    const tombstone = await findArticleTombstone(slug);
    if (tombstone) {
      return (
        <Tombstone
          title={tombstone.title}
          reason={tombstone.reason}
          backHref="/actualites"
          backLabel="Voir les actualités récentes"
        />
      );
    }
    notFound();
  }

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

  // P1-18 — Article.citation[] array depuis les ContentCitation persistées.
  // Query séparée car Article n'expose pas la relation inverse Prisma.
  const citations = await loadArticleCitations(article.id);

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
          ...(citations.length > 0 ? { citations } : {}),
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

  // TL;DR Canonical Answer (audit AEO/GEO 2026-05-15 § 3.5) — source = excerpt
  // si présent, sinon les 2 premières phrases du body (fallback). null si rien
  // d'exploitable → AnswerCard pas rendu.
  const tldrText = deriveTldr(t.excerpt, t.bodyText ?? t.body);

  const tierBadge =
    article.indexationTier === "tier_1_indexable"
      ? "Actualité vérifiée"
      : article.indexationTier === "tier_2_noindex_follow"
        ? "Brève (non indexée)"
        : "Archive";

  return (
    <>
      {/* P1-17 — alternate format markdown brut pour LLM ingestion (Cursor /
          Claude Code / Perplexity Spaces). React 19 hoist auto vers <head>. */}
      <link
        rel="alternate"
        type="text/markdown"
        href={`/api/markdown/actualites/${slug}`}
        title={`${t.title} (markdown)`}
      />
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

      {tldrText ? (
        <Section>
          <Container className="max-w-3xl">
            <AnswerCard
              locale="fr"
              {...(sourceName ? { sourceLabel: sourceName } : {})}
              {...(sourceUrl ? { sourceUrl } : {})}
            >
              {tldrText}
            </AnswerCard>
          </Container>
        </Section>
      ) : null}

      <Section>
        <Container className="text-fg max-w-3xl space-y-6 text-lg leading-relaxed">
          {paragraphs.map((p, idx) => (
            <p key={`p-${idx}`}>{p}</p>
          ))}
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <AiContentDisclaimer locale="fr" />
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
