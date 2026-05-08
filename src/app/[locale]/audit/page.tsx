import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  Globe2,
  Building,
  Building2,
  Users2,
  Sparkles,
  Zap,
  Workflow,
  Briefcase,
  Network,
  Lightbulb,
  Wrench,
  BarChart3,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { AuditHeroSchema } from "@/components/sections/AuditHeroSchema";
import {
  TrustBadges,
  WhyAxionIA,
  SocialProof,
  SignatureCard,
  AuditFaqSection,
  BeyondAuditBlock,
} from "@/components/sections/AuditConversionBlocks";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AUDITS, type AuditAccent, type AuditSlug } from "@/content/audit";
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
    path: "/audit",
    title:
      locale === "fr"
        ? "Audit IA en entreprise Â· 4 niveaux Â· diagnostic flash dÃ¨s 490 â‚¬"
        : "AI audit Â· 4 levels Â· flash diagnosis from â‚¬490",
    description:
      locale === "fr"
        ? "Pyramide d'audit IA en 4 niveaux : Flash 490 â‚¬, Audit ciblÃ© 1 900-3 900 â‚¬, StratÃ©gique PME 4 900-9 900 â‚¬, StratÃ©gique ETI Ã  partir de 12 000 â‚¬. France & international."
        : "4-level AI audit pyramid: Flash â‚¬490, Targeted audit â‚¬1,900-â‚¬3,900, Strategic SMB â‚¬4,900-â‚¬9,900, Strategic mid-cap from â‚¬12,000. France & worldwide.",
  });
}

// Padding latÃ©ral rÃ©duit (alignement avec /interventions).
const TIGHT_X = "lg:px-6 xl:px-10";

// Mapping classes accent â€” prÃ©-dÃ©finis statiquement pour Tailwind JIT.
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

// Surface (fond du bloc) par niveau â€” peps en variant le dÃ©cor.
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

// Ã‰tiquette de prix top-right sur chaque card de la pyramide.
// AffichÃ©e en serif italique terracotta â€” visible immÃ©diatement Ã  l'arrivÃ©e.
const PRICE_TAG_BY_SLUG: Record<AuditSlug, { fr: string; en: string }> = {
  flash: { fr: "490 â‚¬", en: "â‚¬490" },
  process: { fr: "1 900 â‚¬", en: "â‚¬1,900" },
  "strategique-pme": { fr: "4 900 â‚¬", en: "â‚¬4,900" },
  "strategique-eti": { fr: "12 000 â‚¬", en: "â‚¬12,000" },
};

