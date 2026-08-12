// Hub canonique 4e verticale `un-a-un` — coaching IA individuel 1-to-1.
//
// Refonte 2026-05-30 (Will) : la page reprend le template de
// `/interventions/collectives` (ServiceHero orbital + cards + section
// récurrente + section coach + bandeau terracotta + process + FAQ), mais
// adapté au format strictement 1-to-1, articulé autour de DEUX formules :
//
//   1. Coaching DIRIGEANT       → focus 100 % sur le dirigeant lui-même
//                                 (son temps, son argent, son quotidien)
//   2. Coaching COLLABORATEUR   → n'importe quel poste (secrétaire,
//                                 comptabilité, achats…) : on dresse un plan
//                                 concret pour alléger ses tâches répétitives
//
// CTAs alignés sur /interventions/collectives : primary « Réserver un appel »
// (/appel) + outline « Nous écrire » (/contact).

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronDown, Briefcase, UserRound, Sparkles } from "lucide-react";
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
import {
  INTERVENTION_TIERS,
  UN_A_UN_RECURRING_TIER,
  formatAmount,
  getTierById,
} from "@/content/pricing";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildHowToJsonLd,
  buildCollectionPageJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";
import { coachingFormulePath, COACHING_1TO1_ISO_DURATION } from "@/content/coaching-1to1";
import { SERVICE_BY_ID, serviceOfficial } from "@/content/services";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { VisibiliteCallout } from "@/components/visibilite/VisibiliteCallout";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { ServiceJourneyBand } from "@/components/services/ServiceJourneyBand";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

const TIGHT_X = "lg:px-6 xl:px-10";

const DIRIGEANT_PRICE = getTierById(INTERVENTION_TIERS, "intervention-dirigeants").priceFlat!;
const MEMBRE_PRICE = getTierById(INTERVENTION_TIERS, "intervention-membre-equipe").priceFlat!;
const RECURRING_PRICE = UN_A_UN_RECURRING_TIER.priceFlat!;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const entry = formatAmount(Math.min(DIRIGEANT_PRICE, MEMBRE_PRICE, RECURRING_PRICE), loc);
  return buildProductMetadata({
    locale,
    path: loc === "fr" ? "/un-a-un" : "/one-to-one",
    title:
      loc === "fr"
        ? "Coaching IA individuel 1-to-1 · dirigeant ou collaborateur"
        : "1-to-1 individual AI coaching · executive or team member",
    description:
      loc === "fr"
        ? "Coaching IA 1-to-1 — une journée 100% centrée sur vous : gain de temps, baisse de pression et hausse de productivité. Rapport personnalisé sous 7 jours."
        : `A one-on-one day with an AI expert: executive or team-member coaching. Quantified report within 7 days. Anywhere in France. From ${entry}.`,
    alternates: { fr: "/un-a-un", en: "/one-to-one" },
  });
}

