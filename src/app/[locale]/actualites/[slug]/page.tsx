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
import Image from "next/image";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildNewsArticleJsonLd } from "@/lib/seo-content-gen-factories";
import { getManonPersonJsonLd, getManonByline } from "@/lib/seo/manon-person";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import {
  findRelatedArticles,
  segmentForArticleType,
} from "@/server/content-gen/links/related-articles";
import { loadPeopleAlsoAsk, loadAdjacentArticlesByType } from "@/server/content-gen/blog/loader";
import { ArticlePeopleAlsoAsk } from "@/components/content-gen/ArticlePeopleAlsoAsk";
import { ArticlePrevNext } from "@/components/content-gen/ArticlePrevNext";
import { ArticleNewsletterInline } from "@/components/content-gen/ArticleNewsletterInline";
import { findArticleTombstone } from "@/server/content-gen/tombstone";
import { Tombstone } from "@/components/content-gen/Tombstone";
import { findArticleSlugRedirect } from "@/server/content-gen/slug-history";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import { parseFaqItems } from "@/server/content-gen/shared/faq-items";
import { ArticleFaq } from "@/components/content-gen/ArticleFaq";
import { ArticleSources } from "@/components/content-gen/ArticleSources";
import { ArticleKeyTakeaway } from "@/components/content-gen/ArticleKeyTakeaway";
import { ArticleExpertQuote } from "@/components/content-gen/ArticleExpertQuote";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { ArticleTOC, type TocItem } from "@/components/seo/ArticleTOC";
import { buildToc } from "@/lib/knowledge/article-enrich";
import { ArticleShareBar } from "@/components/content-gen/ArticleShareBar";
import { ArticleTransparencyBlock } from "@/components/content-gen/ArticleTransparencyBlock";

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

