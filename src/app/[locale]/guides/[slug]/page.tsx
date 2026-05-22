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
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildArticleJsonLd, buildHowToJsonLd } from "@/lib/seo-content-gen-factories";
import { loadGuideForView } from "@/server/content-gen/guides/loader";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import { findRelatedArticles } from "@/server/content-gen/links/related-articles";

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

  const breadcrumbItems = [
    { href: "/guides", label: "Guides" },
    { href: `/guides/${slug}`, label: guide.title },
  ];

  // Découpe paragraphes : si on a des steps structurées, on rend en sections.
  // Sinon on splite par double newline pour conserver le rythme original.
  const paragraphs = guide.body.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  // TOC Featured Snippets P0-4 — généré depuis les steps structurées si
  // disponibles. Chaque step.name devient un h2 dans le rendu, donc une entrée TOC.
  const tocItems: TocItem[] = guide.hasStructuredSteps
    ? guide.steps.map((s) => ({
        anchor: s.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        title: s.name,
        level: 2 as const,
      }))
    : [];
  const pageUrl = `${SITE_URL}/fr/guides/${slug}`;

  return (
    <>
      <JsonLd data={jsonLd} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

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
            publishedAt={guide.publishedAt ? new Date(guide.publishedAt) : null}
            lastReviewedAt={guide.updatedAt ? new Date(guide.updatedAt) : null}
            locale="fr"
          />

          <div className="mt-12 space-y-6">
            {guide.hasStructuredSteps
              ? guide.steps.map((step) => (
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
              : paragraphs.map((p, idx) => (
                  <p key={idx} className="text-ink leading-relaxed">
                    {p.trim()}
                  </p>
                ))}
          </div>

          <AiContentDisclaimer locale="fr" className="mt-10" />
        </Container>
      </Section>

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
