import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  Globe2,
  Building2,
  Sparkles,
  Plane,
  Calendar,
  PhoneCall,
  ClipboardCheck,
  Target,
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
import { INTERVENTIONS, type InterventionAccent } from "@/content/interventions";
import {
  INTERVENTION_TIERS,
  formatAmount,
  formatPrice,
  getEntryPriceEur,
  getTierById,
} from "@/content/pricing";
import { ClaudeLogo } from "@/components/visual/ClaudeLogo";
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
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const essentielle = getTierById(INTERVENTION_TIERS, "intervention-essentielle");
  const temps = getTierById(INTERVENTION_TIERS, "intervention-temps");
  const essentiellePrice = formatAmount(essentielle.priceFlat!, loc);
  const tempsPrice = formatPrice(temps, loc);
  return buildProductMetadata({
    locale,
    path: "/interventions",
    title:
      loc === "fr"
        ? "Interventions IA en entreprise · 8 formats · France & international"
        : "Corporate AI sessions · 8 formats · France & international",
    description:
      loc === "fr"
        ? `Interventions et formations IA opérationnelles sur site : Essentielle dès ${essentiellePrice} (2-8 pers.), Gagner du temps ${tempsPrice} (2-20), CODIR, conférence, sur demande. France et international.`
        : `Operational AI sessions on site: Essential from ${essentiellePrice} (2-8 people), Save Time ${tempsPrice} (2-20), Leadership, 1-day talk, on request. France and international.`,
  });
}

const TIGHT_X = "lg:px-6 xl:px-10";

// `claude` est un accent local au listing /interventions, dédié à la card
// « Intervention Claude ». Anti-hex doctrine : exception assumée — ce sont les
// couleurs officielles de la marque Anthropic (peach), pas des tokens de
// design Axion-IA. Encapsulés ici, n'impactent ni le theme global ni les
// autres pages.
type ListingAccent = InterventionAccent | "claude";

const accentClasses: Record<
  ListingAccent,
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
  // Anthropic Claude brand colors — exception anti-hex documentée pour la
  // card « Intervention Claude ». Couleurs imposées par la marque Anthropic
  // (logo + monogramme), pas tokenisables en variantes Tailwind.
  // hex-ok: brand-anthropic-claude
  claude: {
    badge: "bg-[#FFF5EC] text-[#9C3E1E] border border-[#D97757]/30", // hex-ok: brand-anthropic-claude
    border: "border-[#D97757]/40 hover:border-[#D97757]", // hex-ok: brand-anthropic-claude
    title: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
    line: "bg-[#D97757]", // hex-ok: brand-anthropic-claude
    cta: "bg-[#D97757] text-white hover:bg-[#B85F3E]", // hex-ok: brand-anthropic-claude
    haloRing: "ring-[#D97757]/15", // hex-ok: brand-anthropic-claude
    chipBg: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
    chipText: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
  },
};

interface ListingCardSubTier {
  label: string;
  range: string;
  price: string;
  isFeatured?: boolean;
}

interface ListingCard {
  key: string;
  accent: ListingAccent;
  isDark: boolean;
  badge: string;
  title: string;
  titleEm?: string;
  duration: string;
  durationLabel: string;
  price: string;
  priceLabel: string;
  groupSize: string;
  audience: string;
  benefitTagline: string;
  outcomes: ReadonlyArray<string>;
  href: string;
  ctaLabel: string;
  surface: string;
  isFlagship?: boolean;
  isHighlight?: boolean;
  /**
   * Grille de sous-tarifs par tranche d'effectif. Affichée sous le tagline
   * pour les formats multi-prix (Essentielle, Approfondie). Sprint 14.10.4.
   */
  subTierGrid?: ReadonlyArray<ListingCardSubTier>;
}

