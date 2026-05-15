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
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildHowToJsonLd } from "@/lib/seo-content-gen-factories";
import { loadGuideForView } from "@/server/content-gen/guides/loader";

export const revalidate = 3600;
export const dynamicParams = true;
export const dynamic = "force-dynamic";

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
  if (!guide) notFound();
  setRequestLocale(locale);

  const url = `${SITE_URL}/${locale}/guides/${slug}`;

  // JSON-LD : HowTo si steps fiables (≥ 2 extraites), sinon Article fallback.
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
    : ({
        "@context": "https://schema.org",
        "@type": "Article",
        "@id": `${url}#article`,
        headline: guide.title,
        description: guide.excerpt,
        url,
        inLanguage: "fr-FR",
        datePublished: guide.publishedAt.toISOString(),
        dateModified: guide.updatedAt.toISOString(),
        author: { "@id": `${SITE_URL}/fr/equipe/manon#person` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      } as const);

  const breadcrumbItems = [
    { href: "/guides", label: "Guides" },
    { href: `/guides/${slug}`, label: guide.title },
  ];

  // Découpe paragraphes : si on a des steps structurées, on rend en sections.
  // Sinon on splite par double newline pour conserver le rythme original.
  const paragraphs = guide.body.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  return (
    <>
      <JsonLd data={jsonLd} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section className="bg-cream">
        <Container className="max-w-3xl">
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
        </Container>
      </Section>

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
