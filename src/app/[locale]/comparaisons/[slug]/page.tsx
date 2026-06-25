import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Scale, Wallet, ShieldCheck, Zap } from "lucide-react";
import { routing, STATIC_LOCALES, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ArticleFaq } from "@/components/content-gen/ArticleFaq";
import { getComparison, getAllComparisonSlugs, type ComparisonI18n } from "@/content/comparaisons";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { getManonPersonJsonLd } from "@/lib/seo/manon-person";
import { WasHelpful } from "@/components/marketing/WasHelpful";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllComparisonSlugs().flatMap((slug) =>
    STATIC_LOCALES.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const c = getComparison(slug);
  if (!c) return {};
  const copy = c[locale as Locale];
  const directAnswer = c.directAnswer?.[locale as Locale];
  return buildProductMetadata({
    locale,
    path: `/comparaisons/${slug}`,
    title: `${copy.title} · Axion-IA`,
    description: directAnswer ?? copy.excerpt,
  });
}

export default async function ComparisonPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const c = getComparison(slug);
  if (!c) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const copy = c[loc];
  const pick = (v: ComparisonI18n): string => v[loc];

  // Refonte templates 2026-06-22 — date de fraîcheur (fallback date éditoriale).
  const updatedAt = c.updatedAt ?? "2026-06-22";
  const directAnswer = c.directAnswer ? pick(c.directAnswer) : copy.excerpt;
  const optionAName = c.optionA ? pick(c.optionA) : "Option A";
  const optionBName = c.optionB ? pick(c.optionB) : "Option B";
  const criteria = c.criteria ?? [];
  const verdicts = c.verdicts ?? [];
  const faqItems = (c.faq ?? []).map((f) => ({
    question: pick(f.question),
    answer: pick(f.answer),
  }));

  // JSON-LD Article enrichi (vs l'ancien minimal sans auteur) : auteur Manon par
  // @id (Person co-émis), dateModified réelle, Speakable pointant la réponse
  // directe. BreadcrumbList émis par <Breadcrumbs>, FAQPage par <ArticleFaq>.
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.title,
    description: directAnswer,
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/comparaisons/${slug}`,
    datePublished: updatedAt,
    dateModified: updatedAt,
    author: { "@id": `${SITE_URL}/${locale}/equipe/manon#person` },
    publisher: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["[data-answer]"],
    },
  } as const;
  const personJsonLd = await getManonPersonJsonLd();

  const breadcrumbItems = [
    { href: "/comparaisons", label: isFr ? "Comparaisons" : "Comparisons" },
    { href: `/comparaisons/${slug}`, label: copy.title },
  ];

  // Split sur " vs " pour mettre "vs" en italique terracotta éditorial.
  const vsMatch = copy.title.match(/^(.+?)\s+vs\s+(.+)$/i);

  const pills = [
    { icon: Scale, label: isFr ? "Comparaison neutre" : "Neutral comparison" },
    { icon: Wallet, label: isFr ? "Critères ROI" : "ROI criteria" },
    { icon: ShieldCheck, label: isFr ? "RGPD · UE" : "GDPR · EU" },
    { icon: Zap, label: isFr ? "Quand choisir quoi" : "When to choose what" },
  ];
  const heroChildren = (
    <Container className="mt-8 max-w-2xl">
      <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
        {pills.map((pill) => {
          const Icon = pill.icon;
          return (
            <li key={pill.label} className="text-fg-soft inline-flex items-center gap-2 text-sm">
              <Icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
              <span>{pill.label}</span>
            </li>
          );
        })}
      </ul>
    </Container>
  );

  // Body multi-paragraphes : split par phrase pour densité éditoriale.
  const paragraphs = copy.body
    .trim()
    .split(/(?<=\.)\s+(?=[A-ZÀÉÈÔÎ])/)
    .filter(Boolean);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {vsMatch ? (
        <Section
          titleAs="h1"
          eyebrow={isFr ? "Comparaison" : "Comparison"}
          title={vsMatch[1]}
          titleEm="vs"
          titleTail={` ${vsMatch[2]}`}
          description={copy.excerpt}
        >
          {heroChildren}
        </Section>
      ) : (
        <Section
          titleAs="h1"
          eyebrow={isFr ? "Comparaison" : "Comparison"}
          title={copy.title}
          description={copy.excerpt}
        >
          {heroChildren}
        </Section>
      )}

      {/* Answer-first (AEO/GEO) — réponse directe « quand choisir quoi ». */}
      <Section>
        <Container className="max-w-3xl">
          <AnswerCard locale={loc}>{directAnswer}</AnswerCard>
        </Container>
      </Section>

      {/* Tableau comparatif structuré (le cœur d'un comparatif pour l'AEO). */}
      {criteria.length > 0 ? (
        <Section eyebrow={isFr ? "Comparatif" : "At a glance"}>
          <Container className="max-w-3xl">
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left text-base">
                <caption className="sr-only">
                  {optionAName} {isFr ? "contre" : "vs"} {optionBName}
                </caption>
                <thead>
                  <tr className="bg-sand-deep">
                    <th scope="col" className="text-fg p-3 font-semibold">
                      {isFr ? "Critère" : "Criterion"}
                    </th>
                    <th scope="col" className="text-fg p-3 font-semibold">
                      {optionAName}
                    </th>
                    <th scope="col" className="text-fg p-3 font-semibold">
                      {optionBName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((row, i) => (
                    <tr key={`crit-${i}`} className="odd:bg-sand/50">
                      <th scope="row" className="border-border text-fg border-t p-3 font-medium">
                        {pick(row.label)}
                      </th>
                      <td className="border-border text-fg-soft border-t p-3">
                        {pick(row.optionA)}
                      </td>
                      <td className="border-border text-fg-soft border-t p-3">
                        {pick(row.optionB)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* Analyse rédigée (corps prose chartré). */}
      <Section>
        <Container className="text-fg max-w-3xl space-y-5 text-base leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={`p-${i}`} className="text-fg-soft">
              {p}
            </p>
          ))}
        </Container>
      </Section>

      {/* « Quand choisir quoi » — verdicts SPÉCIFIQUES (data-driven, plus de cartes
          génériques identiques pour tous les comparatifs). */}
      {verdicts.length > 0 ? (
        <Section eyebrow={isFr ? "Quand choisir quoi" : "When to choose what"} tone="sand">
          <Container className="max-w-3xl">
            <ul className="grid gap-4 sm:grid-cols-2">
              {verdicts.map((v, i) => (
                <li
                  key={`v-${i}`}
                  className="border-border bg-paper border-l-terracotta rounded-lg border border-l-4 p-5"
                >
                  <p className="text-terracotta-deep text-sm font-semibold">{pick(v.when)}</p>
                  <p className="text-fg mt-2 leading-relaxed">{pick(v.choose)}</p>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* FAQ → FAQPage JSON-LD (composant partagé, accordéon natif 0 JS). */}
      <ArticleFaq items={faqItems} locale={loc} dateModified={updatedAt} />

      <div className="border-border border-t py-6">
        <Container>
          <WasHelpful isFr={isFr} />
        </Container>
      </div>

      <CtaBlock
        title={isFr ? "Besoin d'arbitrer pour votre cas ?" : "Need to arbitrate for your case?"}
        description={
          isFr
            ? "L'audit IA Axion-IA livre une recommandation chiffrée en 5 jours."
            : "The Axion-IA AI audit delivers a costed recommendation in 5 days."
        }
        cta={
          <Cta href="/audit" size="lg">
            {isFr ? "Voir l'audit IA" : "See AI audit"} →
          </Cta>
        }
        tone="dark"
      />
      <JsonLd data={articleJsonLd} />
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
    </>
  );
}
