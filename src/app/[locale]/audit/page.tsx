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
  ClipboardCheck,
  Target,
  Store,
  Briefcase,
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
        ? "Audit IA en entreprise · 4 formats · à partir de 290 €"
        : "AI audit on site · 4 formats · from €290",
    description:
      locale === "fr"
        ? "Audit IA opérationnel : entreprise complète ou département cible, point de vente, cabinet ou agence. TPE / PME / grandes entreprises, France et international, à distance ou sur site."
        : "Operational AI audit: full company or single department, storefront, firm or agency. Small to enterprise, France and worldwide, remote or on site.",
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

// Surface (fond du bloc) par slug — peps en variant le décor.
// Le bloc cabinet est dark (mocha-rich) pour trancher.
const surfaceBySlug: Record<AuditSlug, { container: string; aside: string; isDark: boolean }> = {
  complet: {
    container: "bg-halo-warm",
    aside: "bg-paper border-terracotta/15",
    isDark: false,
  },
  departement: {
    container: "bg-halo-cool",
    aside: "bg-paper border-primary/15",
    isDark: false,
  },
  "point-de-vente": {
    container: "bg-sand",
    aside: "bg-paper border-sage/20",
    isDark: false,
  },
  cabinet: {
    container: "bg-mocha-rich text-mocha-fg",
    aside: "bg-mocha-soft border-mocha-fg/15",
    isDark: true,
  },
};

const ICON_BY_SLUG: Record<AuditSlug, typeof ClipboardCheck> = {
  complet: ClipboardCheck,
  departement: Target,
  "point-de-vente": Store,
  cabinet: Briefcase,
};