function buildCards(isFr: boolean): ReadonlyArray<ListingCard> {
  const essentielle = INTERVENTIONS.find((i) => i.slug === "essentielle")!;
  const approfondie = INTERVENTIONS.find((i) => i.slug === "approfondie")!;
  const conference = INTERVENTIONS.find((i) => i.slug === "conference")!;
  const dirigeants = INTERVENTIONS.find((i) => i.slug === "dirigeants")!;

  const ess = essentielle.summary[isFr ? "fr" : "en"];
  const appr = approfondie.summary[isFr ? "fr" : "en"];
  const conf = conference.summary[isFr ? "fr" : "en"];
  const dir = dirigeants.summary[isFr ? "fr" : "en"];

  const essHref = isFr ? essentielle.pathFr : essentielle.pathEn;
  const apprHref = isFr ? approfondie.pathFr : approfondie.pathEn;
  const confHref = isFr ? conference.pathFr : conference.pathEn;
  const dirHref = isFr ? dirigeants.pathFr : dirigeants.pathEn;

  // 1 card Essentielle (1 jour) avec 3 paliers d'effectif visibles inline :
  // 2-8 personnes → 490 € HT (prix fixe), 9-15 → Sur devis, 16-30 → Sur devis.
  // Au-delà de 30 personnes : voir card « Sur demande particulière » plus bas.
  const essSubTierGrid: ReadonlyArray<ListingCardSubTier> = (ess.priceTiers ?? []).map(
    (t, idx) => ({
      label: isFr ? `Palier ${idx + 1}` : `Tier ${idx + 1}`,
      range: t.size,
      price: t.price,
      // Premier palier mis en avant (490 € HT prix d'entrée).
      ...(idx === 0 ? { isFeatured: true as const } : {}),
    }),
  );

  // Prix d'entrée Essentielle (palier 2-8 personnes). Aligné sur
  // INTERVENTION_TIERS dans pricing.ts via summary.priceTiers[0].
  const essEntryPriceLabel = ess.priceTiers?.[0]?.price
    ? isFr
      ? `dès ${ess.priceTiers[0].price}`
      : `from ${ess.priceTiers[0].price}`
    : ess.price;

  return [
    // Card 1 — Essentielle 1 jour (offre phare avec 3 paliers d'effectif inline)
    {
      key: "essentielle",
      accent: "terracotta",
      isDark: false,
      badge: isFr ? "Offre phare" : "Flagship",
      title: isFr ? "Essentielle" : "Essential",
      titleEm: isFr ? "1 journée découverte" : "1-day discovery",
      duration: isFr ? "1 journée sur site" : "1 day on site",
      durationLabel: isFr ? "1 jour" : "1 day",
      price: essEntryPriceLabel,
      priceLabel: essEntryPriceLabel,
      groupSize: isFr ? "2 à 30 personnes" : "2 to 30 people",
      audience: ess.audience,
      benefitTagline: ess.benefitTagline,
      outcomes: ess.outcomes,
      href: essHref,
      ctaLabel: ess.ctaLabel,
      surface: "bg-paper",
      isFlagship: true,
      subTierGrid: essSubTierGrid,
    },
    // Card — Approfondie 2 jours (équipes étendu) — même grille d'effectif
    // qu'Essentielle mais 2 journées consécutives pour creuser. 3 paliers
    // de prix dégressif au nombre de participants. Sprint 14.10.6.
    {
      key: "approfondie",
      accent: "primary",
      isDark: false,
      badge: isFr ? "Équipes · 2 jours" : "Teams · 2 days",
      title: isFr ? "Approfondie" : "Deep Dive",
      titleEm: isFr ? "2 jours équipes" : "2-day teams",
      duration: appr.duration,
      durationLabel: isFr ? "2 jours" : "2 days",
      price: appr.price,
      priceLabel: appr.price,
      groupSize: appr.groupSize,
      audience: appr.audience,
      benefitTagline: appr.benefitTagline,
      outcomes: appr.outcomes,
      href: apprHref,
      ctaLabel: appr.ctaLabel,
      surface: "bg-halo-cool",
      subTierGrid: (appr.priceTiers ?? []).map((t, idx) => ({
        label: isFr ? `Palier ${idx + 1}` : `Tier ${idx + 1}`,
        range: t.size,
        price: t.price,
        ...(idx === 1 ? { isFeatured: true as const } : {}),
      })),
    },
    // Card 5 — Gagner du temps (NEW format)
    {
      key: "gagner-du-temps",
      accent: "primary",
      isDark: false,
      badge: isFr ? "Productivité" : "Productivity",
      title: isFr ? "Gagner du temps" : "Save Time",
      titleEm: isFr ? "concrètement" : "concretely",
      duration: isFr ? "1 journée sur site" : "1 day on site",
      durationLabel: isFr ? "1 jour" : "1 day",
      price: formatPrice(getTierById(INTERVENTION_TIERS, "intervention-temps"), isFr ? "fr" : "en"),
      priceLabel: formatAmount(
        getTierById(INTERVENTION_TIERS, "intervention-temps").priceFlat!,
        isFr ? "fr" : "en",
        { compact: true },
      ),
      groupSize: isFr ? "2 à 20 personnes" : "2 to 20 people",
      audience: isFr
        ? "Équipes opérationnelles · TPE, PME, ETI"
        : "Operational teams · small to mid-market",
      benefitTagline: isFr
        ? "Une journée pour gagner du temps concrètement : automatisations IA sur les tâches récurrentes, prompts efficaces, intégration dans le flux de travail quotidien. Vos équipes ressortent avec des heures gagnées chaque semaine."
        : "One day to save time concretely: AI automations on recurring tasks, effective prompts, integration into daily workflow. Your teams leave with hours saved every week.",
      outcomes: isFr
        ? [
            "Vos équipes identifient leurs tâches répétitives chronophages et y appliquent l'IA",
            "Chaque participant repart avec 5 à 10 automatisations testées sur ses propres outils",
            "Gain mesurable dès le retour au bureau — plusieurs heures par personne et par semaine",
          ]
        : [
            "Your team spots their time-consuming recurring tasks and applies AI to them",
            "Each participant leaves with 5 to 10 automations tested on their own tools",
            "Measurable gains the day back at the office — hours per person, per week",
          ],
      href: "/interventions/gagner-du-temps",
      ctaLabel: isFr ? "Découvrir Gagner du temps" : "Discover Save Time",
      surface: "bg-paper",
      isHighlight: true,
    },
    // Card — Intervention Claude (Chat · Cowork · Code) — outil-spécifique,
    // logo + encadrement aux couleurs Anthropic. Demande Will 2026-05-08.
    // Prix non précisé → « Sur devis » par défaut, à compléter quand Will
    // donnera le tarif fixe.
    {
      key: "intervention-claude",
      accent: "claude",
      isDark: false,
      badge: isFr ? "Outil · Claude" : "Tool · Claude",
      title: isFr ? "Intervention Claude" : "Claude intervention",
      titleEm: isFr ? "Chat · Cowork · Code" : "Chat · Cowork · Code",
      duration: isFr ? "1 journée sur site" : "1 day on site",
      durationLabel: isFr ? "1 jour" : "1 day",
      price: isFr ? "Sur devis" : "On request",
      priceLabel: isFr ? "Sur devis" : "On request",
      groupSize: isFr ? "Selon besoin" : "As needed",
      audience: isFr
        ? "Équipes qui veulent maîtriser Claude (Anthropic) en profondeur"
        : "Teams that want to master Claude (Anthropic) in depth",
      benefitTagline: isFr
        ? "Une journée 100 % dédiée à Claude — l'assistant Anthropic. Trois volets : Chat (rédaction, analyse, synthèse), Cowork (Projects, fichiers, mémoire) et Code (Claude Code en CLI, génération et refactoring). Vos équipes ressortent autonomes sur l'outil de pointe IA."
        : "A full day 100 % focused on Claude — Anthropic's assistant. Three tracks: Chat (writing, analysis, synthesis), Cowork (Projects, files, memory) and Code (Claude Code CLI, generation and refactoring). Your teams leave autonomous on the cutting-edge AI tool.",
      outcomes: isFr
        ? [
            "Maîtrise des 3 surfaces Claude : Chat (web), Cowork (Projects), Code (CLI)",
            "Workflows IA avancés sur Claude : prompts longs, mémoire de projet, fichiers attachés",
            "Pour les équipes tech : Claude Code en CLI, génération et refactoring de code",
          ]
        : [
            "Mastery of all 3 Claude surfaces: Chat (web), Cowork (Projects), Code (CLI)",
            "Advanced AI workflows on Claude: long prompts, project memory, file attachments",
            "For tech teams: Claude Code CLI, code generation and refactoring",
          ],
      href: "/interventions/intervention-claude",
      ctaLabel: isFr ? "Découvrir Intervention Claude" : "Discover Claude intervention",
      surface: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
    },
    // Card 6 — Direction (CODIR/COMEX) — repositionnement 2026-05-08 : pas
    // une formation théorique, une journée de travail privilégié à vos côtés.
    // Quick-wins activables semaine suivante + vision 12-24 mois + automatisations
    // dirigeants. Prix fixe 990 € HT (Will, 2026-05-08).
    {
      key: "dirigeants",
      accent: "mocha",
      isDark: true,
      badge: isFr ? "Travail 1-to-1 · Quick-wins" : "1-on-1 · Quick-wins",
      title: isFr ? "Direction" : "Direction",
      titleEm: isFr ? "Journée stratégique" : "Strategic day",
      duration: dir.duration,
      durationLabel: isFr ? "1 jour" : "1 day",
      price: dir.price,
      priceLabel: dir.price,
      groupSize: dir.groupSize,
      audience: dir.audience,
      benefitTagline: dir.benefitTagline,
      outcomes: dir.outcomes,
      href: dirHref,
      ctaLabel: dir.ctaLabel,
      surface: "bg-mocha-rich text-mocha-fg",
      isHighlight: true,
    },
    // Card 7 — Conférence 1 journée (Sprint 14.10.4 : pas de demi-journée)
    {
      key: "conference",
      accent: "terracotta",
      isDark: false,
      badge: isFr ? "Format collectif" : "Collective format",
      title: isFr ? "Conférence" : "Talk",
      titleEm: isFr ? "1 journée" : "1 day",
      duration: isFr ? "1 journée" : "1 day",
      durationLabel: isFr ? "1 j" : "1 d",
      price: conf.price,
      priceLabel: isFr ? "Sur devis" : "On request",
      groupSize: conf.groupSize,
      audience: conf.audience,
      benefitTagline: conf.benefitTagline,
      outcomes: conf.outcomes,
      href: confHref,
      ctaLabel: conf.ctaLabel,
      surface: "bg-halo-warm",
    },
    // Card 8 — Sur demande particulière (NEW)
    {
      key: "sur-demande",
      accent: "sage",
      isDark: false,
      badge: isFr ? "Sur mesure" : "Bespoke",
      title: isFr ? "Sur demande" : "On request",
      titleEm: isFr ? "particulière" : "bespoke",
      duration: isFr ? "Selon besoin" : "As needed",
      durationLabel: isFr ? "Selon besoin" : "As needed",
      price: isFr ? "Sur devis" : "On request",
      priceLabel: isFr ? "Sur devis" : "On request",
      groupSize: isFr ? "Selon besoin" : "As needed",
      audience: isFr
        ? "Toute entreprise · besoin spécifique · format hors-cadre"
        : "Any company · specific need · non-standard format",
      benefitTagline: isFr
        ? "Pour les configurations qui ne rentrent pas dans nos formats standards : journée sur 2 sites, public mixte, contenus ultra-spécifiques, multi-jours, offsite, internationale. On cadre par appel, on construit ensemble, on chiffre."
        : "For setups that don't fit our standard formats: split-site day, mixed audiences, ultra-specific content, multi-day, offsite, international. We frame by call, build it together, then quote.",
      outcomes: isFr
        ? [
            "Cadrage par visio pour comprendre votre besoin et vos contraintes",
            "Programme personnalisé construit ensemble — durée, contenu, modalités",
            "Devis détaillé sous 48 h ouvrées · facture après l'intervention",
          ]
        : [
            "Framing video call to understand your need and constraints",
            "Personalised programme built together — duration, content, format",
            "Detailed quote within 48 business hours · invoice after the session",
          ],
      href: "/contact",
      ctaLabel: isFr ? "Demander un devis sur mesure" : "Request a bespoke quote",
      surface: "bg-sand",
    },
  ];
}

