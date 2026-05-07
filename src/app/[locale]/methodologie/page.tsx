import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { MethodologyHeroSchema } from "@/components/sections/MethodologyHeroSchema";
import { Illustration } from "@/components/visual/Illustration";
import { buildProductMetadata, buildBreadcrumbJsonLd, buildHowToJsonLd, SITE_URL } from "@/lib/seo";

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

  // HowTo JSON-LD — AEO 2026 critical : Google AI Overviews + Perplexity
  // citent les HowTo schemas pour répondre aux requêtes « comment AxionIA
  // procède ? », « quelles étapes pour un audit IA ? », etc.
  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/methodologie",
    name: isFr
      ? "Méthodologie AxionIA · 4 étapes vers le ROI"
      : "AxionIA methodology · 4 steps to ROI",
    description: isFr
      ? "Notre méthode propriétaire en 4 étapes : identifier sur le terrain, auditer en 5 jours, implémenter en 6-8 semaines, mesurer le ROI réel."
      : "Our proprietary 4-step method: identify in the field, audit in 5 days, implement in 6-8 weeks, measure real ROI.",
    totalTime: "P12W",
    estimatedCost: { currency: "EUR", value: "490" },
    steps: isFr
      ? [
          {
            name: "Identifier",
            text: "Cartographie terrain en 1 journée d'intervention sur site. 3-5 process candidats à l'IA, démos live sur vos données anonymisées, identification des quick-wins déployables sous 30 jours.",
          },
          {
            name: "Auditer",
            text: "Audit IA en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation chiffré priorisé. Livrable PDF 25-40 pages + atelier de restitution.",
          },
          {
            name: "Implémenter",
            text: "Mise en production en 6-8 semaines : cadrage technique, prototype itératif, tests utilisateurs, déploiement progressif, support 30 jours inclus.",
          },
          {
            name: "Mesurer",
            text: "Mesure du ROI réel post-déploiement : heures économisées, coût économisé, impact qualitatif. Itération si dérive de qualité observée.",
          },
        ]
      : [
          {
            name: "Identify",
            text: "Field mapping in 1 day on-site session. 3-5 candidate processes for AI, live demos on your anonymised data, identification of quick-wins deployable within 30 days.",
          },
          {
            name: "Audit",
            text: "5-day AI audit: complete mapping, ROI/complexity scoring per opportunity, costed prioritised implementation plan. 25-40 page PDF deliverable + debrief workshop.",
          },
          {
            name: "Implement",
            text: "Production deployment in 6-8 weeks: technical scoping, iterative prototype, user testing, progressive rollout, 30-day support included.",
          },
          {
            name: "Measure",
            text: "Real ROI measurement post-deployment: hours saved, cost saved, qualitative impact. Iteration if quality drift is observed.",
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
          p: "Audit IA en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation chiffré priorisé. Livrable PDF 25-40 pages + atelier de restitution.",
        },
        {
          n: "03",
          h: "Implémenter",
          p: "Mise en production en 6-8 semaines : cadrage technique, prototype itératif, tests utilisateurs, déploiement progressif, support 30 jours inclus. Stack open-source ou propriétaire selon le cas.",
        },
        {
          n: "04",
          h: "Mesurer",
          p: "Mesure du ROI réel post-déploiement : heures économisées, coût économisé, impact qualitatif. Itération si dérive de qualité observée. Pas d'engagement long terme.",
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
          p: "5-day AI audit: complete mapping, ROI/complexity scoring per opportunity, costed prioritised implementation plan. 25-40 page PDF deliverable + debrief workshop.",
        },
        {
          n: "03",
          h: "Implement",
          p: "Production deployment in 6-8 weeks: technical scoping, iterative prototype, user testing, progressive go-live, 30-day support included. Open-source or proprietary stack as needed.",
        },
        {
          n: "04",
          h: "Measure",
          p: "Real ROI measurement post-deployment: hours saved, costs saved, qualitative impact. Iteration if quality drift observed. No long-term commitment.",
        },
      ];

  const whyMethodology = isFr
    ? [
        {
          h: "Sur vos données, pas sur des démos vendeur",
          p: "Chaque étape s'appuie sur vos process réels, vos outils, vos chiffres. On démontre, on ne raconte pas.",
        },
        {
          h: "Découplée du contrat long",
          p: "Vous pouvez vous arrêter après l'audit, après l'implémentation, après la mesure. Aucun lock-in technique ni commercial.",
        },
        {
          h: "Mesurée, pas promise",
          p: "Le ROI est calculé sur des indicateurs convenus avant le déploiement, pas sur des projections marketing.",
        },
      ]
    : [
        {
          h: "On your data, not on vendor demos",
          p: "Every step uses your real processes, tools and numbers. We demonstrate — we don't pitch.",
        },
        {
          h: "Decoupled from long contracts",
          p: "You can stop after the audit, after deployment, after measurement. Zero technical or commercial lock-in.",
        },
        {
          h: "Measured, not promised",
          p: "ROI is calculated on indicators agreed before deployment, not on marketing projections.",
        },
      ];

  return (
    <>
      {/* HERO — layout 2 colonnes (text + flow narratif méthodologie). */}
      <section className="bg-halo-warm text-fg relative py-20 sm:py-24 lg:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, white 15%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 15%, transparent 70%)",
            opacity: 0.1,
          }}
        />
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche — eyebrow + titre + description + CTA */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Méthodologie" : "Methodology"}
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "4 étapes vers le " : "4 steps to "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "ROI mesurable" : "measurable ROI"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Méthodologie AxionIA, éprouvée sur 50+ entreprises de la TPE au mid-market. On démontre sur vos données, pas sur des démos vendeur."
                  : "AxionIA methodology, proven on 50+ companies from small business to mid-market. We demonstrate on your data, not vendor demos."}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="/audit" size="lg">
                  {isFr ? "Voir les 4 niveaux d'audit" : "See the 4 audit levels"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/cas-concrets" variant="outline" size="lg">
                  {isFr ? "Voir les cas concrets" : "See case studies"}
                </Cta>
              </div>
            </div>

            {/* Colonne droite — flow narratif méthodologie 4 étapes */}
            <MethodologyHeroSchema
              isFr={isFr}
              className="relative mx-auto w-full max-w-xl lg:mx-0"
              ariaLabel={
                isFr
                  ? "Schéma méthodologie AxionIA : votre entreprise au départ, 4 étapes méthodologiques (Identifier, Auditer, Implémenter, Mesurer), puis 4 résultats concrets (plan chiffré, process automatisés, équipes formées, ROI mesuré)."
                  : "AxionIA methodology diagram: your company at the start, 4 method steps (Identify, Audit, Implement, Measure), then 4 concrete outcomes (costed plan, automated processes, trained teams, measured ROI)."
              }
            />
          </div>
        </Container>
      </section>

      {/* SECTION — détail des 4 étapes */}
      <Section
        eyebrow={isFr ? "Le détail" : "In detail"}
        title={isFr ? "Comment se déroule" : "How it"}
        titleEm={isFr ? "concrètement" : "actually unfolds"}
        description={
          isFr
            ? "Quatre temps clairement séparés. Chacun produit un livrable concret. Chacun peut être le dernier."
            : "Four clearly separated phases. Each produces a concrete deliverable. Each can be the last."
        }
      >
        <Container>
          <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="space-y-3">
                <p className="text-primary font-mono text-2xl tabular-nums">{s.n}</p>
                <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                  {s.h}
                </h2>
                <p className="text-fg-soft text-base leading-relaxed">{s.p}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* SECTION — Pourquoi cette méthodologie (extension copy +300 mots) */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Notre parti pris" : "Our principle"}
        title={isFr ? "Pourquoi" : "Why this"}
        titleEm={isFr ? "cette méthode" : "method"}
        description={
          isFr
            ? "Trois principes non-négociables qui guident chaque mission AxionIA, du diagnostic flash à l'audit stratégique ETI."
            : "Three non-negotiable principles guiding every AxionIA engagement, from flash diagnosis to strategic mid-cap audit."
        }
      >
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
            {/* Visuel placeholder à gauche en lg, en haut en mobile */}
            <Illustration
              slot="METHO-02-mid"
              aspectRatio="1:1"
              filenameTarget="public/illustrations/methodologie-mid-1.avif"
              caption={
                isFr
                  ? "Compas d'architecte sur feuille gridée — précision opérationnelle"
                  : "Architect's compass on gridded paper — operational precision"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'un compas d'architecte au-dessus d'une feuille gridée, symbole de la précision méthodologique d'AxionIA."
                  : "Editorial illustration of an architect's compass over gridded paper, symbol of AxionIA's methodological precision."
              }
              className="border-terracotta/30 bg-halo-warm shadow-subtle relative w-full overflow-hidden rounded-2xl border-2 border-dashed lg:sticky lg:top-24"
            />
            {/* Liste des 3 principes à droite */}
            <ol className="space-y-7">
              {whyMethodology.map((w, i) => (
                <li key={w.h} className="flex gap-5">
                  <span
                    aria-hidden="true"
                    className="text-terracotta-deep shrink-0 font-mono text-lg tracking-[0.12em] tabular-nums"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                      {w.h}
                    </h3>
                    <p className="text-fg-soft mt-3 text-base leading-relaxed sm:text-lg">{w.p}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      {/* SECTION — closing visual avant CtaBlock */}
      <Section tone="canvas">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Illustration
              slot="METHO-04-closing"
              aspectRatio="16:9"
              filenameTarget="public/illustrations/methodologie-closing.avif"
              caption={
                isFr
                  ? "Cycle continu — la méthode appliquée, ronde mais pas répétitive"
                  : "Continuous cycle — method applied, looping but not repeating"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'un cycle continu représentant la méthodologie AxionIA appliquée dans la durée."
                  : "Editorial illustration of a continuous cycle representing the AxionIA methodology applied over time."
              }
            />
          </div>
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
      <JsonLd data={howToJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