export default async function AuditListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Bandeau "Pour qui" — 5 réassurances B2B (sans engagement de durée).
  const audienceStrip = [
    {
      icon: Globe2,
      label: isFr ? "France & international" : "France & international",
      detail: isFr ? "Sur site partout dans le monde" : "On site worldwide",
    },
    {
      icon: Building2,
      label: isFr ? "TPE · PME · grandes entreprises" : "Small · mid-market · enterprise",
      detail: isFr ? "Tous secteurs, tous niveaux" : "All sectors, all levels",
    },
    {
      icon: Users2,
      label: isFr ? "Global ou ciblé" : "Full or targeted",
      detail: isFr ? "Toute l'entreprise ou un seul service" : "Whole company or one department",
    },
    {
      icon: ClipboardCheck,
      label: isFr ? "Rapport remis en main propre" : "Report handed over personally",
      detail: isFr ? "Restitution dédiée avec votre équipe" : "Dedicated debrief with your team",
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

  // ItemList JSON-LD — chaque audit listé comme Service.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Audits IA en entreprise" : "Corporate AI audits",
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
        },
      };
    }),
  } as const;

  return (
    <>
      {/* HERO — layout 2 colonnes (text + flow narratif "C'est quoi un audit").
          Le schéma est SANS fond (transparent) ; le hero garde son
          halo-warm + grille décorative en arrière-plan, mais à très
          faible opacité pour ne pas concurrencer le flow. */}
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
                {isFr ? "Auditer toute votre " : "Audit your whole "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "entreprise" : "company"}
                </span>
                {isFr
                  ? " — ou un seul service, à votre rythme."
                  : " — or one department, at your pace."}
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Nous intervenons en entreprise pour cartographier vos opportunités IA, prioriser les quick-wins et chiffrer le plan d'implémentation. 4 formats au choix, du global à l'ultra-ciblé. TPE, PME, ETI ou grandes entreprises — France et international, à distance ou sur site."
                  : "We come on site to map your AI opportunities, prioritize quick-wins and cost the implementation plan. 4 formats from global to ultra-targeted. Small, mid-market or enterprise — France and worldwide, remote or on site."}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href="/audit/demande"
                  size="lg"
                  className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
                >
                  {isFr
                    ? "Demander un audit · 290 € à 1 990 €"
                    : "Request an audit · €290 to €1,990"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/cas-concrets" variant="outline" size="lg">
                  {isFr ? "Voir les cas concrets" : "See case studies"}
                </Cta>
              </div>
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

      {/* 4 FORMATS — premier full-width (audit complet phare), 3 autres en grid 2×2 + 1 */}
      <Section
        eyebrow={isFr ? "Choisir votre format d'audit" : "Pick your audit format"}
        title={isFr ? "4 formats d'audit IA" : "4 AI audit formats"}
        titleEm={isFr ? "à votre mesure" : "for every fit"}
        description={
          isFr
            ? "Chaque bloc est cliquable et mène à la page dédiée. Vous voyez immédiatement la durée, le prix par taille, ce que vous obtenez et comment se déroule la prestation."
            : "Every card is clickable and links to the dedicated page. You immediately see the duration, the price per size, what you get and how the engagement runs."
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
            const isFlagship = idx === 0;
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
                      {isFr ? "Durée" : "Duration"}
                    </dt>
                    <dd className={`mt-1 text-[15px] font-semibold ${txt}`}>{s.duration}</dd>
                  </div>
                  {s.priceTiers && s.priceTiers.length > 0 ? (
                    <div>
                      <dt className={`text-[11px] tracking-[0.12em] uppercase ${txtMuted}`}>
                        {isFr ? "Tarifs par taille" : "Price by size"}
                      </dt>
                      <ul className="mt-2 space-y-1.5">
                        {s.priceTiers.map((tier, i) => (
                          <li
                            key={i}
                            className="border-l-terracotta rounded-md border-l-2 py-1 pl-3"
                          >
                            <p className={cn("text-[12.5px]", txtSoft)}>{tier.size}</p>
                            <p className={cn("mt-0.5 text-[13px] font-semibold tabular-nums", txt)}>
                              <span className={txtMuted}>{isFr ? "à distance " : "remote "}</span>
                              {tier.remote}
                              <span className="mx-2 opacity-40">·</span>
                              <span className={txtMuted}>{isFr ? "sur site " : "on site "}</span>
                              {tier.onsite}
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
                </dl>
              </aside>
            );

            const KpiInline = (
              <dl className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { label: isFr ? "Durée" : "Duration", value: s.duration },
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
                {isFlagship ? (
                  <span
                    className={cn(
                      "shadow-subtle pointer-events-none absolute top-5 right-5 z-[3] inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
                      acc.chipBg,
                      acc.chipText,
                    )}
                  >
                    <Sparkles aria-hidden="true" className="h-3 w-3" />
                    {isFr ? "Format global · dès 290 €" : "Global format · from €290"}
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
                        {s.audience}
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

      {/* GRILLE TARIFAIRE détaillée — visibilité maximale */}
      <Section
        id="tarifs"
        tone="sand"
        eyebrow={isFr ? "Tarifs affichés" : "Public pricing"}
        title={isFr ? "4 tailles d'entreprise" : "4 company sizes"}
        titleEm={isFr ? "× 2 modalités" : "× 2 modalities"}
        description={
          isFr
            ? "Tarifs HT pour l'audit complet. Pour les autres formats (département, point de vente, cabinet), consultez la fiche dédiée. Au-delà de 250 collaborateurs ou pour les missions multi-sites, devis personnalisé sous 48 h ouvrées."
            : "Excl. VAT prices for the full audit. For other formats (department, storefront, firm), see the dedicated page. Beyond 250 employees or for multi-site engagements, custom quote within 48 business hours."
        }
        contentClassName={TIGHT_X}
      >
        <div className="border-border bg-paper shadow-subtle overflow-hidden rounded-2xl border">
          <table className="w-full text-left">
            <thead className="bg-halo-warm border-border border-b">
              <tr>
                <th className="text-fg p-5 text-sm font-semibold">
                  {isFr ? "Taille d'entreprise" : "Company size"}
                </th>
                <th className="text-fg p-5 text-sm font-semibold">
                  {isFr ? "À distance" : "Remote"}
                </th>
                <th className="text-fg p-5 text-sm font-semibold">
                  {isFr ? "Sur site" : "On site"}
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  size: isFr ? "TPE / Artisan (1-9)" : "Small / Artisan (1-9)",
                  remote: isFr ? "290 €" : "€290",
                  onsite: isFr ? "490 €" : "€490",
                },
                {
                  size: isFr ? "PME (10-49)" : "PME (10-49)",
                  remote: isFr ? "690 €" : "€690",
                  onsite: isFr ? "990 €" : "€990",
                },
                {
                  size: isFr ? "Moyenne (50-249)" : "Mid-market (50-249)",
                  remote: isFr ? "1 290 €" : "€1,290",
                  onsite: isFr ? "1 990 €" : "€1,990",
                },
                {
                  size: isFr ? "Grande entreprise (250+)" : "Enterprise (250+)",
                  remote: isFr ? "Sur devis" : "On quote",
                  onsite: isFr ? "Sur devis" : "On quote",
                },
              ].map((row) => (
                <tr key={row.size} className="border-border border-b last:border-0">
                  <td className="text-fg p-5 text-sm font-medium">{row.size}</td>
                  <td className="text-fg p-5 text-sm tabular-nums">{row.remote}</td>
                  <td className="text-fg p-5 text-sm font-semibold tabular-nums">{row.onsite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-fg-muted mt-6 max-w-2xl text-sm leading-relaxed">
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
                ? "L'audit complet ou département identifie 5-10 quick-wins immédiats sans bouleverser vos process. Vous gardez la main."
                : "The full or department audit identifies 5-10 immediate quick-wins without disrupting your processes. You keep control.",
              recommendation: isFr ? "Audit complet · département" : "Full · department",
            },
            {
              level: isFr ? "Niveau 2" : "Stage 2",
              title: isFr ? "Premiers usages IA déjà testés" : "Early AI uses already tried",
              body: isFr
                ? "L'audit département ou point de vente structure ce qui marche, élimine ce qui n'en vaut pas la peine, et chiffre la suite."
                : "The department or storefront audit structures what works, drops what doesn't, and costs the next step.",
              recommendation: isFr ? "Département · point de vente" : "Department · storefront",
            },
            {
              level: isFr ? "Niveau 3" : "Stage 3",
              title: isFr
                ? "Usages IA matures, recherche d'optimisation"
                : "Mature AI uses, looking to optimize",
              body: isFr
                ? "L'audit cabinet/agence ou complet pose un benchmark concurrentiel et identifie les leviers de scalabilité non encore exploités."
                : "The firm or full audit benchmarks competitors and identifies unexploited scaling levers.",
              recommendation: isFr ? "Complet · cabinet / agence" : "Full · firm / agency",
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
                  {isFr ? "Format conseillé : " : "Recommended format: "}
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
        title={isFr ? "Demandez votre audit IA" : "Request your AI audit"}
        titleEm={isFr ? "en 2 minutes" : "in 2 minutes"}
        description={
          isFr
            ? "Formulaire en 6 étapes : on cadre votre entreprise, votre périmètre et la modalité — vous recevez un devis personnalisé sous 48 h ouvrées. France et international, dès 1 personne — toutes les entreprises sont les bienvenues."
            : "6-step form: we frame your company, scope and modality — you get a personalised quote within 48 business hours. France and worldwide, from 1 employee — every company is welcome."
        }
        cta={
          <Cta href="/audit/demande" size="lg">
            {isFr ? "Demander un audit personnalisé" : "Request a personalised audit"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
