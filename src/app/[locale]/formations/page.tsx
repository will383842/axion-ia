// Hub /formations — catalogue formations IA intra-entreprise (refonte
// 2026-07-19, décision Will) : FIN de la présentation par durée. Le hub
// présente les 3 OFFRES GÉNÉRALES (IA pour bien commencer — 2 formats —,
// IA pour les équipes, IA pour l'automatisation) + 2 CTA vers les listings
// « par métier » (9) et « par secteur d'activité » (8). Le séminaire est
// présenté À PART, la formule mensuelle/bi-mensuelle est conservée. Prix
// PUBLICS par groupe, dérivés de la matrice pricing.ts (jamais en dur).
import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  Users,
  Sparkles,
  UserCheck,
  TrendingUp,
  Zap,
  Building2,
  Bot,
  LineChart,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getFormationsV2ByCategorie,
  getFormationV2EntryPrice,
  getSeminairesV2,
} from "@/content/formations/catalog-v2";
import { FORMATION_CATEGORIES_META, formationDureeIso } from "@/content/formations/catalog-v2-meta";
import {
  FORMATION_DUREE_FACTS,
  getFormationImage,
  getFormationImageCredit,
} from "@/content/formations/catalog-v2-facts";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { ServiceReviewsSection } from "@/components/reviews/ServiceReviewsSection";
import { formatAmount, getFormationCatalogPriceRange, getFormationPrice } from "@/content/pricing";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildHowToJsonLd,
  buildCourseJsonLd,
  buildCollectionPageJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { getPageImages } from "@/lib/seo/page-images";
import { buildServiceAreasServed } from "@/lib/service-coverage";
// Sprint uniformisation 2026-05-24 (Will) — alignement template /implementation.
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { ServiceHero } from "@/components/sections/ServiceHero";
// Sprint Hero orbital v2 2026-05-28 (Will) — orbital travaillé avec glyphes
// brand SVG inline + animations CSS subtiles. Remplace HeroMatrix (trop dense)
// et l'orbital générique (pas assez travaillé).
import { HeroOrbital } from "@/components/sections/HeroOrbital";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";

// ============================================================================
// Hub « Formations équipe » — 4 paliers durée : 4 h / 1 jour / 2 jours /
// 3 jours (sur mesure). Compteur dynamique par palier dérivé de `FORMATIONS_V2`
// (catalog-v2). Ajouter une formation au catalogue incrémente automatiquement
// le palier correspondant.
// ============================================================================

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  // Claim Qualiopi/OPCO gaté Phase B — il fuyait en SERP alors que tout le reste
  // de la page est gaté (purge du flag 2026-07-14). ISR 1h le réinjecte au flip.
  const qualiopiSerp = isQualiopiPublicDisclosureEnabled()
    ? "certifié Qualiopi, finançables OPCO"
    : "générales, par métier ou par secteur d'activité";
  return buildProductMetadata({
    locale,
    path: "/formations",
    // Titre court (≤ 60 car) pour éviter la troncature SERP + servir de label
    // sitelink net (audit sitelinks 2026-07-06). TPE/PME/ETI restent dans la
    // description. Finit par « · Axion-IA » (bypass template).
    title:
      loc === "fr"
        ? "Formation IA en entreprise sur site · Axion-IA"
        : "On-site corporate AI training · Axion-IA",
    description:
      loc === "fr"
        ? `Formations IA présentiel ou distanciel, ${qualiopiSerp} — dès ${formatAmount(getFormationCatalogPriceRange().minEur, "fr")} par groupe (2 à 15 pers.). Vos équipes gagnent du temps dès le lendemain.`
        : `Corporate AI training on site: general offers plus role-specific and industry-specific programmes, priced per group (2-15 people). Instant time savings for your teams.`,
  });
}

// ISR — le hub dépend de la config (catalogue + Phase B) et du layout partagé
// (bandeau + JSON-LD Qualiopi). 1h : repeuple le contenu DB-dépendant figé au
// build stub une fois la Phase B activée, sans rebuild.
export const revalidate = 3600;