// Découpe heuristique du titre en `lead` + `em` (em = portion serif italique
// terracotta), identique à /blog/[slug] (parité template). Règle :
// 1. Si le titre contient « : », on coupe au séparateur (la partie après devient
//    l'em). 2. Sinon on italicise les 2 derniers mots (titre 4+ mots) sinon le
//    dernier mot.
function splitTitleEm(title: string): { lead: string; em: string } {
  const colonFr = title.indexOf(" : ");
  if (colonFr > 0) {
    return { lead: title.slice(0, colonFr + 1), em: title.slice(colonFr + 3) };
  }
  const colonEn = title.indexOf(": ");
  if (colonEn > 0) {
    return { lead: title.slice(0, colonEn + 1), em: title.slice(colonEn + 2) };
  }
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return { lead: "", em: title };
  const emCount = words.length >= 4 ? 2 : 1;
  return {
    lead: words.slice(0, words.length - emCount).join(" "),
    em: words.slice(words.length - emCount).join(" "),
  };
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
    // P0 soft-404 (2026-06-21) — slug actualité inconnu SANS tombstone. Comme
    // `dynamicParams=true`, Next rend la page on-demand : un `return {}` héritait
    // du `robots: index, follow` du layout → URL inexistante servie en 200
    // indexable (soft-404). On force noindex/nofollow explicite (la page appelle
    // aussi `notFound()`). Même correctif que blog/[slug].
    return { robots: { index: false, follow: false } };
  }

  const meta = buildProductMetadata({
    locale,
    path: `/actualites/${slug}`,
    title: t.metaTitle ?? `${t.title} · Axion-IA`,
    description: t.metaDescription ?? t.excerpt ?? t.title,
    ogType: "article", // VIS-05/SEO-05
    // SEO news 2026 — OG article:* (fraîcheur + attribution, lus par
    // Facebook/LinkedIn/crawlers news) + autodiscovery du flux RSS section.
    rssFeed: `${SITE_URL}/fr/actualites/feed.xml`,
    article: {
      ...(t.article.publishedAt ? { publishedTime: t.article.publishedAt.toISOString() } : {}),
      ...(t.article.updatedAt ? { modifiedTime: t.article.updatedAt.toISOString() } : {}),
      ...(t.article.author?.name ? { authors: [t.article.author.name] } : {}),
      ...(t.article.newsCategory ? { section: t.article.newsCategory } : {}),
    },
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

  // Chantier templates 2026-06-21 — FAQ (Article.faqJson, jamais rendue) +
  // date de dernière mise à jour visible (avant : seulement « Publié le »).
  const faqItems = parseFaqItems(article.faqJson);
  const keyTakeaway = article.keyTakeaway ?? null;
  const expertQuote =
    article.expertQuoteName && article.expertQuoteText
      ? {
          name: article.expertQuoteName,
          title: article.expertQuoteTitle ?? null,
          text: article.expertQuoteText,
        }
      : null;
  const updatedIso = article.updatedAt ? article.updatedAt.toISOString().slice(0, 10) : null;
  const showUpdated =
    article.updatedAt != null &&
    article.publishedAt != null &&
    article.updatedAt.getTime() !== article.publishedAt.getTime();

  // VIS-14 — NewsArticle émis SYSTÉMATIQUEMENT (avant : seulement si source
  // tracée → une actu éditoriale sans source n'avait aucun JSON-LD article).
  // La source (isBasedOn) reste conditionnelle côté factory.
  const newsJsonLd = buildNewsArticleJsonLd({
    title: t.title,
    description: t.excerpt ?? t.metaDescription ?? t.title,
    slug,
    locale: "fr",
    publishedAt: article.publishedAt ?? article.createdAt,
    updatedAt: article.updatedAt,
    wordCount,
    urlSegment: "actualites",
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceName ? { sourceName } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(authorIdRef ? { authorIdRef } : {}),
    ...(section ? { section } : {}),
    ...(article.publishedAtDateline ? { dateline: article.publishedAtDateline } : {}),
    ...(citations.length > 0 ? { citations } : {}),
  });

  // VIS-05 — co-émet le nœud Person Manon pour résoudre l'author @id du
  // NewsArticle (sinon @id orphelin → warning Rich Results + perte E-E-A-T).
  const personJsonLd = await getManonPersonJsonLd();
  const manonByline = await getManonByline();

  // VIS-10 — articles connexes (anti dead-end de maillage : la page news n'en
  // avait aucun). Tier-1 only (anti-doorway).
  const related = await findRelatedArticles({ currentSlug: slug, locale: "fr", limit: 4 });
  // Refonte 2026-06-22 — People Also Ask (parité maillage /blog).
  const peopleAlsoAsk = await loadPeopleAlsoAsk(slug, "fr");
  const adjacentNews = await loadAdjacentArticlesByType(slug, "fr", "news");

  const breadcrumbItems = [
    { href: "/actualites", label: "Actualités" },
    { href: `/actualites/${slug}`, label: t.title },
  ];

  // VIS-01 (fix C3 2026-06-15) — `bodyText` = prose plate (cas normal) rendue en
  // paragraphes. Si `bodyText` absent, `body` = HTML content-gen → on le rend
  // sanitisé (whitelist anti-XSS) au lieu d'échapper les balises littéralement
  // (bug VIS-01 latent : `<p>{html}</p>` afficherait `<h2>…</h2>` en clair).
  // Refonte templates 2026-06-22 — TOC + ancres h2 (gap audit confirmé :
  // /actualites n'avait ni sommaire ni ancres). buildToc injecte les id sur les
  // h2 du HTML sanitisé et renvoie les items ; ne s'applique qu'au body HTML
  // content-gen (le bodyText plat n'a pas de headings).
  // 2026-07-04 (fix « blocosse ») — Le contenu content-gen d'une news est persisté
  // sous DEUX formes : `body` = HTML riche (h2/h3/h4, listes, callouts) et
  // `bodyText` = version texte plate (balises strippées). L'ancien test
  // `t.bodyText ? plat : html` tombait TOUJOURS dans la branche texte plat (une news
  // content-gen a toujours un `bodyText` non vide) → mur de <p>, sans hiérarchie de
  // titres, sans `.prose-axionia`, sans sommaire : d'où l'aspect « blocosse ». On
  // rend désormais le HTML (avec ancres TOC + prose) dès que `body` contient des
  // balises de bloc — même comportement que /blog. Le texte plat ne sert plus que de
  // fallback pour un `body` réellement dépourvu de HTML (ancien contenu legacy).
  const hasHtmlBody =
    typeof t.body === "string" && /<(h[1-6]|p|ul|ol|blockquote|table|figure|div)\b/i.test(t.body);
  const newsBodyToc = hasHtmlBody ? buildToc(sanitizeContentGenHtml(t.body)) : null;
  const bodyHtmlFallback = newsBodyToc ? newsBodyToc.html : null;
  const tocItems: TocItem[] = newsBodyToc
    ? newsBodyToc.toc.map((h) => ({ anchor: h.id, title: h.text, level: 2 as const }))
    : [];
  const pageUrl = `${SITE_URL}/fr/actualites/${slug}`;
  const paragraphs = (t.bodyText ?? "")
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

  // Accent éditorial du titre (parité /blog) — la queue rend en serif italique
  // terracotta via `titleEm` du <Section>.
  const titleParts = splitTitleEm(t.title);
  // Bannière « Dernière révision » (parité /blog) — signal de fraîcheur E-E-A-T.
  // Date de référence = updatedAt sinon publishedAt.
  const lastReviewed = article.updatedAt ?? article.publishedAt;

  return (
    <>
      {/* Refonte templates 2026-06-22 — barre de progression de lecture (CSS, 0 JS). */}
      <div className="reading-progress" aria-hidden="true" />

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
        title={titleParts.lead}
        titleEm={titleParts.em}
        description={t.excerpt ?? undefined}
        // Photo hero À DROITE du titre (parité /blog 2026-06-24). LCP critique →
        // priority. Ratio 16/10 réservé (CLS = 0), cadre premium (rounded-2xl +
        // bordure + ombre). Rendue uniquement si Article.featuredImage existe.
        media={
          article.featuredImage ? (
            <figure className="m-0">
              <div className="border-border/60 shadow-card relative aspect-[16/10] w-full overflow-hidden rounded-2xl border">
                <Image
                  src={article.featuredImage}
                  alt={article.featuredImageAltFr ?? t.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
              <UnsplashCredit
                photographerName={article.featuredImagePhotographerName}
                photographerUrl={article.featuredImagePhotographerUrl}
              />
            </figure>
          ) : undefined
        }
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
          {showUpdated && article.updatedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={article.updatedAt.toISOString()} className="tabular-nums">
                Mis à jour le {article.updatedAt.toLocaleDateString("fr-FR")}
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
        {/* Bannière « Dernière révision » (parité /blog) — signal de fraîcheur
            E-E-A-T visible (Article.dateModified déjà émis côté JSON-LD).
            Toujours affichée dès qu'une date de référence existe. */}
        {lastReviewed ? (
          <Container className="mt-4 max-w-3xl">
            <div className="border-border bg-sand-50 text-fg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <svg
                aria-hidden="true"
                className="text-terracotta-deep h-4 w-4 shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.477-9.817a.75.75 0 0 1 1.053-.143Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                Dernière révision :{" "}
                <time dateTime={lastReviewed.toISOString()} className="tabular-nums">
                  {lastReviewed.toLocaleDateString("fr-FR")}
                </time>
                {showUpdated ? <span className="text-fg-muted ml-1">(mis à jour)</span> : null}
              </span>
            </div>
          </Container>
        ) : null}
      </Section>

      {/* Layout 2 colonnes (parité blog 2026-06-25) : rail SOMMAIRE sticky à
          GAUCHE + colonne de lecture à droite. Mobile-first : sous lg une seule
          colonne (le <details> Sommaire s'empile en haut). */}
      <Container
        className={
          tocItems.length >= 2 ? "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12" : ""
        }
      >
        <div className="lg:col-start-1 lg:row-start-1">
          {tocItems.length >= 2 ? (
            <ArticleTOC items={tocItems} pageUrl={pageUrl} locale="fr" />
          ) : null}
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
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

          {/* « Point clé » (si renseigné). */}
          <ArticleKeyTakeaway text={keyTakeaway} locale="fr" />

          {/* A11y — <article> sémantique (contenu éditorial). */}
          <article>
            <Section>
              <Container className="text-fg max-w-[52rem] space-y-6 text-lg leading-relaxed">
                {bodyHtmlFallback ? (
                  <div
                    className="prose prose-axionia max-w-none"
                    dangerouslySetInnerHTML={{ __html: bodyHtmlFallback }}
                  />
                ) : (
                  paragraphs.map((p, idx) => <p key={`p-${idx}`}>{p}</p>)
                )}
              </Container>
            </Section>
          </article>

          {/* Carte auteur E-E-A-T EN BAS (parité blog). */}
          <Section>
            <Container className="max-w-[52rem]">
              <AuthorByline
                authorName={article.author?.name ?? "Manon"}
                authorSlug={article.author?.slug ?? "manon"}
                {...(manonByline
                  ? { authorAvatarUrl: manonByline.avatarUrl, authorBio: manonByline.bio }
                  : {})}
                publishedAt={article.publishedAt ?? null}
                lastReviewedAt={article.updatedAt ?? null}
                emitJsonLd={false}
                locale="fr"
              />
            </Container>
          </Section>

          {/* Barre de partage + copier le lien. */}
          <ArticleShareBar url={pageUrl} title={t.title} locale="fr" />

          {/* Citation d'expert nommé (si renseignée). */}
          <ArticleExpertQuote quote={expertQuote} locale="fr" />

          {/* FAQ + Sources (briques partagées). */}
          <ArticleFaq items={faqItems} locale="fr" dateModified={updatedIso} />
          <ArticleSources
            items={citations.map((c) => ({ name: c.title, url: c.url }))}
            locale="fr"
            lastVerified={updatedIso}
          />

          {/* Transparence E-E-A-T (fraîcheur) — actualités = 30 j. */}
          <ArticleTransparencyBlock
            lastVerified={article.updatedAt ?? article.publishedAt}
            updateCycleDays={30}
            locale="fr"
          />

          <Section>
            <Container className="max-w-3xl">
              <AiContentDisclaimer locale="fr" />
            </Container>
          </Section>

          {/* People Also Ask (parité /blog). */}
          <ArticlePeopleAlsoAsk items={peopleAlsoAsk} locale="fr" />
        </div>
      </Container>

      <SuggestedContent
        variant="articles"
        items={related.map((r) => ({
          // Route par type (parité /blog) : un guide/actualité connexe pointe
          // vers son hub canonique (évite un 308). Défaut sûr = blog.
          href: `/${segmentForArticleType(r.type ?? "blog")}/${r.slug}`,
          title: r.title,
          excerpt: r.excerpt,
          publishedAt: r.publishedAt,
          readingTime: r.readingTime,
        }))}
        eyebrow="Articles connexes"
        title="À lire aussi"
        tone="sand"
        emitJsonLd
      />

      {/* Refonte 2026-06-22 — précédent / suivant (parité /blog). */}
      <ArticlePrevNext prev={adjacentNews.prev} next={adjacentNews.next} locale="fr" />

      {/* Refonte 2026-06-22 — newsletter (parité /blog). */}
      <ArticleNewsletterInline locale="fr" />

      <CtaBlock
        title="Mettre en pratique"
        description="Démarrez par notre formation collective (1 journée)."
        cta={
          <Cta href="/formations" size="lg">
            Voir nos formations →
          </Cta>
        }
        tone="dark"
      />

      {newsJsonLd ? <JsonLd data={newsJsonLd} /> : null}
      {/* AEO/GEO 2026 — BreadcrumbList émis par le composant <Breadcrumbs> ci-dessus
          (chaîne complète avec Accueil, standard site). L'ancien script explicite
          dupliquait le nœud (et omettait l'Accueil) → retiré 2026-07-03. */}
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
    </>
  );
}
