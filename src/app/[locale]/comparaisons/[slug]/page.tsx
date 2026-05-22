import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Scale, Wallet, ShieldCheck, Zap } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getComparison, getAllComparisonSlugs } from "@/content/comparaisons";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { WasHelpful } from "@/components/marketing/WasHelpful";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllComparisonSlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const c = getComparison(slug);
  if (!c) return {};
  const copy = c[locale as Locale];
  return buildProductMetadata({
    locale,
    path: `/comparaisons/${slug}`,
    title: `${copy.title} · Axion-IA`,
    description: copy.excerpt,
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

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.title,
    description: copy.excerpt,
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/comparaisons/${slug}`,
    publisher: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
  } as const;

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/comparaisons", label: isFr ? "Comparaisons" : "Comparisons" },
    { href: `/comparaisons/${slug}`, label: copy.title },
  ];

  // Split sur " vs " pour mettre "vs" en italique terracotta éditorial.
  // Si le titre ne contient pas " vs ", on garde le titre tel quel.
  const vsMatch = copy.title.match(/^(.+?)\s+vs\s+(.+)$/i);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {(() => {
        // Pills réassurance comparaison — 4 critères de décision standard.
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
                  <li
                    key={pill.label}
                    className="text-fg-soft inline-flex items-center gap-2 text-sm"
                  >
                    <Icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                    <span>{pill.label}</span>
                  </li>
                );
              })}
            </ul>
          </Container>
        );
        return vsMatch ? (
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
        );
      })()}

      {(() => {
        // Body multi-paragraphes : split par phrase pour densité éditoriale
        // (audit V14 D4). Si copy.body n'a qu'1 phrase, fallback en 1 `<p>`.
        const paragraphs = copy.body
          .trim()
          .split(/(?<=\.)\s+(?=[A-ZÀÉÈÔÎ])/)
          .filter(Boolean);
        return (
          <Section>
            <Container className="text-fg max-w-3xl space-y-5 text-base leading-relaxed">
              {paragraphs.map((p, i) => (
                <p key={`p-${i}`} className="text-fg-soft">
                  {p}
                </p>
              ))}
            </Container>
          </Section>
        );
      })()}

      <Section eyebrow={isFr ? "Quand choisir quoi" : "When to choose what"} tone="sand">
        <Container>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{isFr ? "Volume de données" : "Data volume"}</CardTitle>
                <CardDescription>
                  {isFr
                    ? "Plus le volume métier est important, plus l'option spécialisée prend le dessus sur le générique."
                    : "The larger the domain dataset, the more the specialised option overtakes the generic."}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{isFr ? "Sensibilité données" : "Data sensitivity"}</CardTitle>
                <CardDescription>
                  {isFr
                    ? "Données sensibles ou stratégiques → préférer l'option avec hébergement UE et gouvernance maîtrisée."
                    : "Sensitive or strategic data → prefer the option with EU hosting and controlled governance."}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{isFr ? "Vélocité décision" : "Decision velocity"}</CardTitle>
                <CardDescription>
                  {isFr
                    ? "Time-to-value < 3 mois → privilégier l'option packagée. Roadmap > 6 mois → l'option custom devient pertinente."
                    : "Time-to-value < 3 months → prefer the packaged option. Roadmap > 6 months → custom becomes relevant."}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Container>
      </Section>
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
    </>
  );
}
