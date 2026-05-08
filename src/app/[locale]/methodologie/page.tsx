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
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildHowToJsonLd, SITE_URL } from "@/lib/seo";

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
        ? "MÃ©thodologie AxionIA Â· 4 Ã©tapes vers le ROI"
        : "AxionIA methodology Â· 4 steps to ROI",
    description:
      locale === "fr"
        ? "Notre mÃ©thodologie : audit terrain, dÃ©mos appliquÃ©es, plan chiffrÃ©, implÃ©mentation pilotÃ©e."
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
      ? "MÃ©thodologie AxionIA Â· 4 Ã©tapes vers le ROI"
      : "AxionIA methodology Â· 4 steps to ROI",
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/methodologie`,
    publisher: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
  } as const;

  // Breadcrumb visuel + JSON-LD intÃ©grÃ© (composant unique). L'item "Accueil"
  // est ajoutÃ© automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/methodologie", label: isFr ? "MÃ©thodologie" : "Methodology" },
  ];

  // HowTo JSON-LD â€” AEO 2026 critical : Google AI Overviews + Perplexity
  // citent les HowTo schemas pour rÃ©pondre aux requÃªtes Â« comment AxionIA
  // procÃ¨de ? Â», Â« quelles Ã©tapes pour un audit IA ? Â», etc.
  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/methodologie",
    name: isFr
      ? "MÃ©thodologie AxionIA Â· 4 Ã©tapes vers le ROI"
      : "AxionIA methodology Â· 4 steps to ROI",
    description: isFr
      ? "Notre mÃ©thode propriÃ©taire en 4 Ã©tapes : identifier sur le terrain, auditer en 5 jours, implÃ©menter en 6-8 semaines, mesurer le ROI rÃ©el."
      : "Our proprietary 4-step method: identify in the field, audit in 5 days, implement in 6-8 weeks, measure real ROI.",
    totalTime: "P12W",
    estimatedCost: { currency: "EUR", value: "490" },
    steps: isFr
      ? [
          {
            name: "Identifier",
            text: "Cartographie terrain en 1 journÃ©e d'intervention sur site. 3-5 process candidats Ã  l'IA, dÃ©mos live sur vos donnÃ©es anonymisÃ©es, identification des quick-wins dÃ©ployables sous 30 jours.",
          },
          {
            name: "Auditer",
            text: "Audit IA en 5 jours : cartographie complÃ¨te, scoring ROI/complexitÃ© par opportunitÃ©, plan d'implÃ©mentation chiffrÃ© priorisÃ©. Livrable PDF 25-40 pages + atelier de restitution.",
          },
          {
            name: "ImplÃ©menter",
            text: "Mise en production en 6-8 semaines : cadrage technique, prototype itÃ©ratif, tests utilisateurs, dÃ©ploiement progressif, support 30 jours inclus.",
          },
          {
            name: "Mesurer",
            text: "Mesure du ROI rÃ©el post-dÃ©ploiement : heures Ã©conomisÃ©es, coÃ»t Ã©conomisÃ©, impact qualitatif. ItÃ©ration si dÃ©rive de qualitÃ© observÃ©e.",
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
          p: "Cartographie terrain en 1 journÃ©e d'intervention sur site. 3-5 process candidats Ã  l'IA, dÃ©mos live sur vos donnÃ©es anonymisÃ©es, identification des quick-wins dÃ©ployables sous 30 jours.",
        },
        {
          n: "02",
          h: "Auditer",
          p: "Audit IA en 5 jours : cartographie complÃ¨te, scoring ROI/complexitÃ© par opportunitÃ©, plan d'implÃ©mentation chiffrÃ© priorisÃ©. Livrable PDF 25-40 pages + atelier de restitution.",
        },
        {
          n: "03",
          h: "ImplÃ©menter",
          p: "Mise en production en 6-8 semaines : cadrage technique, prototype itÃ©ratif, tests utilisateurs, dÃ©ploiement progressif, support 30 jours inclus. Stack open-source ou propriÃ©taire selon le cas.",
        },
        {
          n: "04",
          h: "Mesurer",
          p: "Mesure du ROI rÃ©el post-dÃ©ploiement : heures Ã©conomisÃ©es, coÃ»t Ã©conomisÃ©, impact qualitatif. ItÃ©ration si dÃ©rive de qualitÃ© observÃ©e. Pas d'engagement long terme.",
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
          h: "Sur vos donnÃ©es, pas sur des dÃ©mos vendeur",
          p: "Chaque Ã©tape s'appuie sur vos process rÃ©els, vos outils, vos chiffres. On dÃ©montre, on ne raconte pas.",
        },
        {
          h: "DÃ©couplÃ©e du contrat long",
          p: "Vous pouvez vous arrÃªter aprÃ¨s l'audit, aprÃ¨s l'implÃ©mentation, aprÃ¨s la mesure. Aucun lock-in technique ni commercial.",
        },
        {
          h: "MesurÃ©e, pas promise",
          p: "Le ROI est calculÃ© sur des indicateurs convenus avant le dÃ©ploiement, pas sur des projections marketing.",
        },
      ]
    : [
        {
          h: "On your data, not on vendor demos",
          p: "Every step uses your real processes, tools and numbers. We demonstrate â€” we don't pitch.",
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
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO â€” layout 2 colonnes (text + flow narratif mÃ©thodologie). */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
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
            {/* Colonne gauche â€” eyebrow + titre + description + CTA */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "MÃ©thodologie" : "Methodology"}
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "4 Ã©tapes vers le " : "4 steps to "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "ROI mesurable" : "measurable ROI"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "MÃ©thodologie AxionIA, Ã©prouvÃ©e sur 50+ entreprises de la TPE au mid-market. On dÃ©montre sur vos donnÃ©es, pas sur des dÃ©mos vendeur."
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

            {/* Colonne droite â€” flow narratif mÃ©thodologie 4 Ã©tapes */}
            <MethodologyHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "SchÃ©ma mÃ©thodologie AxionIA : votre entreprise au dÃ©part, 4 Ã©tapes mÃ©thodologiques (Identifier, Auditer, ImplÃ©menter, Mesurer), puis 4 rÃ©sultats concrets (plan chiffrÃ©, process automatisÃ©s, Ã©quipes formÃ©es, ROI mesurÃ©)."
                  : "AxionIA methodology diagram: your company at the start, 4 method steps (Identify, Audit, Implement, Measure), then 4 concrete outcomes (costed plan, automated processes, trained teams, measured ROI)."
              }
            />
          </div>
        </Container>
      </section>

      {/* SECTION â€” dÃ©tail des 4 Ã©tapes */}
      <Section
        eyebrow={isFr ? "Le dÃ©tail" : "In detail"}
        title={isFr ? "Comment se dÃ©roule" : "How it"}
        titleEm={isFr ? "concrÃ¨tement" : "actually unfolds"}
        description={
          isFr
            ? "Quatre temps clairement sÃ©parÃ©s. Chacun produit un livrable concret. Chacun peut Ãªtre le dernier."
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

      {/* SECTION â€” Pourquoi cette mÃ©thodologie (extension copy +300 mots) */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Notre parti pris" : "Our principle"}
        title={isFr ? "Pourquoi" : "Why this"}
        titleEm={isFr ? "cette mÃ©thode" : "method"}
        description={
          isFr
            ? "Trois principes non-nÃ©gociables qui guident chaque mission AxionIA, du diagnostic flash Ã  l'audit stratÃ©gique ETI."
            : "Three non-negotiable principles guiding every AxionIA engagement, from flash diagnosis to strategic mid-cap audit."
        }
      >
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
            {/* Visuel placeholder Ã  gauche en lg, en haut en mobile */}
            <Illustration
              slot="METHO-02-mid"
              aspectRatio="1:1"
              filenameTarget="public/illustrations/methodologie-mid-1.avif"
              caption={
                isFr
                  ? "Compas d'architecte sur feuille gridÃ©e â€” prÃ©cision opÃ©rationnelle"
                  : "Architect's compass on gridded paper â€” operational precision"
              }
              alt={
                isFr
                  ? "Illustration Ã©ditoriale d'un compas d'architecte au-dessus d'une feuille gridÃ©e, symbole de la prÃ©cision mÃ©thodologique d'AxionIA."
                  : "Editorial illustration of an architect's compass over gridded paper, symbol of AxionIA's methodological precision."
              }
              className="border-terracotta/30 bg-halo-warm shadow-subtle relative w-full overflow-hidden rounded-2xl border-2 border-dashed lg:sticky lg:top-24"
            />
            {/* Liste des 3 principes Ã  droite */}
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

      {/* SECTION â€” closing visual avant CtaBlock */}
      <Section tone="canvas">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Illustration
              slot="METHO-04-closing"
              aspectRatio="16:9"
              filenameTarget="public/illustrations/methodologie-closing.avif"
              caption={
                isFr
                  ? "Cycle continu â€” la mÃ©thode appliquÃ©e, ronde mais pas rÃ©pÃ©titive"
                  : "Continuous cycle â€” method applied, looping but not repeating"
              }
              alt={
                isFr
                  ? "Illustration Ã©ditoriale d'un cycle continu reprÃ©sentant la mÃ©thodologie AxionIA appliquÃ©e dans la durÃ©e."
                  : "Editorial illustration of a continuous cycle representing the AxionIA methodology applied over time."
              }
            />
          </div>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "PrÃªt Ã  dÃ©marrer ?" : "Ready to start?"}
        description={
          isFr
            ? "RÃ©servez l'Essentielle 490 â‚¬ pour identifier 3-5 quick-wins en une journÃ©e."
            : "Book the Essential â‚¬490 to identify 3-5 quick-wins in one day."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle 490 â‚¬" : "See the Essential â‚¬490"} â†’
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={articleJsonLd} />
      <JsonLd data={howToJsonLd} />
    </>
  );
}