export default async function FormationsHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    {
      href: "/formations",
      label: isFr ? "Formations IA" : "AI trainings",
    },
  ];

  // Données dérivées du SSOT catalogue (refonte 2026-07-19) — jamais de prix ni
  // de compte en dur : tout suit automatiquement si le catalogue bouge.
  const generales = getFormationsV2ByCategorie("generale");
  const equipes = generales.find((f) => f.id === "ia-pour-les-equipes");
  const automatisation = generales.find((f) => f.id === "ia-pour-l-automatisation");
  const metiers = getFormationsV2ByCategorie("metier");
  const secteurs = getFormationsV2ByCategorie("secteur");
  const seminaire = getSeminairesV2()[0];
  const metiersMeta = FORMATION_CATEGORIES_META.find((c) => c.id === "metier");
  const secteursMeta = FORMATION_CATEGORIES_META.find((c) => c.id === "secteur");
  const { minEur } = getFormationCatalogPriceRange();
  // `formatAmount` non-compact porte déjà « € HT » — ne jamais resuffixer.
  const minPriceLabel = formatAmount(minEur, "fr");
  // Claims certification/financement du héros — gatés Phase B (ISR 1h les
  // réinjecte au flip du flag, comme la meta).
  const ofPublicHero = isQualiopiPublicDisclosureEnabled();

  /** « 4 heures » · « 1 journée » · « 2 journées (scindable 2×1j) ». */
  const dureeLabelFr = (f: {
    duree: keyof typeof FORMATION_DUREE_FACTS;
    scindable?: boolean;
  }): string => {
    const d = FORMATION_DUREE_FACTS[f.duree];
    const base = f.duree === "4h" ? d.heuresLabelFr : d.joursLabelFr;
    return f.scindable ? `${base} — scindable 2×1j` : base;
  };

  // Photos illustratives de la page — SSOT centralisée `@/lib/seo/page-images`
  // (`PAGE_IMAGES_MANIFEST["/formations"]`). Le MÊME manifeste alimente le rendu
  // <Image> (grille + bandeau quadriptyque + portrait), le JSON-LD ImageObject et
  // le sitemap images → aucune divergence possible (avant : arrays inline + snapshot
  // sitemap figé qui avaient dérivé, laissant ces photos hors Google Images).
  // Optimisation Next.js Image conservée au rendu (AVIF/WebP runtime, lazy,
  // aspect-ratio fixe CLS=0, sizes responsive, alt denses SEO).
  const gridPhotos = getPageImages("/formations").filter((p) => p.slot === "grid");

  // JSON-LD ImageObject @graph — construit DEPUIS le manifeste (6 ImageObject :
  // 4 photos grille + 1 quadriptyque `representativeOfPage` + 1 portrait Williams),
  // license CC BY 4.0, creator/copyrightHolder Axion-IA `#organization`.
  const photosImageObjectJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/formations" });

  // Les 4 cartes « offres générales » du hub (Will 2026-07-19 : les 2 formats
  // « bien commencer » sont des cartes SÉPARÉES, avec la différence explicite,
  // et CHAQUE carte porte un badge sur sa photo).
  const bienCommencer4h = generales.find((f) => f.id === "ia-pour-bien-commencer");
  const bienCommencerJournee = generales.find((f) => f.id === "ia-pour-bien-commencer-journee");
  const offresGenerales = [
    ...(bienCommencer4h
      ? [
          {
            key: "bien-commencer-4h",
            f: bienCommencer4h,
            titreFr: "IA pour bien commencer",
            badgeFr: "Pour bien démarrer · condensé",
            benefitFr: "Comprendre l'IA et l'utiliser dès aujourd'hui",
            pitchFr:
              "La découverte en une demi-journée : dense et démonstrative, elle lève les blocages sans désorganiser votre activité. Chacun repart avec des usages applicables dès le lendemain.",
          },
        ]
      : []),
    ...(bienCommencerJournee
      ? [
          {
            key: "bien-commencer-journee",
            f: bienCommencerJournee,
            titreFr: "IA pour bien commencer — journée complète",
            badgeFr: "Pour bien démarrer · approfondi",
            benefitFr: "S'approprier l'IA en pratiquant sur ses propres tâches",
            pitchFr:
              "La différence avec le condensé : une journée entière avec autant de pratique que de théorie — chaque participant teste plusieurs usages sur son propre travail, en atelier guidé.",
          },
        ]
      : []),
    ...(equipes
      ? [
          {
            key: "equipes",
            f: equipes,
            titreFr: equipes.titreFr,
            badgeFr: "Pour gagner du temps",
            benefitFr: "Gagner du temps au quotidien",
            pitchFr:
              "Pour les équipes qui utilisent déjà l'IA : transformer des usages dispersés en pratique commune — rédaction, synthèse, prompts réutilisables, sur vos vraies tâches.",
          },
        ]
      : []),
    ...(automatisation
      ? [
          {
            key: "automatisation",
            f: automatisation,
            titreFr: automatisation.titreFr,
            badgeFr: "Pour automatiser",
            benefitFr: "Vos premières automatisations concrètes",
            pitchFr:
              "Identifier ce qui vous fait perdre du temps et construire une première automatisation, testée sur un cas réel de votre entreprise.",
          },
        ]
      : []),
  ];

  // Service JSON-LD — le `speakable` a été DÉPLACÉ sur le nœud CollectionPage
  // ci-dessous (2026-07-01) : `speakable` est une propriété de WebPage/CreativeWork,
  // PAS de `Service` (sous-type d'Intangible) → posé sur Service il était ignoré
  // par Google et les moteurs de réponse.
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/formations",
    name: isFr
      ? "Formations IA équipe · générales, métiers, secteurs · Axion-IA"
      : "Team AI trainings · general, role and industry offers · Axion-IA",
    description: isFr
      ? `Formations IA opérationnelles pour vos équipes (2 à 15 personnes) : ${offresGenerales.length} offres générales, ${metiers.length} formations par métier, ${secteurs.length} formations par secteur d'activité. Prix par groupe, dès ${minPriceLabel}.`
      : `Operational AI trainings for your teams (2-15 people): general offers plus ${metiers.length} role-specific and ${secteurs.length} industry-specific programmes, priced per group.`,
    serviceType: "AI training",
    areasServed: buildServiceAreasServed(loc),
  });

  // CollectionPage JSON-LD — porteur VALIDE du `speakable` (h1/h2 + réponses) et
  // du `primaryImageOfPage` (quadriptyque représentatif). Le hub /formations est un
  // listing (4 paliers durée) → CollectionPage. `breadcrumb` relie au fil d'Ariane.
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/formations",
    name: isFr
      ? "Formations IA en entreprise — générales, par métier, par secteur"
      : "Corporate AI trainings — general, by role, by industry",
    description: isFr
      ? `Hub des formations IA opérationnelles Axion-IA : ${offresGenerales.length} offres générales, ${metiers.length} formations par métier, ${secteurs.length} formations par secteur d'activité, séminaire entreprise et formule mensuelle. Prix par groupe (2 à 15 pers.), dès ${minPriceLabel}.`
      : "Hub of Axion-IA operational AI trainings: general offers, role-specific and industry-specific programmes, company seminar and recurring monthly formula. Priced per group (2-15 people).",
    speakable: true,
    ...(buildPrimaryImageOfPage("/formations")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/formations") } }
      : {}),
  });

  // Course JSON-LD — un Course par offre générale (les fiches métier/secteur
  // émettent le leur sur leur propre page). Permet citation Google AI
  // Overviews / Perplexity / Claude pour « formation IA débutant entreprise »,
  // « formation IA équipe », « formation automatisation IA ».
  const courseJsonLdArray = generales.map((f) =>
    buildCourseJsonLd({
      locale: loc,
      path: `/formations/${f.slugFr}`,
      name: f.titreFr,
      description: f.metaDescriptionFr,
      courseMode: ["Onsite"],
      duration: formationDureeIso(f.duree),
      audienceType: isFr
        ? "Décideurs, managers, équipes opérationnelles TPE PME ETI grandes entreprises (B2B)"
        : "Decision-makers, managers, operational teams SME mid-cap large enterprise (B2B)",
      about: "IA opérationnelle (ChatGPT, Claude, Gemini, méthode AXION)",
    }),
  );

  // HowTo JSON-LD — Sprint perfection AEO 2026-05-28 (Will). Section
  // « Comment réserver » : 3 étapes (réserver → préparation → intervention).
  // Permet aux LLMs (Perplexity, Claude.ai, Google AI Overviews) de citer
  // le process complet pour requêtes « comment se passe une formation IA
  // Axion-IA ».
  const howToReserverJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/formations",
    name: isFr
      ? "Comment réserver votre formation IA en entreprise"
      : "How to book your corporate AI training",
    description: isFr
      ? "3 étapes simples pour réserver et organiser votre formation IA sur site : vous réservez (2 canaux), on prépare votre journée adaptée à votre entreprise, le formateur intervient le jour J."
      : "3 simple steps to book and organise your on-site AI training: you book (2 channels), we prepare your day tailored to your business, the trainer delivers on the day.",
    steps: [
      {
        name: isFr ? "Vous réservez" : "You book",
        text: isFr
          ? "Réservation d'un appel ou formulaire de contact : 2 canaux disponibles, vous choisissez celui qui vous convient."
          : "Call booking or contact form: 2 available channels, you pick the one that suits you.",
      },
      {
        name: isFr ? "On prépare votre journée" : "We prepare your day",
        text: isFr
          ? "Étude de votre secteur, vos outils et vos enjeux. Le programme est calibré pour votre entreprise — vos équipes apprennent sur des exemples qui leur parlent immédiatement."
          : "Study of your industry, tools and business challenges. The programme is calibrated for your company — your teams learn on examples that resonate immediately.",
      },
      {
        name: isFr ? "Intervention sur site" : "On-site delivery",
        text: isFr
          ? "Cadrage rapide par téléphone, puis le formateur intervient le jour J sur votre site avec vos équipes."
          : "Quick phone scoping, then the trainer comes on site with your teams on the day.",
      },
    ],
  });

  // ItemList JSON-LD — le catalogue complet (générales + métiers + secteurs),
  // chaque item pointant sa fiche. Factory centralisée seo.ts.
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/formations",
    name: isFr ? "Catalogue des formations IA Axion-IA" : "Axion-IA AI training catalogue",
    items: [...generales, ...metiers, ...secteurs].map((f, idx) => ({
      position: idx + 1,
      name: f.titreFr,
      url: `${SITE_URL}/${locale}/formations/${f.slugFr}`,
      description: f.accrocheFr,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2 colonnes — refonte wording Will 2026-07-19 : promesse
          productivité + ligne de réassurance (claims Qualiopi/OPCO GATÉS
          Phase B — fallback légal sans certification hors flag) + bonus
          visibilité sous les CTA. */}
      <ServiceHero
        eyebrow={isFr ? "Module 1 · Formations équipe" : "Module 1 · Team trainings"}
        title={isFr ? "Explosez la productivité de vos équipes" : "Boost your teams' productivity"}
        titleEm={isFr ? "par des formations performantes" : "with high-impact trainings"}
        description={
          isFr
            ? ofPublicHero
              ? "Certifié Qualiopi · jusqu'à 100 % finançable OPCO · 100 % clients satisfaits."
              : "100 % clients satisfaits · 100 % pratique, sur vos propres outils et cas d'usage · prix publics par groupe."
            : ofPublicHero
              ? "Qualiopi-certified · up to 100% OPCO-fundable · 100% satisfied clients."
              : "100% satisfied clients · 100% hands-on, on your own tools and use cases · public prices per group."
        }
        ctas={
          // CTA primary « Réserver un appel » (aligné Header) + Secondary
          // « Nous écrire », puis BONUS VISIBILITÉ (Will 2026-07-19) sous les
          // CTA — wording aligné sur FormationsLesPlus (offre réelle existante).
          <>
            <Cta
              href="/appel"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track="collectives-hero-book-call"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              className="bg-paper text-terracotta hover:bg-paper border-terracotta-deep shadow-subtle border-2"
              track="collectives-hero-contact"
            >
              {isFr ? "Nous écrire" : "Email us"}
            </Cta>
            <p className="text-fg-soft w-full basis-full text-[13.5px] leading-relaxed">
              <span className="text-fg font-semibold">
                {isFr
                  ? "Visibilité offerte à votre entreprise :"
                  : "Free visibility for your company:"}
              </span>{" "}
              {isFr
                ? "podcast avec le dirigeant · interviews de participants · page web dédiée sur axion-ia.com"
                : "executive podcast · participant interviews · dedicated page on axion-ia.com"}
            </p>
          </>
        }
        customVisual={
          <HeroOrbital
            centerLabel={isFr ? "Votre équipe" : "Your team"}
            ariaLabel={
              isFr
                ? "Schéma : votre équipe au centre, entourée du paysage IA que nous couvrons (ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity, Midjourney, Sora, HeyGen)."
                : "Diagram: your team at the center, surrounded by the AI landscape we cover (ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity, Midjourney, Sora, HeyGen)."
            }
            nodes={[
              {
                slug: "chatgpt",
                label: "ChatGPT",
                benefit: isFr ? "Rédaction, synthèse" : "Writing, synthesis",
                accent: "terracotta",
              },
              {
                slug: "claude",
                label: "Claude",
                benefit: isFr ? "Analyse, code" : "Analysis, code",
                accent: "primary",
              },
              {
                slug: "mistral",
                label: "Mistral",
                benefit: isFr ? "IA souveraine FR" : "Sovereign EU AI",
                accent: "sage",
              },
              {
                slug: "copilot",
                label: "Copilot",
                benefit: isFr ? "Office, Outlook" : "Office, Outlook",
                accent: "mocha",
              },
              {
                slug: "perplexity",
                label: "Perplexity",
                benefit: isFr ? "Recherche sourcée" : "Sourced research",
                accent: "terracotta",
              },
              {
                slug: "midjourney",
                label: "Midjourney",
                benefit: isFr ? "Création visuelle" : "Visual creation",
                accent: "primary",
              },
              {
                slug: "sora",
                label: "Sora",
                benefit: isFr ? "Vidéo IA" : "AI video",
                accent: "sage",
              },
              {
                slug: "heygen",
                label: "HeyGen",
                benefit: isFr ? "Avatars formation" : "Training avatars",
                accent: "mocha",
              },
            ]}
          />
        }
      />

      {/* SCROLL HINT visible centré sous le hero (Will 2026-05-28 — « plus
          visible et centré en bas du hero »). Bouton pill avec chevron-down
          animé bounce, ancre vers la section #formats. Placé hors du hero
          pour respiration visuelle. */}
      <div className="bg-paper flex justify-center pb-12 sm:pb-16">
        <a
          href="#formats"
          data-cta="collectives-hero-scroll-formats"
          className="bg-paper text-fg hover:text-terracotta border-terracotta/40 hover:border-terracotta shadow-subtle hover:shadow-card focus-visible:ring-terracotta inline-flex items-center gap-3 rounded-full border-2 px-7 py-3.5 text-[15px] font-semibold tracking-tight transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {isFr ? "Découvrir les formations" : "Discover the trainings"}
          <ChevronDown aria-hidden="true" className="text-terracotta h-5 w-5 animate-bounce" />
        </a>
      </div>

      {/* CATALOGUE — Refonte 2026-07-19 (Will) : l'axe durée disparaît. Le hub
          présente les 3 OFFRES GÉNÉRALES (cartes riches, prix publics par
          groupe) puis 2 grandes cartes CTA vers les listings « par métier »
          et « par secteur d'activité ». La durée reste un badge par carte. */}
      <Section
        id="formats"
        eyebrow={isFr ? "Offres générales" : "General offers"}
        title={isFr ? "Trois offres pour" : "Three offers to"}
        titleEm={isFr ? "commencer et accélérer" : "start and accelerate"}
        description={
          isFr
            ? `Des formations 100 % pratiques, construites à partir de vos propres outils et cas d'usage — chaque participant repart avec des méthodes et des prompts immédiatement applicables. Prix par groupe (2 à 15 personnes), dès ${minPriceLabel}.`
            : "100% hands-on trainings, built on your own tools and use cases — every participant leaves with methods and prompts they can apply immediately. Priced per group (2-15 people)."
        }
        contentClassName={TIGHT_X}
      >
        {/* 4 CARTES OFFRES GÉNÉRALES — les 2 formats « bien commencer » sont
            des cartes séparées et CHAQUE carte porte son badge sur la photo
            (Will 2026-07-19). Grid 2×2 en md, 4 sur 1 ligne en xl. */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:gap-6 xl:grid-cols-4">
          {offresGenerales.map((offre) => {
            const img = getFormationImage(offre.f);
            const credit = getFormationImageCredit(offre.f);
            const price = getFormationV2EntryPrice(offre.f);
            return (
              <article
                key={offre.key}
                className="group/offre bg-paper border-terracotta/30 hover:border-terracotta shadow-subtle relative flex h-full flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(205,107,72,0.30)]"
              >
                {/* Filet couleur en haut */}
                <span aria-hidden="true" className="bg-terracotta block h-2 w-full" />

                {/* BANDEAU IMAGE — photo dédiée + BADGE de positionnement sur
                    chaque carte (Unsplash locale, crédit CGU §9, CLS=0). */}
                <div className="relative">
                  <Image
                    src={img.src}
                    alt={img.altFr}
                    width={1280}
                    height={800}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 320px"
                    className="aspect-[16/9] w-full object-cover"
                    quality={78}
                  />
                  <span className="bg-terracotta text-mocha-fg absolute top-3 left-3 z-[2] inline-flex items-center rounded-full px-3 py-1 text-[10.5px] font-bold tracking-wide uppercase shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
                    {offre.badgeFr}
                  </span>
                  {credit ? (
                    <UnsplashCredit
                      photographerName={credit.name}
                      photographerUrl={credit.url}
                      className="bg-paper/85 absolute right-2 bottom-2 z-[2] !mt-0 rounded-full px-2 py-0.5 !text-[9.5px]"
                    />
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  {/* Le BÉNÉFICE ressort en titre (Will 2026-07-19 : « c'est
                      "Comprendre l'IA et l'utiliser dès aujourd'hui" qui doit
                      ressortir, pas "IA pour bien commencer" ») ; le nom de la
                      formation passe en sous-ligne discrète. */}
                  <h2 className="text-fg text-lg leading-tight font-semibold sm:text-xl">
                    {offre.benefitFr}
                  </h2>
                  <p className="text-fg-muted mt-1.5 text-[12.5px] leading-snug font-medium">
                    {offre.titreFr}
                  </p>
                  <p className="text-fg-soft mt-3 text-[13px] leading-relaxed">{offre.pitchFr}</p>

                  {/* Durée & prix — dérivés de la matrice (jamais en dur).
                      `formatAmount` NON-compact porte déjà « € HT ». */}
                  <div className="border-border mt-5 flex items-baseline justify-between gap-3 border-t pt-4 text-[13.5px]">
                    <span className="text-fg-soft font-medium">{dureeLabelFr(offre.f)}</span>
                    <span className="text-fg font-semibold tabular-nums">
                      {typeof price === "number"
                        ? formatAmount(price, "fr")
                        : isFr
                          ? "Sur devis"
                          : "On quote"}
                    </span>
                  </div>
                  <p className="text-fg-muted mt-1.5 text-[12px]">
                    {isFr
                      ? "Prix par groupe · jusqu'à 15 participants"
                      : "Per group · up to 15 people"}
                  </p>

                  <div className="mt-auto pt-5">
                    <Link
                      href={`/formations/${offre.f.slugFr}` as never}
                      className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep inline-flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3 text-[13.5px] font-semibold transition-colors"
                    >
                      <span>{isFr ? "Découvrir la formation" : "See the training"}</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform duration-200 group-hover/offre:translate-x-1"
                      />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* 2 CTA CATÉGORIES — formations par métier / par secteur d'activité.
            Chaque carte ouvre la page listing dédiée (toutes les formations de
            la catégorie), qui elle-même mène aux fiches. */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:gap-6">
          {(
            [
              {
                key: "metiers",
                href: "/formations/metiers",
                count: metiers.length,
                labelFr: metiersMeta?.labelFr ?? "Formations par métier",
                taglineFr:
                  metiersMeta?.taglineFr ?? "L'IA appliquée aux tâches réelles de chaque fonction.",
                axes: metiers,
                ctaFr: "Voir les formations par métier",
                ctaEn: "See role-specific trainings",
              },
              {
                key: "secteurs",
                href: "/formations/secteurs",
                count: secteurs.length,
                labelFr: secteursMeta?.labelFr ?? "Formations par secteur d'activité",
                taglineFr:
                  secteursMeta?.taglineFr ?? "L'IA appliquée aux réalités de votre secteur.",
                axes: secteurs,
                ctaFr: "Voir les formations par secteur",
                ctaEn: "See industry-specific trainings",
              },
            ] as const
          ).map((cat) => (
            <article
              key={cat.key}
              className="group/cat bg-sand border-terracotta-deep/40 hover:border-terracotta-deep shadow-subtle relative flex h-full flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(180,80,40,0.30)]"
            >
              <span aria-hidden="true" className="bg-terracotta-deep block h-2 w-full" />
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <div className="bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold">
                  <Users aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>
                    {cat.count} {isFr ? "formations" : "trainings"}
                  </span>
                </div>
                <h2 className="text-fg mt-4 text-xl leading-tight font-semibold sm:text-2xl">
                  {cat.labelFr}
                </h2>
                <p className="text-fg-soft mt-2 text-[13.5px] leading-relaxed">{cat.taglineFr}</p>

                {/* Axes couverts — pills dérivées du catalogue (axeLabelFr) */}
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {cat.axes.map((f) => (
                    <li
                      key={f.id}
                      className="bg-paper border-border text-fg rounded-full border px-2.5 py-1 text-[11.5px] font-medium"
                    >
                      {f.axeLabelFr ?? f.titreFr}
                    </li>
                  ))}
                </ul>

                <div className="relative z-[2] mt-auto pt-6">
                  <Link
                    href={cat.href as never}
                    className="bg-terracotta-deep text-mocha-fg hover:bg-terracotta-deep/85 inline-flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-semibold transition-colors"
                  >
                    <span>{isFr ? cat.ctaFr : cat.ctaEn}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform duration-200 group-hover/cat:translate-x-1"
                    />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Lien grille tarifaire — la page /formations/tarifs porte les 3
            tableaux (catégorie × durée). href littéral typé (routing.ts). */}
        <p className="mt-8 text-center">
          <Link
            href="/formations/tarifs"
            className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {isFr ? "Voir tous les tarifs en détail" : "See all prices in detail"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>

        {/* PHOTOS FORMATION — 4 photos illustratives sous les cards palier
            durée. Sprint 2026-05-28 (Will) — déplacé sous les cards pour
            laisser les cards en premier (call-to-action visible direct),
            les photos servent d'ancrage visuel après le choix.
            Grid 4 cols 1 ligne desktop (`md:grid-cols-4`), 2 cols mobile.
            Aspect-[4/3] paysage moderne. max-w-7xl (vs 6xl avant) pour
            légèrement grossir les photos selon retour Will.
            Pas de zoom/lightbox (Will : « sans possibilité de grossir »). */}
        <div className="mx-auto mt-14 grid max-w-7xl grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4 md:gap-5">
          {gridPhotos.map((p) => (
            <figure key={p.src} className="m-0 overflow-hidden rounded-2xl">
              <Image
                src={p.src}
                alt={isFr ? p.altFr : p.altEn}
                width={p.width}
                height={p.height}
                loading="lazy"
                decoding="async"
                sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 320px"
                className="aspect-[4/3] h-auto w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                quality={82}
              />
              <figcaption className="sr-only">{isFr ? p.nameFr : p.nameEn}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* ============================================================
          FORMATION RÉGULIÈRE — Sprint 2026-05-28 (Will).
          Bloc dédié aux entreprises qui veulent des formations IA
          répétitives (mensuelles ou bi-mensuelles) pour installer
          durablement la culture IA. Sémantique SEO renforcée pour
          requêtes : « formation IA entreprise », « formateur IA »,
          « formation IA TPE/PME/ETI/grandes entreprises », « montée
          en compétence IA », « formation IA récurrente », « formation
          continue IA », « formation IA mensuelle ».
          ============================================================ */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Formation régulière" : "Recurring training"}
        title={isFr ? "Formation régulière" : "Recurring training"}
        titleEm={isFr ? "mensuelle" : "monthly"}
        description={
          isFr
            ? "Pour les TPE, PME, ETI, un formateur IA expert intervient chez vous régulièrement, sur 6, 12 ou 24 mois. Gains de temps instantanés mesurés à chaque session, automatisations métier déployées progressivement, échanges continus entre les journées de formation pour ne jamais vous laisser seul."
            : "For SMEs, mid-caps and large companies, an expert AI trainer comes on site regularly, over 6, 12 or 24 months. Instant time savings measured at each session, business automations rolled out progressively, continuous exchanges between training days so you're never left alone."
        }
        contentClassName={TIGHT_X}
      >
        <Container>
          {/* FRISE panoramique — bande de 3 photos « scène » (maison, sans
              crédit Unsplash) qui ouvre la section : atmosphère + preuve
              visuelle avant les formules. Aspect fixe → 0 CLS, lazy-load. */}
          <div className="mx-auto mb-10 max-w-5xl md:mb-12">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                {
                  src: "/illustrations/formations/salle-formation-ia-entreprise-sur-site.avif",
                  alt: isFr
                    ? "Salle de formation IA en entreprise, animée sur site par un formateur expert"
                    : "AI training room on the company's premises, led on site by an expert trainer",
                },
                {
                  src: "/illustrations/formations/equipe-pme-formation-ia-atelier-pratique.avif",
                  alt: isFr
                    ? "Équipe en atelier pratique pendant une formation IA sur ses propres cas d'usage"
                    : "Team in a hands-on workshop during AI training on their own use cases",
                },
                {
                  src: "/illustrations/formations/bilan-formation-ia-equipe-autonome.avif",
                  alt: isFr
                    ? "Bilan de formation IA — équipe désormais autonome sur ses nouveaux réflexes"
                    : "AI training review — team now autonomous with its new reflexes",
                },
              ].map((img, i) => (
                <div
                  key={i}
                  className="ring-border/60 relative overflow-hidden rounded-2xl ring-1 sm:rounded-3xl"
                >
                  <Image
                    src={img.src}
                    alt={img.alt}
                    width={640}
                    height={800}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 768px) 32vw, 320px"
                    quality={72}
                    className="aspect-[3/4] w-full object-cover sm:aspect-[4/3]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 md:gap-7">
            {/* CARD 1 — Formule mensuelle (la plus mise en avant) */}
            <article className="bg-paper border-terracotta/40 shadow-subtle hover:border-terracotta hover:shadow-card group relative flex flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 hover:-translate-y-1">
              {/* Badge "Le plus choisi" */}
              <span className="bg-terracotta text-mocha-fg absolute top-5 right-5 z-[2] inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase">
                {isFr ? "Le plus choisi" : "Most chosen"}
              </span>

              {/* Filet couleur */}
              <span aria-hidden="true" className="bg-terracotta block h-2 w-full" />

              <div className="flex flex-1 flex-col p-7 sm:p-8">
                <div className="bg-terracotta-soft text-terracotta-deep mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Users aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </div>

                <h3 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                  {isFr ? "Formule mensuelle" : "Monthly programme"}
                </h3>
                <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">
                  {isFr
                    ? "1 journée de formation IA par mois, sur 6 ou 12 mois — le rythme soutenu pour installer rapidement la culture IA dans vos équipes."
                    : "1 day of AI training per month, over 6 or 12 months — the sustained pace to quickly install AI culture across your teams."}
                </p>

                <ul className="mt-6 space-y-3">
                  {(isFr
                    ? [
                        "Formateur IA expert dédié à votre entreprise",
                        "Montée en compétence progressive et mesurable",
                        "Gain de temps instantané dès la 1ʳᵉ session",
                        "Nouveaux cas d'automatisation métier maîtrisés chaque journée",
                        "WhatsApp d'entraide continue entre les sessions",
                      ]
                    : [
                        "Dedicated expert AI trainer for your company",
                        "Progressive, measurable upskilling",
                        "Instant time savings from session 1",
                        "New business automation cases mastered every session",
                        "Continuous WhatsApp peer-support between sessions",
                      ]
                  ).map((line, i) => (
                    <li key={i} className="text-fg flex items-start gap-3 text-[14px]">
                      <span
                        aria-hidden="true"
                        className="bg-terracotta mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      />
                      <span className="leading-snug">{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="bg-terracotta-soft text-terracotta-deep mt-6 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold">
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>
                    {isFr
                      ? "Sur devis personnalisé · 6 ou 12 mois"
                      : "Bespoke quote · 6 or 12 months"}
                  </span>
                </div>

                <div className="mt-auto pt-7">
                  <Cta
                    href="/appel"
                    size="lg"
                    className="bg-primary text-primary-fg hover:bg-primary-hover w-full justify-center shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
                    track="collectives-recurring-monthly-call"
                  >
                    {isFr ? "Réserver un appel" : "Book a call"}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                </div>
              </div>
            </article>

            {/* CARD 2 — Formule bi-mensuelle (rythme plus souple) */}
            <article className="bg-paper border-sage/40 shadow-subtle hover:border-sage hover:shadow-card group relative flex flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 hover:-translate-y-1">
              <span aria-hidden="true" className="bg-sage block h-2 w-full" />

              <div className="flex flex-1 flex-col p-7 sm:p-8">
                <div className="bg-sage-soft text-sage mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Users aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </div>

                <h3 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                  {isFr ? "Formule bi-mensuelle" : "Bi-monthly programme"}
                </h3>
                <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">
                  {isFr
                    ? "1 journée de formation IA tous les 2 mois, sur 6 ou 12 mois — le rythme idéal pour les TPE et équipes chargées qui veulent progresser sans saturer leur agenda."
                    : "1 day of AI training every 2 months, over 6 or 12 months — the ideal pace for small businesses and busy teams that want to progress without saturating their schedule."}
                </p>

                <ul className="mt-6 space-y-3">
                  {(isFr
                    ? [
                        "Cadence respectueuse de la charge opérationnelle",
                        "Mêmes bénéfices que mensuel, rythme ajusté",
                        "Temps d'intégration entre sessions pour pratiquer",
                        "WhatsApp d'entraide continue entre les journées",
                      ]
                    : [
                        "Pace that respects operational workload",
                        "Same benefits as monthly, adjusted pace",
                        "Integration time between sessions to practice",
                        "Continuous WhatsApp peer-support between days",
                      ]
                  ).map((line, i) => (
                    <li key={i} className="text-fg flex items-start gap-3 text-[14px]">
                      <span
                        aria-hidden="true"
                        className="bg-sage mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      />
                      <span className="leading-snug">{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="bg-sage-soft text-sage mt-6 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold">
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>
                    {isFr
                      ? "Sur devis personnalisé · 6 ou 12 mois"
                      : "Bespoke quote · 6 or 12 months"}
                  </span>
                </div>

                <div className="mt-auto pt-7">
                  <Cta
                    href="/appel"
                    size="lg"
                    className="bg-primary text-primary-fg hover:bg-primary-hover w-full justify-center shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
                    track="collectives-recurring-bimonthly-call"
                  >
                    {isFr ? "Réserver un appel" : "Book a call"}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                </div>
              </div>
            </article>
          </div>

          {/* Bénéfices SEO sémantique — densifie le contenu avec les mots-clés
              cibles sans keyword stuffing ; refonte 2026-07-19 (Will) : grille
              à icônes chartée (chips terracotta/primary/sage rotatifs) sur le
              fond sable de la section, au lieu de l'ancien texte plat. */}
          <div className="mx-auto mt-12 max-w-5xl">
            <h3 className="text-fg text-center text-xl leading-tight font-semibold tracking-tight text-balance sm:text-2xl">
              {isFr
                ? "Pourquoi une formation IA récurrente en entreprise ?"
                : "Why recurring corporate AI training?"}
            </h3>
            <p className="text-fg-soft mx-auto mt-3 max-w-2xl text-center text-[15px] leading-relaxed">
              {isFr
                ? "100 % pratique, sur vos propres outils et cas d'usage · prix publics par groupe."
                : "100% hands-on, on your own tools and use cases · public prices per group."}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5">
              {(isFr
                ? [
                    {
                      t: "Formateur IA dédié",
                      d: "Un seul formateur IA expert qui connaît votre métier, votre stack et vos équipes — pas de turn-over, pas de re-briefing à chaque session.",
                    },
                    {
                      t: "Montée en compétence continue",
                      d: "Les apprentissages s'installent dans la durée. Chaque mois consolide les gains du précédent et ouvre de nouveaux cas d'usage.",
                    },
                    {
                      t: "Gain de temps instantané",
                      d: "Dès la 1ʳᵉ journée, les participants maîtrisent 3-5 automatisations applicables à leurs tâches, qui leur font gagner du temps immédiatement.",
                    },
                    {
                      t: "Adapté à toutes les tailles",
                      d: "Programme calibré pour TPE (2-8 pers.), PME (9-50 pers.), ETI (50-250 pers.) ou grandes entreprises (déploiement multi-sites).",
                    },
                    {
                      t: "Assistants IA",
                      d: "ChatGPT, Claude et Gemini, et la création de vos propres assistants IA — chacun repart avec l'assistant qu'il a construit sur un cas d'usage de son métier.",
                    },
                    {
                      t: "ROI mesuré",
                      d: "À chaque session, on chiffre les heures gagnées, les tâches automatisées, l'adoption par participant. Bilan transparent à 3, 6, 12 mois.",
                    },
                  ]
                : [
                    {
                      t: "Dedicated AI trainer",
                      d: "One expert AI trainer who knows your business, stack and teams — no turnover, no re-briefing each session.",
                    },
                    {
                      t: "Continuous upskilling",
                      d: "Learning sticks over time. Each month consolidates previous gains and opens new use cases.",
                    },
                    {
                      t: "Instant time savings",
                      d: "From day 1, participants master 3-5 automations applicable to their tasks, saving time immediately.",
                    },
                    {
                      t: "Fits all company sizes",
                      d: "Programme calibrated for small businesses (2-8 ppl), SMEs (9-50 ppl), mid-caps (50-250 ppl) or large enterprises (multi-site).",
                    },
                    {
                      t: "Business automations",
                      d: "ChatGPT, Claude, Microsoft Copilot, Gemini, AI agents and bespoke business automations — we work only on your real tools, real documents, real workflows.",
                    },
                    {
                      t: "Measured ROI",
                      d: "Each session: hours saved, automated tasks, per-participant adoption — transparent review at 3, 6, 12 months.",
                    },
                  ]
              ).map((row, i) => {
                const meta = [
                  { Icon: UserCheck, chip: "bg-terracotta-soft text-terracotta-deep" },
                  { Icon: TrendingUp, chip: "bg-primary-soft text-primary" },
                  { Icon: Zap, chip: "bg-sage-soft text-sage" },
                  { Icon: Building2, chip: "bg-terracotta-soft text-terracotta-deep" },
                  { Icon: Bot, chip: "bg-primary-soft text-primary" },
                  { Icon: LineChart, chip: "bg-sage-soft text-sage" },
                ][i]!;
                const Icon = meta.Icon;
                return (
                  <div
                    key={i}
                    className="bg-paper border-border shadow-subtle hover:shadow-card flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 sm:p-6"
                  >
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${meta.chip}`}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="text-fg text-[15px] leading-tight font-semibold">{row.t}</span>
                    <span className="text-fg-soft text-[13.5px] leading-relaxed">{row.d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </Section>

      {/* SÉMINAIRE — À PART (décision Will 2026-07-19) : conservé hors des
          catégories du catalogue, rubrique dédiée. Fiche et offre inchangées
          (seminaire-ia-toute-l-entreprise-1j, jusqu'à 50 participants). */}
      {seminaire ? (
        <Section
          eyebrow={isFr ? "Et pour toute l'entreprise ?" : "For the whole company?"}
          title={isFr ? "Le séminaire IA" : "The AI seminar"}
          titleEm={isFr ? "qui fédère toutes vos équipes" : "that unites all your teams"}
          contentClassName={TIGHT_X}
        >
          <Container>
            <article className="bg-paper border-primary/30 hover:border-primary shadow-subtle hover:shadow-card mx-auto flex max-w-3xl flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 hover:-translate-y-1">
              <span aria-hidden="true" className="bg-primary block h-2 w-full" />
              {/* BANDEAU IMAGE séminaire (Unsplash locale + crédit CGU §9) */}
              {(() => {
                const img = getFormationImage(seminaire);
                const credit = getFormationImageCredit(seminaire);
                return (
                  <div className="relative">
                    <Image
                      src={img.src}
                      alt={img.altFr}
                      width={1280}
                      height={800}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 768px) 100vw, 720px"
                      className="aspect-[21/9] w-full object-cover"
                      quality={78}
                    />
                    {credit ? (
                      <UnsplashCredit
                        photographerName={credit.name}
                        photographerUrl={credit.url}
                        className="bg-paper/85 absolute right-2 bottom-2 !mt-0 rounded-full px-2 py-0.5 !text-[9.5px]"
                      />
                    ) : null}
                  </div>
                );
              })()}
              <div className="flex flex-col gap-4 p-7 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-primary-soft text-primary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold">
                    <Users aria-hidden="true" className="h-3.5 w-3.5" />
                    {isFr ? "Jusqu'à 50 participants" : "Up to 50 participants"}
                  </span>
                  <span className="bg-primary-soft text-primary inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold">
                    {isFr ? "1 journée · présentiel · sur devis" : "1 day · on site · on quote"}
                  </span>
                </div>
                <h3 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                  {seminaire.titreFr}
                </h3>
                <p className="text-fg-soft text-[15px] leading-relaxed">{seminaire.accrocheFr}</p>
                <p className="text-fg-soft text-[14px] leading-relaxed">
                  {isFr
                    ? "Distinct des formations en groupe de 15 : une journée pour poser un socle commun, cartographier les usages réels de l'entreprise et repartir avec des règles et des engagements par service."
                    : "Distinct from the 15-person trainings: one day to build a common base, map real usage across the company and leave with rules and commitments per department."}
                </p>
                <div className="pt-2">
                  <Link
                    href={`/formations/${seminaire.slugFr}` as never}
                    className="bg-primary text-primary-fg hover:bg-primary-hover inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-semibold transition-colors"
                  >
                    {isFr ? "Découvrir le séminaire" : "Discover the seminar"}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          </Container>
        </Section>
      ) : null}

      {/* SECTION FORMATEUR — Sprint 2026-05-28 (Will). Pattern home « Section
          Fondateur » adapté formation IA : crédibilité du formateur (Williams
          ou un membre de son équipe) placé juste après le bloc Formation
          régulière mensuelle. Donne confiance avant la conversion (bandeau
          terracotta + Comment réserver + quadriptyque). */}
      <section
        id="formateur"
        aria-labelledby="formateur-heading"
        className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28"
      >
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Colonne gauche : copy formation */}
            <div className="max-w-xl">
              <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
                <span className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Votre formateur IA" : "Your AI trainer"}
              </p>
              <h2
                id="formateur-heading"
                className="text-fg text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Un formateur" : "A trainer"}
                <br />
                <span className="text-terracotta italic">
                  {isFr ? "dédié à votre entreprise" : "dedicated to your business"}
                </span>
              </h2>
              <p className="text-fg-soft mt-7 text-lg leading-relaxed">
                {isFr
                  ? "Williams, fondateur d'Axion-IA, intervient souvent durant les formations, ou un formateur de son équipe — dédié à votre entreprise, qui adapte la formation à votre métier, votre stack et vos enjeux."
                  : "Williams, founder of Axion-IA, often delivers the trainings himself, or a trainer from his team — dedicated to your business, who adapts the training to your work, your stack and your stakes."}
              </p>
              <p className="text-fg-soft mt-5 text-lg leading-relaxed">
                {isFr
                  ? "Nos formateurs codent et déploient au quotidien sur nos projets (audit, implémentation, sites web, SaaS) avant d'enseigner — un atout pour vous : être formé·e par quelqu'un qui maîtrise toute la chaîne, pas seulement la théorie."
                  : "Our trainers code and deploy daily on our projects (audit, implementation, websites, SaaS) before teaching — an asset for you: being trained by someone who masters the full chain, not just theory."}
              </p>
              <div className="border-border-strong mt-8 flex items-start gap-4 border-t pt-6">
                <span className="bg-terracotta mt-1 inline-block h-6 w-0.5 shrink-0 rounded-full" />
                <p
                  className="text-fg-soft text-base leading-relaxed italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr
                    ? "« L'esprit voulu : des formations fun, en détente, avec beaucoup d'humanité — et une forte valeur pour chaque participant. Que vos équipes ressortent autonomes dès le lendemain. »"
                    : "« The spirit we want: fun, relaxed trainings with deep humanity — and strong value for every participant. That your teams leave autonomous from the day after. »"}
                </p>
              </div>
              <p className="mt-6">
                <Link
                  href="/a-propos"
                  className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {isFr ? "Découvrir l'approche Axion-IA" : "Discover the Axion-IA approach"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </p>
            </div>

            {/* Colonne droite : photo Williams */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-xs">
                <figure className="shadow-card m-0 overflow-hidden rounded-2xl">
                  <Image
                    src="/illustrations/william-fondateur-formateur-ia-axion-ia.png"
                    alt={
                      isFr
                        ? "Williams, fondateur Axion-IA et formateur IA — portrait posé devant olivier, ambiance méditerranée. Forme les équipes TPE, PME, ETI et grandes entreprises françaises avec une équipe de formateurs experts dédiés."
                        : "Williams, Axion-IA founder and AI trainer — portrait in front of olive tree, Mediterranean atmosphere. Trains French SME, mid-cap and large enterprise teams with a dedicated team of expert trainers."
                    }
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 1024px) 80vw, 320px"
                    className="aspect-[4/5] h-auto w-full object-cover"
                    quality={85}
                  />
                </figure>
                <div className="mt-4 text-center">
                  <p className="text-fg text-lg font-semibold">Williams</p>
                  <p className="text-fg-muted text-sm">
                    {isFr
                      ? "Fondateur & formateur IA · Axion-IA"
                      : "Founder & AI trainer · Axion-IA"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar — 3 colonnes adaptées formation (sans mention années
              d'expérience selon retour Will 2026-05-28). */}
          <div className="border-border-strong mt-16 grid grid-cols-3 divide-x border-t pt-10">
            {(
              [
                {
                  number: isFr ? "Toute la France" : "All France",
                  labelFr: "métropolitaine + francophone à l'international (1 sem. min.)",
                  labelEn: "metropolitan + French-speaking abroad (1 week min.)",
                },
                {
                  number: isFr ? "Dès le 1ᵉʳ jour" : "From day 1",
                  labelFr: "des automatisations concrètes, applicables tout de suite",
                  labelEn: "concrete automations, usable right away",
                },
                {
                  number: isFr ? "12h/sem" : "12h/week",
                  labelFr: "gain de temps moyen post-formation",
                  labelEn: "average time saved post-training",
                },
              ] as const
            ).map((stat, idx) => (
              <div key={idx} className="flex flex-col gap-1 px-6 first:pl-0 last:pr-0">
                <span
                  className="text-fg text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {stat.number}
                </span>
                <span className="text-fg-soft text-sm leading-snug">
                  {isFr ? stat.labelFr : stat.labelEn}
                </span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* TÉLÉCHARGER LE CATALOGUE + RÉSERVER (ajout 2026-07-19, Will) :
          PDF du catalogue en public/ + réservation d'appel (URL + QR). */}
      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Télécharger le catalogue */}
            <div className="bg-paper shadow-subtle flex flex-col justify-between rounded-2xl border border-black/10 p-7">
              <div>
                <p className="text-terracotta mb-2 text-[12px] font-semibold tracking-[0.16em] uppercase">
                  {isFr ? "Le catalogue complet" : "The full catalogue"}
                </p>
                <h2
                  className="text-fg text-2xl font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Recevez le catalogue en PDF" : "Get the catalogue as a PDF"}
                </h2>
                <p className="text-fg-soft mt-2 text-sm leading-relaxed">
                  {isFr
                    ? "24 pages : 21 formations + 1 séminaire, prix publics par groupe, financement OPCO et méthode AXION."
                    : "24 pages: 21 trainings + 1 seminar, public prices per group, OPCO funding and the AXION method."}
                </p>
              </div>
              <a
                href="/catalogue-formations-ia-axion-ia.pdf"
                download
                className="bg-primary text-primary-fg hover:bg-primary-hover shadow-subtle mt-5 inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-base font-semibold"
              >
                {isFr ? "Télécharger le catalogue (PDF)" : "Download the catalogue (PDF)"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>
            {/* Réserver un appel — URL + QR */}
            <div className="bg-paper shadow-subtle flex items-center gap-6 rounded-2xl border border-black/10 p-7">
              <div className="flex-1">
                <p className="text-terracotta mb-2 text-[12px] font-semibold tracking-[0.16em] uppercase">
                  {isFr ? "Réserver un appel" : "Book a call"}
                </p>
                <h2
                  className="text-fg text-2xl font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "30 min, sans engagement" : "30 min, no commitment"}
                </h2>
                <p className="text-fg-soft mt-2 text-sm leading-relaxed">
                  {isFr ? "Scannez le QR code ou rendez-vous sur :" : "Scan the QR code or go to:"}
                </p>
                <p className="text-fg mt-1 text-base font-semibold">axion-ia.com/fr/appel</p>
                <Cta
                  href="/appel"
                  size="lg"
                  className="bg-primary text-primary-fg hover:bg-primary-hover shadow-subtle mt-4"
                  track="collectives-catalogue-band-call"
                >
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
              </div>
              <Image
                src="/qr-reserver-appel.svg"
                alt={isFr ? "QR code — réserver un appel" : "QR code — book a call"}
                width={128}
                height={128}
                unoptimized
                className="hidden h-32 w-32 shrink-0 rounded-xl border border-black/10 bg-white p-2 sm:block"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* BANDEAU TERRACOTTA compact — pattern aligné sur la home (line 1288 de
          `/[locale]/page.tsx`) : section py-16 sm:py-20 flex horizontal
          (texte gauche, CTAs droite). Will 2026-05-28 — wording d'orientation
          conversationnelle (vs bandeau sombre qui porte maintenant la
          promesse formation IA / montée en compétence). CTAs alignés Header. */}
      <section className="bg-terracotta py-16 sm:py-20">
        <Container>
          <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="max-w-2xl">
              <p className="text-mocha-fg/75 mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
                {isFr ? "Pas sûr·e du bon format ?" : "Not sure which format?"}
              </p>
              <h2
                className="text-mocha-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "On vous oriente," : "We guide you,"}{" "}
                <span className="text-paper italic" style={{ fontFamily: "var(--font-serif)" }}>
                  {isFr ? "à votre rythme" : "at your pace"}
                </span>
              </h2>
              <p className="text-mocha-fg/90 mt-3 text-base leading-relaxed sm:text-lg">
                {isFr
                  ? "Un appel pour comprendre votre contexte, vous conseiller la durée la plus adaptée à vos enjeux, et vous expliquer comment se déroule la formation. Sans engagement."
                  : "A call to understand your context, advise the duration that fits your stakes, and explain how the training unfolds. No commitment."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Cta
                href="/appel"
                size="lg"
                className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
                track="collectives-terracotta-band-call"
              >
                {isFr ? "Réserver un appel" : "Book a call"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
              <Cta
                href="/contact"
                size="lg"
                className="bg-paper text-terracotta hover:bg-paper/95 shadow-subtle"
                track="collectives-terracotta-band-contact"
              >
                {isFr ? "Nous écrire" : "Email us"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* COMMENT ÇA FONCTIONNE — 3 étapes simplifiées (Sprint 2026-05-28 Will).
          1) 3 façons de réserver, 2) on prépare adapté à votre entreprise,
          3) cadrage téléphone + intervention le jour J. */}
      <Section
        eyebrow={isFr ? "Comment ça fonctionne" : "How it works"}
        title={isFr ? "Comment réserver" : "How to book"}
        titleEm={isFr ? "votre journée de formation" : "your training day"}
      >
        <Container>
          <ProcessSteps
            orientation="horizontal"
            steps={[
              {
                id: "step-1-reservation",
                title: isFr ? "Vous réservez" : "You book",
                description: isFr
                  ? "Calendrier, formulaire ou appel : 3 canaux, vous choisissez."
                  : "Calendar, form or call: 3 channels, your pick.",
              },
              {
                id: "step-2-preparation",
                title: isFr ? "On prépare votre journée" : "We prepare your day",
                description: isFr
                  ? "Étude de votre secteur, vos outils, vos enjeux."
                  : "Study of your industry, tools, challenges.",
              },
              {
                id: "step-3-cadrage-intervention",
                title: isFr ? "Intervention sur site" : "On-site delivery",
                description: isFr
                  ? "Cadrage rapide par téléphone, puis le formateur intervient le jour J."
                  : "Quick phone scoping, then trainer comes on the day.",
              },
            ]}
          />
        </Container>
      </Section>

      {/* BANDEAU QUADRIPTYQUE FORMATION — full-bleed (Will 2026-05-28).
          Déplacé après la section « Comment réserver » : conclut narrativement
          le process par une image forte montrant l'intervention réelle (4
          moments : présentation au tableau, écran Claude, équipe collab,
          salle de formation). Pattern aligné home (`home-bandeau-team.avif`)
          : hors Container, bord-à-bord, sans wrapper blanc ni arrondis. */}
      <section className="bg-bg">
        <Image
          src="/illustrations/formation-claude-team-quadriptyque.png"
          alt={
            isFr
              ? "Séquence formation IA Axion-IA en entreprise : présentation au tableau, démo écran Claude, équipe collaborative en atelier pratique, salle de formation sur site avec formateur IA expert."
              : "Axion-IA corporate AI training sequence: tableau presentation, Claude screen demo, collaborative team in hands-on workshop, on-site training room with expert AI trainer."
          }
          width={2400}
          height={800}
          loading="lazy"
          decoding="async"
          sizes="100vw"
          className="h-auto w-full"
        />
      </section>

      {/* COUVERTURE NATIONALE (pSEO villes/régions) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="Les formations IA équipe"
        serviceLabelEn="AI team trainings"
        serviceSlug="interventions"
        tone="paper"
      />

      {/* FAQ unifiée formations équipe (Sprint 2026-05-28 Will) — fusion de
          la FAQ générique + 2 Q/R géolocalisées (couverture). Une seule FAQ
          au lieu de deux pour ne pas alourdir la page. Speakable FAQPage
          JSON-LD émis automatiquement par FaqAccordion. */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "Avant de réserver" : "Before booking"}
        titleEm={isFr ? "votre formation" : "your training"}
      >
        <Container>
          <FaqAccordion
            className="mx-auto max-w-3xl"
            items={
              isFr
                ? [
                    {
                      // Prix dérivés du SSOT catalogue (matrice pricing.ts),
                      // JAMAIS hardcodés — cohérents avec les cartes plus haut.
                      id: "prix-formation-ia",
                      question: "Combien coûte une formation IA en entreprise ?",
                      answer: `Nos prix sont publics et tarifés par groupe (2 à 15 participants) — jamais par personne. Offres générales dès ${minPriceLabel} (4 h) ; formations par métier dès ${formatAmount(getFormationPrice("metier", "1j") ?? Number.NaN, "fr")} la journée ; formations par secteur d'activité dès ${formatAmount(getFormationPrice("secteur", "1j") ?? Number.NaN, "fr")} la journée. Le détail complet figure sur la page tarifs.`,
                    },
                    {
                      id: "effectif",
                      question: "Combien de participants par session ?",
                      answer:
                        "Jusqu'à 15 participants par groupe, au même prix — le tarif est par groupe, pas par personne. Pour réunir toute l'entreprise le même jour (jusqu'à 50 personnes), c'est le séminaire IA, présenté plus haut, qui prend le relais.",
                    },
                    {
                      id: "quelle-formation",
                      question: "Quelle formation choisir ?",
                      answer:
                        "Si vous ne savez pas par où commencer : « IA pour bien commencer » est le point d'entrée naturel (4 h ou 1 journée). Ensuite, choisissez selon votre besoin : « IA pour les équipes » pour installer une pratique commune, « IA pour l'automatisation » pour vos premières automatisations, ou une formation dédiée à votre métier (RH, marketing, commercial…) ou à votre secteur (santé, BTP, industrie…).",
                    },
                    {
                      id: "scindable",
                      question: "Les formations de 2 jours sont-elles scindables ?",
                      answer:
                        "Oui : toutes les formations de 2 jours (automatisation, production, IT, industrie) sont scindables en 2 sessions d'une journée — par exemple à une ou deux semaines d'intervalle, ce qui laisse le temps de pratiquer entre les deux.",
                    },
                    {
                      id: "outils",
                      question: "Quels outils IA utilisés en formation ?",
                      answer:
                        "Les formations s'appuient sur les trois assistants les plus utilisés en entreprise : ChatGPT, Claude et Gemini — vous apprenez à choisir le bon selon le besoin, et à créer vos propres assistants IA. Le reste du paysage (Microsoft Copilot, Mistral, Perplexity, Midjourney, Sora, HeyGen) est situé en panorama, pour que vous sachiez à quoi sert quoi, sans le pratiquer en séance.",
                    },
                    {
                      id: "couverture-paris",
                      question:
                        "Vos formations IA sont-elles disponibles à Paris et en Île-de-France ?",
                      answer:
                        "Oui. Paris et l'Île-de-France sont notre premier terrain d'intervention. Toutes les formations du catalogue (générales, par métier, par secteur) sont accessibles dans les arrondissements parisiens et la première couronne (La Défense, Issy, Boulogne, Levallois, Neuilly). Même tarif public qu'en région.",
                    },
                    {
                      id: "couverture-france",
                      question: "Intervenez-vous dans toute la France métropolitaine ?",
                      answer:
                        "Oui. 12 régions métropolitaines couvertes, plus de 2 100 communes éligibles. Nos formateurs IA experts sont mobiles : Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Rennes, Rouen, Dijon, Orléans, Ajaccio. Aucun surcoût géographique sur le tarif formation.",
                    },
                    {
                      id: "couverture-formation-vs-organisme",
                      question:
                        "En quoi vos formations diffèrent d'un organisme de formation classique ?",
                      answer:
                        "Un programme standardisé et transversal, mais jamais théorique : la méthode AXION est démontrée en direct, puis chacun l'applique à ses propres tâches récurrentes pendant les exercices. Vos collaborateurs apprennent à maîtriser ChatGPT, Claude et Gemini et à créer leurs assistants. Méthode de prompting installée durablement.",
                    },
                    {
                      id: "couverture-international",
                      question: "Intervenez-vous à l'international ou seulement en France ?",
                      answer:
                        "France métropolitaine systématiquement. À l'international, nous intervenons dans les sociétés francophones (Belgique, Suisse, Luxembourg, Québec, Maghreb francophone, etc.) sur des missions d'une semaine minimum — pour garantir un transfert d'autonomie complet à votre équipe. Devis sur mesure.",
                    },
                    {
                      id: "remboursement",
                      question: "Garantie de résultat ?",
                      answer:
                        "Si l'équipe n'a rien tiré de la formation (cas extrêmement rare), on rembourse intégralement. Concrètement, 100 % de nos clients ressortent en maîtrisant 3-5 automatisations applicables à leurs tâches dès le lendemain.",
                    },
                  ]
                : [
                    {
                      // Price derived from the catalogue SSOT, never hardcoded.
                      id: "prix-formation-ia",
                      question: "How much does corporate AI training cost?",
                      answer: `Our prices are public and set per group (2-15 participants) — never per person. General offers from ${formatAmount(getFormationCatalogPriceRange().minEur, "en")} (4 h); role-specific trainings from ${formatAmount(getFormationPrice("metier", "1j") ?? Number.NaN, "en")} per day; industry-specific trainings from ${formatAmount(getFormationPrice("secteur", "1j") ?? Number.NaN, "en")} per day. Full details on the pricing page.`,
                    },
                    {
                      id: "headcount",
                      question: "How many participants per session?",
                      answer:
                        "Up to 15 participants per group, same price — pricing is per group, not per person. To gather the whole company on the same day (up to 50 people), the AI seminar takes over.",
                    },
                    {
                      id: "which-training",
                      question: "Which training to choose?",
                      answer:
                        "If you don't know where to start: 'AI for getting started' is the natural entry point (4 h or a full day). Then pick by need: 'AI for teams' for a shared practice, 'AI for automation' for your first automations, or a training dedicated to your role (HR, marketing, sales…) or your industry (healthcare, construction, industry…).",
                    },
                    {
                      id: "splittable",
                      question: "Can the 2-day trainings be split?",
                      answer:
                        "Yes: all 2-day trainings (automation, operations, IT, industry) can be split into two 1-day sessions — for instance one or two weeks apart, leaving time to practice in between.",
                    },
                    {
                      id: "tools",
                      question: "Which AI tools are used in training?",
                      answer:
                        "The ones your team already uses or that fit your roles: ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity for text and research; Midjourney for visual creation; Sora and HeyGen for video and avatars. We can also train on building AI agents (conversational assistants, autonomous agents) and business automations. No imposed tech.",
                    },
                    {
                      id: "coverage-paris",
                      question: "Are your AI trainings available in Paris and Greater Paris?",
                      answer:
                        "Yes. Paris and Greater Paris are our top engagement ground. Every training in the catalogue (general, role-specific, industry-specific) is accessible in Paris arrondissements and inner suburbs (La Défense, Issy, Boulogne, Levallois, Neuilly). Same public pricing as regions.",
                    },
                    {
                      id: "coverage-france",
                      question: "Do you cover all metropolitan France?",
                      answer:
                        "Yes. 12 metropolitan regions covered, 2,100+ eligible communes. Our expert AI trainers are mobile: Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Rennes, Rouen, Dijon, Orléans, Ajaccio. No geographic surcharge on the training rate.",
                    },
                    {
                      id: "coverage-formation-vs-organisme",
                      question:
                        "How do your trainings differ from a classic training organization?",
                      answer:
                        "Each format includes a pedagogical dimension on your real documents and real business cases (vs theoretical scenarios of classic organizations). Your staff learn to master ChatGPT, Claude, Mistral, AI agents and automations by working directly on their recurring tasks. Prompting methodology installed durably.",
                    },
                    {
                      id: "coverage-international",
                      question: "Do you intervene internationally or only in France?",
                      answer:
                        "Metropolitan France systematically. Internationally, we intervene in French-speaking organisations (Belgium, Switzerland, Luxembourg, Quebec, French-speaking Maghreb, etc.) on missions of one week minimum — to make travel cost-effective and guarantee a complete autonomy transfer to your team. Custom quote including travel and accommodation costs.",
                    },
                    {
                      id: "guarantee",
                      question: "Guarantee?",
                      answer:
                        "If the team got nothing from the training (extremely rare), we refund in full. Concretely, 100 % of our customers come out mastering 3-5 automations applicable to their tasks the next day.",
                    },
                  ]
            }
          />
        </Container>
      </Section>

      {/* AVIS CLIENTS RÉELS — DB, hide-if-empty, stub-safe (jamais d'avis
          fabriqué). Même section que les autres pages service. */}
      <ServiceReviewsSection serviceLine="interventions_formations" />

      {/* CONNAISSANCES LIÉES — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="interventions-formations" />

      <CtaBlock
        eyebrow={isFr ? "Formation IA en entreprise" : "Corporate AI training"}
        title={isFr ? "Faites monter en compétence" : "Upskill"}
        titleEm={isFr ? "vos équipes à l'IA" : "your teams in AI"}
        description={
          isFr
            ? "Un formateur IA expert intervient sur votre site. Vos équipes appliquent la méthode à leurs tâches réelles et gagnent des heures dès la 1ʳᵉ intervention."
            : "An expert AI trainer comes on site. Your teams apply the method to their real tasks and save hours from the very first session."
        }
        cta={
          // Sprint cohérence CTA 2026-05-28 (Will) — aligné Header primary :
          // label « Réserver un appel », destination /appel, couleur primary bleu
          // + glow. Tracking conservé pour distinguer cet appel pré-vente du CTA
          // header générique en analytics.
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
            track="collectives-ctablock-consultation"
          >
            {isFr ? "Réserver un appel" : "Book a call"} →
          </Cta>
        }
        tone="dark"
      />

      {/* CTA mobile sticky (Sprint uniformisation 2026-05-24).
          Cohérence funnel 2026-06-03 (Will) — aligné sur /appel comme tout
          le reste de la page (héros, bandeaux, CtaBlock) ; l'ancien /reserver
          créait une divergence de funnel. */}
      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="interventions-collectives-sticky-mobile"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={collectionPageJsonLd} />
      <JsonLd data={itemListJsonLd} />
      {photosImageObjectJsonLd ? <JsonLd data={photosImageObjectJsonLd} /> : null}
      <JsonLd data={howToReserverJsonLd} />
      {courseJsonLdArray.map((course, idx) => (
        <JsonLd key={`course-${idx}`} data={course} />
      ))}
    </>
  );
}
