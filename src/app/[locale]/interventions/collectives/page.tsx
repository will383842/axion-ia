import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Users, Clock, Sparkles } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  COLLECTIVE_DURATIONS,
  countFormatsByCell,
  durationPath,
  quoteContactPath,
  getFamily,
} from "@/content/interventions-taxonomy";
import { INTERVENTION_TIERS, formatAmount, getEntryPriceEur, getTierById } from "@/content/pricing";
import { buildProductMetadata, buildServiceJsonLd, SITE_URL } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";

// ============================================================================
// Sprint 14.10.7 (2026-05-11) — page famille « Formations équipe ».
//
// 4 paliers durée : 4 h / 1 jour / 2 jours / 3 jours et plus (devis).
// Compteur dynamique par palier dérivé de `INTERVENTION_FORMATS`. Quand Will
// ajoute une formation dans la taxonomie, le palier correspondant incrémente.
// ============================================================================

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const essentielle = getTierById(INTERVENTION_TIERS, "intervention-essentielle");
  const essentiellePrice = formatAmount(essentielle.priceFlat!, loc);
  return buildProductMetadata({
    locale,
    path: "/interventions/collectives",
    title:
      loc === "fr"
        ? "Formations IA équipe · 4 durées · de 4 heures à 3 jours+"
        : "Team AI trainings · 4 durations · from 4 hours to 3 days+",
    description:
      loc === "fr"
        ? `Formations IA opérationnelles pour vos équipes sur site, organisées en 4 paliers durée : 4 heures, 1 jour (dès ${essentiellePrice}), 2 jours, 3 jours et plus (sur devis). 2 à 30+ personnes.`
        : `Operational AI trainings for your teams on site, organised in 4 duration tiers: 4 hours, 1 day (from ${essentiellePrice}), 2 days, 3 days+ (on request). 2 to 30+ people.`,
  });
}

