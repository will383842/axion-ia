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
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/methodologie",
    title:
      locale === "fr"
        ? "Méthodologie AxionIA · 4 étapes vers le ROI"
        : "AxionIA methodology · 4 steps to ROI",
    description:
      locale === "fr"
        ? "Notre méthodologie : audit terrain, démos appliquées, plan chiffré, implémentation pilotée."
        : "Our methodology: field audit, applied demos, costed plan, piloted implementation.",
    alternates: { fr: "/methodologie", en: "/methodology" },
  });
}

export default async function MethodologyPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: isFr
      ? "Méthodologie AxionIA · 4 étapes vers le ROI"
      : "AxionIA methodology · 4 steps to ROI",
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/methodologie`,
    publisher: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      {
        name: isFr ? "Méthodologie" : "Methodology",
        href: "/methodologie",
      },
    ],
  });

  const steps = isFr
    ? [
        {
          n: "01",
          h: "Identifier",
          p: "Cartographie terrain en 1 journée d'intervention sur site. 3-5 process candidats à l'IA, démos live sur vos données anonymisées, identification des quick-wins déployables sous 30 jours.",
        },
        {
          n: "02",
          h: "Auditer",
          p: "Audit IA en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation 90 jours chiffré. Livrable PDF 25-40 pages + atelier de restitution.",
        },
        {
          n: "03",
          h: "Implémenter",
          p: "Mise en production en 6-8 semaines : cadrage technique, prototype itératif, tests utilisateurs, déploiement progressif, support 30 jours inclus. Stack open-source ou propriétaire selon le cas.",
        },
        {
          n: "04",
          h: "Mesurer",
          p: "Mesure du ROI réel sur 90 jours post-déploiement : heures économisées, coût économisé, impact qualitatif. Itération si dérive de qualité observée. Pas d'engagement long terme.",
        },
      ]
    : [
        {
          n: "01",
          h: "Identify",
          p: "Field mapping in 1 day on-site session. 3-5 candidate processes for AI, live demos on your anonymised data, identification of quick-wins deployable within 30 days.",
        },
        {
          n: "02",
          h: "Audit",
          p: "5-day AI audit: complete mapping, ROI/complexity scoring per opportunity, costed 90-day implementation plan. 25-40 page PDF deliverable + debrief workshop.",
        },
        {
          n: "03",
          h: "Implement",
          p: "Production deployment in 6-8 weeks: technical scoping, iterative prototype, user testing, progressive go-live, 30-day support included. Open-source or proprietary stack as needed.",
        },
        {
          n: "04",
          h: "Measure",
          p: "Real ROI measurement over 90 days post-deployment: hours saved, costs saved, qualitative impact. Iteration if quality drift observed. No long-term commitment.",
        },
      ];

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Méthodologie" : "Methodology"}
        title={isFr ? "4 étapes vers le ROI mesurable" : "4 steps to measurable ROI"}
        description={
          isFr
            ? "Méthodologie AxionIA, éprouvée sur 50+ entreprises de la TPE au mid-market."
            : "AxionIA methodology, proven on 50+ companies from small business to mid-market."
        }
      />

      <Section>
        <Container>
          <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="space-y-3">
                <p className="text-primary font-mono text-2xl tabular-nums">{s.n}</p>
                <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                  {s.h}
                </h2>
                <p className="text-base leading-relaxed text-gray-700">{s.p}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Prêt à démarrer ?" : "Ready to start?"}
        description={
          isFr
            ? "Réservez l'Essentielle 490 € pour identifier 3-5 quick-wins en une journée."
            : "Book the Essential €490 to identify 3-5 quick-wins in one day."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle 490 €" : "See the Essential €490"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