export default async function AuditListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Bandeau "Pour qui" â€” 5 rÃ©assurances B2B.
  const audienceStrip = [
    {
      icon: Globe2,
      label: isFr ? "France & international" : "France & international",
      detail: isFr ? "Sur site partout dans le monde" : "On site worldwide",
    },
    {
      icon: Building2,
      label: isFr ? "TPE â†’ ETI / groupes" : "Small â†’ mid-cap",
      detail: isFr ? "Tous secteurs, tous niveaux" : "All sectors, all levels",
    },
    {
      icon: Users2,
      label: isFr ? "1 zone ou toute l'entreprise" : "1 area or whole company",
      detail: isFr ? "Niveau adaptÃ© Ã  votre besoin" : "Right level for your need",
    },
    {
      icon: Zap,
      label: isFr ? "TÃ¢ches automatisables identifiÃ©es" : "Automatable tasks identified",
      detail: isFr ? "Avec gains chiffrÃ©s par tÃ¢che" : "With costed gains per task",
    },
    {
      icon: Sparkles,
      label: isFr ? "Plan d'action chiffrÃ©" : "Costed action plan",
      detail: isFr
        ? "Quick-wins triÃ©s par gain et complexitÃ©"
        : "Quick-wins sorted by gain & ease",
    },
  ];

  // Breadcrumb visuel + JSON-LD intÃ©grÃ© (composant unique). L'item "Accueil"
  // est ajoutÃ© automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/audit", label: isFr ? "Audit & optimisation" : "Audit & optimization" },
  ];

  // Service JSON-LD avec areasServed multi-rÃ©gions (Sprint 14.9 levier 2).
  // Signal AEO/GEO Â« audit IA disponible partout en France Â» pour Perplexity,
  // Google AI Overviews, Claude.ai. Couvre Country FR + 12 rÃ©gions + Paris.
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/audit",
    name: isFr
      ? "Audit IA opÃ©rationnel Â· 4 niveaux Â· AxionIA"
      : "Operational AI audit Â· 4 tiers Â· AxionIA",
    description: isFr
      ? "Audit IA en entreprise : pyramide 4 niveaux (Flash 490 â‚¬ Â· CiblÃ© 1 900-3 900 â‚¬ Â· StratÃ©gique PME 4 900-9 900 â‚¬ Â· StratÃ©gique ETI dÃ¨s 12 000 â‚¬). Diagnostic actionnable, ROI chiffrÃ©, plan d'attaque livrÃ© sous 5 jours."
      : "Corporate AI audit: 4-tier pyramid (Flash â‚¬490 Â· Targeted â‚¬1,900-3,900 Â· SME Strategic â‚¬4,900-9,900 Â· Mid-cap Strategic from â‚¬12,000). Actionable diagnosis, costed ROI, action plan delivered in 5 days.",
    serviceType: "AI audit",
    priceEur: 490,
    areasServed: buildServiceAreasServed(loc),
  });

  // ItemList JSON-LD â€” chaque niveau listÃ© comme Service.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Audits IA â€” pyramide 4 niveaux" : "AI audits â€” 4-level pyramid",
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
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO â€” layout 2 colonnes (text + flow narratif "C'est quoi un audit").
          Pas de overflow-hidden sur la section : le graphique peut Ãªtre grand,
          on ne veut pas qu'il soit tronquÃ©. Le dÃ©cor de fond est lui-mÃªme
          absolute inset-0 donc ne dÃ©passera pas. */}
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

        <Container className={cn("relative", TIGHT_X)}>
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche â€” eyebrow + titre + description + CTAs */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Module 2 Â· Audit & optimisation" : "Module 2 Â· Audit & optimization"}
              </p>

              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Faites le point sur l'IA" : "Take stock of AI"}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "dans votre entreprise" : "in your company"}
                </span>
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "On cartographie votre entreprise et on identifie tout ce que l'IA peut y apporter, automatiser ou optimiser. 4 niveaux dÃ¨s 490 â‚¬ Â· France & international."
                  : "We map your company and identify everything AI can bring, automate or optimise. 4 levels from â‚¬490 Â· France & worldwide."}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href="/audit/demande?type=flash"
                  size="lg"
                  className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-[0_8px_24px_-8px_rgba(194,74,27,0.6)]"
                >
                  {isFr
                    ? "RÃ©server mon diagnostic flash Â· 490 â‚¬"
                    : "Book my flash diagnosis Â· â‚¬490"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/cas-concrets" variant="outline" size="lg">
                  {isFr ? "Voir les cas concrets" : "See case studies"}
                </Cta>
              </div>
            </div>

            {/* Colonne droite â€” flow narratif "Ce que c'est et comment Ã§a
                fonctionne". Compact : on garde le H1 du hero comme Ã©lÃ©ment
                visuel dominant. */}
            <AuditHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "SchÃ©ma : votre entreprise au dÃ©part, 4 Ã©tapes mÃ©thodologiques de l'audit AxionIA (on observe, on cartographie, on priorise, on remet le plan), puis 6 gains business concrets (chiffre d'affaires en hausse, rentabilitÃ© amÃ©liorÃ©e, tÃ¢ches automatisÃ©es, heures libÃ©rÃ©es, Ã©quipes formÃ©es Ã  l'IA, pilotage au jour le jour)."
                  : "Diagram: your company at the start, 4 methodology steps of the AxionIA audit (we observe, we map, we prioritise, we hand over the plan), then 6 concrete business gains (revenue growth, improved profitability, tasks automated, hours freed, teams trained in AI, day-to-day tracking)."
              }
            />
          </div>
        </Container>
      </section>

      {/* TRUST BADGES â€” rÃ©assurance institutionnelle juste sous le hero */}
      <TrustBadges isFr={isFr} />

      {/* BANDEAU Â« Pour qui Â» â€” rÃ©assurance immÃ©diate, 5 pills */}
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

      {/* MATCHER â€” orientation immÃ©diate en 2 entrÃ©es (taille / situation).
          Pure server : juste des <a href="#level-X"> qui scrollent vers la
          card concernÃ©e. Le highlight :target la met en avant. */}
      <Section
        eyebrow={isFr ? "Trouvez votre niveau en 5 secondes" : "Find your level in 5 seconds"}
        title={isFr ? "Lequel" : "Which one"}
        titleEm={isFr ? "vous correspond ?" : "fits you?"}
        description={
          isFr
            ? "Cliquez sur ce qui vous dÃ©crit le mieux â€” la page vous emmÃ¨ne directement Ã  l'option recommandÃ©e. Vous pouvez aussi explorer la pyramide complÃ¨te juste en dessous."
            : "Click what describes you best â€” the page jumps straight to the recommended option. You can also explore the full pyramid below."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          {/* EntrÃ©e A â€” par taille d'entreprise */}
          <div>
            <p className="text-fg-muted mb-4 flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] uppercase">
              <Compass aria-hidden="true" className="text-terracotta-deep h-4 w-4" />
              {isFr ? "A Â· Selon la taille de votre entreprise" : "A Â· By company size"}
            </p>
            <ul className="space-y-3">
              {(isFr
                ? [
                    {
                      icon: Briefcase,
                      title: "TPE Â· 1 Ã  9 personnes",
                      hint: "Artisan, indÃ©pendant, petite Ã©quipe",
                      target: "flash",
                      level: "Niveau 1 Â· Flash Â· 490 â‚¬",
                    },
                    {
                      icon: Building,
                      title: "PME Â· 10 Ã  49 personnes",
                      hint: "1 service Ã  optimiser ou aller plus loin",
                      target: "process",
                      level: "Niveau 2 Â· Audit ciblÃ© Â· 1 900 â‚¬+",
                    },
                    {
                      icon: Building2,
                      title: "PME Â· 50 Ã  249 personnes",
                      hint: "Plusieurs services, vision d'ensemble",
                      target: "strategique-pme",
                      level: "Niveau 3 Â· StratÃ©gique PME Â· 4 900 â‚¬+",
                    },
                    {
                      icon: Network,
                      title: "ETI Â· 250+ ou multi-sites",
                      hint: "Plusieurs BU, plusieurs sites, gouvernance IA",
                      target: "strategique-eti",
                      level: "Niveau 4 Â· StratÃ©gique ETI Â· 12 000 â‚¬+",
                    },
                  ]
                : [
                    {
                      icon: Briefcase,
                      title: "Small Â· 1 to 9 people",
                      hint: "Artisan, freelance, small team",
                      target: "flash",
                      level: "Level 1 Â· Flash Â· â‚¬490",
                    },
                    {
                      icon: Building,
                      title: "SMB Â· 10 to 49 people",
                      hint: "1 service to optimise or go further",
                      target: "process",
                      level: "Level 2 Â· Targeted Â· â‚¬1,900+",
                    },
                    {
                      icon: Building2,
                      title: "SMB Â· 50 to 249 people",
                      hint: "Several services, full picture",
                      target: "strategique-pme",
                      level: "Level 3 Â· Strategic SMB Â· â‚¬4,900+",
                    },
                    {
                      icon: Network,
                      title: "Mid-cap Â· 250+ or multi-site",
                      hint: "Several BUs, multiple sites, AI governance",
                      target: "strategique-eti",
                      level: "Level 4 Â· Strategic mid-cap Â· â‚¬12,000+",
                    },
                  ]
              ).map((opt) => {
                const Icon = opt.icon as LucideIcon;
                return (
                  <li key={opt.title}>
                    <a
                      href={`#level-${opt.target}`}
                      className="border-border bg-paper hover:border-terracotta hover:bg-halo-warm hover:shadow-card focus-visible:ring-terracotta group flex items-center gap-4 rounded-2xl border-2 p-4 transition-all focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="bg-terracotta-soft text-terracotta-deep group-hover:bg-terracotta group-hover:text-mocha-fg flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors">
                        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-fg text-base leading-tight font-bold">{opt.title}</p>
                        <p className="text-fg-soft mt-0.5 text-sm leading-snug">{opt.hint}</p>
                        <p className="text-terracotta-deep mt-1.5 text-[12px] font-bold tracking-wide">
                          â†’ {opt.level}
                        </p>
                      </div>
                      <ArrowRight
                        aria-hidden="true"
                        className="text-terracotta-deep h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* EntrÃ©e B â€” par situation/souhait */}
          <div>
            <p className="text-fg-muted mb-4 flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] uppercase">
              <Compass aria-hidden="true" className="text-terracotta-deep h-4 w-4" />
              {isFr ? "B Â· Selon votre situation" : "B Â· By your situation"}
            </p>
            <ul className="space-y-3">
              {(isFr
                ? [
                    {
                      icon: Lightbulb,
                      title: "Je veux savoir oÃ¹ l'IA peut s'insÃ©rer",
                      hint: "DÃ©couvrir 3-5 endroits concrets, sans engagement",
                      target: "flash",
                      level: "Niveau 1 Â· Flash Â· 490 â‚¬",
                    },
                    {
                      icon: Wrench,
                      title: "Je veux automatiser un service prÃ©cis",
                      hint: "Vente, RH, finance, ops, support â€” Ã©tudiÃ© de A Ã  Z",
                      target: "process",
                      level: "Niveau 2 Â· Audit ciblÃ© Â· 1 900 â‚¬+",
                    },
                    {
                      icon: BarChart3,
                      title: "Je veux une vision globale de mon entreprise",
                      hint: "Plusieurs services Ã©tudiÃ©s, plan stratÃ©gique chiffrÃ©",
                      target: "strategique-pme",
                      level: "Niveau 3 Â· StratÃ©gique PME Â· 4 900 â‚¬+",
                    },
                    {
                      icon: Network,
                      title: "Je gÃ¨re plusieurs sites ou plusieurs BU",
                      hint: "Alignement CODIR, gouvernance, AI Act",
                      target: "strategique-eti",
                      level: "Niveau 4 Â· StratÃ©gique ETI Â· 12 000 â‚¬+",
                    },
                  ]
                : [
                    {
                      icon: Lightbulb,
                      title: "I want to know where AI can fit in",
                      hint: "Discover 3-5 concrete places, no commitment",
                      target: "flash",
                      level: "Level 1 Â· Flash Â· â‚¬490",
                    },
                    {
                      icon: Wrench,
                      title: "I want to automate a specific service",
                      hint: "Sales, HR, finance, ops, support â€” studied A to Z",
                      target: "process",
                      level: "Level 2 Â· Targeted Â· â‚¬1,900+",
                    },
                    {
                      icon: BarChart3,
                      title: "I want a global vision of my company",
                      hint: "Multiple services studied, costed strategic plan",
                      target: "strategique-pme",
                      level: "Level 3 Â· Strategic SMB Â· â‚¬4,900+",
                    },
                    {
                      icon: Network,
                      title: "I manage multiple sites or BUs",
                      hint: "Leadership alignment, governance, AI Act",
                      target: "strategique-eti",
                      level: "Level 4 Â· Strategic mid-cap Â· â‚¬12,000+",
                    },
                  ]
              ).map((opt) => {
                const Icon = opt.icon as LucideIcon;
                return (
                  <li key={opt.title}>
                    <a
                      href={`#level-${opt.target}`}
                      className="border-border bg-paper hover:border-terracotta hover:bg-halo-warm hover:shadow-card focus-visible:ring-terracotta group flex items-center gap-4 rounded-2xl border-2 p-4 transition-all focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="bg-terracotta-soft text-terracotta-deep group-hover:bg-terracotta group-hover:text-mocha-fg flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors">
                        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-fg text-base leading-tight font-bold">{opt.title}</p>
                        <p className="text-fg-soft mt-0.5 text-sm leading-snug">{opt.hint}</p>
                        <p className="text-terracotta-deep mt-1.5 text-[12px] font-bold tracking-wide">
                          â†’ {opt.level}
                        </p>
                      </div>
                      <ArrowRight
                        aria-hidden="true"
                        className="text-terracotta-deep h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Helper "pas sÃ»r" */}
        <p className="text-fg-muted mt-8 text-center text-sm">
          {isFr ? (
            <>
              Pas sÃ»rÂ·e ? Le{" "}
              <a
                href="#level-flash"
                className="text-terracotta-deep font-semibold underline underline-offset-4 hover:opacity-80"
              >
                diagnostic flash 490 â‚¬
              </a>{" "}
              est conÃ§u exactement pour Ã§a : on identifie 3 Ã  5 endroits oÃ¹ l&apos;IA peut
              s&apos;insÃ©rer concrÃ¨tement chez vous.
            </>
          ) : (
            <>
              Not sure? The{" "}
              <a
                href="#level-flash"
                className="text-terracotta-deep font-semibold underline underline-offset-4 hover:opacity-80"
              >
                â‚¬490 flash diagnosis
              </a>{" "}
              is designed exactly for this: we identify 3 to 5 concrete places where AI can fit in
              your company.
            </>
          )}
        </p>
      </Section>

      {/* PYRAMIDE â€” 4 cards par niveau (exploration complÃ¨te).
          Les ancres #level-flash, #level-process, etc. sont posÃ©es sur
          chaque card pour que le matcher au-dessus puisse y scroller. */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Tous les niveaux en dÃ©tail" : "All levels in detail"}
        title={isFr ? "Comparez les" : "Compare the"}
        titleEm={isFr ? "4 niveaux d'audit" : "4 audit levels"}
        description={
          isFr
            ? "Vous arrivez ici depuis le sÃ©lecteur ? La carte qui vous est recommandÃ©e est mise en avant. Sinon, parcourez librement â€” chaque niveau prÃ©cise le pÃ©rimÃ¨tre, le prix et les livrables."
            : "Coming from the matcher above? Your recommended card is highlighted. Otherwise, browse freely â€” each level details scope, price and deliverables."
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
                      {isFr ? "PÃ©rimÃ¨tre" : "Scope"}
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
                      {isFr ? "ModalitÃ©" : "Modality"}
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
                  { label: isFr ? "PÃ©rimÃ¨tre" : "Scope", value: s.scope },
                  { label: isFr ? "Tarif" : "Price", value: s.priceFrom },
                  { label: isFr ? "ModalitÃ©" : "Modality", value: s.modality },
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
                id={`level-${item.slug}`}
                className={cn(
                  "shadow-subtle group/card hover:shadow-card relative scroll-mt-32 overflow-hidden rounded-3xl border-2 ring-1 transition-all",
                  // Highlight quand l'utilisateur arrive via #level-X (matcher).
                  "target:ring-terracotta target:scale-[1.01] target:ring-4",
                  surface.container,
                  acc.border,
                  acc.haloRing,
                  isFlagship && "lg:col-span-2",
                )}
                {...(dark ? { "data-tone": "dark" as const } : {})}
              >
                <Link
                  href={href as never}
                  aria-label={`${c.title} â€” ${s.ctaLabel}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{s.ctaLabel}</span>
                </Link>

                <span aria-hidden="true" className={`block h-1.5 w-full ${acc.line}`} />

                <div
                  className={cn(
                    "p-7 sm:p-8",
                    isFlagship &&
                      "lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10 lg:p-10",
                  )}
                >
                  <div>
                    {/* Header : icon + eyebrow Ã  gauche, PRIX en gros Ã  droite.
                        Le prix est l'Ã©lÃ©ment le plus visible de la card â€”
                        serif italique terracotta, immÃ©diatement lisible. */}
                    <div className="flex items-start gap-3">
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
                          "mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase",
                          acc.badge,
                        )}
                      >
                        {c.eyebrow}
                      </span>

                      {/* PriceTag â€” Ã©tiquette de prix bien visible.
                          Sur card dark (ETI), on bascule terracotta-soft. */}
                      <div aria-hidden="true" className="ml-auto shrink-0 text-right">
                        <p
                          className={cn(
                            "text-[10px] font-bold tracking-[0.16em] uppercase sm:text-[11px]",
                            dark ? "text-mocha-fg/65" : "text-fg-muted",
                          )}
                        >
                          {isFr ? "Ã€ partir de" : "From"}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-[1.75rem] leading-none font-medium tracking-tight italic tabular-nums sm:text-[2rem] lg:text-[2.5rem]",
                            dark ? "text-terracotta-soft" : "text-terracotta",
                          )}
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {PRICE_TAG_BY_SLUG[item.slug][loc]}
                        </p>
                      </div>
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
                        {isFr ? "Voir le dÃ©tail" : "See details"}
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

      {/* GRILLE TARIFAIRE consolidÃ©e â€” 4 lignes par niveau */}
      <Section
        id="tarifs"
        tone="sand"
        eyebrow={isFr ? "Tarifs affichÃ©s" : "Public pricing"}
        title={isFr ? "Pyramide tarifaire" : "Pricing pyramid"}
        titleEm={isFr ? "transparente" : "transparent"}
        description={
          isFr
            ? "Tarifs HT. Sous le marchÃ© Ã  chaque Ã©tage, structure professionnelle, scope dÃ©fini. Pour les ETI, devis personnalisÃ© sous 48 h ouvrÃ©es avec phases et budgets."
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
                  {isFr ? "PÃ©rimÃ¨tre" : "Scope"}
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
                          <p className="text-fg-muted mt-0.5 text-[11px] leading-snug">{s.scope}</p>
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

        <p className="text-fg-muted mt-6 max-w-2xl text-base leading-relaxed">
          {isFr
            ? "Frais de dÃ©placement (sur site uniquement) : forfait journalier sans justificatifs. Logement Ã  la charge du client si plus de 200 km de Paris. DÃ©tails dans la "
            : "Travel fees (on site only): flat daily rate, no receipts. Lodging at client's expense if more than 200 km from Paris. Details in the "}
          <Link
            href="/politique-deplacement"
            className="text-terracotta-deep underline underline-offset-4 hover:opacity-80"
          >
            {isFr ? "politique de dÃ©placement" : "travel policy"}
          </Link>
          .
        </p>
      </Section>

      {/* QUIZ "Comment choisir votre niveau" â€” 3 questions guides */}
      <Section
        eyebrow={isFr ? "Comment choisir" : "How to choose"}
        title={isFr ? "Quel niveau" : "Which level"}
        titleEm={isFr ? "pour vous ?" : "for you?"}
        description={
          isFr
            ? "3 questions simples pour vous orienter vers le bon format. La rÃ¨gle : commencez petit (Flash), montez en gamme quand vous avez besoin de profondeur."
            : "3 simple questions to point you to the right format. The rule: start small (Flash), level up when you need depth."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              question: isFr
                ? "Vous dÃ©marrez avec l'IA ou vous explorez ?"
                : "You're starting with AI or exploring?",
              answer: isFr ? "Niveau 1 Â· Flash" : "Level 1 Â· Flash",
              detail: isFr
                ? "Sur 1 zone clÃ© de votre entreprise, on identifie 3 Ã  5 endroits oÃ¹ l'IA peut s'insÃ©rer concrÃ¨tement, avec gains chiffrÃ©s et plan d'action immÃ©diat."
                : "On 1 key area of your company, we identify 3 to 5 places where AI can fit in concretely, with costed gains and an immediate action plan.",
              cta: isFr
                ? "RÃ©server le diagnostic flash Â· 490 â‚¬"
                : "Book the flash diagnosis Â· â‚¬490",
              href: "/audit/demande?type=flash",
              accent: "terracotta",
            },
            {
              question: isFr
                ? "Vous avez un service prÃ©cis Ã  automatiser ?"
                : "You have a specific service to automate?",
              answer: isFr ? "Niveau 2 Â· Audit ciblÃ©" : "Level 2 Â· Targeted",
              detail: isFr
                ? "RH, finance, vente, ops, support â€” un service complet Ã©tudiÃ© de A Ã  Z. On liste tout ce qui peut Ãªtre automatisÃ© avec gains chiffrÃ©s et plan 6-12 mois."
                : "HR, finance, sales, ops, support â€” a full service studied A to Z. We list everything that can be automated with costed gains and a 6-12 month plan.",
              cta: isFr ? "Demander un audit ciblÃ©" : "Request a targeted audit",
              href: "/audit/demande?type=process",
              accent: "primary",
            },
            {
              question: isFr
                ? "Vous voulez une vision globale ou un plan groupe ?"
                : "You want a global vision or a group plan?",
              answer: isFr
                ? "Niveau 3 ou 4 Â· StratÃ©gique PME ou ETI"
                : "Level 3 or 4 Â· Strategic SMB or mid-cap",
              detail: isFr
                ? "PME 20-250 salariÃ©s : audit stratÃ©gique 4,9-9,9 kâ‚¬. ETI / multi-sites : audit groupe Ã  partir de 12 kâ‚¬, alignement CODIR et premiers jalons AI Act."
                : "SMB 20-250 staff: strategic audit â‚¬4.9-9.9k. Mid-cap / multi-site: group audit from â‚¬12k, leadership alignment and AI Act milestones.",
              cta: isFr ? "Demander un audit stratÃ©gique" : "Request a strategic audit",
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
                  â†’ {q.answer}
                </div>
                <p className="text-fg-soft mt-4 flex-1 text-base leading-relaxed">{q.detail}</p>
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

      {/* POURQUOI AXIONIA â€” 5 diffÃ©renciants vs concurrence */}
      <WhyAxionIA isFr={isFr} />

      {/* SIGNATURE FONDATEUR â€” lÃ©gitimitÃ© humaine entre WhyAxionIA et SocialProof */}
      <SignatureCard isFr={isFr} />

      {/* PREUVE SOCIALE â€” mÃ©triques + bandeau secteurs + 3 tÃ©moignages */}
      <SocialProof isFr={isFr} />

      {/* FAQ â€” 6 questions clÃ©s + JSON-LD FAQPage */}
      <AuditFaqSection
        isFr={isFr}
        items={
          isFr
            ? [
                {
                  id: "duree-reservation",
                  question: "Combien de temps prend la rÃ©servation ?",
                  answer:
                    "Le diagnostic flash se rÃ©serve via un formulaire 6 Ã©tapes (â‰ˆ 3 minutes). Pour les niveaux Process / StratÃ©gique, vous recevez un devis personnalisÃ© sous 48 h ouvrÃ©es avec un crÃ©neau d'appel proposÃ© pour le cadrage.",
                },
                {
                  id: "remote-onsite",
                  question: "Ã€ distance ou sur site, quelle diffÃ©rence ?",
                  answer:
                    "Ã€ distance : visio sÃ©curisÃ©e + entretiens + analyse des donnÃ©es partagÃ©es. Plus rapide Ã  organiser, tarif rÃ©duit. Sur site : observation directe, immersion Ã©quipe, ateliers mÃ©tier physiques. RecommandÃ© dÃ¨s le niveau Process pour les ateliers mÃ©tier et indispensable pour le niveau Point de vente.",
                },
                {
                  id: "data",
                  question: "Quelles donnÃ©es dois-je vous fournir ?",
                  answer:
                    "Aucune donnÃ©e sensible n'est exfiltrÃ©e hors UE. Tous les entretiens et analyses se font sur place ou en visio sÃ©curisÃ©e. Pour calibrer le devis, nous demandons : taille de l'Ã©quipe, secteur, outils en place, pÃ©rimÃ¨tre cible. Aucun accÃ¨s production demandÃ© avant signature.",
                },
                {
                  id: "after",
                  question: "Que se passe-t-il aprÃ¨s l'audit ?",
                  answer:
                    "Vous repartez avec un plan d'action chiffrÃ©, exÃ©cutable par vos Ã©quipes ou par AxionIA (Module 3 ImplÃ©mentation). Une session de suivi peut Ãªtre programmÃ©e 30 Ã  60 jours aprÃ¨s la livraison pour challenger la mise en Å“uvre â€” sans frais additionnels si elle tient en 60 minutes.",
                },
                {
                  id: "eu-jurisdiction",
                  question: "AxionIA peut-elle facturer en France ?",
                  answer:
                    "Oui. AxionIA OÃœ est une sociÃ©tÃ© europÃ©enne dÃ»ment enregistrÃ©e, opÃ©rant en libre prestation de services dans toute l'UE (incluant France). Facturation HT, paiement par virement SEPA ou carte. DonnÃ©es hÃ©bergÃ©es exclusivement en UE (Hetzner Frankfurt). ConformitÃ© RGPD complÃ¨te.",
                },
                {
                  id: "starting-point",
                  question: "Et si aprÃ¨s l'audit, je ne sais pas par oÃ¹ commencer ?",
                  answer:
                    "Notre rapport est volontairement priorisÃ© : le quick-win #1 doit Ãªtre lanÃ§able dans la semaine qui suit la restitution. Si vous hÃ©sitez, nous proposons un appel de clarification gratuit de 30 minutes dans les 30 jours suivant la livraison. Et le Module 3 ImplÃ©mentation peut prendre le relais sans transition.",
                },
              ]
            : [
                {
                  id: "duree-reservation",
                  question: "How long does booking take?",
                  answer:
                    "The flash diagnosis is booked via a 6-step form (â‰ˆ 3 minutes). For Process / Strategic levels, you receive a personalised quote within 48 business hours with a proposed framing call slot.",
                },
                {
                  id: "remote-onsite",
                  question: "Remote or on site â€” what's the difference?",
                  answer:
                    "Remote: secure video + interviews + analysis of shared data. Faster to organise, reduced fee. On site: direct observation, team immersion, physical business workshops. Recommended from Process level for business workshops and essential for Storefront level.",
                },
                {
                  id: "data",
                  question: "What data do I need to provide?",
                  answer:
                    "No sensitive data is exfiltrated outside the EU. All interviews and analysis happen on-site or in secure video conferencing. To calibrate the quote we ask: team size, sector, tools in place, target scope. No production access requested before signing.",
                },
                {
                  id: "after",
                  question: "What happens after the audit?",
                  answer:
                    "You leave with a costed action plan, executable by your teams or by AxionIA (Module 3 Implementation). A follow-up session can be scheduled 30 to 60 days after delivery to challenge execution â€” at no additional cost if it fits in 60 minutes.",
                },
                {
                  id: "eu-jurisdiction",
                  question: "Can AxionIA invoice in France?",
                  answer:
                    "Yes. AxionIA OÃœ is a duly registered European company, operating under EU free-services-provision (including France). Excl. VAT invoicing, SEPA transfer or card payment. Data hosted exclusively in the EU (Hetzner Frankfurt). Full GDPR compliance.",
                },
                {
                  id: "starting-point",
                  question: "What if I don't know where to start after the audit?",
                  answer:
                    "Our report is deliberately prioritised: quick-win #1 must be launchable within a week of the debrief. If you hesitate, we offer a free 30-minute clarification call within the 30 days following delivery. And Module 3 Implementation can take over without transition.",
                },
              ]
        }
      />

      {/* SECTION ANTI-FEAR â€” quel que soit votre niveau IA */}
      <Section
        eyebrow={isFr ? "ConcernÃ©Â·e quel que soit votre niveau" : "A fit for every AI maturity"}
        title={isFr ? "De zÃ©ro IA Ã  Ã©quipes IA-fluentes," : "From zero AI to fluent teams,"}
        titleEm={isFr ? "un audit pour chaque entreprise" : "an audit for every company"}
        description={
          isFr
            ? "Aucune entreprise n'est trop petite ni trop grande, aucun secteur n'est trop spÃ©cifique. Vous repartez avec une roadmap claire, chiffrÃ©e â€” peu importe d'oÃ¹ vous partez."
            : "No company is too small or too large, no sector is too niche. You leave with a clear, costed roadmap â€” whatever your starting point."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              level: isFr ? "Niveau 1" : "Stage 1",
              title: isFr ? "Aucun usage IA en place" : "No AI use in place",
              body: isFr
                ? "Le diagnostic flash identifie 3 Ã  5 endroits oÃ¹ l'IA peut s'insÃ©rer immÃ©diatement, sans bouleverser votre quotidien. Vous gardez la main."
                : "The flash diagnosis identifies 3 to 5 places where AI can fit in immediately, without disrupting your day-to-day. You keep control.",
              recommendation: isFr ? "Flash Â· Audit ciblÃ©" : "Flash Â· Targeted",
            },
            {
              level: isFr ? "Niveau 2" : "Stage 2",
              title: isFr ? "Premiers usages IA dÃ©jÃ  testÃ©s" : "Early AI uses already tried",
              body: isFr
                ? "L'audit ciblÃ© sur un service structure ce qui marche, Ã©limine ce qui n'en vaut pas la peine, et chiffre la suite avec un plan 6-12 mois."
                : "The targeted audit on a service structures what works, drops what doesn't, and costs the next step with a 6-12 month plan.",
              recommendation: isFr
                ? "Audit ciblÃ© Â· StratÃ©gique PME"
                : "Targeted Â· Strategic SMB",
            },
            {
              level: isFr ? "Niveau 3" : "Stage 3",
              title: isFr
                ? "Usages IA matures, recherche d'optimisation"
                : "Mature AI uses, looking to optimize",
              body: isFr
                ? "L'audit stratÃ©gique pose un benchmark concurrentiel et identifie les leviers de scalabilitÃ© multi-sites encore inexploitÃ©s."
                : "The strategic audit benchmarks competitors and identifies unexploited multi-site scaling levers.",
              recommendation: isFr ? "StratÃ©gique PME Â· ETI" : "Strategic SMB Â· mid-cap",
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
                  {isFr ? "Niveau conseillÃ© : " : "Recommended level: "}
                </span>
                {card.recommendation}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* AU-DELÃ€ DE L'AUDIT â€” bandeau d'upsell vers Module 3 ImplÃ©mentation */}
      <BeyondAuditBlock isFr={isFr} />

      {/* COUVERTURE NATIONALE (Sprint 14.9 levier 3 â€” pSEO) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'audit IA"
        serviceLabelEn="AI audit"
        serviceSlug="audit"
        tone="paper"
      />

      {/* FAQ GÃ‰OLOCALISÃ‰E (Sprint 14.9 levier 4 â€” pSEO) */}
      <LocalGeoFaqSection isFr={isFr} service="audit" tone="sand" />

      {/* CLOSING ILLUSTRATION â€” Sprint Visual Rhythm 2026 */}
      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="AUDIT-03-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/audit-closing.avif"
            caption={
              isFr
                ? "Plan d'action remis â€” document Ã©ditorial reliÃ©, prÃªt Ã  exÃ©cuter"
                : "Action plan handed over â€” bound editorial document, ready to execute"
            }
            alt={
              isFr
                ? "Illustration Ã©ditoriale d'un plan d'action remis Ã  l'issue d'un audit AxionIA."
                : "Editorial illustration of an action plan delivered at the end of an AxionIA audit."
            }
          />
        </Container>
      </Section>

      {/* CTA FINAL */}
      <CtaBlock
        eyebrow={isFr ? "DÃ©marrer concrÃ¨tement" : "Start concretely"}
        title={isFr ? "RÃ©servez votre diagnostic flash" : "Book your flash diagnosis"}
        titleEm={isFr ? "Ã  490 â‚¬" : "at â‚¬490"}
        description={
          isFr
            ? "On identifie 3 Ã  5 endroits concrets oÃ¹ l'IA peut s'insÃ©rer dans votre entreprise et tout ce qui peut Ãªtre automatisÃ©. Si vous voulez aller plus loin, 3 niveaux d'audit plus profonds vous attendent selon votre taille et votre ambition."
            : "We identify 3 to 5 concrete places where AI can fit in your company and everything that can be automated. To go further, 3 deeper audit levels await based on your size and ambition."
        }
        cta={
          <Cta href="/audit/demande?type=flash" size="lg">
            {isFr
              ? "RÃ©server mon diagnostic flash Â· 490 â‚¬"
              : "Book my flash diagnosis Â· â‚¬490"}{" "}
            â†’
          </Cta>
        }
        tone="dark"
      />

      {/* STICKY CTA MOBILE â€” apparaÃ®t au scroll, masquÃ© sur lg+ */}
      <StickyMobileCta
        href="/audit/demande?type=flash"
        label={isFr ? "RÃ©server Flash Â· 490 â‚¬" : "Book Flash Â· â‚¬490"}
        track="audit-flash-sticky-mobile"
        threshold={500}
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
