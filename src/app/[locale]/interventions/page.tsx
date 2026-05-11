import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Globe2,
  Building2,
  Sparkles,
  Plane,
  Calendar,
  PhoneCall,
  ClipboardCheck,
  Target,
  Users,
  User,
  Briefcase,
  Clock,
  Megaphone,
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
import { InterventionsHeroSchema } from "@/components/sections/InterventionsHeroSchema";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { INTERVENTION_TIERS, formatAmount, getEntryPriceEur, getTierById } from "@/content/pricing";
import {
  FAMILIES,
  COLLECTIVE_DURATIONS,
  countFormatsByFamily,
  countFormatsByCell,
  familyPath,
  type FamilyDef,
  type FormatAccent,
} from "@/content/interventions-taxonomy";
import { buildProductMetadata, buildServiceJsonLd, SITE_URL } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";

// ============================================================================
// Sprint 14.10.7 (2026-05-11) — refonte taxonomique en 3 BLOCS FAMILLE.
//
// Avant : 8 cards format (Essentielle, Approfondie, Gagner du temps, Claude,
// Conférence, Dirigeants, Sur demande, etc.) listées en 2 colonnes.
//
// Après : 3 cards famille (Formations équipe / Coaching individuel /
// Dirigeants) sur le hub. Le détail (paliers durée + formats) est exposé en
// cliquant sur chaque famille.
//
// Architecture : SSOT `src/content/interventions-taxonomy.ts`. Une nouvelle
// formation = 1 entrée dans `INTERVENTION_FORMATS`. Aucune modif de cette page
// requise pour qu'elle se reflète dans le compteur.
// ============================================================================

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const essentielle = getTierById(INTERVENTION_TIERS, "intervention-essentielle");
  const essentiellePrice = formatAmount(essentielle.priceFlat!, loc);
  return buildProductMetadata({
    locale,
    path: "/interventions",
    title:
      loc === "fr"
        ? "Interventions IA en entreprise · 4 familles · France & international"
        : "Corporate AI sessions · 4 families · France & international",
    description:
      loc === "fr"
        ? `Interventions et formations IA opérationnelles sur site organisées en 4 blocs : formations équipe (4 h à 3 j+, dès ${essentiellePrice}), coaching individuel 1-to-1, journée stratégique dirigeants, et conférence plénière. France et international.`
        : `Operational AI sessions on site organised in 4 blocks: team trainings (4 h to 3 d+, from ${essentiellePrice}), 1-on-1 coaching, executive strategic day, and plenary talk. France and international.`,
  });
}

// ----------------------------------------------------------------------------
// Accents Tailwind par famille — palette Editorial v3 + exception Claude.
// ----------------------------------------------------------------------------
const familyAccentClasses: Record<
  FormatAccent,
  {
    border: string;
    title: string;
    line: string;
    cta: string;
    haloRing: string;
    chipBg: string;
    chipText: string;
    badge: string;
    iconBg: string;
    iconText: string;
  }