export default async function InterventionsListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

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

  const essentielleEntryAmount = getTierById(
    INTERVENTION_TIERS,
    "intervention-essentielle",
  ).priceFlat!;
  const tempsAmount = getTierById(INTERVENTION_TIERS, "intervention-temps").priceFlat!;
  const essentielleEntry = formatAmount(essentielleEntryAmount, loc);
  const tempsLabel = formatAmount(tempsAmount, loc);
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/interventions",
    name: isFr
      ? "Interventions IA en entreprise · 8 formats · Axion-IA"
      : "Corporate AI sessions · 8 formats · Axion-IA",
    description: isFr
      ? `Interventions et formations IA opérationnelles sur site : Essentielle dès ${essentielleEntry} (2 à 30+ personnes, 4 paliers), Gagner du temps ${tempsLabel} (2-20), CODIR sur devis, conférence 1 journée, et sur demande particulière. France et international.`
      : `Operational AI sessions on site: Essential from ${essentielleEntry} (2 to 30+ people, 4 tiers), Save Time ${tempsLabel} (2-20), Leadership on request, 1-day talk, and bespoke. France and international.`,
    serviceType: "AI training & engagement",
    priceEur: getEntryPriceEur(INTERVENTION_TIERS) ?? 0,
    areasServed: buildServiceAreasServed(loc),
  });

  const cards = buildCards(isFr);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Interventions IA en entreprise" : "Corporate AI sessions",
    itemListElement: cards.map((card, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "Service",
        name: `${card.title} ${card.titleEm ?? ""}`.trim(),
        url: `${SITE_URL}/${locale}${card.href}`,
        description: card.benefitTagline,
      },
    })),
  } as const;

  // Hero schema — 5 nodes représentant les grandes familles de formats
  // (4 paliers Essentielle réduits à 1 node « Essentielle » pour la lisibilité
  // du diagramme, +1 node Gagner du temps, +1 CODIR, +1 Conférence, +1 Sur demande).
  const heroNodes: ReadonlyArray<{
    label: string;
    benefit: string;
    accent: InterventionAccent;
  }> = [
    {
      label: isFr ? "Essentielle" : "Essential",
      benefit: isFr
        ? `Découverte IA · dès ${formatAmount(essentielleEntryAmount, "fr", { compact: true })}`
        : `AI discovery · from ${formatAmount(essentielleEntryAmount, "en", { compact: true })}`,
      accent: "terracotta",
    },
    {
      label: isFr ? "Gagner du temps" : "Save Time",
      benefit: isFr
        ? `${formatAmount(tempsAmount, "fr", { compact: true })} · 2 à 20 personnes`
        : `${formatAmount(tempsAmount, "en", { compact: true })} · 2 to 20 people`,
      accent: "primary",
    },
    {
      label: isFr ? "CODIR · Dirigeants" : "Leadership",
      benefit: isFr ? "Vision IA pour vos décisions" : "Clear AI vision for decisions",
      accent: "mocha",
    },
    {
      label: isFr ? "Conférence 1 jour" : "1-day talk",
      benefit: isFr ? "Toute l'entreprise au même niveau" : "Whole company aligned",
      accent: "terracotta",
    },
    {
      label: isFr ? "Sur demande" : "Bespoke",
      benefit: isFr ? "Configurations sur mesure" : "Custom configurations",
      accent: "sage",
    },
  ];

  // Tunnel de réservation — 4 étapes claires, demandées explicitement par Will :
  // calendrier → call → formulaire/questionnaire → intervention adaptée.
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

      {/* HERO */}
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
                {isFr ? "Formez vos équipes à l'IA " : "Train your teams on AI "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "en 1 ou 2 journées" : "in 1 or 2 days"}
                </span>
                {isFr ? " — concrètement, sur site." : " — concretely, on site."}
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? `8 formats d'intervention IA opérationnels — sur site, en France et à l'international. De 2 à 30+ personnes, dès ${essentielleEntry}. Pour TPE, PME, ETI ou grandes entreprises. À chaque entreprise son format. À chaque équipe son bénéfice concret, mesurable, dès le lendemain.`
                  : `8 operational AI session formats — on site, in France and abroad. From 2 to 30+ people, from ${formatAmount(essentielleEntryAmount, "en", { compact: true })}. Small businesses, mid-market or enterprise. A format for every company, a concrete benefit for every team, starting the very next day.`}
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
                  ? "Schéma : votre entreprise au centre, entourée des grandes familles de formats d'intervention IA Axion-IA et de leur bénéfice concret."
                  : "Diagram: your company at the centre, surrounded by the Axion-IA intervention format families and their concrete benefit."
              }
              nodes={heroNodes}
            />
          </div>
        </Container>
      </section>

      {/* BANDEAU « Pour qui » */}
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

      {/* 8 CARDS — grille 2 colonnes uniforme. Prix + durée ULTRA visibles
          via banner haut de card (chip terracotta + chip neutre). Cards
          1-4 = 4 paliers Essentielle (cliquables vers /interventions/essentielle).
          5 = Gagner du temps (NEW, 990 €), 6 = CODIR, 7 = Conférence, 8 = Sur demande. */}
      <Section
        eyebrow={isFr ? "Choisir votre format" : "Pick your format"}
        title={isFr ? "8 formats d'intervention" : "8 intervention formats"}
        titleEm={isFr ? "à votre mesure" : "for every fit"}
        description={
          isFr
            ? "Chaque bloc affiche prix HT et durée en haut, lisibles au premier coup d'œil. Cliquez pour la page détaillée du format ou pour ouvrir le calendrier de réservation."
            : "Every card shows price (excl. VAT) and duration at the top, readable at a glance. Click for the format's detail page or to open the booking calendar."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
          {cards.map((card) => {
            const acc = accentClasses[card.accent];
            const dark = card.isDark;
            const txt = dark ? "text-mocha-fg" : "text-fg";
            const txtSoft = dark ? "text-mocha-fg/85" : "text-fg-soft";
            const txtMuted = dark ? "text-mocha-fg/70" : "text-fg-muted";

            return (
              <article
                key={card.key}
                className={cn(
                  "shadow-subtle group/card hover:shadow-card relative overflow-hidden rounded-3xl border-2 ring-1 transition-shadow",
                  card.surface,
                  acc.border,
                  acc.haloRing,
                )}
                {...(dark ? { "data-tone": "dark" as const } : {})}
              >
                {/* Stretched link couvre la card. CTA interne en relative z-[2]. */}
                <Link
                  href={card.href as never}
                  aria-label={`${card.title} ${card.titleEm ?? ""} — ${card.ctaLabel}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{card.ctaLabel}</span>
                </Link>

                <span aria-hidden="true" className={`block h-1.5 w-full ${acc.line}`} />

                {/* BANNER PRIX + DURÉE — la signature de cette refonte. Ultra
                    visible : chip prix terracotta gros, chip durée neutre,
                    badge audience à droite. Lisible en moins d'une seconde. */}
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 px-7 pt-6 sm:px-8",
                    dark ? "border-mocha-fg/15" : "border-border/60",
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <span
                      className={cn(
                        "rounded-full px-4 py-1.5 text-base font-bold tracking-tight tabular-nums shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)] sm:text-lg",
                        acc.cta,
                      )}
                    >
                      {card.priceLabel}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-semibold tracking-tight",
                        dark
                          ? "bg-mocha-soft border-mocha-fg/20 text-mocha-fg"
                          : "bg-paper border-border/60 text-fg",
                      )}
                    >
                      <span aria-hidden="true" className="mr-1.5 opacity-60">
                        ⏱
                      </span>
                      {card.durationLabel}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-semibold tracking-tight",
                        dark
                          ? "bg-mocha-soft border-mocha-fg/20 text-mocha-fg"
                          : "bg-paper border-border/60 text-fg",
                      )}
                    >
                      <span aria-hidden="true" className="mr-1.5 opacity-60">
                        👥
                      </span>
                      {card.groupSize}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
                      acc.badge,
                    )}
                  >
                    {card.isFlagship ? <Sparkles className="mr-1 h-3 w-3" /> : null}
                    {card.badge}
                  </span>
                </div>

                <div className="p-7 sm:p-8">
                  {/* Logo Claude visible en haut de la card Intervention Claude.
                      Marqueur visuel fort qui distingue immédiatement cette
                      formation outil-spécifique des formats généraux. */}
                  {card.accent === "claude" ? (
                    <div className="mb-5 flex items-center gap-3">
                      {/* hex-ok: brand-anthropic-claude */}
                      <span
                        className={
                          "flex h-12 w-12 items-center justify-center rounded-xl bg-[#D97757]/10" // hex-ok: brand-anthropic-claude
                        }
                      >
                        <ClaudeLogo
                          ariaLabel="Claude (Anthropic)"
                          className={"h-7 w-7 text-[#D97757]" /* hex-ok */} // hex-ok: brand-anthropic-claude
                        />
                      </span>
                      <span
                        className={
                          "text-[12px] font-semibold tracking-[0.14em] text-[#9C3E1E] uppercase" // hex-ok: brand-anthropic-claude
                        }
                      >
                        {isFr ? "Logo Claude · Anthropic" : "Claude logo · Anthropic"}
                      </span>
                    </div>
                  ) : null}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase",
                      acc.badge,
                    )}
                  >
                    {card.audience}
                  </span>

                  <h2
                    className={cn(
                      "mt-4 text-[clamp(1.5rem,2.4vw,2rem)] leading-tight font-semibold tracking-tight",
                      txt,
                    )}
                  >
                    {card.title}
                    {card.titleEm ? (
                      <>
                        {" "}
                        <span
                          className={`italic ${acc.title}`}
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {card.titleEm}
                        </span>
                      </>
                    ) : null}
                  </h2>

                  <p className={cn("mt-4 text-[15.5px] leading-relaxed", txtSoft)}>
                    {card.benefitTagline}
                  </p>

                  {card.subTierGrid && card.subTierGrid.length > 0 ? (
                    <div className="mt-6">
                      <p
                        className={cn(
                          "mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase",
                          txtMuted,
                        )}
                      >
                        {isFr ? "Tarifs selon l'effectif" : "Pricing by headcount"}
                      </p>
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {card.subTierGrid.map((t) => (
                          <div
                            key={t.label}
                            className={cn(
                              "relative flex flex-col items-start rounded-xl border p-3",
                              t.isFeatured
                                ? "border-terracotta bg-paper shadow-subtle"
                                : "border-border/60 bg-paper/60",
                            )}
                          >
                            {t.isFeatured ? (
                              <span className="bg-terracotta text-mocha-fg absolute -top-2 left-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase">
                                ★ {isFr ? "Recommandé" : "Recommended"}
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "text-[10px] font-bold tracking-[0.14em] uppercase",
                                txtMuted,
                              )}
                            >
                              {t.label}
                            </span>
                            <span
                              className={cn(
                                "mt-1 text-lg leading-none font-bold tabular-nums sm:text-xl",
                                t.isFeatured ? "text-terracotta-deep" : txt,
                              )}
                            >
                              {t.price}
                            </span>
                            <span
                              className={cn(
                                "mt-1 text-[12px] leading-tight font-semibold",
                                txtSoft,
                              )}
                            >
                              {t.range}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6">
                    <p
                      className={cn(
                        "mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase",
                        txtMuted,
                      )}
                    >
                      {isFr
                        ? "À l'issue, vos équipes savent…"
                        : "After the session, your team can…"}
                    </p>
                    <ul className="space-y-2">
                      {card.outcomes.map((o, i) => (
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

                  {/* CTA principale + lien calendrier — au-dessus du stretched link */}
                  <div className="relative z-[2] mt-7 flex flex-wrap items-center gap-3">
                    <Link
                      href={card.href as never}
                      className={cn(
                        "cta-lift inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
                        acc.cta,
                      )}
                    >
                      {card.ctaLabel}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                    {card.href !== "/reserver" && card.href !== "/contact" ? (
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
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* COMMENT ÇA SE PASSE — section dédiée demandée explicitement par Will :
          calendrier → appel → formulaire → intervention adaptée. Visible aussi
          comme rassurance commerciale (B2B : « comment je réserve concrètement »). */}
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

      {/* SECTION ANTI-FEAR — quel que soit votre niveau IA */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Concerné·e quel que soit votre niveau" : "A fit for every AI maturity"}
        title={isFr ? "De zéro IA à équipes IA-fluentes," : "From zero AI to fluent teams,"}
        titleEm={isFr ? "un format pour chaque entreprise" : "one format per company"}
        description={
          isFr
            ? "Aucune entreprise n'est trop petite ni trop grande. Aucune équipe n'est trop débutante ni trop experte. Vous repartez avec un bénéfice concret — peu importe d'où vous partez."
            : "No company is too small or too large. No team is too novice or too expert. You leave with a concrete benefit — whatever your starting point."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              level: isFr ? "Niveau 1" : "Stage 1",
              title: isFr ? "Aucun collaborateur formé à l'IA" : "No employee trained in AI yet",
              body: isFr
                ? "L'Essentielle ou la conférence 1 journée vous donnent une vision claire et des quick-wins prêts à reprendre."
                : "The Essential or the 1-day talk gives you a clear vision and quick-wins ready to resume.",
              recommendation: isFr
                ? `Essentielle ${formatAmount(essentielleEntryAmount, "fr", { compact: true })} · Conférence`
                : `Essential ${formatAmount(essentielleEntryAmount, "en", { compact: true })} · Talk`,
            },
            {
              level: isFr ? "Niveau 2" : "Stage 2",
              title: isFr ? "Premiers usages IA déjà testés" : "Early AI uses already tried",
              body: isFr
                ? `Gagner du temps (${tempsLabel}) structure ce qui marche, élimine ce qui n'en vaut pas la peine, et passe à l'échelle équipe.`
                : `Save Time (${tempsLabel}) structures what works, drops what doesn't, and scales it to the team.`,
              recommendation: isFr
                ? `Gagner du temps · ${formatAmount(tempsAmount, "fr", { compact: true })}`
                : `Save Time · ${formatAmount(tempsAmount, "en", { compact: true })}`,
            },
            {
              level: isFr ? "Niveau 3" : "Stage 3",
              title: isFr ? "Équipes IA-fluentes en place" : "Fluent AI teams already in place",
              body: isFr
                ? "L'intervention CODIR pose le cadre stratégique 12-24 mois — gouvernance, investissements, gestion des risques."
                : "The Leadership session sets the 12-24 month strategic frame — governance, investments, risk management.",
              recommendation: isFr ? "Dirigeants · CODIR" : "Executives · Leadership",
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
                  {isFr ? "Format conseillé : " : "Recommended format: "}
                </span>
                {card.recommendation}
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
