/**
 * Route publique guides piliers (Batch 3.A audit 2026-05-15 P0-7).
 *
 * - FR uniquement V1 (doctrine v1.2 — contenus content-gen FR-only).
 * - DB-driven : lit Article par slug via `loadGuideForView` (filtre
 *   templateVariant matchant guide OU slug commençant par `guide-`).
 * - JSON-LD HowTo si steps structurées extraites du body (Batch 3.C livrera
 *   le pipeline 2-step qui produira des steps fiables) ; sinon fallback
 *   Article JSON-LD pour rester indexable + author Manon canonical.
 * - Anti-doorway HCU : meta robots dérivé de `Article.indexationTier`.
 * - ISR Next 16 : revalidate=3600 + dynamicParams=true (nouveaux guides
 *   rendus on-demand au premier hit puis cachés 1h).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import { findRedirectFromHistory } from "@/lib/knowledge/slug-history";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { ArticleTOC, type TocItem } from "@/components/seo/ArticleTOC";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { buildArticleJsonLd, buildHowToJsonLd } from "@/lib/seo-content-gen-factories";
import { getManonPersonJsonLd, getManonByline } from "@/lib/seo/manon-person";
import { loadGuideForView } from "@/server/content-gen/guides/loader";
import { loadPeopleAlsoAsk, loadAdjacentArticlesByType } from "@/server/content-gen/blog/loader";
import { ArticlePeopleAlsoAsk } from "@/components/content-gen/ArticlePeopleAlsoAsk";
import { ArticlePrevNext } from "@/components/content-gen/ArticlePrevNext";
import { ArticleNewsletterInline } from "@/components/content-gen/ArticleNewsletterInline";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import { findRelatedArticles } from "@/server/content-gen/links/related-articles";
import { ArticleFaq } from "@/components/content-gen/ArticleFaq";
import { ArticleSources } from "@/components/content-gen/ArticleSources";
import { ArticleKeyTakeaway } from "@/components/content-gen/ArticleKeyTakeaway";
import { ArticleExpertQuote } from "@/components/content-gen/ArticleExpertQuote";
import { ArticleShareBar } from "@/components/content-gen/ArticleShareBar";
import { ArticleTransparencyBlock } from "@/components/content-gen/ArticleTransparencyBlock";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";

// ISR pure : `force-dynamic` annule silencieusement `revalidate`. Retiré
// pour rétablir le cache ISR (audit Web Vitals 2026-05-15).
export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const guide = await loadGuideForView(slug, locale as Locale);
  if (!guide) return {};

  const meta = buildProductMetadata({
    locale,
    path: `/guides/${slug}`,
    title: `${guide.title} · Guide Axion-IA`,
    description: guide.excerpt || `Guide pratique : ${guide.title}.`,
    ogType: "article", // VIS-05/SEO-05
  });

  // Anti-doorway HCU : robots dérivé du tier (Sprint 14.10 pattern).
  if (guide.tier === "tier_2_noindex_follow") {
    return { ...meta, robots: { index: false, follow: true } };
  }
  if (guide.tier === "tier_3_noindex_nofollow") {
    return { ...meta, robots: { index: false, follow: false } };
  }
  return meta;
}

export default async function GuidePiliersPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const guide = await loadGuideForView(slug, locale as Locale);
  if (!guide) {
    // V-10 KB redirect wire 2026-05-22 — 301 vers nouveau slug si entry
    // KnowledgeSlugHistory existe. Préserve link juice après rename KB.
    const hit = await findRedirectFromHistory({
      oldSlug: slug,
      oldLocale: locale as Locale,
      oldType: "guide",
    });
    if (hit?.currentPath) {
      permanentRedirect(hit.currentPath);
    }
    notFound();
  }
  setRequestLocale(locale);

  // JSON-LD : HowTo si steps fiables (≥ 2 extraites), sinon Article fallback.
  // Méta-cert 2026-05-15 AGENT 20 P0 — le fallback Article passe désormais par
  // `buildArticleJsonLd` factory pour injecter creator + disambiguatingDescription
  // + usageInfo + speakable (AI Act EU art. 50 machine-readable).
  const jsonLd = guide.hasStructuredSteps
    ? buildHowToJsonLd({
        name: guide.title,
        description: guide.excerpt || guide.title,
        slug,
        locale: "fr",
        publishedAt: guide.publishedAt,
        updatedAt: guide.updatedAt,
        totalTimeMinutes: guide.readingTimeMinutes,
        steps: guide.steps.map((s) => ({ name: s.name, text: s.text })),
      })
    : buildArticleJsonLd({
        title: guide.title,
        description: guide.excerpt,
        slug,
        locale: "fr",
        publishedAt: guide.publishedAt,
        updatedAt: guide.updatedAt,
        urlSegment: "guides",
      });

  // VIS-05 — co-émet le nœud Person Manon (résout l'author @id du HowTo/Article).
  const personJsonLd = await getManonPersonJsonLd();
  // Chantier templates 2026-06-21 — byline enrichie (photo/rôle/LinkedIn depuis
  // AuthorProfile). emitJsonLd={false} : le Person riche est personJsonLd ci-dessus.
  const manonByline = await getManonByline();
  // Refonte 2026-06-22 — People Also Ask aussi sur /guides (parité maillage avec
  // /blog) : vraies questions issues des FAQ d'autres articles publiés.
  const peopleAlsoAsk = await loadPeopleAlsoAsk(slug, locale as Locale);
  const adjacent = await loadAdjacentArticlesByType(slug, locale as Locale, "guides");

  const breadcrumbItems = [
    { href: "/guides", label: "Guides" },
    { href: `/guides/${slug}`, label: guide.title },
  ];

  // Découpe paragraphes : si on a des steps structurées, on rend en sections.
  // Sinon on splite par double newline pour conserver le rythme original.
  const paragraphs = guide.body.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  // VIS-01 (fix C3 2026-06-15) — `guide.body` provient de `translation.body`
  // (HTML content-gen, cf. guides/loader.ts). Sans steps structurées, l'ancien
  // rendu `<p>{guide.body}</p>` échappait les balises (h2/listes/liens visibles
  // en clair). On rend désormais le HTML sanitisé quand le body EST du HTML ;
  // le fallback paragraphes plats reste pour un éventuel body en prose brute.
  // Détection ciblée sur des balises de contenu RÉELLES (pas `<[a-z]` générique,
  // qui faux-positiverait sur de la prose contenant « <mot> »).
  const guideBodyHtml =
    /<(?:p|h[1-6]|ul|ol|li|a|strong|em|blockquote|table|thead|tbody|tr|td|th|div|br|img|figure|figcaption|pre|code|hr)\b/i.test(
      guide.body,
    )
      ? sanitizeContentGenHtml(guide.body)
      : null;

  // TOC Featured Snippets P0-4 — généré depuis les steps structurées si
  // disponibles. Chaque step.name devient un h2 dans le rendu, donc une entrée TOC.
  // Chantier templates 2026-06-21 — FIX ancres mortes : l'ancre du sommaire
  // DOIT être identique à l'`id` de la section (`step-${position}`, cf. rendu
  // ci-dessous). Avant : l'ancre était un slug du nom → ne matchait jamais
  // l'id `step-N` → clics du sommaire sans effet. `step-${position}` est unique.
  const tocItems: TocItem[] = guide.hasStructuredSteps
    ? guide.steps.map((s) => ({
        anchor: `step-${s.position}`,
        title: s.name,
        level: 2 as const,
      }))
    : [];
  const pageUrl = `${SITE_URL}/fr/guides/${slug}`;

  return (
    <>
      {/* Refonte templates 2026-06-22 — barre de progression de lecture (CSS, 0 JS). */}
      <div className="reading-progress" aria-hidden="true" />

      {/* P1-17 — alternate format markdown brut pour LLM ingestion (parité /blog). */}
      <link
        rel="alternate"
        type="text/markdown"
        href={`/api/markdown/guides/${slug}`}
        title={`${guide.title} (markdown)`}
      />

      <JsonLd data={jsonLd} />
      {/* AEO/GEO 2026 — BreadcrumbList (chaîne d'attribution Claude/Perplexity/SGE). */}
      <JsonLd
        data={buildBreadcrumbJsonLd({
          locale: locale as Locale,
          items: breadcrumbItems.map((b) => ({ name: b.label, href: b.href })),
        })}
        scriptId="jsonld-breadcrumb-guide"
      />
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* A11y WCAG 2.4.1/1.3.1 — cible du skip-link + landmark de contenu
          éditorial principal (un seul id="main-content" par page). */}
      <article>
      <Section className="bg-cream">
        <Container className="max-w-3xl">
          {tocItems.length >= 2 && (
            <ArticleTOC items={tocItems} pageUrl={pageUrl} locale="fr" sticky={false} />
          )}
          <div className="mb-6 flex items-center gap-3">
            <Badge variant="accent" className="tracking-wide">
              Guide pilier
            </Badge>
            <span className="text-muted text-sm">{guide.readingTimeMinutes} min de lecture</span>
          </div>

          <h1 className="display-editorial text-ink text-4xl md:text-5xl lg:text-6xl">
            {guide.title}
          </h1>

          {guide.excerpt && (
            <p className="text-muted mt-6 text-lg leading-relaxed">{guide.excerpt}</p>
          )}

          {/* P3 QW-5 — AuthorByline E-E-A-T (KB-10). */}
          <AuthorByline
            authorName="Manon"
            authorSlug="manon"
            {...(manonByline
              ? { authorAvatarUrl: manonByline.avatarUrl, authorBio: manonByline.bio }
              : {})}
            publishedAt={guide.publishedAt ? new Date(guide.publishedAt) : null}
            lastReviewedAt={guide.updatedAt ? new Date(guide.updatedAt) : null}
            emitJsonLd={false}
            locale="fr"
          />

          {/* Chantier templates 2026-06-21 — héros Unsplash (avant : aucune
              image sur /guides). LCP priority, ratio 16/9 réservé (CLS=0). */}
          {guide.featuredImage ? (
            <div className="mt-8">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
                <Image
                  src={guide.featuredImage}
                  alt={guide.featuredImageAlt ?? guide.title}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                />
              </div>
              <UnsplashCredit
                photographerName={guide.photographerName}
                photographerUrl={guide.photographerUrl}
              />
            </div>
          ) : null}

          <div className="mt-12 space-y-6">
            {guide.hasStructuredSteps ? (
              guide.steps.map((step) => (
                <section
                  key={step.position}
                  aria-labelledby={`step-${step.position}`}
                  className="border-border rounded-lg border bg-white p-6"
                >
                  <h2
                    id={`step-${step.position}`}
                    className="text-ink text-xl font-semibold md:text-2xl"
                  >
                    <span className="text-terracotta mr-2">{step.position}.</span>
                    {step.name}
                  </h2>
                  <div className="text-ink mt-3 leading-relaxed whitespace-pre-line">
                    {step.text}
                  </div>
                </section>
              ))
            ) : guideBodyHtml ? (
              <div
                className="prose prose-axionia text-ink max-w-none leading-relaxed"
                dangerouslySetInnerHTML={{ __html: guideBodyHtml }}
              />
            ) : (
              paragraphs.map((p, idx) => (
                <p key={idx} className="text-ink leading-relaxed">
                  {p.trim()}
                </p>
              ))
            )}
          </div>

          <AiContentDisclaimer locale="fr" className="mt-10" />
        </Container>
      </Section>
      </article>

      {/* Chantier templates 2026-06-21 — point clé + citation expert (rendus
          seulement si renseignés). Hors de la section cream pour éviter une
          imbrication de <Section>. */}
      <ArticleKeyTakeaway text={guide.keyTakeaway} locale="fr" />
      <ArticleExpertQuote quote={guide.expertQuote} locale="fr" />

      {/* Refonte templates 2026-06-22 — barre de partage + copier le lien. */}
      <ArticleShareBar url={pageUrl} title={guide.title} locale="fr" />

      {/* Chantier templates 2026-06-21 — FAQ + Sources (briques partagées,
          mêmes composants que /blog). guide.updatedAt = Date → ISO court. */}
      <ArticleFaq
        items={guide.faqItems}
        locale="fr"
        dateModified={guide.updatedAt.toISOString().slice(0, 10)}
      />
      <ArticleSources
        items={guide.citations}
        locale="fr"
        lastVerified={guide.updatedAt.toISOString().slice(0, 10)}
      />

      {/* Refonte templates 2026-06-22 — transparence E-E-A-T (fraîcheur). */}
      {/* Cadence de revue par type (audit perfection 2026-06-22) — guides = 60 j. */}
      <ArticleTransparencyBlock lastVerified={guide.updatedAt} updateCycleDays={60} locale="fr" />

      {/* Refonte 2026-06-22 — People Also Ask (parité /blog). */}
      <ArticlePeopleAlsoAsk items={peopleAlsoAsk} locale="fr" />

      {/* V-14 sprint UX 2026-05-22 — section Articles connexes (auparavant absente sur /guides/[slug] → dead-end + bounce maximal). */}
      <SuggestedContent
        variant="articles"
        items={(await findRelatedArticles({ currentSlug: slug, locale: "fr", limit: 4 })).map(
          (r) => ({
            href: `/blog/${r.slug}`,
            title: r.title,
            excerpt: r.excerpt,
            publishedAt: r.publishedAt,
            readingTime: r.readingTime,
          }),
        )}
        eyebrow="Articles connexes"
        title="À lire aussi"
        tone="sand"
        emitJsonLd
      />

      {/* Refonte 2026-06-22 — précédent / suivant (parité /blog). */}
      <ArticlePrevNext prev={adjacent.prev} next={adjacent.next} locale="fr" />

      {/* Refonte 2026-06-22 — newsletter (parité /blog). */}
      <ArticleNewsletterInline locale="fr" />

      <CtaBlock
        title="Besoin d'un accompagnement opérationnel ?"
        description="Axion-IA accompagne les PME et ETI sur l'audit, l'intervention et l'implémentation IA."
        cta={
          <Cta href="/audit" size="lg">
            Demander un audit
          </Cta>
        }
      />
    </>
  );
}