> = {
  terracotta: {
    border: "border-terracotta/35 hover:border-terracotta",
    title: "text-terracotta-deep",
    line: "bg-terracotta",
    cta: "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
    haloRing: "ring-terracotta/15",
    chipBg: "bg-terracotta-soft",
    chipText: "text-terracotta-deep",
    badge: "bg-terracotta-soft text-terracotta-deep border border-terracotta/20",
    iconBg: "bg-terracotta-soft",
    iconText: "text-terracotta-deep",
  },
  primary: {
    border: "border-primary/35 hover:border-primary",
    title: "text-primary",
    line: "bg-primary",
    cta: "bg-primary text-primary-fg hover:bg-primary-hover",
    haloRing: "ring-primary/15",
    chipBg: "bg-primary-soft",
    chipText: "text-primary",
    badge: "bg-primary-soft text-primary border border-primary/25",
    iconBg: "bg-primary-soft",
    iconText: "text-primary",
  },
  sage: {
    border: "border-sage/40 hover:border-sage",
    title: "text-sage",
    line: "bg-sage",
    cta: "bg-sage text-mocha-fg hover:opacity-90",
    haloRing: "ring-sage/20",
    chipBg: "bg-sage-soft",
    chipText: "text-sage",
    badge: "bg-sage-soft text-sage border border-sage/30",
    iconBg: "bg-sage-soft",
    iconText: "text-sage",
  },
  mocha: {
    border: "border-mocha-fg/15 hover:border-terracotta",
    title: "text-terracotta-soft",
    line: "bg-terracotta",
    cta: "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
    haloRing: "ring-terracotta/30",
    chipBg: "bg-terracotta-soft",
    chipText: "text-terracotta-deep",
    badge: "bg-terracotta-soft text-terracotta-deep border border-terracotta/30",
    iconBg: "bg-terracotta-soft",
    iconText: "text-terracotta-deep",
  },
  // hex-ok: brand-anthropic-claude — non utilisé pour les cards famille
  // mais conservé pour compat avec les cards format où Claude est présent.
  claude: {
    border: "border-[#D97757]/40 hover:border-[#D97757]", // hex-ok: brand-anthropic-claude
    title: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
    line: "bg-[#D97757]", // hex-ok: brand-anthropic-claude
    cta: "bg-[#D97757] text-white hover:bg-[#B85F3E]", // hex-ok: brand-anthropic-claude
    haloRing: "ring-[#D97757]/15", // hex-ok: brand-anthropic-claude
    chipBg: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
    chipText: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
    badge: "bg-[#FFF5EC] text-[#9C3E1E] border border-[#D97757]/30", // hex-ok: brand-anthropic-claude
    iconBg: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
    iconText: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
  },
};

// ----------------------------------------------------------------------------
// Helpers locaux pour construire chaque card famille (libellés, sub-rows…).
// ----------------------------------------------------------------------------

interface FamilyCardData {
  family: FamilyDef;
  icon: typeof Users;
  /** Sub-rows : paliers durée (Collectives) ou résumé liste plate (Individuel/Dirigeants). */
  subRows: ReadonlyArray<{ label: string; meta: string }>;
  /** Statut affiché en haut de la card. */
  countLabel: string;
  /** CTA label. */
  ctaLabel: string;
  /** Surface de fond. */
  surface: string;
  /** Dark mode pour la card (texte clair sur fond foncé). */
  isDark?: boolean;
}