export default async function CollectivesFamilyHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const family = getFamily("collectives");

  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions" : "Sessions",
    },
    {
      href: "/interventions/collectives",
      label: isFr ? family.labelFr : family.labelEn,
    },
  ];

  const essentielleEntry = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    loc,
  );

  // Détail de chaque palier durée pour affichage en grid.
  const durationRows = COLLECTIVE_DURATIONS.map((d) => {
    const count = countFormatsByCell("collectives", d.id);
    const href = d.isQuoteOnly ? quoteContactPath(d, loc) : durationPath(d, loc);
    let metaFr: string;
    let metaEn: string;
    if (d.isQuoteOnly) {
      metaFr = "Sur devis — cadrage personnalisé";
      metaEn = "On request — bespoke framing";
    } else if (count === 0) {
      metaFr = "Formations en préparation";
      metaEn = "Trainings coming soon";
    } else if (count === 1) {
      metaFr = "1 formation disponible";
      metaEn = "1 training available";
    } else {
      metaFr = `${count} formations disponibles`;
      metaEn = `${count} trainings available`;
    }
    return {
      duration: d,
      href,
      count,
      metaFr,
      metaEn,
    };
  });

  // Service JSON-LD
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/interventions/collectives",
    name: isFr
      ? "Formations IA équipe · 4 durées · Axion-IA"
      : "Team AI trainings · 4 durations · Axion-IA",
    description: isFr
      ? `Formations IA opérationnelles pour vos équipes sur site, 4 paliers durée de 4 h à 3 j+, dès ${essentielleEntry}.`
      : `Operational AI trainings for your teams on site, 4 duration tiers from 4 h to 3 d+, from ${essentielleEntry}.`,
    serviceType: "AI training",
    priceEur: getEntryPriceEur(INTERVENTION_TIERS) ?? 0,
    areasServed: buildServiceAreasServed(loc),
  });

  // ItemList JSON-LD — 4 items = 4 paliers durée
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Paliers durée — Formations équipe" : "Duration tiers — Team trainings",
    itemListElement: durationRows.map((row, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "Service",
        name: isFr ? row.duration.labelFr : row.duration.labelEn,
        url: `${SITE_URL}/${locale}${row.href}`,
        description: isFr ? row.duration.durationDetailFr : row.duration.durationDetailEn,
      },
    })),
  } as const;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Famille · Formations équipe" : "Family · Team trainings"}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Choisissez la durée " : "Pick the duration "}
              <span
                className="text-terracotta mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "qui vous va" : "that fits you"}
              </span>
            </h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr
                ? `4 paliers durée pour vos formations IA équipe — de la demi-journée express (4 h) à l'immersion longue (3 jours et plus, sur devis). Cliquez sur le palier pour voir les formations disponibles dans cette durée.`
                : `4 duration tiers for your team AI trainings — from express half-day (4 h) to long immersion (3 days+, on request). Click a tier to see the trainings available for that duration.`}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta href="/reserver" size="lg">
                {isFr ? "Réserver sur le calendrier" : "Book on the calendar"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
              <Cta href="/interventions" variant="outline" size="lg">
                {isFr ? "← Retour aux familles" : "← Back to families"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* 4 CARDS PALIER DURÉE */}
      <Section
        eyebrow={isFr ? "Choisir une durée" : "Pick a duration"}
        title={isFr ? "4 paliers durée" : "4 duration tiers"}
        titleEm={isFr ? "selon votre besoin" : "to fit your need"}
        description={
          isFr
            ? "Chaque palier ouvre une page avec les formations disponibles à cette durée. Si la durée que vous voulez n'a pas encore de formation publiée, contactez-nous : on construit du sur-mesure."
            : "Each tier opens a page with the trainings available at that duration. If your preferred duration has no published training yet, get in touch — we build it bespoke."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          {durationRows.map(({ duration: d, href, count, metaFr, metaEn }) => {
            const isQuote = d.isQuoteOnly === true;
            const isEmpty = !isQuote && count === 0;
            return (
              <article
                key={d.id}
                className={cn(
                  "shadow-subtle hover:shadow-card border-border ring-terracotta/10 relative overflow-hidden rounded-3xl border-2 ring-1 transition-shadow",
                  isQuote ? "bg-sand" : "bg-paper",
                )}
              >
                <Link
                  href={href as never}
                  aria-label={`${isFr ? d.labelFr : d.labelEn}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{isFr ? d.labelFr : d.labelEn}</span>
                </Link>

                <span
                  aria-hidden="true"
                  className={cn("block h-1.5 w-full", isQuote ? "bg-sage" : "bg-terracotta")}
                />

                <div className="p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                        isQuote
                          ? "bg-sage-soft text-sage"
                          : "bg-terracotta-soft text-terracotta-deep",
                      )}
                    >
                      <Clock aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
                        isQuote
                          ? "bg-sage-soft text-sage border-sage/30 border"
                          : isEmpty
                            ? "bg-paper border-border text-fg-muted border"
                            : "bg-terracotta-soft text-terracotta-deep border-terracotta/20 border",
                      )}
                    >
                      {d.shortFr}
                    </span>
                  </div>

                  <h2 className="text-fg mt-5 text-xl leading-tight font-semibold">
                    {isFr ? d.labelFr : d.labelEn}
                  </h2>
                  <p className="text-fg-soft mt-2 text-[13.5px] leading-relaxed">
                    {isFr ? d.durationDetailFr : d.durationDetailEn}
                  </p>

                  <div
                    className={cn(
                      "border-border/60 mt-5 flex items-center gap-2 border-t pt-4 text-[13px] font-medium",
                      isEmpty ? "text-fg-muted" : "text-fg",
                    )}
                  >
                    {isQuote ? (
                      <Sparkles aria-hidden="true" className="text-sage h-4 w-4" />
                    ) : (
                      <Users aria-hidden="true" className="text-terracotta-deep h-4 w-4" />
                    )}
                    <span>{isFr ? metaFr : metaEn}</span>
                  </div>

                  <div className="relative z-[2] mt-5">
                    <Link
                      href={href as never}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4",
                        isQuote
                          ? "text-sage hover:text-sage/80"
                          : "text-terracotta-deep hover:text-terracotta",
                      )}
                    >
                      {isQuote
                        ? isFr
                          ? "Demander un devis"
                          : "Request a quote"
                        : isFr
                          ? "Voir les formations"
                          : "See trainings"}
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Pas sûr·e du bon palier ?" : "Not sure which tier?"}
        title={
          isFr ? "On en parle 15 minutes au téléphone" : "Let's chat for 15 minutes on the phone"
        }
        description={
          isFr
            ? "Un appel court pour comprendre votre contexte, vous orienter sur la durée la plus adaptée, et vous expliquer comment ça se passe. Sans engagement."
            : "A short call to understand your context, point you to the right duration, and explain how it works. No commitment."
        }
        cta={
          <Cta href="/contact" size="lg">
            {isFr ? "Demander un appel" : "Request a call"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
