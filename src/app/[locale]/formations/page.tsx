// Hub /formations — catalogue formations IA intra-entreprise (17 formations,
// 4 paliers durée). Remplace l'ancien hub /interventions/collectives ; design
// strictement identique, alimenté par le catalogue V2 (catalog-v2). Mono-axe
// durée : la gamme (IA / Agents / Claude) reste un badge, pas un axe de nav.
import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronDown, Users, Sparkles } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getFormationsV2ByDuree } from "@/content/formations/catalog-v2";
import {
  FORMATION_DUREES_META,
  FORMATION_GAMMES_META,
  formationDureeIso,
} from "@/content/formations/catalog-v2-meta";
import { formatAmount, getFormationCatalogPriceRange } from "@/content/pricing";
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
  const fromPrice = formatAmount(getFormationCatalogPriceRange().minEur, loc);
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
        ? `Formation IA en entreprise sur site pour TPE, PME, ETI et grandes entreprises : 4 formats one-shot (4 h à 3 j+) ou formules récurrentes mensuelles/bi-mensuelles. Formateur IA dédié, montée en compétence continue, gains de temps instantanés. Dès ${fromPrice}.`
        : `Corporate AI training on site for SMEs and large companies: 4 one-shot formats (4 h to 3 d+) or monthly/bi-monthly recurring programmes. Dedicated AI trainer, continuous upskilling, instant time savings. From ${fromPrice}.`,
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

  const essentielleEntry = formatAmount(getFormationCatalogPriceRange().minEur, loc);

  // Libellés dérivés du SSOT catalogue (jamais figés dans la prose FAQ) : si un
  // format de durée ou une gamme est ajouté/renommé, la réponse « prix » suit
  // automatiquement (audit FAQ prix dynamique 2026-07-06).
  const dureeShortFirst = FORMATION_DUREES_META[0]?.shortFr ?? "4 h";
  const dureeShortLast = FORMATION_DUREES_META[FORMATION_DUREES_META.length - 1]?.shortFr ?? "3 j";
  const nbDureeFormats = FORMATION_DUREES_META.length;
  // « Gamme IA / Agents & Automatisations / Gamme Claude » → on retire le préfixe
  // « Gamme » pour une liste propre et réutilisable en FR comme en EN.
  const gammesList = FORMATION_GAMMES_META.map((g) => g.labelFr.replace(/^Gamme\s+/i, "")).join(
    ", ",
  );

  // Adaptateur durée — dérive du catalogue V2 (17 formations) la même forme que
  // l'ancien DurationDef collectives, pour garder le JSX du design strictement
  // identique. Mono-axe durée (décision Will 2026-06-11) : la gamme reste un
  // simple badge sur les cartes, pas d'axe de navigation séparé.
  const DURATIONS = FORMATION_DUREES_META.map((m) => ({
    id: m.id,
    slug: m.slug,
    labelFr: m.labelFr,
    labelEn: m.labelFr,
    shortFr: m.shortFr,
    shortEn: m.shortFr,
    durationDetailFr: m.heuresFr,
    durationDetailEn: m.heuresFr,
    // Les 4 paliers ont des formations catalogue réelles (4h:4 · 1j:6 · 2j:4 ·
    // 3j:3 = 17). Aucun palier « sur devis » : chaque carte est une carte
    // peuplée (le sur-mesure est proposé sur la page durée elle-même).
    isQuoteOnly: false,
    iso8601Duration: formationDureeIso(m.id),
    pathFr: `/formations/duree/${m.slug}`,
    pathEn: `/formations/duree/${m.slug}`,
  }));

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

  // Features par palier durée — Sprint 14.10.7 (Will 2026-05-11) : enrichir
  // les cards pour qu'elles soient parlantes (3 points de positionnement par
  // palier). Évite le rendu trop simpliste « badge + compteur ».
  const FEATURES_BY_DURATION: Record<
    (typeof DURATIONS)[number]["id"],
    { fr: ReadonlyArray<string>; en: ReadonlyArray<string> }
  > = {
    "4h": {
      fr: ["Demi-journée express", "Découverte ciblée", "Quick-wins immédiats"],
      en: ["Express half-day", "Targeted discovery", "Immediate quick-wins"],
    },
    "1j": {
      fr: ["Cadrage du matin", "Ateliers pratiques", "Plan d'action le soir"],
      en: ["Morning framing", "Hands-on workshops", "Action plan by evening"],
    },
    "2j": {
      fr: ["Approfondissement", "Cas réels de l'équipe", "Transfert IA-fluence"],
      en: ["Deep dive", "Real team cases", "AI-fluency transfer"],
    },
    "3j": {
      fr: ["Séminaires dirigeants", "Off-sites équipe", "Programmes multi-sites"],
      en: ["Executive seminars", "Team off-sites", "Multi-site programmes"],
    },
  };

  // Détail de chaque palier durée pour affichage en grid.
  const durationRows = DURATIONS.map((d) => {
    const count = d.isQuoteOnly ? 0 : getFormationsV2ByDuree(d.id).length;
    const href = d.pathFr;
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
      features: FEATURES_BY_DURATION[d.id],
    };
  });

  // Service JSON-LD — le `speakable` a été DÉPLACÉ sur le nœud CollectionPage
  // ci-dessous (2026-07-01) : `speakable` est une propriété de WebPage/CreativeWork,
  // PAS de `Service` (sous-type d'Intangible) → posé sur Service il était ignoré
  // par Google et les moteurs de réponse.
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/formations",
    name: isFr
      ? "Formations IA équipe · 4 durées · Axion-IA"
      : "Team AI trainings · 4 durations · Axion-IA",
    description: isFr
      ? `Formations IA opérationnelles pour vos équipes sur site, 4 paliers durée de 4 h à 3 j+, dès ${essentielleEntry}.`
      : `Operational AI trainings for your teams on site, 4 duration tiers from 4 h to 3 d+, from ${essentielleEntry}.`,
    serviceType: "AI training",
    priceEur: getFormationCatalogPriceRange().minEur,
    areasServed: buildServiceAreasServed(loc),
  });

  // CollectionPage JSON-LD — porteur VALIDE du `speakable` (h1/h2 + réponses) et
  // du `primaryImageOfPage` (quadriptyque représentatif). Le hub /formations est un
  // listing (4 paliers durée) → CollectionPage. `breadcrumb` relie au fil d'Ariane.
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/formations",
    name: isFr
      ? "Formations IA en entreprise — 4 durées, sur site"
      : "Corporate AI trainings — 4 durations, on site",
    description: isFr
      ? `Hub des formations IA opérationnelles Axion-IA pour vos équipes sur site : 4 paliers durée de 4 h à 3 j+, formule mensuelle récurrente, dès ${essentielleEntry}.`
      : `Hub of Axion-IA operational AI trainings for your teams on site: 4 duration tiers from 4 h to 3 d+, recurring monthly programme, from ${essentielleEntry}.`,
    speakable: true,
    ...(buildPrimaryImageOfPage("/formations")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/formations") } }
      : {}),
  });

  // Course JSON-LD ×4 — Sprint perfection AEO 2026-05-28 (Will). Un Course
  // par palier durée. Permet citation Google AI Overviews / Perplexity /
  // Claude pour requêtes « formation IA 4h », « formation IA 1 jour », etc.
  // Pattern réutilisé depuis `CollectiveDurationListing` (sous-pages) mais
  // émis aussi sur le hub avec `@id` unique pour indexation listing.
  const courseJsonLdArray = DURATIONS.filter((d) => !d.isQuoteOnly).map((d) =>
    buildCourseJsonLd({
      locale: loc,
      path: loc === "fr" ? d.pathFr : d.pathEn,
      name: isFr
        ? `Formation IA opérationnelle ${d.labelFr}`
        : `Operational AI training — ${d.labelEn}`,
      description: isFr
        ? `Formation IA opérationnelle sur ${d.labelFr.toLowerCase()} pour TPE, PME, ETI et grandes entreprises. Format Axion-IA sur site, ChatGPT, Claude, Mistral, agents IA et automatisations métier. De 2 à 30+ personnes.`
        : `Operational AI training over ${d.labelEn.toLowerCase()} for SMEs, mid-caps and large enterprises. Axion-IA on-site format, ChatGPT, Claude, Mistral, AI agents and business automations. From 2 to 30+ people.`,
      courseMode: ["Onsite"],
      ...(d.iso8601Duration ? { duration: d.iso8601Duration } : {}),
      audienceType: isFr
        ? "Décideurs, managers, équipes opérationnelles TPE PME ETI grandes entreprises (B2B)"
        : "Decision-makers, managers, operational teams SME mid-cap large enterprise (B2B)",
      about: "IA opérationnelle (ChatGPT, Claude, Mistral, Copilot, agents IA, automatisations)",
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

  // ItemList JSON-LD — 4 paliers durée. Factory centralisée seo.ts
  // (audit perfection 2026-05-12).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/formations",
    name: isFr ? "Paliers durée — Formations équipe" : "Duration tiers — Team trainings",
    items: durationRows.map((row, idx) => ({
      position: idx + 1,
      name: isFr ? row.duration.labelFr : row.duration.labelEn,
      url: `${SITE_URL}/${locale}${row.href}`,
      description: isFr ? row.duration.durationDetailFr : row.duration.durationDetailEn,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2 colonnes — Sprint Uniformisation héros 2026-05-24 (Will) */}
      <ServiceHero
        eyebrow={isFr ? "Module 1 · Formations équipe" : "Module 1 · Team trainings"}
        title={isFr ? "Formez vos équipes à l'IA" : "Train your teams in AI"}
        titleEm={isFr ? "pour un gain de temps immédiat" : "for immediate time savings"}
        description={
          isFr
            ? "Un formateur IA expert vient sur votre site. Vos équipes montent en compétence sur leurs vrais outils (ChatGPT, Claude, Mistral), apprennent à concevoir des agents IA et automatisations métier — et gagnent des heures dès la 1ʳᵉ session."
            : "An expert AI trainer comes on site. Your teams upskill on their real tools (ChatGPT, Claude, Mistral), learn to build AI agents and business automations — and save hours from the very first session."
        }
        ctas={
          // Sprint cohérence CTA 2026-05-28 (Will) — alignés Header (Primary
          // « Réserver un appel » + Secondary « Nous écrire »). Le scroll hint
          // « Découvrir les formations » est désormais un bouton séparé visible
          // centré sous le hero (Will : « plus visible et centré en bas du hero »).
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
          </>
        }
        customVisual={
          <HeroOrbital
            centerLabel={isFr ? "Votre équipe" : "Your team"}
            ariaLabel={
              isFr
                ? "Schéma : votre équipe au centre, entourée des 8 outils IA enseignés en formation (ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity, Midjourney, Sora, HeyGen)."
                : "Diagram: your team at the center, surrounded by 8 AI tools taught in training (ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity, Midjourney, Sora, HeyGen)."
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

      {/* 4 CARDS PALIER DURÉE */}
      <Section
        id="formats"
        eyebrow={isFr ? "Formation ponctuelle one-shot" : "One-shot training"}
        title={isFr ? "Choisissez la durée" : "Choose the duration"}
        titleEm={isFr ? "de votre formation" : "of your training"}
        description={
          isFr
            ? "Que vous découvriez l'IA ou que vous l'utilisiez quotidiennement, chaque journée d'intervention sera un bond en avant et un déclic évolutif. Pour un programme durable, voir la formation régulière mensuelle plus bas."
            : "Whether you're discovering AI or using it daily, each training day will be a leap forward and an evolutionary trigger. For a sustained programme, see the monthly recurring training below."
        }
        contentClassName={TIGHT_X}
      >
        {/* PHOTOS FORMATION — 5 photos illustratives en grid 3 cols desktop
            (3+2 = 2 lignes), 2 cols mobile (2+2+1 = 3 lignes). Optimisation
            top mai 2026 : Next.js Image auto AVIF/WebP au runtime, sizes
            responsive, loading lazy (sous fold), aspect ratio fixe → CLS=0.
            Pas de zoom/lightbox (Will : « sans possibilité de grossir »).
            JSON-LD ImageObject array émis plus bas pour Google Images + AEO. */}
        {/* Sprint 14.10.7 (Will 2026-05-11) — cards portrait, plus hautes
            que larges sur desktop. Badge palier XXL agrandi, padding y
            étendu, min-h pour forcer une silhouette rectangle vertical
            cohérente entre les 4 cards même quand le contenu varie.
            Grid mobile-first : 1 col → 4 sur 1 ligne dès sm (640px).
            Will (2026-05-11) : forcer 4 cards sur 1 ligne même sur écrans
            moyens où la sidebar VSCode/DevTools réduit la zone utile. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:gap-3 md:gap-4 lg:gap-6">
          {durationRows.map(({ duration: d, href, count, metaFr, metaEn, features }) => {
            const isQuote = d.isQuoteOnly === true;
            const isEmpty = !isQuote && count === 0;
            const featureLabels = isFr ? features.fr : features.en;
            const ctaLabelFr = isQuote
              ? "Demander un devis"
              : isEmpty
                ? "Nous contacter"
                : "Voir les formations";
            const ctaLabelEn = isQuote
              ? "Request a quote"
              : isEmpty
                ? "Contact us"
                : "See trainings";
            return (
              <article
                key={d.id}
                className={cn(
                  "group/duration shadow-subtle relative flex h-full flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 sm:min-h-[460px] md:min-h-[520px] lg:min-h-[560px]",
                  isQuote
                    ? "bg-sand border-terracotta-deep/40 hover:border-terracotta-deep hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(180,80,40,0.30)]"
                    : "bg-paper border-terracotta/30 hover:border-terracotta hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(205,107,72,0.30)]",
                )}
              >
                <Link
                  href={href as never}
                  aria-label={`${isFr ? d.labelFr : d.labelEn} — ${isFr ? ctaLabelFr : ctaLabelEn}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{isFr ? ctaLabelFr : ctaLabelEn}</span>
                </Link>

                {/* Filet couleur en haut */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-2 w-full",
                    isQuote ? "bg-terracotta-deep" : "bg-terracotta",
                  )}
                />

                {/* Badge palier XXL — accroche visuelle dominante.
                    Padding réduit sur sm (4 cards serrées) pour économiser
                    la verticale, étendu sur md+ pour silhouette portrait. */}
                <div
                  className={cn(
                    "relative flex items-center justify-center py-8 sm:py-9 md:py-14",
                    isQuote ? "bg-terracotta-soft/65" : "bg-terracotta-soft/45",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "font-display text-[clamp(3.75rem,8vw,6rem)] leading-none font-bold tracking-tight tabular-nums transition-transform duration-200 group-hover/duration:scale-110",
                      isQuote ? "text-terracotta-deep" : "text-terracotta-deep",
                    )}
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {d.shortFr}
                  </span>
                </div>

                {/* Contenu textuel — enrichi de 3 features pour donner de
                    la consistance au-delà du simple badge + compteur. */}
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <h2 className="text-fg text-lg leading-tight font-semibold sm:text-xl">
                    {isFr ? d.labelFr : d.labelEn}
                  </h2>
                  <p className="text-fg-soft mt-2 text-[13.5px] leading-relaxed">
                    {isFr ? d.durationDetailFr : d.durationDetailEn}
                  </p>

                  {/* 3 features visuelles — point coloré + texte court.
                      Donnent une idée concrète de « ce qu'on y fait ». */}
                  <ul className="mt-5 space-y-2">
                    {featureLabels.map((feat, i) => (
                      <li
                        key={i}
                        className="text-fg flex items-start gap-2.5 text-[13px] leading-snug"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                            isQuote ? "bg-terracotta-deep" : "bg-terracotta",
                          )}
                        />
                        <span className="font-medium">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Métadonnée compteur — pill séparée, ressort comme indicateur de stock */}
                  <div
                    className={cn(
                      "mt-5 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold",
                      isQuote
                        ? "bg-terracotta-soft text-terracotta-deep"
                        : isEmpty
                          ? "bg-paper border-border text-fg-muted border"
                          : "bg-terracotta-soft text-terracotta-deep",
                    )}
                  >
                    {isQuote ? (
                      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <Users aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    <span>{isFr ? metaFr : metaEn}</span>
                  </div>

                  {/* Bouton CTA plein large — fait clairement "BLOC CLIQUABLE" */}
                  <div className="relative z-[2] mt-auto pt-6">
                    <Link
                      href={href as never}
                      className={cn(
                        "inline-flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-semibold transition-colors",
                        isQuote
                          ? "bg-terracotta-deep text-mocha-fg hover:bg-terracotta-deep/85"
                          : "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
                      )}
                    >
                      <span>{isFr ? ctaLabelFr : ctaLabelEn}</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform duration-200 group-hover/duration:translate-x-1"
                      />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

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

          {/* Bandeau bénéfices SEO sémantique — densifie le contenu avec
              les mots-clés cibles sans tomber dans le keyword stuffing :
              chaque ligne est une affirmation utile au lecteur. */}
          <div className="bg-paper border-border shadow-subtle mx-auto mt-10 max-w-5xl rounded-3xl border p-6 sm:p-8">
            <h3 className="text-fg text-lg leading-tight font-semibold tracking-tight sm:text-xl">
              {isFr
                ? "Pourquoi une formation IA récurrente en entreprise ?"
                : "Why recurring corporate AI training?"}
            </h3>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
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
                      t: "Automatisations métier",
                      d: "ChatGPT, Claude, Microsoft Copilot, Gemini, agents IA et automatisations métier sur mesure — on travaille uniquement sur vos vrais outils, vos vrais documents, vos vrais workflows.",
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
              ).map((row, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <span className="text-fg text-[14.5px] leading-tight font-semibold">{row.t}</span>
                  <span className="text-fg-soft text-[13.5px] leading-relaxed">{row.d}</span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </Section>

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
                      // Prix dérivé du SSOT catalogue (getFormationCatalogPriceRange),
                      // JAMAIS hardcodé — même valeur que le « Dès … » du hero pour
                      // rester cohérent sur la page (audit FAQ prix 2026-07-06).
                      id: "prix-formation-ia",
                      question: "Combien coûte une formation IA en entreprise ?",
                      answer: `Une formation IA en entreprise sur site démarre à ${essentielleEntry} HT. Le tarif dépend ensuite de la durée (de ${dureeShortFirst} à ${dureeShortLast}), de la gamme (${gammesList}) et du nombre de participants — la grille complète figure plus haut sur cette page. Le devis précis se cale sur votre contexte après un premier échange.`,
                    },
                    {
                      id: "effectif",
                      question: "Combien de participants par session ?",
                      answer:
                        "Selon le palier : le format 1 jour accueille 2-30 personnes en 3 tranches tarifaires (2-8, 9-15, 16-30). Le format 2 jours idem. Format 4 h : 2-20 personnes prix fixe. Au-delà de 30 personnes, on bascule sur conférence (sur devis).",
                    },
                    {
                      id: "duree",
                      question: "Quelle durée choisir ?",
                      answer:
                        "4 h pour découvrir l'IA ou cadrer 1 cas d'usage. 1 jour pour une découverte opérationnelle. 1 jour productivité pour des automatisations métier ciblées. 2 jours pour aller en profondeur. 3 jours+ pour multi-sites ou contenus ultra-spécifiques.",
                    },
                    {
                      id: "outils",
                      question: "Quels outils IA utilisés en formation ?",
                      answer:
                        "Ceux que votre équipe utilise déjà ou qui correspondent à vos métiers : ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity pour le texte et la recherche ; Midjourney pour la création visuelle ; Sora et HeyGen pour la vidéo et les avatars. On peut aussi former à la conception d'agents IA (assistants conversationnels, agents autonomes) et aux automatisations métier. Pas de techno imposée.",
                    },
                    {
                      id: "couverture-paris",
                      question:
                        "Vos formations IA sont-elles disponibles à Paris et en Île-de-France ?",
                      answer:
                        "Oui. Paris et l'Île-de-France sont notre premier terrain d'intervention. Les 4 formats durée (4 h, 1 jour, 2 jours, 3 jours+) sont accessibles dans les arrondissements parisiens et la première couronne (La Défense, Issy, Boulogne, Levallois, Neuilly). Même tarif public qu'en région.",
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
                        "Chaque format intègre une dimension pédagogique sur vos vrais documents et vos vrais cas métier (vs scénarios théoriques d'organisme classique). Vos collaborateurs apprennent à maîtriser ChatGPT, Claude, Mistral, les agents IA et les automatisations en travaillant directement sur leurs tâches récurrentes. Méthode de prompting installée durablement.",
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
                      // Price derived from the catalogue SSOT, never hardcoded —
                      // same value as the hero "From …" (2026-07-06 price-FAQ audit).
                      id: "prix-formation-ia",
                      question: "How much does corporate AI training cost?",
                      answer: `On-site corporate AI training starts at ${essentielleEntry} ex. VAT. The rate then depends on the format (${nbDureeFormats} durations from ${dureeShortFirst} to ${dureeShortLast}), the track (${gammesList}) and the number of participants — the full grid is above on this page. The precise quote is tailored to your context after a first call.`,
                    },
                    {
                      id: "headcount",
                      question: "How many participants per session?",
                      answer:
                        "Depending on the tier: the one-day format hosts 2-30 people in 3 price brackets (2-8, 9-15, 16-30). The two-day format same. 4 h format: 2-20 people flat price. Beyond 30, we switch to conference (on quote).",
                    },
                    {
                      id: "duration",
                      question: "Which duration to choose?",
                      answer:
                        "4 h to discover AI or frame 1 use case. 1 day for operational discovery. 1 day productivity for targeted business automations. 2 days for depth. 3+ days for multi-site or ultra-specific content.",
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
                        "Yes. Paris and Greater Paris are our top engagement ground. The 4 duration formats (4 h, 1 day, 2 days, 3 days+) are accessible in Paris arrondissements and inner suburbs (La Défense, Issy, Boulogne, Levallois, Neuilly). Same public pricing as regions.",
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

      {/* CONNAISSANCES LIÉES — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="interventions-formations" />

      <CtaBlock
        eyebrow={isFr ? "Formation IA en entreprise" : "Corporate AI training"}
        title={isFr ? "Faites monter en compétence" : "Upskill"}
        titleEm={isFr ? "vos équipes à l'IA" : "your teams in AI"}
        description={
          isFr
            ? "Un formateur IA expert intervient sur votre site. Vos équipes apprennent sur leurs vrais outils métier et gagnent des heures dès la 1ʳᵉ intervention."
            : "An expert AI trainer comes on site. Your teams learn on their real business tools and save hours from the very first session."
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