function buildFamilyCards(isFr: boolean): ReadonlyArray<FamilyCardData> {
  return FAMILIES.map((family): FamilyCardData => {
    if (family.id === "collectives") {
      // Sub-rows = 4 paliers durée, avec compteur de formats par cellule.
      const subRows = COLLECTIVE_DURATIONS.map((d) => {
        const count = countFormatsByCell("collectives", d.id);
        const label = isFr ? d.labelFr : d.labelEn;
        let meta: string;
        if (d.isQuoteOnly) {
          meta = isFr ? "sur devis" : "on request";
        } else if (count === 0) {
          meta = isFr ? "Bientôt" : "Coming soon";
        } else if (count === 1) {
          meta = isFr ? "1 formation" : "1 training";
        } else {
          meta = isFr ? `${count} formations` : `${count} trainings`;
        }
        return { label, meta };
      });
      const total = countFormatsByFamily("collectives");
      return {
        family,
        icon: Users,
        subRows,
        countLabel: isFr
          ? `${total} formation${total > 1 ? "s" : ""} · 4 paliers durée`
          : `${total} training${total > 1 ? "s" : ""} · 4 duration tiers`,
        ctaLabel: isFr ? "Voir les formations équipe" : "See team trainings",
        surface: "bg-paper",
      };
    }
    if (family.id === "individuel") {
      const count = countFormatsByFamily("individuel");
      // Liste plate. Si vide, on annonce la mise à dispo prochaine.
      const subRows =
        count > 0
          ? [
              {
                label: isFr ? "Formats disponibles" : "Available formats",
                meta: isFr
                  ? `${count} format${count > 1 ? "s" : ""}`
                  : `${count} format${count > 1 ? "s" : ""}`,
              },
            ]
          : [
              {
                label: isFr ? "Coaching IA personnel" : "Personal AI coaching",
                meta: isFr ? "Sur devis" : "On request",
              },
              {
                label: isFr ? "Managers · indépendants" : "Managers · independents",
                meta: isFr ? "1-to-1" : "1-on-1",
              },
              {
                label: isFr ? "Format à définir ensemble" : "Format defined together",
                meta: isFr ? "Visio ou présentiel" : "Remote or on site",
              },
            ];
      return {
        family,
        icon: User,
        subRows,
        countLabel:
          count > 0
            ? isFr
              ? `${count} format${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}`
              : `${count} format${count > 1 ? "s" : ""} available`
            : isFr
              ? "Sur devis · cadrage par visio"
              : "On request · framing by video",
        ctaLabel: isFr ? "Demander un coaching" : "Request a coaching",
        surface: "bg-halo-cool",
      };
    }
    if (family.id === "dirigeants") {
      const count = countFormatsByFamily("dirigeants");
      const dirigeantsTier = getTierById(INTERVENTION_TIERS, "intervention-dirigeants");
      return {
        family,
        icon: Briefcase,
        subRows: [
          {
            label: isFr ? "Journée stratégique CODIR" : "Strategic CODIR day",
            meta: isFr
              ? `${formatAmount(dirigeantsTier.priceFlat!, "fr", { compact: true })} · 1 jour`
              : `${formatAmount(dirigeantsTier.priceFlat!, "en", { compact: true })} · 1 day`,
          },
          {
            label: isFr ? "Effectif" : "Group size",
            meta: isFr ? "1 à 5 personnes" : "1 to 5 people",
          },
          {
            label: isFr ? "Huis clos · CODIR / COMEX" : "In camera · CODIR / COMEX",
            meta: isFr ? "Quick-wins activables" : "Actionable quick-wins",
          },
        ],
        countLabel: isFr
          ? `${count} format${count > 1 ? "s" : ""} · journée stratégique`
          : `${count} format${count > 1 ? "s" : ""} · strategic day`,
        ctaLabel: isFr ? "Voir l'offre dirigeants" : "See executives offer",
        surface: "bg-mocha-rich text-mocha-fg",
        isDark: true,
      };
    }
    // Conférence — liste plate (1 format en V1, format historique sorti de
    // Collectives/1-jour pour devenir sa propre famille).
    const count = countFormatsByFamily("conference");
    return {
      family,
      icon: Megaphone,
      subRows: [
        {
          label: isFr ? "Plénière 1 journée" : "1-day plenary",
          meta: isFr ? "Sur devis" : "On request",
        },
        {
          label: isFr ? "Effectif" : "Group size",
          meta: isFr ? "30+ personnes" : "30+ people",
        },
        {
          label: isFr ? "Format" : "Format",
          meta: isFr ? "Séminaires · kick-off annuels" : "Seminars · annual kick-offs",
        },
      ],
      countLabel: isFr
        ? `${count} format${count > 1 ? "s" : ""} · plénière`
        : `${count} format${count > 1 ? "s" : ""} · plenary`,
      ctaLabel: isFr ? "Voir l'offre conférence" : "See talk offer",
      surface: "bg-halo-warm",
    };
  });
}

