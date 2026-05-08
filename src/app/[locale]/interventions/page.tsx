import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Globe2, Building2, Sparkles, Plane } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { InterventionsHeroSchema } from "@/components/sections/InterventionsHeroSchema";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  INTERVENTIONS,
  type InterventionAccent,
  type InterventionSlug,
} from "@/content/interventions";
import { buildProductMetadata, buildServiceJsonLd, SITE_URL } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/interventions",
    title:
      locale === "fr"
        ? "Interventions IA en entreprise Â· 5 formats Â· France & international"
        : "Corporate AI sessions Â· 5 formats Â· France & international",
    description:
      locale === "fr"
        ? "Interventions et formations IA opÃ©rationnelles : Essentielle 490 â‚¬, Ã©quipes, managers, confÃ©rence Â½ journÃ©e, dirigeants. TPE / PME / grandes entreprises, France et international."
        : "Operational AI sessions: Essential â‚¬490, teams, managers, half-day talk, executives. Small to enterprise, France and international.",
  });
}

// Padding latÃ©ral rÃ©duit pour cette page (vs Container default lg:px-10
// xl:px-16). Donne plus de respiration au contenu et resserre les marges
// gauche/droite â€” Will, 2026-05-07.
const TIGHT_X = "lg:px-6 xl:px-10";

// Mapping classes accent â€” prÃ©-dÃ©finis statiquement pour Tailwind JIT.
const accentClasses: Record<
  InterventionAccent,
  {
    badge: string;
    border: string;
    title: string;
    line: string;
    cta: string;
    haloRing: string;
    chipBg: string;
    chipText: string;
  }
> = {
  terracotta: {
    badge: "bg-terracotta-soft text-terracotta-deep border border-terracotta/20",
    border: "border-terracotta/35 hover:border-terracotta",
    title: "text-terracotta-deep",
    line: "bg-terracotta",
    cta: "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
    haloRing: "ring-terracotta/15",
    chipBg: "bg-terracotta-soft",
    chipText: "text-terracotta-deep",
  },
  primary: {
    badge: "bg-primary-soft text-primary border border-primary/25",
    border: "border-primary/35 hover:border-primary",
    title: "text-primary",
    line: "bg-primary",
    cta: "bg-primary text-primary-fg hover:bg-primary-hover",
    haloRing: "ring-primary/15",
    chipBg: "bg-primary-soft",
    chipText: "text-primary",
  },
  sage: {
    badge: "bg-sage-soft text-sage border border-sage/30",
    border: "border-sage/40 hover:border-sage",
    title: "text-sage",
    line: "bg-sage",
    cta: "bg-sage text-mocha-fg hover:opacity-90",
    haloRing: "ring-sage/20",
    chipBg: "bg-sage-soft",
    chipText: "text-sage",
  },
  mocha: {
    badge: "bg-terracotta-soft text-terracotta-deep border border-terracotta/30",
    border: "border-mocha-fg/15 hover:border-terracotta",
    title: "text-terracotta-soft",
    line: "bg-terracotta",
    // CTA en terracotta â€” sort sur fond mocha sombre.
    cta: "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
    haloRing: "ring-terracotta/30",
    chipBg: "bg-terracotta-soft",
    chipText: "text-terracotta-deep",
  },
};

// Surface (fond du bloc) par slug â€” donne du peps en variant le dÃ©cor d'un
// format Ã  l'autre. Le bloc dirigeants est dark (mocha-rich) : il tranche
// volontairement avec les 4 autres.
const surfaceBySlug: Record<
  InterventionSlug,
  { container: string; aside: string; isDark: boolean }
