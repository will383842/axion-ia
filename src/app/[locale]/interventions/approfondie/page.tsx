import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Layers, Sparkles, Target, Wrench } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { FormationContactBand } from "@/components/services/formation/FormationContactBand";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { APPROFONDIE_TIERS, getIntervention } from "@/content/interventions";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildImageGraphJsonLd,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const intervention = getIntervention("approfondie");
  const c = intervention[locale as Locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? intervention.pathFr : intervention.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: intervention.pathFr, en: intervention.pathEn },
  });
}

export default async function Approfondie({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const intervention = getIntervention("approfondie");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;
  const isFr = loc === "fr";
  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « formation IA approfondie 2 jours », « co-construction automatisations IA TPE PME ».
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — formation IA Approfondie 2 jours sur site"
          : "Axion-IA team — Approfondie 2-day on-site AI training",
        alt: isFr
          ? "Équipe Axion-IA en session « Approfondie » 2 jours — cabinet IA opérationnel français accompagnant TPE et PME pour co-construire 10 à 20 automatisations IA sur leurs vrais outils métier, avec plan d'action 30 jours."
          : "Axion-IA team in « Approfondie » 2-day session — French operational AI consultancy supporting small businesses and SMEs to co-build 10 to 20 AI automations on their real domain tools, with 30-day action plan.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, formateur IA Approfondie"
          : "William — Axion-IA founder, Approfondie AI trainer",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Anime personnellement les sessions « Approfondie » pour équipes TPE et PME — panorama IA jour 1, co-construction d'automatisations jour 2, plan d'action 30 jours partagé."
          : "Portrait of William, Axion-IA founder. Personally runs « Approfondie » sessions for small business and SME teams — AI panorama day 1, automation co-build day 2, shared 30-day action plan.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI deep-dive training (2 days)",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    imagesJsonLd,
  ];
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
    },
    { href: "/interventions/approfondie", label: copy.title },
  ];
  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? "2 journées consécutives" : "2 consecutive days"}
      title={isFr ? "Aller au fond en 2 jours" : "Go deep in 2 days"}
      accent="primary"
      blocks={[
        {
          icon: Layers,
          prefix: isFr ? "Jour 1" : "Day 1",
          label: isFr ? "Panorama + ateliers" : "Panorama + workshops",
          detail: isFr
            ? "Découverte des outils IA + ateliers pratiques sur leurs vraies tâches métier."
            : "AI tools panorama + hands-on workshops on their real domain tasks.",
        },
        {
          icon: Wrench,
          prefix: isFr ? "Jour 2" : "Day 2",
          label: isFr ? "Co-construction" : "Co-build",
          detail: isFr
            ? "10 à 20 automatisations construites en direct sur vos vrais outils métier."
            : "10 to 20 automations built live on your real domain tools.",
        },
        {
          icon: Target,
          prefix: isFr ? "Fin J2" : "End D2",
          label: isFr ? "Plan d'action 30 jours" : "30-day action plan",
          detail: isFr
            ? "Plan partagé : qui fait quoi, quand, avec quels outils, quels gains attendus."
            : "Shared plan: who does what, when, which tools, expected gains.",
        },
      ]}
      ariaLabel={
        isFr
          ? "Schéma : Approfondie 2 jours — Jour 1 panorama et ateliers, Jour 2 co-construction d'automatisations, fin du jour 2 plan d'action 30 jours partagé."
          : "Diagram: Deep Dive 2 days — Day 1 panorama and workshops, Day 2 automation co-build, end of day 2 shared 30-day action plan."
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
        ctaPrimaryHref="/reserver?intervention=approfondie"
        ctaSecondaryHref="/interventions/essentielle"
        heroSchema={heroSchema}
        midBand={<FormationContactBand isFr={isFr} />}
        jsonLd={jsonLd}
      />
      {/* Section 3 tranches — miroir de la page Essentielle. Will (audit
          /interventions 2026-05-12) — Approfondie partage la même grille
          d'effectif que l'Essentielle (2-8 / 9-15 / 16-30 personnes) mais
          des prix différents (cf. pricing.ts APPROFONDIE_SUB_TIERS). Avant
          cette section, la page n'exposait aucun palier visible et le
          calendrier facturait systématiquement le palier minimum. */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Choisissez votre tranche" : "Pick your tier"}
        title={isFr ? "3 tarifs selon" : "3 prices for"}
        titleEm={isFr ? "votre effectif" : "your headcount"}
        description={
          isFr
            ? "Programme identique pour les 3 tranches. Le prix dépend uniquement du nombre de participants présents sur les 2 jours."
            : "Same programme for all 3 tiers. Price depends only on the number of participants on the 2 days."
        }
      >
        <Container className="max-w-5xl">
          <ul className="grid gap-5 sm:gap-6 lg:grid-cols-3">
            {APPROFONDIE_TIERS.map((t) => {
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
                        ? "2 jours consécutifs sur site (9 h – 17 h). Co-construction de 10 à 20 automatisations + plan d'action 30 jours."
                        : "2 consecutive on-site days (9 a.m. – 5 p.m.). 10 to 20 automations co-built + 30-day action plan."}
                    </p>
                    <div className="mt-auto pt-6">
                      <Cta
                        href={`/reserver?intervention=approfondie&tier=${t.id}`}
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
    </>
  );
}