export default async function InterventionsListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const essentielleEntryAmount = getTierById(
    INTERVENTION_TIERS,
    "intervention-essentielle",
  ).priceFlat!;
  const essentielleEntry = formatAmount(essentielleEntryAmount, loc);

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
      icon: Sparkles,
      label: isFr ? "De débutant à expert IA" : "From AI novice to fluent",
      detail: isFr ? "Un format adapté à chaque maturité" : "A format for every maturity",
    },
    {
      icon: Plane,
      label: isFr ? "Déplacement & logement" : "Travel & lodging",
      detail: isFr
        ? "À la charge du client · forfait journalier"
        : "Covered by client · flat daily rate",
    },
  ];

  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions en entreprise" : "Corporate AI sessions",
    },
  ];

  // JSON-LD Service principal — pointe vers le hub et liste les 3 familles
  // via le ItemList plus bas.
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/interventions",
    name: isFr
      ? "Interventions IA en entreprise · 4 familles · Axion-IA"
      : "Corporate AI sessions · 4 families · Axion-IA",
    description: isFr
      ? `Catalogue d'interventions et formations IA opérationnelles sur site, organisé en 4 familles : formations équipe (4 paliers durée de 4 h à 3 j+, dès ${essentielleEntry}), coaching individuel 1-to-1, journée stratégique dirigeants, et conférence plénière. France et international.`
      : `Catalogue of operational AI sessions on site, organised in 4 families: team trainings (4 duration tiers from 4 h to 3 d+, from ${essentielleEntry}), 1-on-1 coaching, executive strategic day, and plenary talk. France and international.`,
    serviceType: "AI training & engagement",
    priceEur: getEntryPriceEur(INTERVENTION_TIERS) ?? 0,
    areasServed: buildServiceAreasServed(loc),
  });

  const familyCards = buildFamilyCards(isFr);

  // ItemList JSON-LD — 3 items = 3 familles. Le détail des formats reste
  // exposé par chaque page famille / page durée via leur propre JSON-LD.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Familles d'interventions IA" : "AI session families",
    itemListElement: familyCards.map(({ family }, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "Service",
        name: isFr ? family.labelFr : family.labelEn,
        url: `${SITE_URL}/${locale}${familyPath(family, loc)}`,
        description: isFr ? family.taglineFr : family.taglineEn,
      },
    })),
  } as const;

  // Hero schema — 4 nodes famille (Sprint 14.10.7 + ajout Conférence).
  // Distribution équidistante en losange via le composant (N=4 → [-90,0,90,180]).
  const heroNodes: ReadonlyArray<{
    label: string;
    benefit: string;
    accent: "terracotta" | "primary" | "sage" | "mocha";
  }> = [
    {
      label: isFr ? "Formations équipe" : "Team trainings",
      benefit: isFr ? "De 4 h à 3 j+ · 2 à 30+ personnes" : "From 4 h to 3 d+ · 2 to 30+ people",
      accent: "terracotta",
    },
    {
      label: isFr ? "Coaching individuel" : "Individual coaching",
      benefit: isFr ? "1-to-1 sur mesure" : "Bespoke 1-on-1",
      accent: "primary",
    },
    {
      label: isFr ? "Dirigeants" : "Executives",
      benefit: isFr ? "Journée stratégique CODIR" : "Strategic CODIR day",
      accent: "mocha",
    },
    {
      label: isFr ? "Conférence" : "Talk",
      benefit: isFr ? "Plénière 1 journée · 30+" : "1-day plenary · 30+",
      accent: "sage",
    },
  ];

  // Tunnel de réservation 4 étapes — inchangé depuis Sprint 14.10 (Will).
  const reservationFlow = [
    {
      icon: Calendar,
      title: isFr ? "Vous réservez sur le calendrier" : "You book on the calendar",
      detail: isFr
        ? "Choisissez une date disponible en temps réel sur le calendrier maison. Confirmation immédiate par email."
        : "Pick an available date in real time on the in-house calendar. Instant email confirmation.",
    },
    {
      icon: PhoneCall,
      title: isFr ? "Nous vous appelons" : "We call you",
      detail: isFr
        ? "Un appel pour valider le format choisi, l'effectif, et les premières contraintes pratiques."
        : "A call to confirm the chosen format, headcount, and the first practical constraints.",
    },
    {
      icon: ClipboardCheck,
      title: isFr
        ? "Formulaire envoyé pour mieux connaître l'équipe"
        : "Form sent to know the team better",
      detail: isFr
        ? "Un questionnaire sur les profils, outils déjà utilisés, douleurs métier — pour adapter l'intervention à votre contexte."
        : "A questionnaire on roles, current tools, pain points — to adapt the session to your context.",
    },
    {
      icon: Target,
      title: isFr ? "Intervention adaptée à votre entreprise" : "Session adapted to your company",
      detail: isFr
        ? "Le programme reste standardisé, mais les ateliers et exemples sont calibrés pour vos profils — pour un impact concret dès le lendemain."
        : "The programme stays standardised, but workshops and examples are calibrated to your roles — for concrete impact starting the very next day.",
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO — 3 blocs famille au lieu de 8 formats (Sprint 14.10.7) */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-20 sm:py-24 lg:py-28">
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
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Module 1 · Interventions" : "Module 1 · Sessions"}
              </p>

              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Formez votre entreprise à l'IA " : "Train your company on AI "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "à votre niveau" : "at your level"}
                </span>
                {isFr ? " — concrètement, sur site." : " — concretely, on site."}
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? `4 grandes familles d'interventions IA pour s'adapter à toute configuration : formations équipe (de 4 heures à plusieurs jours, dès ${essentielleEntry}), coaching individuel 1-to-1, journée stratégique dirigeants, et conférence plénière. France et international. À chaque entreprise son format.`
                  : `4 main families of AI sessions to fit every configuration: team trainings (from 4 hours to several days, from ${essentielleEntry}), 1-on-1 individual coaching, executive strategic day, and plenary talk. France and abroad. A format for every company.`}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href="/reserver"
                  size="lg"
                  className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
                >
                  {isFr ? "Réserver sur le calendrier" : "Book on the calendar"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/cas-concrets" variant="outline" size="lg">
                  {isFr ? "Voir les cas concrets" : "See case studies"}
                </Cta>
              </div>
            </div>

            <InterventionsHeroSchema
              className="hero-schema pointer-events-none"
              centerLabel={isFr ? "Votre entreprise" : "Your company"}
              ariaLabel={
                isFr
                  ? "Schéma : votre entreprise au centre, entourée des 4 familles d'interventions Axion-IA — formations équipe, coaching individuel, dirigeants, conférence."
                  : "Diagram: your company at the centre, surrounded by the 4 Axion-IA session families — team trainings, individual coaching, executives, talk."
              }
              nodes={heroNodes}
            />
          </div>
        </Container>
      </section>

      {/* BANDEAU « Pour qui » — inchangé */}
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

      {/* 4 CARDS FAMILLE — coeur de la refonte Sprint 14.10.7 */}
      <Section
        eyebrow={isFr ? "Choisir votre famille" : "Pick your family"}
        title={isFr ? "4 familles" : "4 families"}
        titleEm={isFr ? "d'intervention IA" : "of AI sessions"}
        description={
          isFr
            ? "Cliquez sur une famille pour voir le détail. Les formations équipe sont organisées par durée (4 h, 1 j, 2 j, 3 j+). Le coaching individuel, la journée dirigeants et la conférence sont des listes plates de formats."
            : "Click a family to see the detail. Team trainings are organised by duration (4 h, 1 d, 2 d, 3 d+). Individual coaching, executive day and talk are flat format lists."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {familyCards.map((card) => {
            const acc = familyAccentClasses[card.family.accent];
            const Icon = card.icon;
            const dark = card.isDark === true;
            const txt = dark ? "text-mocha-fg" : "text-fg";
            const txtSoft = dark ? "text-mocha-fg/85" : "text-fg-soft";
            const txtMuted = dark ? "text-mocha-fg/70" : "text-fg-muted";
            const href = familyPath(card.family, loc);

            return (
              <article
                key={card.family.id}
                className={cn(
                  "shadow-subtle group/family hover:shadow-card relative overflow-hidden rounded-3xl border-2 ring-1 transition-shadow",
                  card.surface,
                  acc.border,
                  acc.haloRing,
                )}
                {...(dark ? { "data-tone": "dark" as const } : {})}
              >
                {/* Stretched link couvre la card */}
                <Link
                  href={href as never}
                  aria-label={`${isFr ? card.family.labelFr : card.family.labelEn} — ${card.ctaLabel}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{card.ctaLabel}</span>
                </Link>

                <span aria-hidden="true" className={`block h-1.5 w-full ${acc.line}`} />

                <div className="p-7 sm:p-8">
                  {/* En-tête : icône + badge count */}
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                        acc.iconBg,
                        acc.iconText,
                      )}
                    >
                      <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
                        acc.badge,
                      )}
                    >
                      {card.countLabel}
                    </span>
                  </div>

                  {/* Titre famille */}
                  <h2
                    className={cn(
                      "mt-6 text-[clamp(1.5rem,2.4vw,2rem)] leading-tight font-semibold tracking-tight",
                      txt,
                    )}
                  >
                    {isFr ? card.family.labelFr : card.family.labelEn}
                  </h2>

                  {/* Tagline */}
                  <p className={cn("mt-3 text-[15.5px] leading-relaxed", txtSoft)}>
                    {isFr ? card.family.taglineFr : card.family.taglineEn}
                  </p>

                  {/* Sub-rows : paliers durée ou résumé */}
                  <ul
                    className={cn(
                      "mt-6 space-y-2.5 border-t pt-5",
                      dark ? "border-mocha-fg/15" : "border-border/60",
                    )}
                  >
                    {card.subRows.map((row, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
                      >
                        <span
                          className={cn("flex items-center gap-2 text-[14px] font-medium", txt)}
                        >
                          {card.family.id === "collectives" ? (
                            <Clock
                              aria-hidden="true"
                              className={cn("h-3.5 w-3.5 opacity-60", acc.iconText)}
                            />
                          ) : null}
                          {row.label}
                        </span>
                        <span className={cn("text-[12.5px] tabular-nums", txtMuted)}>
                          {row.meta}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA principale — au-dessus du stretched link */}
                  <div className="relative z-[2] mt-7 flex flex-wrap items-center gap-3">
                    <Link
                      href={href as never}
                      className={cn(
                        "cta-lift inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
                        acc.cta,
                      )}
                    >
                      {card.ctaLabel}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/reserver"
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4",
                        dark
                          ? "text-mocha-fg hover:text-terracotta-soft"
                          : "text-fg hover:text-terracotta-deep",
                      )}
                    >
                      {isFr ? "Voir le calendrier" : "See the calendar"}
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* COMMENT ÇA SE PASSE — tunnel réservation 4 étapes (inchangé) */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Comment ça se passe" : "How it works"}
        title={isFr ? "De la réservation" : "From booking"}
        titleEm={isFr ? "à l'intervention adaptée" : "to the adapted session"}
        description={
          isFr
            ? "Vous réservez en ligne. On vous appelle. Vous remplissez un court formulaire pour qu'on connaisse votre équipe. On adapte l'intervention à votre contexte. Quatre étapes, zéro surprise."
            : "You book online. We call you. You fill a short form so we know your team. We adapt the session to your context. Four steps, zero surprises."
        }
        contentClassName={TIGHT_X}
      >
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {reservationFlow.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={i}
                className="bg-paper border-border shadow-subtle relative rounded-2xl border p-6"
              >
                <div className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <span className="text-fg-muted absolute top-4 right-5 text-[12px] font-semibold tracking-[0.12em] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-fg text-base leading-tight font-semibold">{step.title}</h3>
                <p className="text-fg-soft mt-2 text-[14px] leading-relaxed">{step.detail}</p>
              </li>
            );
          })}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Cta href="/reserver" size="lg">
            {isFr ? "Ouvrir le calendrier" : "Open the calendar"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Link
            href="/contact"
            className="text-fg hover:text-terracotta-deep text-sm font-medium underline underline-offset-4"
          >
            {isFr ? "Question avant de réserver ?" : "Question before booking?"}
          </Link>
        </div>
      </Section>

      {/* ANTI-FEAR — 3 niveaux maturité, recos pointent maintenant vers les familles */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Concerné·e quel que soit votre niveau" : "A fit for every AI maturity"}
        title={isFr ? "De zéro IA à équipes IA-fluentes," : "From zero AI to fluent teams,"}
        titleEm={isFr ? "une famille pour chaque situation" : "one family per situation"}
        description={
          isFr
            ? "Aucune entreprise n'est trop petite ni trop grande. Aucune équipe n'est trop débutante ni trop experte. À chaque maturité IA correspond une famille — vous repartez avec un bénéfice concret."
            : "No company is too small or too large. No team is too novice or too expert. To each AI maturity its family — you leave with a concrete benefit."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              level: isFr ? "Niveau 1" : "Stage 1",
              title: isFr ? "Aucun collaborateur formé à l'IA" : "No employee trained in AI yet",
              body: isFr
                ? `Démarrez par une formation équipe Essentielle ${formatAmount(essentielleEntryAmount, "fr", { compact: true })} ou une conférence 1 journée pour mettre tout le monde au même niveau.`
                : `Start with an Essential team training ${formatAmount(essentielleEntryAmount, "en", { compact: true })} or a 1-day talk to bring everyone to the same level.`,
              recommendation: isFr ? "Famille : Formations équipe" : "Family: Team trainings",
              href: "/interventions/collectives",
            },
            {
              level: isFr ? "Niveau 2" : "Stage 2",
              title: isFr ? "Premiers usages IA déjà testés" : "Early AI uses already tried",
              body: isFr
                ? "Coaching individuel pour structurer ce qui marche chez les managers clés, ou Approfondie 2 jours pour passer toute l'équipe à l'échelle."
                : "Individual coaching to structure what works for key managers, or 2-day Deep Dive to scale the whole team.",
              recommendation: isFr
                ? "Familles : Individuel · Équipe"
                : "Families: Individual · Team",
              href: "/interventions/individuel",
            },
            {
              level: isFr ? "Niveau 3" : "Stage 3",
              title: isFr ? "Équipes IA-fluentes en place" : "Fluent AI teams already in place",
              body: isFr
                ? "Journée stratégique CODIR pour cadrer la gouvernance IA 12-24 mois, les investissements prioritaires et la gestion des risques."
                : "Strategic CODIR day to frame 12-24 month AI governance, priority investments and risk management.",
              recommendation: isFr ? "Famille : Dirigeants" : "Family: Executives",
              href: "/interventions/dirigeants",
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
                  {isFr ? "Recommandé : " : "Recommended: "}
                </span>
                <Link
                  href={card.href as never}
                  className="text-terracotta-deep hover:text-terracotta font-medium underline underline-offset-4"
                >
                  {card.recommendation}
                </Link>
              </p>
            </article>
          ))}
        </div>
      </Section>

      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="Les interventions IA"
        serviceLabelEn="AI sessions"
        serviceSlug="interventions"
        tone="paper"
      />

      <LocalGeoFaqSection isFr={isFr} service="interventions" tone="sand" />

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="INTERV-02-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/interventions-closing.avif"
            caption={
              isFr
                ? "Équipe en mouvement — silhouettes éditoriales orientées vers l'action"
                : "Team in motion — editorial silhouettes oriented toward action"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'une équipe orientée vers l'action après une intervention Axion-IA."
                : "Editorial illustration of a team oriented toward action after an Axion-IA session."
            }
          />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer concrètement" : "Start concretely"}
        title={
          isFr ? "Réservez la prochaine intervention disponible" : "Book the next available session"
        }
        description={
          isFr
            ? "Calendrier maison en temps réel. Réponse sous 48 h ouvrées sur les devis. France et international — toutes les entreprises sont les bienvenues."
            : "Live in-house calendar. 48-business-hour reply on quotes. France and international — every company is welcome."
        }
        cta={
          <Cta href="/reserver" size="lg">
            {isFr ? "Voir le calendrier des interventions" : "See the intervention calendar"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
