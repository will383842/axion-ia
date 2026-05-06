import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Badge } from "@/components/ui/badge";
import { getCaseStudy, getAllSlugs } from "@/content/case-studies";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

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
    title: `${c.title} · AxionIA`,
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

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.title,
    description: copy.excerpt,
    url: `${SITE_URL}/${loc}/cas-concrets/${slug}`,
    publisher: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
    inLanguage: loc,
  } as const;

  const reviewJsonLd = {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: { "@type": "Service", name: "AxionIA AI consulting" },
    reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
    reviewBody: copy.testimonialQuote,
    author: { "@type": "Person", name: copy.testimonialAuthor },
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Cas concrets" : "Case studies", href: "/cas-concrets" },
      { name: copy.title, href: `/cas-concrets/${slug}` },
    ],
  });

  return (
    <>
      <Section
        eyebrow={isFr ? "Cas concret · accent green" : "Case study · green accent"}
        title={copy.title}
      >
        <Container className="flex flex-wrap gap-2">
          <Badge variant="neutral">{isFr ? cs.industry : cs.industryEn}</Badge>
          <Badge variant="success">{cs.metric}</Badge>
        </Container>
      </Section>

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

      <CtaBlock
        eyebrow={isFr ? "Vous aussi" : "You too"}
        title={isFr ? "Démarrez votre propre cas concret" : "Start your own case study"}
        description={
          isFr
            ? "L'Essentielle 490 € pose le diagnostic + le plan d'action 90 jours."
            : "The Essential €490 frames the diagnostic and the 90-day action plan."
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
      <JsonLd data={breadcrumb} />
    </>
  );
}
