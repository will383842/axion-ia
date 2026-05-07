import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { ESSENTIELLE_TIERS, getIntervention } from "@/content/interventions";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
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

  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      ...(copy.priceEur ? { priceEur: copy.priceEur } : {}),
      serviceType: "AI consulting",
      area: "Worldwide",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    buildBreadcrumbJsonLd({
      locale: loc,
      items: [
        { name: loc === "fr" ? "Accueil" : "Home", href: "/" },
        {
          name: loc === "fr" ? "Interventions entreprise" : "Corporate AI sessions",
          href: "/interventions",
        },
        { name: copy.title, href: "/interventions/essentielle" },
      ],
    }),
  ];

  const isFr = loc === "fr";

  return (
    <>
      <ProductPageTemplate
        isFr={loc === "fr"}
        accent="primary"
        copy={copy}
        ctaPrimaryHref="/reserver?intervention=essentielle"
        ctaSecondaryHref="/cas-concrets"
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
    </>
  );
}