export default async function UnAUnHubPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const path = isFr ? "/un-a-un" : "/one-to-one";

  const dirigeantPrice = formatAmount(DIRIGEANT_PRICE, loc);
  const membrePrice = formatAmount(MEMBRE_PRICE, loc);
  const recurringPrice = formatAmount(RECURRING_PRICE, loc);
  const entryPrice = formatAmount(Math.min(DIRIGEANT_PRICE, MEMBRE_PRICE, RECURRING_PRICE), loc);

  const breadcrumbItems = [{ href: path, label: serviceOfficial(SERVICE_BY_ID.unAUn, isFr) }];

  // ==========================================================================
  // Les 2 formules 1-to-1 — équivalent des « paliers durée » de collectives.
  // ==========================================================================
  const COACHING_TYPES = [
    {
      id: "dirigeant",
      accent: "mocha" as const,
      // path vers le hub famille Dirigeants (SSOT taxonomie, cf. coaching-1to1).
      hrefFr: coachingFormulePath("dirigeant", "fr"),
      hrefEn: coachingFormulePath("dirigeant", "en"),
      iso8601Duration: COACHING_1TO1_ISO_DURATION,
      labelFr: "Coaching dirigeant",
      labelEn: "Executive coaching",
      durationFr: "1 journée en tête-à-tête (7 à 8 h)",
      durationEn: "1 one-on-one day (7 to 8 h)",
      // Le visiteur dirigeant doit comprendre tout de suite : il ne sait
      // peut-être pas comment implémenter l'IA, ni tout ce qu'il peut en
      // tirer. Le but est SUR LUI — son temps, son argent, son quotidien.
      taglineFr:
        "Tout est centré sur VOUS, dirigeant — votre temps, vos décisions, votre charge. Vous ne mesurez peut-être pas tout ce que l'IA peut faire pour vous : on part de votre vraie journée et on en retire le superflu et le chronophage.",
      taglineEn:
        "Everything centres on YOU, the executive — your time, your decisions, your load. You may not realise everything AI can do for you: we start from your real day and strip out the busywork and the time-sinks.",
      featuresFr: [
        "Tout part de vous, pas de l'entreprise",
        "Mails, arbitrages, réunions, veille, comptes-rendus",
        "Du temps gagné — et de l'argent",
        "Sortir la tête de l'eau, déléguer à l'IA",
      ],
      featuresEn: [
        "It all starts with you, not the company",
        "Inbox, trade-offs, meetings, monitoring, minutes",
        "Time saved — and money too",
        "Get your head above water, delegate to AI",
      ],
      priceFr: `Dès ${dirigeantPrice}`,
      priceEn: `From ${dirigeantPrice}`,
      ctaFr: "Découvrir le coaching dirigeant",
      ctaEn: "Discover executive coaching",
    },
    {
      id: "membre-equipe",
      accent: "terracotta" as const,
      // path vers le hub famille Coaching individuel (SSOT taxonomie).
      hrefFr: coachingFormulePath("membre-equipe", "fr"),
      hrefEn: coachingFormulePath("membre-equipe", "en"),
      iso8601Duration: COACHING_1TO1_ISO_DURATION,
      labelFr: "Coaching collaborateur",
      labelEn: "Team-member coaching",
      durationFr: "1 journée de travail à deux (7 à 8 h)",
      durationEn: "1 working day for two (7 to 8 h)",
      // Secrétaire, comptabilité, responsable achat ou tout autre poste : une
      // journée de travail pour analyser tout ce qu'on peut alléger. Ce n'est
      // PAS de l'implémentation, mais un plan concret de ce qui peut être mis
      // en place — par la personne seule ou par nous ensuite.
      taglineFr:
        "Pour n'importe quel poste — secrétaire, comptable, RH, DAF, commercial, chef d'atelier, responsable achats, assistant·e de direction… On décortique sa journée de travail et on s'attaque à ce qui revient sans cesse : ces tâches répétitives qui grignotent ses heures.",
      taglineEn:
        "For any role — admin, accounting, purchasing, HR… We break down their working day and tackle what keeps coming back: the repetitive tasks eating their hours.",
      featuresFr: [
        "Pensé pour le poste : secrétaire, comptable, RH, DAF, chef d'atelier…",
        "On vise les tâches répétitives, une à une",
        "Des gains de temps repérés sur ses vraies tâches",
        "Plus d'autonomie, moins de friction",
      ],
      featuresEn: [
        "Built around the role: admin, accounting, purchasing, HR…",
        "We target repetitive tasks, one by one",
        "Time savings spotted on their real tasks",
        "More autonomy, less friction",
      ],
      priceFr: `Dès ${membrePrice}`,
      priceEn: `From ${membrePrice}`,
      ctaFr: "Découvrir le coaching collaborateur",
      ctaEn: "Discover team-member coaching",
    },
  ];

  // ==========================================================================
  // JSON-LD
  // ==========================================================================
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path,
    name: isFr ? "Coaching IA individuel 1-to-1" : "1-to-1 individual AI coaching",
    description: isFr
      ? `Accompagnement IA en tête-à-tête : 1 personne, 1 expert Axion-IA, 1 journée préparée en amont sur votre métier. Deux formules — dirigeant ou collaborateur. Sous 7 jours, votre livrable personnalisé : note de cadrage stratégique, ou cahier de prompts et plan d'action. Partout en France métropolitaine. Dès ${entryPrice}.`
      : `One-on-one AI coaching: 1 person, 1 Axion-IA expert, 1 day prepared in advance for your role. Two formats — executive or team member. Within 7 days, your personalised deliverable: strategic framing note, or prompt playbook and action plan. Across metropolitan France. From ${entryPrice}.`,
    serviceType: isFr ? "Coaching IA individuel" : "Individual AI coaching",
    priceEur: Math.min(DIRIGEANT_PRICE, MEMBRE_PRICE),
    areasServed: buildServiceAreasServed(loc),
  });

  // CollectionPage — porteur VALIDE du `speakable` (déplacé hors du Service où il
  // était inerte) + `primaryImageOfPage`. /un-a-un est un hub 2 formules → CollectionPage.
  const coachingPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path,
    name: isFr ? "Coaching IA individuel 1-to-1" : "1-to-1 individual AI coaching",
    description: isFr
      ? "Hub du coaching IA individuel Axion-IA : deux formules (dirigeant ou collaborateur clé), 1 journée en tête-à-tête, livrable personnalisé sous 7 jours, partout en France métropolitaine."
      : "Hub of Axion-IA individual AI coaching: two formats (executive or key team member), 1 one-on-one day, personalised deliverable within 7 days, across metropolitan France.",
    speakable: true,
    extra: { primaryImageOfPage: buildPrimaryImageOfPage("/un-a-un") },
  });

  // Service, PAS Course : les kits 16/17 sont formels — « ce n'est pas une action
  // de formation » (conseil, non finançable). Déclarer un Course aux moteurs/LLM
  // contredirait le document contractuel remis au client.
  const courseJsonLdArray = COACHING_TYPES.map((c) =>
    buildServiceJsonLd({
      locale: loc,
      path: isFr ? c.hrefFr : c.hrefEn,
      name: isFr ? c.labelFr : c.labelEn,
      description: isFr ? c.taglineFr : c.taglineEn,
      serviceType: isFr
        ? "Accompagnement individuel IA (intervention de conseil)"
        : "Individual AI coaching (consulting engagement)",
    }),
  );

  const howToReserverJsonLd = buildHowToJsonLd({
    locale: loc,
    path,
    name: isFr
      ? "Comment réserver votre coaching IA 1-to-1"
      : "How to book your 1-to-1 AI coaching",
    description: isFr
      ? "3 étapes pour réserver et organiser votre journée de coaching IA en tête-à-tête : vous réservez, on prépare la journée selon votre poste et vos enjeux, votre coach intervient le jour J."
      : "3 steps to book and organise your one-on-one AI coaching day: you book, we prepare the day to fit your role and stakes, your coach delivers on the day.",
    steps: [
      {
        name: isFr ? "Vous réservez" : "You book",
        text: isFr
          ? "Réservation d'un appel ou formulaire de contact : 2 canaux, vous choisissez celui qui vous convient."
          : "Call booking or contact form: 2 channels, you pick the one that suits you.",
      },
      {
        name: isFr ? "On prépare votre journée" : "We prepare your day",
        text: isFr
          ? "Étude de votre poste, vos outils et vos tâches récurrentes. La journée est calibrée pour vous — dirigeant ou collaborateur — sur vos vrais cas."
          : "Study of your role, tools and recurring tasks. The day is calibrated for you — executive or team member — on your real cases.",
      },
      {
        name: isFr ? "Journée en tête-à-tête" : "One-on-one day",
        text: isFr
          ? "Échange préalable de 30 minutes, puis votre coach passe la journée avec vous : journée stratégique pour un dirigeant (panorama IA de votre secteur, leviers hiérarchisés), journée de pratique sur vos vrais dossiers pour un collaborateur."
          : "A 30-minute preliminary call, then your coach spends the day with you: a strategy day for an executive (AI landscape of your sector, prioritised levers), a hands-on day on your real files for a team member.",
      },
      {
        name: isFr ? "Livrable sous 7 jours" : "Deliverable within 7 days",
        text: isFr
          ? "Sous 7 jours, vous recevez votre livrable personnalisé : la note de cadrage stratégique (dirigeant) ou votre cahier de prompts et plan d'action (collaborateur), avec un point de suivi à 30 jours pour le coaching collaborateur."
          : "Within 7 days, you receive your personalised deliverable: the strategic framing note (executive) or your prompt playbook and action plan (team member), with a 30-day follow-up for the team-member coaching.",
      },
    ],
  });

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: isFr ? "/un-a-un" : "/one-to-one",
    name: isFr ? "Formules de coaching 1-to-1" : "1-to-1 coaching formats",
    items: COACHING_TYPES.map((c, idx) => ({
      position: idx + 1,
      name: isFr ? c.labelFr : c.labelEn,
      url: `${SITE_URL}/${locale}${isFr ? c.hrefFr : c.hrefEn}`,
      description: isFr ? c.taglineFr : c.taglineEn,
    })),
  });

  // JSON-LD ImageObject depuis le manifeste SSOT (`PAGE_IMAGES_MANIFEST["/un-a-un"]`).
  const imagesJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/un-a-un" });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2 colonnes — template aligné /interventions/collectives */}
      <ServiceHero
        eyebrow={isFr ? "Coaching individuel · 1-to-1" : "Individual coaching · 1-to-1"}
        title={isFr ? "Un seul jour pour transformer" : "Just one day to transform"}
        titleEm={isFr ? "votre façon de travailler" : "the way you work"}
        description={
          isFr
            ? "Une journée complète en tête-à-tête — dirigeant ou collaborateur clé : on met votre travail à plat, on identifie ce que l'IA peut alléger, et vous repartez avec un cap clair."
            : "A full day one-on-one — executive or key team member: we map out your work, identify what AI can take off your plate, and you leave with a clear course."
        }
        ctas={
          <>
            <Cta
              href="/appel"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track="un-a-un-hero-book-call"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              className="bg-paper text-terracotta hover:bg-paper border-terracotta-deep shadow-subtle border-2"
              track="un-a-un-hero-contact"
            >
              {isFr ? "Nous écrire" : "Email us"}
            </Cta>
          </>
        }
        schemaCenterLabel="Vous"
        schemaAriaLabel="Schéma : vous au centre, entouré des axes que l'IA et l'automatisation transforment — vos journées, vos semaines, vos tâches, votre organisation, vos priorités, votre temps, vos revenus, vos décisions."
        schemaNodes={[
          { label: "Vos journées", benefit: "réorganisées", accent: "terracotta" },
          { label: "Vos semaines", benefit: "planifiées avec l'IA", accent: "primary" },
          { label: "Vos tâches", benefit: "automatisées", accent: "sage" },
          { label: "Votre organisation", benefit: "repensée", accent: "mocha" },
          { label: "Vos priorités", benefit: "clarifiées", accent: "terracotta" },
          { label: "Votre temps", benefit: "récupéré", accent: "primary" },
          { label: "Vos revenus", benefit: "de nouveaux leviers", accent: "sage" },
          { label: "Vos décisions", benefit: "mieux outillées", accent: "mocha" },
        ]}
      />

      {/* SCROLL HINT centré sous le hero — ancre vers #formules */}
      <div className="bg-paper flex justify-center pb-12 sm:pb-16">
        <a
          href="#formules"
          data-cta="un-a-un-hero-scroll-formules"
          className="bg-paper text-fg hover:text-terracotta border-terracotta/40 hover:border-terracotta shadow-subtle hover:shadow-card focus-visible:ring-terracotta inline-flex items-center gap-3 rounded-full border-2 px-7 py-3.5 text-[15px] font-semibold tracking-tight transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {isFr ? "Découvrir les deux formules" : "Discover the two formats"}
          <ChevronDown aria-hidden="true" className="text-terracotta h-5 w-5 animate-bounce" />
        </a>
      </div>

      {/* POSITIONNEMENT — bandeau « parcours » commun aux 5 hubs (audit
          positionnement 2026-07-28). Placé APRÈS le hero pour ne pas
          déplacer l'élément LCP. */}
      <ServiceJourneyBand currentId="unAUn" isFr={isFr} />

      {/* 2 CARDS FORMULE */}
      <Section
        id="formules"
        eyebrow={isFr ? "Coaching 1-to-1 · 1 journée" : "1-to-1 coaching · 1 day"}
        title={isFr ? "Deux façons" : "Two ways"}
        titleEm={isFr ? "d'être accompagné" : "to be coached"}
        description={
          isFr
            ? "Une journée, deux approches selon qui en profite : le dirigeant, ou un collaborateur clé. À vous de choisir. Pour un accompagnement dans la durée, voir le coaching régulier plus bas."
            : "One day, two approaches depending on who benefits: the executive, or a key team member. Your call. For ongoing support over time, see the recurring coaching below."
        }
        contentClassName={TIGHT_X}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-7">
          {COACHING_TYPES.map((c) => {
            const isDirigeant = c.id === "dirigeant";
            const Icon = isDirigeant ? Briefcase : UserRound;
            const href = isFr ? c.hrefFr : c.hrefEn;
            const features = isFr ? c.featuresFr : c.featuresEn;
            const ctaLabel = isFr ? c.ctaFr : c.ctaEn;
            return (
              <article
                key={c.id}
                className={cn(
                  "group/formule shadow-subtle relative flex h-full flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 hover:-translate-y-1",
                  isDirigeant
                    ? "bg-sand border-terracotta-deep/40 hover:border-terracotta-deep hover:shadow-[0_16px_40px_-12px_rgba(180,80,40,0.30)]"
                    : "bg-paper border-terracotta/30 hover:border-terracotta hover:shadow-[0_16px_40px_-12px_rgba(205,107,72,0.30)]",
                )}
              >
                <Link
                  href={href as never}
                  aria-label={`${isFr ? c.labelFr : c.labelEn} — ${ctaLabel}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{ctaLabel}</span>
                </Link>

                {/* Filet couleur en haut */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-2 w-full",
                    isDirigeant ? "bg-terracotta-deep" : "bg-terracotta",
                  )}
                />

                <div className="flex flex-1 flex-col p-7 sm:p-8">
                  <div
                    className={cn(
                      "mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl",
                      isDirigeant
                        ? "bg-terracotta-soft text-terracotta-deep"
                        : "bg-terracotta-soft text-terracotta-deep",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                  </div>

                  <h2 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                    {isFr ? c.labelFr : c.labelEn}
                  </h2>
                  <p className="text-fg-muted mt-1 text-[13.5px] font-medium">
                    {isFr ? c.durationFr : c.durationEn}
                  </p>
                  <p className="text-fg-soft mt-4 text-[15px] leading-relaxed">
                    {isFr ? c.taglineFr : c.taglineEn}
                  </p>

                  <ul className="mt-6 space-y-2.5">
                    {features.map((feat, i) => (
                      <li
                        key={i}
                        className="text-fg flex items-start gap-2.5 text-[13.5px] leading-snug"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                            isDirigeant ? "bg-terracotta-deep" : "bg-terracotta",
                          )}
                        />
                        <span className="font-medium">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className={cn(
                      "mt-6 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold",
                      "bg-terracotta-soft text-terracotta-deep",
                    )}
                  >
                    <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>{isFr ? c.priceFr : c.priceEn}</span>
                  </div>

                  <div className="relative z-[2] mt-auto pt-7">
                    <Link
                      href={href as never}
                      className={cn(
                        "inline-flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-semibold transition-colors",
                        isDirigeant
                          ? "bg-terracotta-deep text-mocha-fg hover:bg-terracotta-deep/85"
                          : "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
                      )}
                    >
                      <span>{ctaLabel}</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform duration-200 group-hover/formule:translate-x-1"
                      />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* ============================================================
          COACHING RÉGULIER — adaptation 1-to-1 du bloc « Formation
          régulière » de /interventions/collectives. Sessions mensuelles
          ou bi-mensuelles en tête-à-tête, sur contrat 6, 12 ou 24 mois.
          ============================================================ */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Coaching régulier" : "Recurring coaching"}
        title={isFr ? "Coaching régulier" : "Recurring coaching"}
        titleEm={isFr ? "mensuel" : "monthly"}
        description={
          isFr
            ? "Là, on change de dimension. Sur un contrat de 6, 12 ou 24 mois, on met en place une vraie stratégie d'évolution de bout en bout — et on construit des outils personnels, faits pour VOTRE activité. Un seul objectif : faire sauter vos tâches répétitives, optimiser tout ce qui peut l'être et vous dégager de la charge mentale. Il y a un avant et un après."
            : "This is where it changes dimension. Over a 6, 12 or 24-month contract, we set up a real end-to-end evolution strategy — and build personal tools, made for YOUR activity. One single goal: eliminate your repetitive tasks, optimise everything that can be optimised and free you from mental load. There's a before and an after."
        }
        contentClassName={TIGHT_X}
      >
        <Container>
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 md:gap-7">
            {/* CARD 1 — Mensuel (mis en avant) */}
            <article className="bg-paper border-terracotta/40 shadow-subtle hover:border-terracotta hover:shadow-card group relative flex flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 hover:-translate-y-1">
              <span className="bg-terracotta text-mocha-fg absolute top-5 right-5 z-[2] inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase">
                {isFr ? "Le plus choisi" : "Most chosen"}
              </span>
              <span aria-hidden="true" className="bg-terracotta block h-2 w-full" />
              <div className="flex flex-1 flex-col p-7 sm:p-8">
                <div className="bg-terracotta-soft text-terracotta-deep mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl">
                  <UserRound aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                  {isFr ? "Formule mensuelle" : "Monthly programme"}
                </h3>
                <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">
                  {isFr
                    ? "1 session par mois, sur un contrat de 6, 12 ou 24 mois — le rythme soutenu pour transformer en profondeur votre façon de travailler."
                    : "1 session per month, over a 6, 12 or 24-month contract — the sustained pace to deeply transform the way you work."}
                </p>
                <ul className="mt-6 space-y-3">
                  {(isFr
                    ? [
                        "Des gains qui s'accumulent, mois après mois",
                        "Un coach qui connaît votre poste : zéro re-briefing",
                        "Des outils qui restent à vous, entre les sessions",
                        "Bilan chiffré à 3, 6, 12 et 24 mois",
                      ]
                    : [
                        "Gains that compound, month after month",
                        "A coach who knows your role: zero re-briefing",
                        "Tools that stay yours, between sessions",
                        "Quantified review at 3, 6, 12 and 24 months",
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
                      ? `À partir de ${recurringPrice} / session · contrat 6, 12 ou 24 mois`
                      : `From ${recurringPrice} / session · 6, 12 or 24-month contract`}
                  </span>
                </div>
                <div className="mt-auto pt-7">
                  <Cta
                    href="/appel"
                    size="lg"
                    className="bg-primary text-primary-fg hover:bg-primary-hover w-full justify-center shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
                    track="un-a-un-recurring-monthly-call"
                  >
                    {isFr ? "Réserver un appel" : "Book a call"}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                </div>
              </div>
            </article>

            {/* CARD 2 — Bi-mensuel */}
            <article className="bg-paper border-sage/40 shadow-subtle hover:border-sage hover:shadow-card group relative flex flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 hover:-translate-y-1">
              <span aria-hidden="true" className="bg-sage block h-2 w-full" />
              <div className="flex flex-1 flex-col p-7 sm:p-8">
                <div className="bg-sage-soft text-sage mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl">
                  <UserRound aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                  {isFr ? "Formule bi-mensuelle" : "Bi-monthly programme"}
                </h3>
                <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">
                  {isFr
                    ? "1 session tous les 2 mois, sur un contrat de 6, 12 ou 24 mois — le rythme idéal pour les agendas chargés qui veulent évoluer sans surcharge."
                    : "1 session every 2 months, over a 6, 12 or 24-month contract — the ideal pace for busy schedules that want to evolve without overload."}
                </p>
                <ul className="mt-6 space-y-3">
                  {(isFr
                    ? [
                        "La même dynamique, à rythme allégé",
                        "Idéal quand l'agenda est déjà plein",
                        "Du temps pour pratiquer entre deux sessions",
                      ]
                    : [
                        "The same momentum, at a lighter pace",
                        "Ideal when the diary is already full",
                        "Time to practise between two sessions",
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
                      ? `À partir de ${recurringPrice} / session · contrat 6, 12 ou 24 mois`
                      : `From ${recurringPrice} / session · 6, 12 or 24-month contract`}
                  </span>
                </div>
                <div className="mt-auto pt-7">
                  <Cta
                    href="/appel"
                    size="lg"
                    className="bg-primary text-primary-fg hover:bg-primary-hover w-full justify-center shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
                    track="un-a-un-recurring-bimonthly-call"
                  >
                    {isFr ? "Réserver un appel" : "Book a call"}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                </div>
              </div>
            </article>
          </div>

          {/* Bandeau métiers & tâches — couverture sémantique (rôles + tâches
              concrètes automatisables). Remplace l'ancienne grille « Pourquoi »
              qui paraphrasait les bénéfices déjà énoncés plus haut. Ici on
              apporte du NEUF : quels postes, quelles tâches concrètes. */}
          <div className="bg-paper border-border shadow-subtle mx-auto mt-10 max-w-5xl rounded-3xl border p-6 sm:p-8">
            <h3 className="text-fg text-lg leading-tight font-semibold tracking-tight sm:text-xl">
              {isFr
                ? "Les tâches qui sautent, métier par métier"
                : "The tasks we eliminate, role by role"}
            </h3>
            <p className="text-fg-soft mt-2 text-[14px] leading-relaxed">
              {isFr
                ? "Quelques exemples concrets de ce qu'on automatise ou simplifie, selon le poste :"
                : "A few concrete examples of what we automate or simplify, depending on the role:"}
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
              {(isFr
                ? [
                    {
                      t: "Dirigeant·e",
                      d: "Tri des mails, préparation de réunions, comptes-rendus, veille concurrentielle, tableaux de bord, suivi commercial.",
                    },
                    {
                      t: "Assistant·e / secrétariat",
                      d: "Courriers et e-mails, prises de rendez-vous, mise en forme de documents, classement, relances.",
                    },
                    {
                      t: "Comptabilité / gestion",
                      d: "Saisie, rapprochements, notes de frais, relances clients, reporting mensuel.",
                    },
                    {
                      t: "Achats / ADV",
                      d: "Demandes de devis, comparatifs fournisseurs, bons de commande, suivi de livraison.",
                    },
                    {
                      t: "Commercial / marketing",
                      d: "E-mails de prospection, propositions, fiches produits, contenus, mise à jour du CRM.",
                    },
                    {
                      t: "RH / office management",
                      d: "Offres d'emploi, tri de candidatures, onboarding, notes internes, réponses RH récurrentes.",
                    },
                  ]
                : [
                    {
                      t: "Executive",
                      d: "Inbox triage, meeting prep, minutes, competitive monitoring, dashboards, sales follow-up.",
                    },
                    {
                      t: "Assistant / admin",
                      d: "Letters and emails, scheduling, document formatting, filing, follow-ups.",
                    },
                    {
                      t: "Accounting / finance",
                      d: "Data entry, reconciliations, expense reports, client reminders, monthly reporting.",
                    },
                    {
                      t: "Purchasing / order desk",
                      d: "Quote requests, supplier comparisons, purchase orders, delivery tracking.",
                    },
                    {
                      t: "Sales / marketing",
                      d: "Prospecting emails, proposals, product sheets, content, CRM updates.",
                    },
                    {
                      t: "HR / office management",
                      d: "Job ads, application screening, onboarding, internal notes, recurring HR answers.",
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

      {/* SECTION COACH — crédibilité (Williams ou un membre de l'équipe) */}
      <section
        id="coach"
        aria-labelledby="coach-heading"
        className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28"
      >
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
                <span className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Votre coach IA" : "Your AI coach"}
              </p>
              <h2
                id="coach-heading"
                className="text-fg text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Un expert" : "An expert"}
                <br />
                <span className="text-terracotta italic">
                  {isFr ? "rien que pour vous" : "just for you"}
                </span>
              </h2>
              <p className="text-fg-soft mt-7 text-lg leading-relaxed">
                {isFr
                  ? "Williams, fondateur d'Axion-IA, assure lui-même l'essentiel des journées 1-to-1 — ou un coach de son équipe — dédié à votre poste, calibré sur votre métier, vos outils et vos enjeux."
                  : "Williams, founder of Axion-IA, personally runs most of the 1-to-1 days — or a coach from his team — dedicated to your role, calibrated to your work, your tools and your stakes."}
              </p>
              <p className="text-fg-soft mt-5 text-lg leading-relaxed">
                {isFr
                  ? "Une journée entière consacrée à votre situation. Côté dirigeant : on prend de la hauteur — panorama IA de votre secteur préparé en amont, 5 à 10 leviers hiérarchisés, scénarios à 3 ans. Côté collaborateur : on pratique sur vos vrais dossiers, et vous repartez avec 3 à 5 méthodes maîtrisées, utilisables dès le lendemain. Puis, sous 7 jours, votre livrable personnalisé : note de cadrage stratégique, ou cahier de prompts et plan d'action. Un seul cap : du temps gagné et des décisions plus claires."
                  : "A full day dedicated to your situation. Executive side: we take the high view — an AI landscape of your sector prepared in advance, 5 to 10 prioritised levers, 3-year scenarios. Team-member side: hands-on practice on your real files, and you leave with 3 to 5 mastered methods, usable the next day. Then, within 7 days, your personalised deliverable: strategic framing note, or prompt playbook and action plan. One single goal: time saved and clearer decisions."}
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-xs">
                <figure className="shadow-card m-0 overflow-hidden rounded-2xl">
                  <Image
                    src="/illustrations/william-fondateur-formateur-ia-axion-ia.png"
                    alt={
                      isFr
                        ? "Williams, fondateur Axion-IA et coach IA — portrait posé devant olivier, ambiance méditerranée. Accompagne dirigeants et collaborateurs clés en tête-à-tête, partout en France métropolitaine."
                        : "Williams, Axion-IA founder and AI coach — portrait in front of olive tree, Mediterranean atmosphere. Coaches executives and key team members one-on-one, across metropolitan France."
                    }
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 1024px) 80vw, 320px"
                    className="aspect-[4/5] h-auto w-full object-cover"
                    quality={75}
                  />
                </figure>
                <div className="mt-4 text-center">
                  <p className="text-fg text-lg font-semibold">Williams</p>
                  <p className="text-fg-muted text-sm">
                    {isFr ? "Fondateur & coach IA · Axion-IA" : "Founder & AI coach · Axion-IA"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar — 3 colonnes adaptées coaching 1-to-1 */}
          <div className="border-border-strong mt-16 grid grid-cols-3 divide-x border-t pt-10">
            {(
              [
                {
                  number: isFr ? "Toute la France" : "All France",
                  labelFr: "métropolitaine + francophone à l'international (1 sem. min.)",
                  labelEn: "metropolitan + French-speaking abroad (1 week min.)",
                },
                {
                  number: isFr ? "Dès le 1ᵉʳ jour" : "From day one",
                  labelFr: "des process concrets, utilisables tout de suite",
                  labelEn: "concrete processes, usable right away",
                },
                {
                  number: isFr ? "1 personne" : "1 person",
                  labelFr: "un vrai tête-à-tête, 100 % sur votre quotidien",
                  labelEn: "a true one-on-one, 100 % on your day",
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

      {/* BANDEAU TERRACOTTA — orientation */}
      <section className="bg-terracotta py-16 sm:py-20">
        <Container>
          <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="max-w-2xl">
              <p className="text-mocha-fg mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
                {isFr ? "Pas sûr·e de la bonne formule ?" : "Not sure which format?"}
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
                  ? "Un appel pour comprendre votre contexte, vous dire si le coaching dirigeant ou collaborateur vous correspond, et vous expliquer comment se déroule la journée. Sans engagement."
                  : "A call to understand your context, tell you whether executive or team-member coaching fits, and explain how the day unfolds. No commitment."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Cta
                href="/appel"
                size="lg"
                className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
                track="un-a-un-terracotta-band-call"
              >
                {isFr ? "Réserver un appel" : "Book a call"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
              <Cta
                href="/contact"
                size="lg"
                className="bg-paper text-terracotta hover:bg-paper/95 shadow-subtle"
                track="un-a-un-terracotta-band-contact"
              >
                {isFr ? "Nous écrire" : "Email us"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* COMMENT ÇA FONCTIONNE — 3 étapes */}
      <Section
        eyebrow={isFr ? "Comment ça fonctionne" : "How it works"}
        title={isFr ? "Comment réserver" : "How to book"}
        titleEm={isFr ? "votre journée 1-to-1" : "your 1-to-1 day"}
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
                  ? "Étude de votre poste, vos outils, vos tâches récurrentes."
                  : "Study of your role, tools, recurring tasks.",
              },
              {
                id: "step-3-tete-a-tete",
                title: isFr ? "Journée en tête-à-tête" : "One-on-one day",
                description: isFr
                  ? "Votre coach passe la journée avec vous : stratégie et leviers hiérarchisés pour un dirigeant, pratique sur vos vrais dossiers pour un collaborateur."
                  : "Your coach spends the day with you: strategy and prioritised levers for an executive, hands-on practice on your real files for a team member.",
              },
              {
                id: "step-4-rapport",
                title: isFr ? "Livrable sous 7 jours" : "Deliverable within 7 days",
                description: isFr
                  ? "Note de cadrage stratégique (dirigeant) ou cahier de prompts et plan d'action (collaborateur), remis sous 7 jours."
                  : "Strategic framing note (executive) or prompt playbook and action plan (team member), delivered within 7 days.",
              },
            ]}
          />
        </Container>
      </Section>

      {/* COUVERTURE NATIONALE (pSEO villes/régions) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="Le coaching IA 1-to-1"
        serviceLabelEn="1-to-1 AI coaching"
        serviceSlug="un-a-un"
        tone="paper"
      />

      {/* FAQ unifiée coaching 1-to-1 */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "Avant de réserver" : "Before booking"}
        titleEm={isFr ? "votre coaching" : "your coaching"}
      >
        <Container>
          <FaqAccordion
            className="mx-auto max-w-3xl"
            items={
              isFr
                ? [
                    {
                      id: "a-qui",
                      question: "À qui s'adresse le coaching IA 1-to-1 ?",
                      answer:
                        "À deux profils. Le coaching dirigeant est centré sur le dirigeant lui-même : comment l'IA peut lui faire gagner du temps et de l'argent dans son propre quotidien. Le coaching collaborateur s'adresse à n'importe quel poste (secrétariat, comptabilité, responsable achat, RH…) : on analyse ses tâches répétitives et on les allège.",
                    },
                    {
                      id: "difference",
                      question: "Quelle différence entre coaching dirigeant et collaborateur ?",
                      answer:
                        "Le coaching dirigeant est focalisé sur VOUS, dirigeant : votre temps, vos décisions, votre charge personnelle — pas sur l'entreprise. Le coaching collaborateur est une journée de travail avec la personne concernée pour cartographier et alléger ses tâches répétitives, et lui apporter un gain d'efficacité immédiat.",
                    },
                    {
                      id: "benefice-jour",
                      question: "Qu'est-ce que je repars avec à la fin de la journée ?",
                      answer:
                        "Côté collaborateur : 3 à 5 méthodes pratiquées sur vos vrais dossiers pendant la journée, utilisables dès le lendemain. Côté dirigeant : une vision claire — le panorama IA de votre secteur et 5 à 10 leviers hiérarchisés. Puis, sous 7 jours, votre livrable personnalisé : note de cadrage stratégique, ou cahier de prompts et plan d'action.",
                    },
                    {
                      id: "rapport",
                      question: "Recevez-vous un compte-rendu après la journée ?",
                      answer:
                        "Oui, et c'est LE livrable clé, remis sous 7 jours. Pour un dirigeant : la note de cadrage stratégique — panorama IA de votre secteur, sourcé, et vos 5 à 10 leviers hiérarchisés par impact et urgence. Pour un collaborateur : votre cahier de prompts personnel et un plan d'action, suivis d'un point à 30 jours.",
                    },
                    {
                      id: "duree",
                      question: "Combien de temps dure une journée de coaching ?",
                      answer:
                        "Environ 7 à 8 h sur site, en tête-à-tête. La journée peut aussi se dérouler à distance ou en hybride selon votre préférence. Pour ancrer les usages dans la durée, on propose aussi un coaching régulier mensuel ou bi-mensuel, sur un contrat de 6, 12 ou 24 mois.",
                    },
                    {
                      id: "outils",
                      question: "Quels outils IA utilisez-vous en coaching ?",
                      answer:
                        "Les trois assistants les plus utilisés en entreprise — ChatGPT, Claude et Gemini — appliqués à votre poste, et la création de vos propres assistants IA. Le coaching étant individuel, on travaille sur vos vrais dossiers et vos vrais outils, dans le respect strict de la confidentialité (rien n'est conservé).",
                    },
                    {
                      id: "couverture",
                      question: "Intervenez-vous partout en France ?",
                      answer:
                        "Oui. Toute la France métropolitaine : Paris et l'Île-de-France en priorité, puis Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Rennes et plus de 2 100 communes éligibles. À l'international, nous intervenons dans les structures francophones sur des missions d'une semaine minimum.",
                    },
                    {
                      // ⚠️ Même correction que sur /formations le 2026-08-12 : cette
                      // réponse promettait un remboursement intégral et un gain de temps
                      // « systématique ». Les CGV (`src/content/legal.ts`) posent une
                      // obligation de MOYENS et écrivent « aucune garantie de résultat
                      // n'est donnée ; les gains, ROI ou performances évoqués sont
                      // indicatifs » — une page publique ne peut pas engager au-delà.
                      // Ne PAS réintroduire de promesse de résultat ici.
                      id: "garantie",
                      question: "Garantie de résultat ?",
                      answer:
                        "Non, et personne de sérieux ne peut en donner une : nos conditions générales posent une obligation de moyens, et les gains évoqués restent indicatifs — ils dépendent de vos dossiers et de ce que vous appliquez ensuite. Ce que nous engageons figure au devis : une journée en tête-à-tête sur votre poste réel, le livrable écrit sous 7 jours et un point de suivi à 30 jours. En cas d'imprévu de votre côté, la journée est reportable une fois sans frais ; annulée à plus de 15 jours ouvrés, les acomptes versés vous sont intégralement remboursés.",
                    },
                  ]
                : [
                    {
                      id: "who",
                      question: "Who is 1-to-1 AI coaching for?",
                      answer:
                        "Two profiles. Executive coaching focuses on the executive themselves: how AI can save them time and money in their own daily work. Team-member coaching is for any role (admin, accounting, purchasing manager, HR…): we analyse their repetitive tasks and offload them.",
                    },
                    {
                      id: "difference",
                      question: "What's the difference between executive and team-member coaching?",
                      answer:
                        "Executive coaching focuses on YOU, the executive: your time, your decisions, your personal workload — not the company. Team-member coaching is a working day with a key employee to map and offload their repetitive tasks and bring immediate efficiency.",
                    },
                    {
                      id: "day-benefit",
                      question: "What do I leave with at the end of the day?",
                      answer:
                        "Real value from day one. We map out your organisation and set up concrete processes, usable right away, that save you time immediately. Then, within 7 days, a quantified report lists the automations to put in place and the expected gains (time, money).",
                    },
                    {
                      id: "report",
                      question: "Do you provide a report after the day?",
                      answer:
                        "Yes, and it's THE key deliverable. Within 7 days, you receive a complete, detailed report: all the concrete, real automations to put in place, prioritised, with the expected gains quantified (time saved, money saved).",
                    },
                    {
                      id: "duration",
                      question: "How long is a coaching day?",
                      answer:
                        "About 7 to 8 h on site, one-on-one. The day can also run remotely or in hybrid mode depending on your preference. To embed the practices over time, we also offer recurring monthly or bi-monthly coaching, on a 6, 12 or 24-month contract.",
                    },
                    {
                      id: "tools",
                      question: "Which AI tools do you use in coaching?",
                      answer:
                        "The three most widely used business assistants — ChatGPT, Claude and Gemini — applied to your role, plus building your own AI assistants. As the coaching is individual, we work on your real files and real tools, under strict confidentiality (nothing is kept).",
                    },
                    {
                      id: "coverage",
                      question: "Do you cover all of France?",
                      answer:
                        "Yes. All metropolitan France: Paris and Greater Paris first, then Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Rennes and 2,100+ eligible communes. Internationally, we intervene in French-speaking organisations on missions of one week minimum.",
                    },
                    {
                      // Miroir EN de la correction du 2026-08-12 — voir le commentaire
                      // détaillé sur l'entrée `garantie` du bloc FR. Le site est servi en
                      // français uniquement, mais laisser ici la promesse retirée côté FR
                      // reviendrait à la garder armée dans le dépôt.
                      id: "guarantee",
                      question: "Guarantee?",
                      answer:
                        "No, and no serious provider can give one: our terms set an obligation of means, and any gains mentioned are indicative — they depend on your own files and on what you apply afterwards. What we do commit to is written in the quote: a one-to-one day on your actual workstation, the written deliverable within 7 days and a follow-up at 30 days. If something unexpected comes up on your side, the day can be postponed once at no cost; cancelled more than 15 working days ahead, any deposit paid is refunded in full.",
                    },
                  ]
            }
          />
        </Container>
      </Section>

      {/* CONNAISSANCES LIÉES — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="un-a-un" />

      <VisibiliteCallout isFr={isFr} />

      <CtaBlock
        eyebrow={isFr ? "Coaching IA individuel" : "Individual AI coaching"}
        title={isFr ? "Gagnez du temps" : "Save time"}
        titleEm={isFr ? "dès la première journée" : "from the very first day"}
        description={
          isFr
            ? "Un appel suffit pour caler la bonne formule et une date. Le reste, on s'en occupe."
            : "One call is enough to lock in the right format and a date. We handle the rest."
        }
        cta={
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
            track="un-a-un-ctablock-consultation"
          >
            {isFr ? "Réserver un appel" : "Book a call"} →
          </Cta>
        }
        tone="dark"
      />

      {/* CTA mobile sticky */}
      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver mon coaching" : "Book my coaching"}
        track="un-a-un-sticky-mobile"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={coachingPageJsonLd} />
      <JsonLd data={itemListJsonLd} />
      {imagesJsonLd ? <JsonLd data={imagesJsonLd} /> : null}
      <JsonLd data={howToReserverJsonLd} />
      {courseJsonLdArray.map((course, idx) => (
        <JsonLd key={`course-${idx}`} data={course} />
      ))}
    </>
  );
}
