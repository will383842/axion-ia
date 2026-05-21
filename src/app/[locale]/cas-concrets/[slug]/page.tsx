import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Building2, BarChart3, ShieldCheck, Calendar } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { Badge } from "@/components/ui/badge";
import { getCaseStudy, getAllSlugs } from "@/content/case-studies";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildArticleJsonLd, buildReviewJsonLd } from "@/lib/seo";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { splitTitleEm } from "@/lib/title";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Dérive le texte TL;DR (Canonical Answer pattern AEO/GEO 2026 § 3.5).
 * Pour les case studies, l'excerpt est toujours présent (champ requis du
 * type CaseStudy). Fallback sur les 2 premières phrases du contexte.
 */
function deriveTldr(excerpt: string | null | undefined, fallback: string): string | null {
  const trimmed = (excerpt ?? "").trim();
  if (trimmed.length > 0) return trimmed;
  const sentences = fallback
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÀÉÈÔÎÊ])/)
    .filter((s) => s.length > 0)
    .slice(0, 2)
    .join(" ");
  return sentences.length > 0 ? sentences : null;
}

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const cs = getCaseStudy(slug);
  if (!cs) return {};
  const c = cs[locale];
  return buildProductMetadata({
    locale,
    path: `/cas-concrets/${slug}`,
    title: `${c.title} · Axion-IA`,
    description: c.excerpt,
  });
}

export default async function CaseStudyPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const cs = getCaseStudy(slug);
  if (!cs) notFound();
  const copy = cs[loc];

  // Article JSON-LD spec AEO/GEO 2026 — factory unifiée (Person author + dateModified
  // + mainEntityOfPage + image dynamique + keywords + section + wordCount).
  // P1.5 QW-1/QW-6 — AI Act art. 50 : spread aiGenerated flag (IA-assisté).
  const articleJsonLd = {
    ...buildArticleJsonLd({
      locale: loc,
      path: `/cas-concrets/${slug}`,
      headline: copy.title,
      description: copy.excerpt,
      datePublished: "2026-05-01",
      articleSection: isFr ? cs.industry : cs.industryEn,
      keywords: [cs.industry, cs.industryEn, cs.size ?? ""].filter(Boolean),
    }),
    aiGenerated: true,
    additionalType: "https://schema.org/AIGeneratedContent",
  };

  // Review JSON-LD via factory — star rating Google SERP rich results.
  const reviewJsonLd = buildReviewJsonLd({
    authorName: copy.testimonialAuthor,
    authorRole: copy.testimonialRole,
    ratingValue: 5,
    reviewBody: copy.testimonialQuote,
    itemReviewed: {
      type: "Service",
      name: isFr ? "Conseil IA opérationnel Axion-IA" : "Axion-IA operational AI consulting",
    },
  });

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  // P1-14 audit E2E NAV+CTA 2026-05-15 — fallback breadcrumbName court (≤35c)
  // pour éviter les titres très longs (« Industriel · -32% temps administratif
  // comptable » = 61 caractères) qui cassent la lisibilité du fil d'Ariane.
  const breadcrumbItems = [
    { href: "/cas-concrets", label: isFr ? "Cas concrets" : "Case studies" },
    { href: `/cas-concrets/${slug}`, label: copy.breadcrumbName ?? copy.title },
  ];

  // TL;DR Canonical Answer (audit AEO/GEO 2026-05-15 § 3.5).
  const tldrText = deriveTldr(copy.excerpt, copy.context);

  return (
    <>
      {/* P1-17 — alternate format markdown brut pour LLM ingestion. */}
      <link rel="alternate" type="text/markdown" href={`/api/markdown/cas-concrets/${slug}`} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {(() => {
        const t = splitTitleEm(copy.title);
        return (
          <Section
            titleAs="h1"
            eyebrow={isFr ? "Cas concret" : "Case study"}
            title={t.lead}
            titleEm={t.em}
            description={copy.excerpt}
          >
            <Container className="mt-8 max-w-3xl">
              <div className="mb-5 flex flex-wrap gap-2">
                <Badge variant="neutral">{isFr ? cs.industry : cs.industryEn}</Badge>
                <Badge variant="success">{cs.metric}</Badge>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  { icon: Building2, label: isFr ? cs.industry : cs.industryEn },
                  { icon: BarChart3, label: cs.metric },
                  { icon: ShieldCheck, label: isFr ? "Données anonymisées" : "Anonymised data" },
                  { icon: Calendar, label: isFr ? "Mission 2024-2026" : "2024-2026 engagement" },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Container>
          </Section>
        );
      })()}

      {tldrText ? (
        <Section>
          <Container className="max-w-3xl">
            <AnswerCard locale={loc}>{tldrText}</AnswerCard>
          </Container>
        </Section>
      ) : null}

      {/* P3 QW-5 — AuthorByline E-E-A-T (KB-10). */}
      <Container className="max-w-3xl">
        <AuthorByline
          authorName={isFr ? "Équipe Axion-IA" : "Axion-IA team"}
          publishedAt={new Date("2026-05-01")}
          locale={loc}
        />
      </Container>

      <Section eyebrow={isFr ? "Contexte" : "Context"}>
        <Container className="text-fg max-w-3xl text-lg leading-relaxed">{copy.context}</Container>
      </Section>

      <Section eyebrow={isFr ? "Problème" : "Problem"}>
        <Container className="text-fg max-w-3xl text-lg leading-relaxed">{copy.problem}</Container>
      </Section>

      <Section eyebrow={isFr ? "Solution" : "Solution"}>
        <Container className="text-fg max-w-3xl text-lg leading-relaxed">{copy.solution}</Container>
      </Section>

      <Section eyebrow={isFr ? "Résultats" : "Results"}>
        <Container className="max-w-3xl">
          <p className="text-fg text-2xl leading-snug font-semibold tracking-tight">
            {copy.result}
          </p>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Témoignage" : "Testimonial"}>
        <Container className="max-w-3xl">
          <TestimonialCard
            quote={copy.testimonialQuote}
            author={copy.testimonialAuthor}
            role={copy.testimonialRole}
          />
        </Container>
      </Section>

      {/* P1.5 QW-6 — AI Act art. 50 disclosure visible (bandeau IA-assisté). */}
      <Section>
        <Container className="max-w-3xl">
          <AiContentDisclaimer locale={loc} />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Vous aussi" : "You too"}
        title={isFr ? "Démarrez votre propre cas concret" : "Start your own case study"}
        description={
          isFr
            ? `L'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} pose le diagnostic + le plan d'action chiffré.`
            : `The Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })} frames the diagnostic and the costed action plan.`
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Réserver l'Essentielle" : "Book the Essential"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={articleJsonLd} />
      <JsonLd data={reviewJsonLd} />
    </>
  );
}
