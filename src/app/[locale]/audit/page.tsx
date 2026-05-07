import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  Globe2,
  Building2,
  Users2,
  Sparkles,
  Zap,
  Workflow,
  Briefcase,
  Network,
  ShieldCheck,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AuditHeroSchema } from "@/components/sections/AuditHeroSchema";
import { AUDITS, type AuditAccent, type AuditSlug } from "@/content/audit";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/audit",
    title:
      locale === "fr"
        ? "Audit IA en entreprise · 4 niveaux · diagnostic flash dès 490 €"
        : "AI audit · 4 levels · flash diagnosis from €490",
    description:
      locale === "fr"
        ? "Pyramide d'audit IA en 4 niveaux : Flash (490 € · satisfait ou remboursé), Process (1 900-3 900 €), Stratégique PME (4 900-9 900 €), Stratégique ETI (à partir de 12 000 €). France & international."
        : "4-level AI audit pyramid: Flash (€490 · satisfied or refunded), Process (€1,900-€3,900), Strategic SMB (€4,900-€9,900), Strategic mid-cap (from €12,000). France & worldwide.",
  });
}

// Padding latéral réduit (alignement avec /interventions).
const TIGHT_X = "lg:px-6 xl:px-10";

// Mapping classes accent — pré-définis statiquement pour Tailwind JIT.
const accentClasses: Record<
  AuditAccent,
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
    cta: "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
    haloRing: "ring-terracotta/30",
    chipBg: "bg-terracotta-soft",
    chipText: "text-terracotta-deep",
  },
};

// Surface (fond du bloc) par niveau — peps en variant le décor.
// Le bloc ETI est dark (mocha-rich) pour signaler le hero offer.
const surfaceBySlug: Record<AuditSlug, { container: string; aside: string; isDark: boolean }> = {
  flash: {
    container: "bg-halo-warm",
    aside: "bg-paper border-terracotta/15",
    isDark: false,
  },
  process: {
    container: "bg-halo-cool",
    aside: "bg-paper border-primary/15",
    isDark: false,
  },
  "strategique-pme": {
    container: "bg-sand",
    aside: "bg-paper border-sage/20",
    isDark: false,
  },
  "strategique-eti": {
    container: "bg-mocha-rich text-mocha-fg",
    aside: "bg-mocha-soft border-mocha-fg/15",
    isDark: true,
  },
};

const ICON_BY_SLUG: Record<AuditSlug, typeof Zap> = {
  flash: Zap,
  process: Workflow,
  "strategique-pme": Briefcase,
  "strategique-eti": Network,
};

