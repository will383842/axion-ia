import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles, Compass, FlaskConical, Lightbulb } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { FormationContactBand } from "@/components/services/formation/FormationContactBand";
import { FormationSubPageExtras } from "@/components/services/formation/FormationSubPageExtras";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  ESSENTIELLE_TIERS,
  RESERVATION_STEPS_FR,
  RESERVATION_STEPS_EN,
  getIntervention,
} from "@/content/interventions";
// SSOT pricing — sous-tranches Essentielle (690/890/1490) pour offres JSON-LD.
import { ESSENTIELLE_SUB_TIERS } from "@/content/pricing";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildImageGraphJsonLd,
  buildHowToJsonLd,
  buildCourseJsonLd,
  SITE_URL,
} from "@/lib/seo";

// ESSENTIELLE_TIERS importé de content/interventions.ts (source unique).

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const intervention = getIntervention("essentielle");
  const c = intervention[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? intervention.pathFr : intervention.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: intervention.pathFr, en: intervention.pathEn },
  });
}

export default async function Essentielle({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;

  const intervention = getIntervention("essentielle");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;

  const isFr = loc === "fr";

  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « formation IA essentielle TPE PME », « journée IA découverte entreprise ».
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — journée découverte IA Essentielle TPE et PME"
          : "Axion-IA team — Essentielle AI discovery day for small businesses and SMEs",
        alt: isFr
          ? "Équipe Axion-IA en journée « Essentielle » — cabinet IA opérationnel français accompagnant TPE et PME (9 h-17 h sur site) avec découverte des outils IA, ateliers pratiques et idées d'automatisations métier."
          : "Axion-IA team in « Essentielle » day — French operational AI consultancy supporting small businesses and SMEs (9 a.m.-5 p.m. on site) with AI tool discovery, hands-on workshops and business automation ideas.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, formateur IA Essentielle"
          : "William — Axion-IA founder, Essentielle AI trainer",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Anime personnellement les journées Essentielle pour équipes TPE et PME — tour d'horizon des outils IA, mises en pratique, premières automatisations à emporter."
          : "Portrait of William, Axion-IA founder. Personally runs Essentielle days for small business and SME teams — AI tool overview, hands-on practice, first automations to take away.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });

  // Service JSON-LD — Sprint harmonisation kit hubs 2026-06-03 (Will). Le
  // Service exposait un prix unique (`copy.priceEur`) alors qu'Essentielle a
  // 3 sous-tranches d'effectif au tarif distinct (690/890/1490, SSOT
  // `ESSENTIELLE_SUB_TIERS`). On construit le Service SANS `priceEur` (qui
  // n'émet qu'une seule Offer) puis on attache un array `offers` dérivé du
  // SSOT — aucun prix en dur, parité avec collectives/un-a-un.
  const baseServiceJsonLd = buildServiceJsonLd({
    locale: loc,
    path,
    name: copy.title,
    description: copy.answer,
    serviceType: "AI consulting",
    area: "Worldwide",
  });
  const serviceUrl = `${SITE_URL}/${loc}${path}`;
  const serviceJsonLd = {
    ...baseServiceJsonLd,
    offers: ESSENTIELLE_SUB_TIERS.map((t) => ({
      "@type": "Offer",
      name: isFr ? t.labelFr : t.labelEn,
      description: isFr ? t.rangeFr : t.rangeEn,
      price: t.priceFlat.toString(),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: serviceUrl,
    })),
  };

  // HowTo JSON-LD « réservation » — parité collectives/un-a-un. Réutilise les
  // étapes SSOT `RESERVATION_STEPS_FR/EN` (5 étapes : réservation → cadrage →
  // acompte → journée → solde).
  const howToReserverJsonLd = buildHowToJsonLd({
    locale: loc,
    path,
    name: isFr
      ? "Comment réserver votre journée Essentielle IA"
      : "How to book your Essentielle AI day",
    description: isFr
      ? "Les étapes pour réserver et dérouler la journée Essentielle IA sur site : réservation au calendrier, call de cadrage, acompte, journée d'intervention puis solde et frais annexes."
      : "The steps to book and run your on-site Essentielle AI day: calendar booking, framing call, deposit, on-site session day, then balance and travel fees.",
    steps: (isFr ? RESERVATION_STEPS_FR : RESERVATION_STEPS_EN).map((s) => ({
      name: s.title,
      text: s.description,
    })),
  });

  // Course JSON-LD — Essentielle est une formation 1 jour. Miroir du pattern
  // collectives (provider Organization, hasCourseInstance Onsite, Offer prix
  // SSOT = tranche d'entrée 690 €). Permet la citation AEO « formation IA
  // découverte 1 jour ».
  const courseJsonLd = buildCourseJsonLd({
    locale: loc,
    path,
    name: copy.title,
    description: copy.answer,
    courseMode: ["Onsite"],
    duration: "PT8H",
    audienceType: isFr
      ? "Équipes TPE et PME, tous métiers — découverte de l'IA opérationnelle (B2B)"
      : "Small business and SME teams, all roles — operational AI discovery (B2B)",
    about: "IA opérationnelle (ChatGPT, Claude, Copilot, Gemini, automatisations métier)",
    priceEurHt: ESSENTIELLE_SUB_TIERS[0]!.priceFlat,
  });

  const jsonLd = [
    serviceJsonLd,
    buildFaqJsonLd({ items: copy.faqs }),
    imagesJsonLd,
    howToReserverJsonLd,
    courseJsonLd,
  ];
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
    },
    { href: "/interventions/essentielle", label: copy.title },
  ];

  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? "Une journée type" : "A typical day"}
      title={isFr ? "Découvrir l'IA en 1 journée" : "Discover AI in 1 day"}
      accent="primary"
      blocks={[
        {
          icon: Compass,
          prefix: isFr ? "Matin" : "Morning",
          label: isFr ? "Découverte des outils" : "Tool discovery",
          detail: isFr
            ? "ChatGPT, Claude, Copilot, Gemini : à quoi ils servent et quand les choisir."
            : "ChatGPT, Claude, Copilot, Gemini: what they do and when to pick each.",
        },
        {
          icon: FlaskConical,
          prefix: isFr ? "Midi" : "Noon",
          label: isFr ? "Ateliers pratiques" : "Hands-on workshops",
          detail: isFr
            ? "Rédaction, recherche, analyse, synthèse — sur leurs vraies tâches métier."
            : "Writing, research, analysis, synthesis — on their real business tasks.",
        },
        {
          icon: Lightbulb,
          prefix: isFr ? "Après-midi" : "Afternoon",
          label: isFr ? "Idées d'usages" : "Usage ideas",
          detail: isFr
            ? "5 à 10 usages applicables repérés + boîte à outils remise en fin de journée."
            : "5 to 10 applicable uses spotted + toolbox handed over at end of day.",
        },
      ]}
      ariaLabel={
        isFr
          ? "Schéma : journée type Essentielle — matin découverte des outils IA, midi ateliers pratiques, après-midi idées d'usages applicables."
          : "Diagram: typical Essentielle day — morning AI tool discovery, noon hands-on workshops, afternoon applicable usage ideas."
      }
    />
  );

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <ProductPageTemplate
        isFr={isFr}
        accent="primary"
        copy={copy}
        ctaPrimaryHref="/reserver?intervention=essentielle"
        ctaSecondaryHref="/cas-concrets"
        heroSchema={heroSchema}
        midBand={<FormationContactBand isFr={isFr} />}
        jsonLd={jsonLd}
      />
      {/* Section 3 tranches — bloc de différenciation tarifaire après le CTA mocha.
          Un même produit (Essentielle), 3 tarifs distincts selon l'effectif. */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Choisissez votre tranche" : "Pick your tier"}
        title={isFr ? "3 tarifs selon" : "3 prices for"}
        titleEm={isFr ? "votre effectif" : "your headcount"}
        description={
          isFr
            ? "Programme identique pour les 3 tranches. Le prix dépend uniquement du nombre de participants présents à la journée."
            : "Same programme for all 3 tiers. Price depends only on the number of participants on the day."
        }
      >
        <Container className="max-w-5xl">
          <ul className="grid gap-5 sm:gap-6 lg:grid-cols-3">
            {ESSENTIELLE_TIERS.map((t) => {
              const label = isFr ? t.labelFr : t.labelEn;
              const size = isFr ? t.sizeFr : t.sizeEn;
              return (
                <li key={t.id} className="relative">
                  {t.isFeatured ? (
                    <span className="bg-terracotta text-mocha-fg shadow-subtle absolute -top-3 left-6 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase">
                      <Sparkles aria-hidden="true" className="h-3 w-3" />★{" "}
                      {isFr ? "Recommandé" : "Recommended"}
                    </span>
                  ) : null}
                  <article
                    className={`bg-paper hover:shadow-card relative flex h-full flex-col rounded-3xl border-2 p-7 transition-all lg:p-8 ${
                      t.isFeatured
                        ? "border-terracotta shadow-card"
                        : "border-border-strong hover:border-terracotta"
                    }`}
                  >
                    <p className="text-fg-muted text-[12px] font-bold tracking-[0.16em] uppercase">
                      {label}
                    </p>
                    <p
                      className="text-fg mt-4 text-[clamp(2.5rem,5vw,3.5rem)] leading-none font-medium tracking-tight tabular-nums"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {t.priceEur} <span className="text-terracotta italic">€</span>
                    </p>
                    <p className="text-fg-muted mt-1 text-xs">{isFr ? "HT" : "excl. VAT"}</p>
                    <p className="text-fg mt-4 text-base leading-snug font-semibold">{size}</p>
                    <p className="text-fg-soft mt-3 text-base leading-relaxed">
                      {isFr
                        ? "Une journée sur site (9 h – 17 h). Découverte des outils IA, ateliers pratiques, idées d'automatisations."
                        : "One day on site (9 a.m. – 5 p.m.). AI tool discovery, hands-on workshops, automation ideas."}
                    </p>
                    <div className="mt-auto pt-6">
                      <Cta
                        href={`/reserver?intervention=essentielle&tier=${t.id}`}
                        size="lg"
                        className="w-full justify-center"
                      >
                        {isFr ? "Réserver à ce tarif" : "Book at this price"}
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Cta>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>
      <FormationSubPageExtras isFr={isFr} slug="essentielle" />
    </>
  );
}
