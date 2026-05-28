// Sprint 14.10.7 — hub famille « Formations équipe » avec 4 paliers durée.
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
import { buildProductMetadata, buildServiceJsonLd, buildItemListJsonLd, SITE_URL } from "@/lib/seo";
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
        ? "Formation IA entreprise · TPE PME ETI · formateur IA sur site · Axion-IA"
        : "Corporate AI training · SME ETI · on-site AI trainer · Axion-IA",
    description:
      loc === "fr"
        ? `Formation IA en entreprise sur site pour TPE, PME, ETI et grandes entreprises : 4 formats one-shot (4 h à 3 j+) ou formules récurrentes mensuelles/bi-mensuelles. Formateur IA dédié, montée en compétence continue, gains de temps instantanés. Dès ${essentiellePrice}.`
        : `Corporate AI training on site for SMEs and large companies: 4 one-shot formats (4 h to 3 d+) or monthly/bi-monthly recurring programmes. Dedicated AI trainer, continuous upskilling, instant time savings. From ${essentiellePrice}.`,
  });
}

export default async function CollectivesFamilyHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const family = getFamily("collectives");

  // P1-13 audit E2E NAV+CTA 2026-05-15 — label parent aligné sur SSOT
  // `nav.interventions` (« Interventions entreprise » / « Corporate AI sessions »).
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
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

  // Sprint photos formation 2026-05-28 (Will) — 4 photos illustratives de
  // sessions de formation IA en entreprise, insérées entre la section
  // « Choisissez la durée » et les 4 cards palier durée. Optimisation top
  // mai 2026 : Next.js Image auto AVIF/WebP au runtime (×5-10 gain poids vs
  // PNG source), lazy loading (sous le fold du hero), aspect ratio fixe
  // (CLS=0), sizes responsive, alt textes denses SEO, JSON-LD ImageObject
  // array émis pour visibilité Google Images + AI Overviews.
  const PHOTOS_FORMATION = [
    {
      src: "/illustrations/formations/formation-equipe-02.png",
      altFr:
        "Formateur IA expert Axion-IA présentant Claude à des collaborateurs PME française — atelier pratique sur les vrais outils métier en formation IA opérationnelle.",
      altEn:
        "Expert Axion-IA AI trainer presenting Claude to French SME team members — hands-on workshop on real business tools in operational AI training.",
      nameFr: "Formateur IA présentant Claude en atelier PME",
      nameEn: "AI trainer presenting Claude in SME workshop",
    },
    {
      src: "/illustrations/formations/formation-equipe-03.png",
      altFr:
        "Équipe PME engagée en formation IA — apprenants en atelier pratique automatisations métier sur leurs vrais outils, montée en compétence opérationnelle Axion-IA.",
      altEn:
        "Engaged SME team in AI training — learners in hands-on business automation workshop on their real tools, operational upskilling by Axion-IA.",
      nameFr: "Équipe PME engagée en atelier formation IA",
      nameEn: "Engaged SME team in AI training workshop",
    },
    {
      src: "/illustrations/formations/formation-equipe-04.png",
      altFr:
        "Salle de formation IA sur site entreprise — Axion-IA forme les équipes TPE, PME, ETI sur ChatGPT, Claude, Mistral et les outils IA quotidien pour gagner du temps.",
      altEn:
        "On-site corporate AI training room — Axion-IA trains SME, mid-cap and large enterprise teams on ChatGPT, Claude, Mistral and daily AI tools for time savings.",
      nameFr: "Formation IA sur site entreprise",
      nameEn: "On-site corporate AI training",
    },
    {
      src: "/illustrations/formations/formation-equipe-05.png",
      altFr:
        "Bilan de formation IA — équipe entreprise française autonome sur ChatGPT, Claude, Mistral et automatisations métier, gains de temps mesurés après l'intervention Axion-IA.",
      altEn:
        "AI training review — autonomous French corporate team on ChatGPT, Claude, Mistral and business automations, measured time savings after Axion-IA intervention.",
      nameFr: "Bilan formation IA équipe autonome",
      nameEn: "AI training review with autonomous team",
    },
  ];

  // JSON-LD ImageObject @graph — exposition AEO/Google Images. Chaque photo
  // est déclarée comme ImageObject avec creator, license CC BY 4.0,
  // copyrightHolder, datePublished. Permet l'indexation par Google Images,
  // Bing, Pinterest, et la citation dans les AI Overviews / Perplexity /
  // Claude Vision (alignement doctrine image-bank Axion-IA).
  // Inclut les 5 photos formation (carré 1024×768) + le bandeau quadriptyque
  // (2400×800 panoramique placé après la section « Comment réserver »).
  const photosImageObjectJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      ...PHOTOS_FORMATION.map((p) => ({
        "@type": "ImageObject",
        "@id": `${SITE_URL}${p.src}#image`,
        contentUrl: `${SITE_URL}${p.src}`,
        url: `${SITE_URL}${p.src}`,
        name: isFr ? p.nameFr : p.nameEn,
        description: isFr ? p.altFr : p.altEn,
        width: 1024,
        height: 768,
        encodingFormat: "image/png",
        representativeOfPage: false,
        license: "https://creativecommons.org/licenses/by/4.0/",
        acquireLicensePage: `${SITE_URL}/${locale}/cgu`,
        creator: { "@type": "Organization", "@id": `${SITE_URL}#org`, name: "Axion-IA" },
        copyrightHolder: { "@type": "Organization", "@id": `${SITE_URL}#org`, name: "Axion-IA" },
        copyrightNotice: "© Axion-IA 2026 — CC BY 4.0",
        datePublished: "2026-05-28",
        inLanguage: locale,
      })),
      {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/illustrations/formation-claude-team-quadriptyque.png#image`,
        contentUrl: `${SITE_URL}/illustrations/formation-claude-team-quadriptyque.png`,
        url: `${SITE_URL}/illustrations/formation-claude-team-quadriptyque.png`,
        name: isFr
          ? "Séquence formation IA Axion-IA quadriptyque — 4 moments d'intervention"
          : "Axion-IA AI training sequence quadriptych — 4 intervention moments",
        description: isFr
          ? "Bandeau quadriptyque illustrant 4 moments clés d'une formation IA Axion-IA en entreprise : présentation au tableau, démo écran Claude, équipe collaborative en atelier pratique, salle de formation sur site avec formateur IA expert."
          : "Quadriptych banner illustrating 4 key moments of an Axion-IA corporate AI training: tableau presentation, Claude screen demo, collaborative team in hands-on workshop, on-site training room with expert AI trainer.",
        width: 2400,
        height: 800,
        encodingFormat: "image/png",
        representativeOfPage: false,
        license: "https://creativecommons.org/licenses/by/4.0/",
        acquireLicensePage: `${SITE_URL}/${locale}/cgu`,
        creator: { "@type": "Organization", "@id": `${SITE_URL}#org`, name: "Axion-IA" },
        copyrightHolder: { "@type": "Organization", "@id": `${SITE_URL}#org`, name: "Axion-IA" },
        copyrightNotice: "© Axion-IA 2026 — CC BY 4.0",
        datePublished: "2026-05-28",
        inLanguage: locale,
      },
    ],
  };

  // Features par palier durée — Sprint 14.10.7 (Will 2026-05-11) : enrichir
  // les cards pour qu'elles soient parlantes (3 points de positionnement par
  // palier). Évite le rendu trop simpliste « badge + compteur ».
  const FEATURES_BY_DURATION: Record<
    (typeof COLLECTIVE_DURATIONS)[number]["id"],
    { fr: ReadonlyArray<string>; en: ReadonlyArray<string> }
  > = {
    "4h": {
      fr: ["Demi-journée express", "Découverte ciblée", "Quick-wins immédiats"],
      en: ["Express half-day", "Targeted discovery", "Immediate quick-wins"],
    },
    "1-jour": {
      fr: ["Cadrage du matin", "Ateliers pratiques", "Plan d'action le soir"],
      en: ["Morning framing", "Hands-on workshops", "Action plan by evening"],
    },
    "2-jours": {
      fr: ["Approfondissement", "Cas réels de l'équipe", "Transfert IA-fluence"],
      en: ["Deep dive", "Real team cases", "AI-fluency transfer"],
    },
    "3-jours-plus": {
      fr: ["Séminaires dirigeants", "Off-sites équipe", "Programmes multi-sites"],
      en: ["Executive seminars", "Team off-sites", "Multi-site programmes"],
    },
  };

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
      features: FEATURES_BY_DURATION[d.id],
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

  // ItemList JSON-LD — 4 paliers durée. Factory centralisée seo.ts
  // (audit perfection 2026-05-12).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: loc === "fr" ? "/interventions/collectives" : "/interventions/team-trainings",
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
            ? "Un formateur IA expert vient sur votre site. Vos équipes montent en compétence sur leurs vrais outils et leurs vrais cas métier — et gagnent des heures dès la 1ʳᵉ session."
            : "An expert AI trainer comes on site. Your teams upskill on their real tools and real business cases — and save hours from the very first session."
        }
        ctas={
          // Sprint cohérence CTA 2026-05-28 (Will) — alignés Header (Primary
          // « Réserver un appel » + Secondary « Nous écrire »). Suivi d'un lien
          // anchor « Découvrir les formations » avec chevron-down qui scroll
          // vers la section #formats (cards palier durée juste en dessous).
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
            {/* Scroll hint vers la section paliers durée — visual cue subtil. */}
            <a
              href="#formats"
              data-cta="collectives-hero-scroll-formats"
              className="text-fg-muted hover:text-terracotta inline-flex basis-full items-center gap-1.5 text-[13px] font-medium tracking-tight transition-colors sm:basis-auto"
            >
              {isFr ? "Découvrir les formations" : "Discover the trainings"}
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </a>
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

      {/* 4 CARDS PALIER DURÉE */}
      <Section
        id="formats"
        eyebrow={isFr ? "Quel format pour votre équipe ?" : "Which format for your team?"}
        title={isFr ? "Choisissez la durée" : "Choose the duration"}
        titleEm={isFr ? "selon vos besoins" : "that fits your needs"}
        description={
          isFr
            ? "Que vous découvriez l'IA ou que vous l'utilisiez quotidiennement, chaque journée d'intervention sera un bond en avant et un déclic évolutif."
            : "Whether you're discovering AI or using it daily, each training day will be a leap forward and an evolutionary trigger."
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
            Aspect-[4/3] paysage moderne (vs carré « grossier »).
            Pas de zoom/lightbox (Will : « sans possibilité de grossir »). */}
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-4">
          {PHOTOS_FORMATION.map((p) => (
            <figure key={p.src} className="m-0 overflow-hidden rounded-2xl">
              <Image
                src={p.src}
                alt={isFr ? p.altFr : p.altEn}
                width={1024}
                height={768}
                loading="lazy"
                decoding="async"
                sizes="(max-width: 768px) 50vw, 280px"
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
                      d: "ChatGPT, Claude, Microsoft Copilot, Gemini, Make, Zapier, agents IA — on travaille uniquement sur vos vrais outils, vos vrais documents, vos vrais workflows.",
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
                      d: "ChatGPT, Claude, Microsoft Copilot, Gemini, Make, Zapier, AI agents — we work only on your real tools, real documents, real workflows.",
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
                      id: "effectif",
                      question: "Combien de participants par session ?",
                      answer:
                        "Selon le palier : Essentielle (1 jour) accueille 2-30 personnes en 3 tranches tarifaires (2-8, 9-15, 16-30). Approfondie (2 jours) idem. Format 4 h : 2-20 personnes prix fixe. Au-delà de 30 personnes, on bascule sur Conférence (sur devis).",
                    },
                    {
                      id: "duree",
                      question: "Quelle durée choisir ?",
                      answer:
                        "4 h pour découvrir l'IA ou cadrer 1 cas d'usage. 1 jour Essentielle pour le format de découverte opérationnelle. 1 jour Gagner du temps pour des automatisations métier ciblées. 2 jours Approfondie pour aller en profondeur. 3 jours+ pour multi-sites ou contenus ultra-spécifiques.",
                    },
                    {
                      id: "frais-deplacement",
                      question: "Frais de déplacement inclus ?",
                      answer:
                        "Non. Logement, repas et forfait trajet sont facturés en sus, calculés au cas par cas selon distance/durée. Devis transparent fourni avant signature.",
                    },
                    {
                      id: "outils",
                      question: "Quels outils IA utilisés ?",
                      answer:
                        "Ceux que votre équipe utilise déjà ou qui correspondent aux métiers : ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity pour le texte et la recherche ; Midjourney pour le visuel ; Sora et HeyGen pour la vidéo et les avatars. Pas de techno imposée.",
                    },
                    {
                      id: "couverture-france",
                      question: "Intervenez-vous dans toute la France ?",
                      answer:
                        "Oui. Nos formateurs IA experts se déplacent dans toute la France métropolitaine, des grandes métropoles (Paris, Lyon, Marseille, Bordeaux, Lille, Nantes, Toulouse) jusqu'aux villes moyennes. Frais de déplacement chiffrés au cas par cas dans le devis.",
                    },
                    {
                      id: "couverture-international",
                      question: "Et à l'international ?",
                      answer:
                        "Oui, sur demande. Nos formateurs peuvent intervenir dans les pays francophones (Belgique, Suisse, Luxembourg, Québec…) ou anglophones. Cadrage par appel pour valider la faisabilité et les modalités.",
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
                      id: "headcount",
                      question: "How many participants per session?",
                      answer:
                        "Depending on the tier: Essential (1 day) hosts 2-30 people in 3 price brackets (2-8, 9-15, 16-30). Deep dive (2 days) same. 4 h format: 2-20 people flat price. Beyond 30, we switch to Conference (on quote).",
                    },
                    {
                      id: "duration",
                      question: "Which duration to choose?",
                      answer:
                        "4 h to discover AI or frame 1 use case. 1 day Essential for operational discovery. 1 day Save Time for targeted business automations. 2 days Deep dive for depth. 3+ days for multi-site or ultra-specific content.",
                    },
                    {
                      id: "travel-fees",
                      question: "Travel expenses included?",
                      answer:
                        "No. Lodging, meals and travel allowance billed separately, calculated case by case based on distance/duration. Transparent quote provided before signature.",
                    },
                    {
                      id: "tools",
                      question: "Which AI tools are used?",
                      answer:
                        "The ones your team already uses or that fit the roles: ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity for text and research; Midjourney for visual; Sora and HeyGen for video and avatars. No imposed tech.",
                    },
                    {
                      id: "coverage-france",
                      question: "Do you cover all of France?",
                      answer:
                        "Yes. Our expert AI trainers travel throughout metropolitan France, from major cities (Paris, Lyon, Marseille, Bordeaux, Lille, Nantes, Toulouse) to mid-size towns. Travel costs quoted case by case.",
                    },
                    {
                      id: "coverage-international",
                      question: "And internationally?",
                      answer:
                        "Yes, on request. Our trainers can travel to French-speaking countries (Belgium, Switzerland, Luxembourg, Quebec…) or English-speaking ones. Scoping call to validate feasibility and terms.",
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

      {/* CTA mobile sticky (Sprint uniformisation 2026-05-24) */}
      <StickyMobileCta
        href="/reserver"
        label={isFr ? "Pré-réserver une formation" : "Pre-book a training"}
        track="interventions-collectives-sticky-mobile"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={photosImageObjectJsonLd} />
    </>
  );
}