export default async function AuditListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Bandeau "Pour qui" — 5 réassurances B2B.
  const audienceStrip = [
    {
      icon: Globe2,
      label: isFr ? "France & international" : "France & international",
      detail: isFr ? "Sur site partout dans le monde" : "On site worldwide",
    },
    {
      icon: Building2,
      label: isFr ? "TPE → ETI / groupes" : "Small → mid-cap",
      detail: isFr ? "Tous secteurs, tous niveaux" : "All sectors, all levels",
    },
    {
      icon: Users2,
      label: isFr ? "1 process ou toute l'entreprise" : "1 process or whole company",
      detail: isFr ? "Niveau adapté à votre besoin" : "Right level for your need",
    },
    {
      icon: ShieldCheck,
      label: isFr ? "Diagnostic flash sans risque" : "Flash diagnosis at zero risk",
      detail: isFr ? "Satisfait ou intégralement remboursé" : "Satisfied or fully refunded",
    },
    {
      icon: Sparkles,
      label: isFr ? "Plan d'action chiffré" : "Costed action plan",
      detail: isFr ? "Quick-wins triés par gain et complexité" : "Quick-wins sorted by gain & ease",
    },
  ];

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Audit & optimisation" : "Audit & optimization", href: "/audit" },
    ],
  });

  // ItemList JSON-LD — chaque niveau listé comme Service.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Audits IA — pyramide 4 niveaux" : "AI audits — 4-level pyramid",
    itemListElement: AUDITS.map((item, idx) => {
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

  return (
    <>
      {/* HERO — layout 2 colonnes (text + flow narratif "C'est quoi un audit"). */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-20 sm:py-24 lg:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, white 15%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 15%, transparent 70%)",
            opacity: 0.1,
          }}
        />

        <Container className={cn("relative", TIGHT_X)}>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 xl:gap-20">
            {/* Colonne gauche — eyebrow + titre + description + CTAs */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Module 2 · Audit & optimisation" : "Module 2 · Audit & optimization"}
              </p>

              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "4 façons d'amener l'" : "4 ways to bring "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "IA dans votre entreprise" : "AI into your company"}
                </span>
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Du diagnostic flash à 490 € (satisfait ou remboursé) au plan stratégique multi-sites. À chaque taille d'entreprise, son format. On intervient en TPE, PME, ETI ou grandes entreprises — France et international, à distance ou sur site."
                  : "From the €490 flash diagnosis (satisfied or refunded) to the multi-site strategic plan. A fit for every company size. We work with small businesses, SMBs, mid-caps and large enterprises — France and worldwide, remote or on site."}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href="/audit/demande?type=flash"
                  size="lg"
                  className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-[0_8px_24px_-8px_rgba(194,74,27,0.6)]"
                >
                  {isFr
                    ? "Réserver mon diagnostic flash · 490 €"
                    : "Book my flash diagnosis · €490"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/cas-concrets" variant="outline" size="lg">
                  {isFr ? "Voir les cas concrets" : "See case studies"}
                </Cta>
              </div>

              {/* Réassurance directe sous le CTA */}
              <p className="text-fg-muted mt-4 flex items-center gap-2 text-[13px]">
                <ShieldCheck aria-hidden="true" className="text-terracotta-deep h-4 w-4" />
                {isFr
                  ? "Satisfait ou intégralement remboursé sur le diagnostic flash."
                  : "Satisfied or fully refunded on the flash diagnosis."}
              </p>
            </div>

            {/* Colonne droite — flow narratif "Ce que c'est et comment ça
                fonctionne". Sans fond, plus gros, langage simple. */}
            <div className="relative mx-auto w-full max-w-2xl lg:mx-0">
              <AuditHeroSchema
                isFr={isFr}
                ariaLabel={
                  isFr
                    ? "Schéma : votre entreprise au départ, 4 étapes méthodologiques de l'audit AxionIA (on observe, on cartographie, on priorise, on remet le plan), puis 6 gains business concrets (chiffre d'affaires en hausse, rentabilité améliorée, tâches automatisées, heures libérées, équipes formées à l'IA, pilotage au jour le jour)."
                    : "Diagram: your company at the start, 4 methodology steps of the AxionIA audit (we observe, we map, we prioritise, we hand over the plan), then 6 concrete business gains (revenue growth, improved profitability, tasks automated, hours freed, teams trained in AI, day-to-day tracking)."
                }
              />
            </div>
          </div>
        </Container>
      </section>

      {/* BANDEAU « Pour qui » — réassurance immédiate, 5 pills */}
      <section className="bg-paper border-border border-y py-10">
        <Container className={TIGHT_X}>
          <ul className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-5">
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

      {/* PYRAMIDE — 4 cards par niveau */}
      <Section
        eyebrow={isFr ? "Choisir votre niveau" : "Pick your level"}
        title={isFr ? "Pyramide d'audit" : "Audit pyramid"}
        titleEm={isFr ? "en 4 niveaux" : "in 4 levels"}
        description={
          isFr
            ? "Chaque niveau est cliquable et mène à la fiche dédiée. Vous voyez immédiatement le périmètre, le prix, ce que vous obtenez et la garantie associée. Le diagnostic flash est sans risque — si vous n'en tirez aucune valeur, on rembourse intégralement."
            : "Every level is clickable and links to the dedicated page. You immediately see the scope, price, what you get and the guarantee. The flash diagnosis is risk-free — if you get no value out of it, we refund in full."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
          {AUDITS.map((item, idx) => {
            const c = item[loc];
            const s = item.summary[loc];
            const acc = accentClasses[item.accent];
            const surface = surfaceBySlug[item.slug];
            const href = isFr ? item.pathFr : item.pathEn;
            const isFlash = idx === 0;
            const isFlagship = idx === 0 || idx === 3; // Flash + ETI = pleine largeur
            const dark = surface.isDark;
            const Icon = ICON_BY_SLUG[item.slug];

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
                      {isFr ? "Périmètre" : "Scope"}
                    </dt>
                    <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.scope}</dd>
                  </div>
                  {s.priceTiers && s.priceTiers.length > 0 ? (
                    <div>
                      <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                        {isFr ? "Tarifs" : "Pricing"}
                      </dt>
                      <ul className="mt-2 space-y-1.5">
                        {s.priceTiers.map((tier, i) => (
                          <li
                            key={i}
                            className="border-l-terracotta rounded-md border-l-2 py-1 pl-3"
                          >
                            <p className={cn("text-[12.5px]", txtSoft)}>{tier.size}</p>
                            <p className={cn("mt-0.5 text-[14px] font-semibold tabular-nums", txt)}>
                              {tier.price}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                        {isFr ? "Tarif" : "Price"}
                      </dt>
                      <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.priceFrom}</dd>
                    </div>
                  )}
                  <div>
                    <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                      {isFr ? "Modalité" : "Modality"}
                    </dt>
                    <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.modality}</dd>
                  </div>
                  <div>
                    <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                      {isFr ? "Pour qui" : "Audience"}
                    </dt>
                    <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.audience}</dd>
                  </div>
                  {s.guarantee ? (
                    <div className="border-terracotta/30 bg-terracotta-soft mt-2 rounded-lg border-2 p-3">
                      <dt className="text-terracotta-deep text-[11px] font-bold tracking-[0.12em] uppercase">
                        <ShieldCheck
                          aria-hidden="true"
                          className="mr-1 inline h-3.5 w-3.5"
                          strokeWidth={2.5}
                        />
                        {isFr ? "Garantie" : "Guarantee"}
                      </dt>
                      <dd className="text-terracotta-deep mt-1 text-[13px] leading-snug font-bold">
                        {s.guarantee}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </aside>
            );

            const KpiInline = (
              <dl className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { label: isFr ? "Périmètre" : "Scope", value: s.scope },
                  { label: isFr ? "Tarif" : "Price", value: s.priceFrom },
                  { label: isFr ? "Modalité" : "Modality", value: s.modality },
                  { label: isFr ? "Pour qui" : "Audience", value: s.audience },
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
                  "shadow-subtle group/card hover:shadow-card relative overflow-hidden rounded-3xl border-2 ring-1 transition-shadow",
                  surface.container,
                  acc.border,
                  acc.haloRing,
                  isFlagship && "lg:col-span-2",
                )}
                {...(dark ? { "data-tone": "dark" as const } : {})}
              >
                <Link
                  href={href as never}
                  aria-label={`${c.title} — ${s.ctaLabel}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{s.ctaLabel}</span>
                </Link>

                <span aria-hidden="true" className={`block h-1.5 w-full ${acc.line}`} />

                {/* Chip "Sans risque" sur le Flash, "Multi-sites" sur l'ETI */}
                {isFlash ? (
                  <span
                    className={cn(
                      "shadow-subtle pointer-events-none absolute top-5 right-5 z-[3] inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
                      acc.chipBg,
                      acc.chipText,
                    )}
                  >
                    <Sparkles aria-hidden="true" className="h-3 w-3" />
                    {isFr ? "Sans risque · 490 €" : "Risk-free · €490"}
                  </span>
                ) : null}
                {item.slug === "strategique-eti" ? (
                  <span className="bg-terracotta-soft text-terracotta-deep shadow-subtle pointer-events-none absolute top-5 right-5 z-[3] inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                    <Network aria-hidden="true" className="h-3 w-3" />
                    {isFr ? "Multi-sites · groupes" : "Multi-site · groups"}
                  </span>
                ) : null}

                <div
                  className={cn(
                    "p-7 sm:p-8",
                    isFlagship &&
                      "lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10 lg:p-10",
                  )}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          acc.chipBg,
                          acc.chipText,
                        )}
                      >
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase",
                          acc.badge,
                        )}
                      >
                        {c.eyebrow}
                      </span>
                    </div>

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
                    </h2>

                    <p
                      className={cn(
                        "mt-4 leading-relaxed",
                        isFlagship ? "text-lg" : "text-[15.5px]",
                        txtSoft,
                      )}
                    >
                      {s.benefitTagline}
                    </p>

                    {!isFlagship ? KpiInline : null}

                    {/* Ce que vous obtenez */}
                    <div className="mt-6">
                      <p
                        className={cn(
                          "mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase",
                          txtMuted,
                        )}
                      >
                        {isFr ? "Ce que vous obtenez" : "What you get"}
                      </p>
                      <ul className="space-y-2">
                        {s.outcomes.map((o, i) => (
                          <li key={i} className={cn("flex items-start gap-3 text-[14.5px]", txt)}>
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

                    {/* Déroulement */}
                    <div className="mt-6">
                      <p
                        className={cn(
                          "mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase",
                          txtMuted,
                        )}
                      >
                        {isFr ? "Comment ça se déroule" : "How it runs"}
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

                    {/* Garantie inline (compact uniquement) */}
                    {!isFlagship && s.guarantee ? (
                      <div
                        className={cn(
                          "mt-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold",
                          acc.chipBg,
                          acc.chipText,
                        )}
                      >
                        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {s.guarantee}
                      </div>
                    ) : null}

                    <div className="relative z-[2] mt-7 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/audit/demande?type=${item.slug}` as never}
                        className={cn(
                          "cta-lift inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
                          acc.cta,
                        )}
                      >
                        {s.ctaLabel}
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                      <Link
                        href={href as never}
                        className={cn(
                          "inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4",
                          linkColor,
                        )}
                      >
                        {isFr ? "Voir le détail" : "See details"}
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {isFlagship ? KpiCard : null}
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* GRILLE TARIFAIRE consolidée — 4 lignes par niveau */}
      <Section
        id="tarifs"
        tone="sand"
        eyebrow={isFr ? "Tarifs affichés" : "Public pricing"}
        title={isFr ? "Pyramide tarifaire" : "Pricing pyramid"}
        titleEm={isFr ? "transparente" : "transparent"}
        description={
          isFr
            ? "Tarifs HT. Sous le marché à chaque étage, structure professionnelle, scope défini. Pour les ETI, devis personnalisé sous 48 h ouvrées avec phases et budgets."
            : "Excl. VAT. Below market at every step, professional structure, defined scope. For mid-caps, custom quote within 48 business hours with phases and budgets."
        }
        contentClassName={TIGHT_X}
      >
        <div className="border-border bg-paper shadow-subtle overflow-hidden rounded-2xl border">
          <table className="w-full text-left">
            <thead className="bg-halo-warm border-border border-b">
              <tr>
                <th className="text-fg p-5 text-sm font-semibold">{isFr ? "Niveau" : "Level"}</th>
                <th className="text-fg p-5 text-sm font-semibold">
                  {isFr ? "Pour qui" : "Audience"}
                </th>
                <th className="text-fg hidden p-5 text-sm font-semibold sm:table-cell">
                  {isFr ? "Périmètre" : "Scope"}
                </th>
                <th className="text-fg p-5 text-right text-sm font-semibold">
                  {isFr ? "Prix HT" : "Price excl. VAT"}
                </th>
              </tr>
            </thead>
            <tbody>
              {AUDITS.map((a) => {
                const s = a.summary[loc];
                const Icon = ICON_BY_SLUG[a.slug];
                const acc = accentClasses[a.accent];
                return (
                  <tr key={a.slug} className="border-border border-b last:border-0">
                    <td className="p-5">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            acc.chipBg,
                            acc.chipText,
                          )}
                        >
                          <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                        </span>
                        <div>
                          <p className="text-fg text-sm font-bold">{a[loc].eyebrow}</p>
                          {s.guarantee ? (
                            <p className="text-terracotta-deep mt-0.5 text-[11px] font-semibold">
                              {s.guarantee}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="text-fg-soft p-5 text-sm">{s.audience}</td>
                    <td className="text-fg-soft hidden p-5 text-sm sm:table-cell">{s.scope}</td>
                    <td className="text-fg p-5 text-right text-sm font-bold tabular-nums">
                      {s.priceFrom}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-fg-muted mt-6 max-w-3xl text-sm leading-relaxed">
          {isFr
            ? "Frais de déplacement (sur site uniquement) : forfait journalier sans justificatifs. Logement à la charge du client si plus de 200 km de Paris. Détails dans la "
            : "Travel fees (on site only): flat daily rate, no receipts. Lodging at client's expense if more than 200 km from Paris. Details in the "}
          <Link
            href="/politique-deplacement"
            className="text-terracotta-deep underline underline-offset-4 hover:opacity-80"
          >
            {isFr ? "politique de déplacement" : "travel policy"}
          </Link>
          .
        </p>
      </Section>

      {/* QUIZ "Comment choisir votre niveau" — 3 questions guides */}
      <Section
        eyebrow={isFr ? "Comment choisir" : "How to choose"}
        title={isFr ? "Quel niveau" : "Which level"}
        titleEm={isFr ? "pour vous ?" : "for you?"}
        description={
          isFr
            ? "3 questions simples pour vous orienter vers le bon format. La règle : commencez petit (Flash), montez en gamme quand vous avez besoin de profondeur."
            : "3 simple questions to point you to the right format. The rule: start small (Flash), level up when you need depth."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              question: isFr
                ? "Vous démarrez avec l'IA ou vous explorez ?"
                : "You're starting with AI or exploring?",
              answer: isFr ? "Niveau 1 · Flash" : "Level 1 · Flash",
              detail: isFr
                ? "Vous voulez tester sans engagement. Sur 1 process clé, on identifie 3-5 cas d'usage et un plan 30/90 jours. Satisfait ou remboursé."
                : "You want to test with no commitment. On 1 key process, we identify 3-5 use cases and a 30/90-day plan. Satisfied or refunded.",
              cta: isFr
                ? "Réserver le diagnostic flash · 490 €"
                : "Book the flash diagnosis · €490",
              href: "/audit/demande?type=flash",
              accent: "terracotta",
            },
            {
              question: isFr
                ? "Vous avez un service précis à optimiser ?"
                : "You have a specific service to optimise?",
              answer: isFr ? "Niveau 2 · Process" : "Level 2 · Process",
              detail: isFr
                ? "RH, finance, vente, ops, support — un processus complet, cartographié de bout en bout, avec roadmap IA 6-12 mois et tâches automatisables chiffrées."
                : "HR, finance, sales, ops, support — a full process mapped end to end, with a 6-12 month AI roadmap and costed automatable tasks.",
              cta: isFr ? "Demander un audit Process" : "Request a Process audit",
              href: "/audit/demande?type=process",
              accent: "primary",
            },
            {
              question: isFr
                ? "Vous voulez une vision globale ou un plan groupe ?"
                : "You want a global vision or a group plan?",
              answer: isFr
                ? "Niveau 3 ou 4 · Stratégique PME ou ETI"
                : "Level 3 or 4 · Strategic SMB or mid-cap",
              detail: isFr
                ? "PME 20-250 salariés : audit stratégique 4,9-9,9 k€. ETI / multi-sites : audit groupe à partir de 12 k€, alignement CODIR et premiers jalons AI Act."
                : "SMB 20-250 staff: strategic audit €4.9-9.9k. Mid-cap / multi-site: group audit from €12k, leadership alignment and AI Act milestones.",
              cta: isFr ? "Demander un audit stratégique" : "Request a strategic audit",
              href: "/audit/demande?type=strategique-pme",
              accent: "sage",
            },
          ].map((q, i) => {
            const acc = accentClasses[q.accent as AuditAccent];
            return (
              <article
                key={i}
                className={cn(
                  "bg-paper shadow-subtle relative flex flex-col rounded-2xl border-2 p-6",
                  acc.border,
                )}
              >
                <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                  {isFr ? `Question ${i + 1}` : `Question ${i + 1}`}
                </p>
                <h3 className="text-fg mt-2 text-lg leading-snug font-bold">{q.question}</h3>
                <div
                  className={cn(
                    "mt-4 inline-block self-start rounded-full px-3 py-1 text-[12px] font-bold",
                    acc.chipBg,
                    acc.chipText,
                  )}
                >
                  → {q.answer}
                </div>
                <p className="text-fg-soft mt-4 flex-1 text-sm leading-relaxed">{q.detail}</p>
                <Link
                  href={q.href as never}
                  className={cn(
                    "cta-lift mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                    acc.cta,
                  )}
                >
                  {q.cta}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </article>
            );
          })}
        </div>
      </Section>

      {/* SECTION ANTI-FEAR — quel que soit votre niveau IA */}
      <Section
        eyebrow={isFr ? "Concerné·e quel que soit votre niveau" : "A fit for every AI maturity"}
        title={isFr ? "De zéro IA à équipes IA-fluentes," : "From zero AI to fluent teams,"}
        titleEm={isFr ? "un audit pour chaque entreprise" : "an audit for every company"}
        description={
          isFr
            ? "Aucune entreprise n'est trop petite ni trop grande, aucun secteur n'est trop spécifique. Vous repartez avec une roadmap claire, chiffrée — peu importe d'où vous partez."
            : "No company is too small or too large, no sector is too niche. You leave with a clear, costed roadmap — whatever your starting point."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              level: isFr ? "Niveau 1" : "Stage 1",
              title: isFr ? "Aucun usage IA en place" : "No AI use in place",
              body: isFr
                ? "Le diagnostic flash identifie 3-5 quick-wins immédiats sans bouleverser vos process. Vous gardez la main, vous testez sans risque."
                : "The flash diagnosis identifies 3-5 immediate quick-wins without disrupting your processes. You keep control, test without risk.",
              recommendation: isFr ? "Flash · Process" : "Flash · Process",
            },
            {
              level: isFr ? "Niveau 2" : "Stage 2",
              title: isFr ? "Premiers usages IA déjà testés" : "Early AI uses already tried",
              body: isFr
                ? "L'audit Process structure ce qui marche, élimine ce qui n'en vaut pas la peine, et chiffre la suite avec une roadmap 6-12 mois."
                : "The Process audit structures what works, drops what doesn't, and costs the next step with a 6-12 month roadmap.",
              recommendation: isFr ? "Process · Stratégique PME" : "Process · Strategic SMB",
            },
            {
              level: isFr ? "Niveau 3" : "Stage 3",
              title: isFr
                ? "Usages IA matures, recherche d'optimisation"
                : "Mature AI uses, looking to optimize",
              body: isFr
                ? "L'audit stratégique pose un benchmark concurrentiel et identifie les leviers de scalabilité multi-sites encore inexploités."
                : "The strategic audit benchmarks competitors and identifies unexploited multi-site scaling levers.",
              recommendation: isFr ? "Stratégique PME · ETI" : "Strategic SMB · mid-cap",
            },
          ].map((card, idx) => (
            <article key={idx} className="bg-paper border-border relative rounded-2xl border p-6">
              <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
                {card.level}
              </p>
              <h3 className="text-fg mt-2 text-lg leading-snug font-semibold">{card.title}</h3>
              <p className="text-fg-soft mt-3 text-sm leading-relaxed">{card.body}</p>
              <p className="text-fg-muted mt-4 text-[12px] tracking-wide">
                <span className="text-fg font-medium">
                  {isFr ? "Niveau conseillé : " : "Recommended level: "}
                </span>
                {card.recommendation}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* CTA FINAL */}
      <CtaBlock
        eyebrow={isFr ? "Démarrer concrètement" : "Start concretely"}
        title={isFr ? "Réservez votre diagnostic flash" : "Book your flash diagnosis"}
        titleEm={isFr ? "à 490 €" : "at €490"}
        description={
          isFr
            ? "Sans engagement · satisfait ou intégralement remboursé. 1 process clé, 3-5 cas d'usage IA, plan d'action 30/90 jours. Si vous voulez aller plus loin, on a 3 niveaux d'audit selon votre taille et votre ambition."
            : "No commitment · satisfied or fully refunded. 1 key process, 3-5 AI use cases, 30/90-day action plan. To go further, we have 3 deeper audit levels based on your size and ambition."
        }
        cta={
          <Cta href="/audit/demande?type=flash" size="lg">
            {isFr ? "Réserver mon diagnostic flash · 490 €" : "Book my flash diagnosis · €490"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