> = {
  essentielle: {
    container: "bg-paper",
    aside: "bg-halo-warm border-terracotta/15",
    isDark: false,
  },
  equipes: {
    container: "bg-halo-cool",
    aside: "bg-paper border-primary/15",
    isDark: false,
  },
  managers: {
    container: "bg-sand",
    aside: "bg-paper border-sage/20",
    isDark: false,
  },
  conference: {
    container: "bg-halo-warm",
    aside: "bg-paper border-terracotta/15",
    isDark: false,
  },
  dirigeants: {
    container: "bg-mocha-rich text-mocha-fg",
    aside: "bg-mocha-soft border-mocha-fg/15",
    isDark: true,
  },
};

export default async function InterventionsListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Bandeau "Pour qui" â€” 5 rÃ©assurances dont la mention frais dÃ©placement
  // (transparence B2B, prÃ©empte l'objection commerciale).
  const audienceStrip = [
    {
      icon: Globe2,
      label: isFr ? "France & international" : "France & international",
      detail: isFr ? "Sur site partout dans le monde" : "On site worldwide",
    },
    {
      icon: Building2,
      label: isFr ? "TPE Â· PME Â· grandes entreprises" : "Small Â· mid-market Â· enterprise",
      detail: isFr ? "Tous secteurs, tous niveaux" : "All sectors, all levels",
    },
    {
      icon: Sparkles,
      label: isFr ? "De dÃ©butant Ã  expert IA" : "From AI novice to fluent",
      detail: isFr ? "Un format adaptÃ© Ã  chaque maturitÃ©" : "A format for every maturity",
    },
    {
      icon: Plane,
      label: isFr ? "DÃ©placement & logement" : "Travel & lodging",
      detail: isFr
        ? "Ã€ la charge du client Â· forfait journalier"
        : "Covered by client Â· flat daily rate",
    },
  ];

  // Breadcrumb visuel + JSON-LD intÃ©grÃ© (composant unique). L'item "Accueil"
  // est ajoutÃ© automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions en entreprise" : "Corporate AI sessions",
    },
  ];

  // Service JSON-LD avec areasServed multi-rÃ©gions (Sprint 14.9 levier 2).
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/interventions",
    name: isFr
      ? "Interventions IA en entreprise Â· 5 formats Â· AxionIA"
      : "Corporate AI sessions Â· 5 formats Â· AxionIA",
    description: isFr
      ? "Interventions et formations IA opÃ©rationnelles sur site : Essentielle 490 â‚¬ HT (1 journÃ©e, jusqu'Ã  100 personnes), Ã©quipes, managers, confÃ©rence Â½ journÃ©e, dirigeants. France mÃ©tropolitaine et international."
      : "Operational AI sessions on site: Essential â‚¬490 (1 day, up to 100 people), teams, managers, half-day talks, executives. Metropolitan France and international.",
    serviceType: "AI training & engagement",
    priceEur: 490,
    areasServed: buildServiceAreasServed(loc),
  });

  // ItemList JSON-LD â€” chaque intervention listÃ©e comme Service.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Interventions IA en entreprise" : "Corporate AI sessions",
    itemListElement: INTERVENTIONS.map((item, idx) => {
      const path = isFr ? item.pathFr : item.pathEn;
      const c = item[loc];
      return {
        "@type": "ListItem",
        position: idx + 1,
        item: {
          "@type": "Service",
          name: c.title,
          url: `${SITE_URL}/${locale}${path}`,
          description: item.summary[loc].benefitTagline,
          ...(c.priceEur
            ? {
                offers: {
                  "@type": "Offer",
                  price: c.priceEur,
                  priceCurrency: "EUR",
                  availability: "https://schema.org/InStock",
                },
              }
            : {}),
        },
      };
    }),
  } as const;

  // Schema labels nodes â€” court, lisible dans le SVG.
  const heroNodes = INTERVENTIONS.map((item) => ({
    label: isFr ? interventionShortLabelFr(item.slug) : interventionShortLabelEn(item.slug),
    benefit: isFr ? interventionShortBenefitFr(item.slug) : interventionShortBenefitEn(item.slug),
    accent: item.accent,
  }));

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO â€” layout custom 2 colonnes (text + schÃ©ma) gardant la doctrine v3 */}
      <section className="bg-halo-warm text-fg relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        {/* Grille texturÃ©e fond â€” vignette douce */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            opacity: 0.18,
          }}
        />

        <Container className={cn("relative", TIGHT_X)}>
          {/* Grille hero â€” proportion harmonisÃ©e avec /audit pour que les
              schemas hero des pages module aient la mÃªme grosseur visuelle.
              v3.2 (2026-05-08) : 1fr 1fr unifiÃ© + `.hero-schema` cap 36rem
              cÃ´tÃ© visuel. Doctrine hero schema width invariant. */}
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche â€” eyebrow + titre + description + CTAs */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Module 1 Â· Interventions" : "Module 1 Â· Sessions"}
              </p>

              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Formez vos Ã©quipes Ã  l'IA " : "Train your teams on AI "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "en 1 ou 2 jours" : "in 1 or 2 days"}
                </span>
                {isFr ? " â€” concrÃ¨tement, sur site." : " â€” concretely, on site."}
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "5 formats d'intervention et de formation IA opÃ©rationnels, sur site, en France et Ã  l'international. TPE, PME, ETI ou grandes entreprises. Ã€ chaque entreprise son format. Ã€ chaque Ã©quipe son bÃ©nÃ©fice concret, mesurable, dÃ¨s le lendemain."
                  : "5 operational AI session and training formats, on site, in France and abroad. Small businesses, mid-market or enterprise. A format for every company. A concrete, measurable benefit for every team, starting the very next day."}
              </p>

              {/* CTAs hero */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href="/interventions/essentielle"
                  size="lg"
                  className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
                >
                  {isFr ? "RÃ©server l'Essentielle Â· 490 â‚¬" : "Book the Essential Â· â‚¬490"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/cas-concrets" variant="outline" size="lg">
                  {isFr ? "Voir les cas concrets" : "See case studies"}
                </Cta>
              </div>
            </div>

            {/* Colonne droite â€” schÃ©ma SVG portrait, c'est l'argumentaire
                visuel principal de la page. lg:max-w-none pour utiliser tout
                l'espace de la colonne grille (1.2fr) et Ã©galer le
                AuditHeroSchema. */}
            <InterventionsHeroSchema
              className="hero-schema pointer-events-none"
              centerLabel={isFr ? "Votre entreprise" : "Your company"}
              ariaLabel={
                isFr
                  ? "SchÃ©ma : votre entreprise au centre, entourÃ©e des 5 formats d'intervention et de formation IA AxionIA et de leur bÃ©nÃ©fice concret."
                  : "Diagram: your company at the center, surrounded by the 5 AxionIA intervention and training formats and their concrete benefit."
              }
              nodes={heroNodes}
            />
          </div>
        </Container>
      </section>

      {/* BANDEAU Â« Pour qui Â» â€” rÃ©assurance immÃ©diate, 5 pills */}
      <section className="bg-paper border-border border-y py-10">
        <Container className={TIGHT_X}>
          <ul className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
            {audienceStrip.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex items-start gap-3">
                  <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-fg text-sm font-semibold">{item.label}</p>
                    <p className="text-fg-soft mt-1 text-xs">{item.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* 5 FORMATS â€” Essentielle full-width, 4 autres en grid 2Ã—2.
          Fonds diffÃ©renciÃ©s par format pour le peps. */}
      <Section
        eyebrow={isFr ? "Choisir votre format" : "Pick your format"}
        title={isFr ? "5 formats d'intervention" : "5 intervention formats"}
        titleEm={isFr ? "Ã  votre mesure" : "for every fit"}
        description={
          isFr
            ? "Chaque bloc est cliquable et mÃ¨ne Ã  la page dÃ©diÃ©e du format. Vous voyez immÃ©diatement la durÃ©e, le prix, ce que vos Ã©quipes sauront faire aprÃ¨s et comment Ã§a se dÃ©roule."
            : "Every card is clickable and links to the dedicated format page. You immediately see the duration, price, what your team will be able to do, and how it runs."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
          {INTERVENTIONS.map((item, idx) => {
            const c = item[loc];
            const s = item.summary[loc];
            const acc = accentClasses[item.accent];
            const surface = surfaceBySlug[item.slug];
            const href = isFr ? item.pathFr : item.pathEn;
            const isFlagship = idx === 0;
            const dark = surface.isDark;

            // Tokens texte adaptÃ©s selon dark / light pour lisibilitÃ©.
            const txt = dark ? "text-mocha-fg" : "text-fg";
            const txtSoft = dark ? "text-mocha-fg/85" : "text-fg-soft";
            const txtMuted = dark ? "text-mocha-fg/70" : "text-fg-muted";
            const stepBg = dark ? "bg-mocha-soft border-mocha-fg/15" : "bg-paper border-border";
            const linkColor = dark
              ? "text-mocha-fg hover:text-terracotta-soft"
              : "text-fg hover:text-terracotta-deep";

            const KpiCard = (
              <aside
                className={cn("shadow-subtle self-start rounded-2xl border p-6", surface.aside)}
              >
                <p className={`text-[12px] font-semibold tracking-[0.16em] uppercase ${acc.title}`}>
                  {isFr ? "L'essentiel" : "At a glance"}
                </p>
                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                      {isFr ? "DurÃ©e" : "Duration"}
                    </dt>
                    <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.duration}</dd>
                  </div>
                  {/* Si tranches multiples (Essentielle), on les expose toutes
                      pour que l'effectif et le prix correspondant soient lisibles
                      du premier coup d'Å“il. */}
                  {s.priceTiers && s.priceTiers.length > 1 ? (
                    <div>
                      <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                        {isFr ? "Tranches de prix" : "Price tiers"}
                      </dt>
                      <ul className="mt-2 space-y-1.5">
                        {s.priceTiers.map((tier, i) => (
                          <li
                            key={i}
                            className="border-l-terracotta flex items-baseline justify-between gap-3 rounded-md border-l-2 py-1 pl-3"
                          >
                            <span className={cn("text-[13px]", txtSoft)}>{tier.size}</span>
                            <span className={cn("text-[14px] font-semibold tabular-nums", txt)}>
                              {tier.price}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                        {isFr ? "Tarif" : "Price"}
                      </dt>
                      <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.price}</dd>
                    </div>
                  )}
                  <div>
                    <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                      {isFr ? "Participants" : "Participants"}
                    </dt>
                    <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.groupSize}</dd>
                  </div>
                  <div>
                    <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                      {isFr ? "Format" : "Format"}
                    </dt>
                    <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.format}</dd>
                  </div>
                </dl>
              </aside>
            );

            const KpiInline = (
              // Version compacte 2Ã—2 pour les blocs non-flagship.
              <dl className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { label: isFr ? "DurÃ©e" : "Duration", value: s.duration },
                  { label: isFr ? "Tarif" : "Price", value: s.price },
                  { label: isFr ? "Participants" : "Participants", value: s.groupSize },
                  { label: isFr ? "Format" : "Format", value: s.format },
                ].map((k, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border px-4 py-3",
                      dark ? "bg-mocha-soft border-mocha-fg/12" : "bg-paper/80 border-border",
                    )}
                  >
                    <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                      {k.label}
                    </dt>
                    <dd className={`mt-1 text-[14px] font-semibold ${txt}`}>{k.value}</dd>
                  </div>
                ))}
              </dl>
            );

            return (
              <article
                key={item.slug}
                className={cn(
                  "shadow-subtle group-hover/card:shadow-card group/card relative overflow-hidden rounded-3xl border-2 ring-1 transition-shadow",
                  surface.container,
                  acc.border,
                  acc.haloRing,
                  isFlagship && "lg:col-span-2",
                )}
                {...(dark ? { "data-tone": "dark" as const } : {})}
              >
                {/* Stretched link â€” couvre toute la card. Les CTAs internes
                    (action principale + lien calendrier) sont remontÃ©s en
                    relative z-[2] plus bas pour rester cliquables au-dessus. */}
                <Link
                  href={href as never}
                  aria-label={`${c.title} â€” ${s.ctaLabel}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{s.ctaLabel}</span>
                </Link>

                {/* LiserÃ© accent + label "Offre phare" sur Essentielle */}
                <span aria-hidden="true" className={`block h-1.5 w-full ${acc.line}`} />
                {isFlagship ? (
                  <span
                    className={cn(
                      "shadow-subtle pointer-events-none absolute top-5 right-5 z-[3] inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
                      acc.chipBg,
                      acc.chipText,
                    )}
                  >
                    <Sparkles aria-hidden="true" className="h-3 w-3" />
                    {isFr ? "Offre phare Â· 490 â‚¬" : "Flagship Â· â‚¬490"}
                  </span>
                ) : null}

                <div
                  className={cn(
                    "p-7 sm:p-8",
                    isFlagship &&
                      "lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10 lg:p-10",
                  )}
                >
                  {/* Contenu principal */}
                  <div>
                    {/* Pill audience */}
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase",
                        acc.badge,
                      )}
                    >
                      {s.audience}
                    </span>

                    {/* Title + accent serif optionnel sur prix */}
                    <h2
                      className={cn(
                        "mt-4 leading-tight font-semibold tracking-tight",
                        isFlagship
                          ? "text-[clamp(1.75rem,3vw,2.5rem)]"
                          : "text-[clamp(1.5rem,2.4vw,2rem)]",
                        txt,
                      )}
                    >
                      {c.title}
                      {c.priceEur ? (
                        <span
                          className={`ml-3 italic ${acc.title}`}
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          Â· {c.priceEur} â‚¬
                        </span>
                      ) : null}
                    </h2>

                    {/* BÃ©nÃ©fice 1 ligne â€” punchy */}
                    <p
                      className={cn(
                        "mt-4 leading-relaxed",
                        isFlagship ? "text-lg" : "text-[15.5px]",
                        txtSoft,
                      )}
                    >
                      {s.benefitTagline}
                    </p>

                    {/* KPI inline (compact) sur les blocs non-flagship */}
                    {!isFlagship ? KpiInline : null}

                    {/* Ce que vos Ã©quipes sauront faire */}
                    <div className="mt-6">
                      <p
                        className={cn(
                          "mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase",
                          txtMuted,
                        )}
                      >
                        {isFr
                          ? "Ã€ l'issue, vos Ã©quipes saventâ€¦"
                          : "After the session, your team canâ€¦"}
                      </p>
                      <ul className="space-y-2">
                        {s.outcomes.map((o, i) => (
                          <li key={i} className={cn("flex items-start gap-3 text-base", txt)}>
                            <span
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                acc.chipBg,
                                acc.chipText,
                              )}
                            >
                              <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                            </span>
                            <span className="leading-relaxed">{o}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* DÃ©roulement */}
                    <div className="mt-6">
                      <p
                        className={cn(
                          "mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase",
                          txtMuted,
                        )}
                      >
                        {isFr ? "Comment Ã§a se dÃ©roule" : "How it runs"}
                      </p>
                      <ol className="grid gap-3 sm:grid-cols-3">
                        {s.outline.map((step, i) => (
                          <li key={i} className={cn("relative rounded-xl border p-4", stepBg)}>
                            <span
                              aria-hidden="true"
                              className={cn(
                                "mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                                acc.chipBg,
                                acc.chipText,
                              )}
                            >
                              {i + 1}
                            </span>
                            <p className={cn("text-[12.5px] leading-relaxed", txt)}>{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* CTA â€” au-dessus du stretched link via relative z-[2].
                        Le lien calendrier reste indÃ©pendamment cliquable. */}
                    <div className="relative z-[2] mt-7 flex flex-wrap items-center gap-3">
                      <Link
                        href={href as never}
                        className={cn(
                          "cta-lift inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
                          acc.cta,
                        )}
                      >
                        {s.ctaLabel}
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/reserver"
                        className={cn(
                          "inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4",
                          linkColor,
                        )}
                      >
                        {isFr ? "Voir le calendrier" : "See the calendar"}
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Aside KPI vertical â€” uniquement sur le bloc Essentielle */}
                  {isFlagship ? KpiCard : null}
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* SECTION ANTI-FEAR â€” quel que soit votre niveau IA */}
      <Section
        tone="sand"
        eyebrow={isFr ? "ConcernÃ©Â·e quel que soit votre niveau" : "A fit for every AI maturity"}
        title={isFr ? "De zÃ©ro IA Ã  Ã©quipes IA-fluentes," : "From zero AI to fluent teams,"}
        titleEm={isFr ? "un format pour chaque entreprise" : "one format per company"}
        description={
          isFr
            ? "Aucune entreprise n'est trop petite ni trop grande. Aucune Ã©quipe n'est trop dÃ©butante ni trop experte. Vous repartez avec un bÃ©nÃ©fice concret â€” peu importe d'oÃ¹ vous partez."
            : "No company is too small or too large. No team is too novice or too expert. You leave with a concrete benefit â€” whatever your starting point."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              level: isFr ? "Niveau 1" : "Stage 1",
              title: isFr ? "Aucun collaborateur formÃ© Ã  l'IA" : "No employee trained in AI yet",
              body: isFr
                ? "L'Essentielle ou la confÃ©rence Â½ journÃ©e vous donnent une vision claire et 3 quick-wins prÃªts Ã  reprendre."
                : "The Essential or the half-day talk gives you a clear vision and 3 quick-wins ready to resume.",
              recommendation: isFr
                ? "Essentielle 490 â‚¬ Â· ConfÃ©rence"
                : "Essential â‚¬490 Â· Talk",
            },
            {
              level: isFr ? "Niveau 2" : "Stage 2",
              title: isFr ? "Premiers usages IA dÃ©jÃ  testÃ©s" : "Early AI uses already tried",
              body: isFr
                ? "L'intervention Ã©quipes ou managers structure ce qui marche, Ã©limine ce qui n'en vaut pas la peine, et passe Ã  l'Ã©chelle."
                : "The team or manager session structures what works, drops what doesn't, and scales.",
              recommendation: isFr ? "Ã‰quipes Â· Managers" : "Teams Â· Managers",
            },
            {
              level: isFr ? "Niveau 3" : "Stage 3",
              title: isFr ? "Ã‰quipes IA-fluentes en place" : "Fluent AI teams already in place",
              body: isFr
                ? "L'intervention dirigeants pose le cadre stratÃ©gique 12-24 mois â€” gouvernance, investissements, gestion des risques."
                : "The leadership session sets the 12-24 month strategic frame â€” governance, investments, risk management.",
              recommendation: isFr ? "Dirigeants Â· CODIR" : "Executives Â· Leadership",
            },
          ].map((card, idx) => (
            <article key={idx} className="bg-paper border-border relative rounded-2xl border p-6">
              <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
                {card.level}
              </p>
              <h3 className="text-fg mt-2 text-xl leading-snug font-semibold">{card.title}</h3>
              <p className="text-fg-soft mt-3 text-base leading-relaxed">{card.body}</p>
              <p className="text-fg-muted mt-4 text-[12px] tracking-wide">
                <span className="text-fg font-medium">
                  {isFr ? "Format conseillÃ© : " : "Recommended format: "}
                </span>
                {card.recommendation}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* COUVERTURE NATIONALE (Sprint 14.9 levier 3 â€” pSEO) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="Les interventions IA"
        serviceLabelEn="AI sessions"
        serviceSlug="interventions"
        tone="paper"
      />

      {/* FAQ GÃ‰OLOCALISÃ‰E (Sprint 14.9 levier 4 â€” pSEO) */}
      <LocalGeoFaqSection isFr={isFr} service="interventions" tone="sand" />

      {/* CLOSING ILLUSTRATION â€” Sprint Visual Rhythm 2026 */}
      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="INTERV-02-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/interventions-closing.avif"
            caption={
              isFr
                ? "Ã‰quipe en mouvement â€” silhouettes Ã©ditoriales orientÃ©es vers l'action"
                : "Team in motion â€” editorial silhouettes oriented toward action"
            }
            alt={
              isFr
                ? "Illustration Ã©ditoriale d'une Ã©quipe orientÃ©e vers l'action aprÃ¨s une intervention AxionIA."
                : "Editorial illustration of a team oriented toward action after an AxionIA session."
            }
          />
        </Container>
      </Section>

      {/* CTA FINAL */}
      <CtaBlock
        eyebrow={isFr ? "DÃ©marrer concrÃ¨tement" : "Start concretely"}
        title={
          isFr
            ? "RÃ©servez la prochaine intervention disponible"
            : "Book the next available session"
        }
        description={
          isFr
            ? "Calendrier maison en temps rÃ©el. RÃ©ponse sous 48 h ouvrÃ©es sur les devis. France et international â€” toutes les entreprises sont les bienvenues."
            : "Live in-house calendar. 48-business-hour reply on quotes. France and international â€” every company is welcome."
        }
        cta={
          <Cta href="/reserver" size="lg">
            {isFr ? "Voir le calendrier des interventions" : "See the intervention calendar"} â†’
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}

// Helpers labels courts pour le schÃ©ma SVG hero. Le label est le NOM du
// format (court), le bÃ©nÃ©fice est ce que l'entreprise gagne concrÃ¨tement.
// Pas de jargon, pas d'acronymes obscurs ("quick-wins" Ã©vitÃ© cÃ´tÃ© hero â€”
// trop technique pour un dirigeant qui dÃ©couvre).
function interventionShortLabelFr(slug: string): string {
  switch (slug) {
    case "essentielle":
      return "DÃ©marrer en 1 jour";
    case "equipes":
      return "Booster vos Ã©quipes";
    case "managers":
      return "Aligner vos managers";
    case "conference":
      return "Embarquer toute l'entreprise";
    case "dirigeants":
      return "CODIR & dirigeants";
    default:
      return slug;
  }
}

function interventionShortLabelEn(slug: string): string {
  switch (slug) {
    case "essentielle":
      return "Start in 1 day";
    case "equipes":
      return "Boost your teams";
    case "managers":
      return "Align your managers";
    case "conference":
      return "Onboard the whole company";
    case "dirigeants":
      return "Execs & leadership";
    default:
      return slug;
  }
}

function interventionShortBenefitFr(slug: string): string {
  switch (slug) {
    case "essentielle":
      return "DÃ©couverte des outils IA Â· Ã  partir de 490 â‚¬";
    case "equipes":
      return "+1 h gagnÃ©e par personne et par jour";
    case "managers":
      return "RÃ©unions et reporting allÃ©gÃ©s de 30 %";
    case "conference":
      return "Sensibiliser toute l'entreprise en Â½ jour";
    case "dirigeants":
      return "Vision IA claire pour vos dÃ©cisions";
    default:
      return "";
  }
}

function interventionShortBenefitEn(slug: string): string {
  switch (slug) {
    case "essentielle":
      return "AI tools discovery Â· from â‚¬490";
    case "equipes":
      return "+1 hour saved per person, per day";
    case "managers":
      return "Meetings & reporting cut by 30 %";
    case "conference":
      return "Upskill the whole company in half a day";
    case "dirigeants":
      return "Clear AI vision for your decisions";
    default:
      return "";
  }
}
