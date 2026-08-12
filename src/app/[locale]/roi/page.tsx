// Page-outil « Simulateur de gains IA » (/roi) — refonte v2, 2026-08-12.
//
// ── Ce que la v2 change ───────────────────────────────────────────────────
// La v1 demandait au dirigeant d'estimer lui-même « ses heures quotidiennes sur
// tâches répétitives » — le seul chiffre qu'un dirigeant ne connaît pas. Tout
// le calcul en découlait, donc tout le résultat était une conjecture que
// l'utilisateur savait avoir lui-même fabriquée.
//
// La v2 pose un DIAGNOSTIC : des questions auxquelles on répond de tête
// (« combien de devis par semaine ? »), un référentiel de tâches automatisables
// qui reconstruit le temps par le bas, et un rapport nominatif — plan d'action,
// feuille de route, limites assumées. Voir `src/content/roi/model/`.
//
// ⚠️ Les chiffres restent des HYPOTHÈSES DE MODÈLE, jamais une étude. La
// section « Notre modèle d'estimation » les expose, et chaque tâche du rapport
// porte sa propre justification. Ne pas réintroduire de formulation du type
// « observé sur N entreprises » sans étude publiable : art. L121-2 du Code de
// la consommation.
//
// Server Component pur ; seul `SimulatorFlow` porte du JS.

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Clock,
  ListChecks,
  Quote,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { SimulatorFlow } from "@/components/roi/v2/SimulatorFlow";
import { decodeAnswers, REPORT_QUERY_PARAM, ROI_QUERY_PARAM } from "@/lib/roi/encode";
import { ROI_MODEL_CONSTANTS, MATURITY_LEVELS } from "@/content/roi/model/types";
import { AUTOMATABLE_TASKS } from "@/content/roi/model/tasks";
import { CLIENT_SECTORS } from "@/content/sectors";
import { getVillesIndexableNow } from "@/content/villes";
import { ROI_PHOTO_CREDITS } from "@/content/roi/roi-photos";
import {
  buildProductMetadata,
  buildFaqSpeakableJsonLd,
  buildWebPageJsonLd,
  buildHowToJsonLd,
  buildItemListJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { getPageImages } from "@/lib/seo/page-images";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PATH = "/roi";

/** Date de dernière révision éditoriale du modèle — alimente `dateModified`. */
const MODEL_REVISED_AT = "2026-08-12T00:00:00.000Z";

export const revalidate = 3600;

function metaFor(isFr: boolean) {
  return {
    title: isFr
      ? "Simulateur de gains IA · le rapport que votre entreprise peut récupérer · Axion-IA"
      : "AI gains simulator · what your company can recover · Axion-IA",
    description: isFr
      ? "Répondez à une dizaine de questions sur vos volumes réels et recevez un rapport nominatif : les premières tâches à automatiser, le temps et l'argent récupérables, la feuille de route à 30 jours, 3 mois et 6 mois. Gratuit, sans inscription."
      : "Answer a dozen questions about your real volumes and get a tailored report: the first tasks to automate, the time and money you can recover, and a roadmap at 30 days, 3 months and 6 months. Free, no sign-up.",
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const { title, description } = metaFor(locale === "fr");
  return buildProductMetadata({ locale, path: PATH, title, description });
}

export default async function RoiPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const meta = metaFor(isFr);

  // Reprise d'un lien partagé. `searchParams` rend la route dynamique à la
  // demande uniquement : sans paramètre, Next sert la version statique.
  const sp = await searchParams;
  const rawDiagnostic = typeof sp[ROI_QUERY_PARAM] === "string" ? sp[ROI_QUERY_PARAM] : null;
  const initialAnswers = decodeAnswers(rawDiagnostic);
  const initialShowReport = sp[REPORT_QUERY_PARAM] === "1" && initialAnswers !== null;

  const pageImages = getPageImages(PATH);
  const heroImage = pageImages.find((i) => i.slot === "hero");
  const bannerImage = pageImages.find((i) => i.slot === "banner");
  const portraitImage = pageImages.find((i) => i.slot === "portrait");
  const villes = getVillesIndexableNow().slice(0, 60);

  const creditFor = (src: string) => {
    const slot = src.split("/").pop()?.replace(".avif", "") ?? "";
    return ROI_PHOTO_CREDITS[slot];
  };

  const breadcrumbItems = [{ href: PATH, label: isFr ? "Simulateur de gains" : "Gains simulator" }];

  // ── Contenu ───────────────────────────────────────────────────────────────

  const heroChips = [
    { icon: ListChecks, label: isFr ? "Vos premières tâches à automatiser" : "Your first tasks to automate" },
    { icon: Clock, label: isFr ? "Temps et argent récupérables" : "Time and money recoverable" },
    { icon: Route, label: isFr ? "Feuille de route 30 j / 3 mois / 6 mois" : "Roadmap 30 d / 3 mo / 6 mo" },
    { icon: ShieldCheck, label: isFr ? "Ce qui ne s'automatise pas" : "What cannot be automated" },
  ] as const;

  const howItWorks = isFr
    ? [
        {
          icon: Users,
          name: "Décrivez votre entreprise",
          text: "Secteur, effectif, outils déjà en place, et les fonctions qui vous prennent du temps. Quatre écrans, quatre appuis.",
        },
        {
          icon: BarChart3,
          name: "Donnez vos volumes réels",
          text: "Combien de devis par semaine, de factures par mois, d'appels par jour. Toujours par tranche, jamais un chiffre exact — et « je ne sais pas » est une réponse valable.",
        },
        {
          icon: ListChecks,
          name: "Recevez votre plan d'action",
          text: "Vos cinq premières tâches à automatiser, classées par rapport entre le gain et l'effort, chacune avec son gain annuel et son délai de mise en œuvre.",
        },
        {
          icon: Route,
          name: "Suivez la feuille de route",
          text: "Ce qui est lançable sous trente jours, ce qui demande de la préparation, et les chantiers de fond. Avec les montants associés à chaque vague.",
        },
      ]
    : [
        {
          icon: Users,
          name: "Describe your company",
          text: "Sector, headcount, tools already in place, and the functions that eat your time. Four screens, four taps.",
        },
        {
          icon: BarChart3,
          name: "Give your real volumes",
          text: "How many quotes a week, invoices a month, calls a day. Always as a range, never an exact figure — and “I don't know” is a valid answer.",
        },
        {
          icon: ListChecks,
          name: "Get your action plan",
          text: "Your first five tasks to automate, ranked by gain against effort, each with its annual gain and lead time.",
        },
        {
          icon: Route,
          name: "Follow the roadmap",
          text: "What you can start within thirty days, what needs preparation, and the deeper projects. With the amount attached to each wave.",
        },
      ];

  // Hypothèses du modèle — E-E-A-T. Lues depuis le SSOT, jamais recopiées.
  const assumptions = isFr
    ? [
        {
          term: "Tâches au référentiel",
          value: `${AUTOMATABLE_TASKS.length}`,
          note: "Chaque tâche porte son temps unitaire de référence, la part de ce temps réellement supprimable, son délai de mise en œuvre et la justification de ce taux. Rien n'est agrégé sans être traçable.",
        },
        {
          term: "Part supprimable la plus élevée",
          value: `${Math.round(Math.max(...AUTOMATABLE_TASKS.map((t) => t.automationRate)) * 100)} %`,
          note: "Jamais 100 %. Il reste toujours la relecture, la décision et l'envoi. Les tâches qui engagent votre responsabilité plafonnent bien plus bas.",
        },
        {
          term: "Journée de travail",
          value: `${ROI_MODEL_CONSTANTS.hoursPerDay} h`,
          note: "Durée légale française : 35 heures hebdomadaires réparties sur 5 jours.",
        },
        {
          term: "Jours ouvrés",
          value: `${ROI_MODEL_CONSTANTS.workingDaysPerYear} / an`,
          note: "Hors congés payés et RTT. Les volumes hebdomadaires sont annualisés sur 44 semaines ouvrées.",
        },
        {
          term: "Équivalent temps plein",
          value: `${ROI_MODEL_CONSTANTS.annualHoursPerFte.toLocaleString("fr-FR")} h / an`,
          note: "Durée légale annuelle du travail en France. Sert de dénominateur au calcul d'ETP récupérés.",
        },
        {
          term: "Maturité numérique",
          value: `${MATURITY_LEVELS.length} niveaux`,
          note: "Vos outils actuels modulent le gain et le délai. Une entreprise encore sur papier récupère moins vite — mais elle peut lancer les mêmes actions immédiates.",
        },
        {
          term: "Plafond de vraisemblance",
          value: "60 %",
          note: "Les tâches du référentiel ne peuvent jamais représenter plus de 60 % de la capacité de votre équipe. Au-delà, l'estimation est réduite : le reste de la journée part dans votre métier, les déplacements et les imprévus.",
        },
      ]
    : [
        {
          term: "Tasks in the catalogue",
          value: `${AUTOMATABLE_TASKS.length}`,
          note: "Each task carries its reference unit time, the share of that time genuinely removable, its lead time and the reasoning behind that rate. Nothing is aggregated without being traceable.",
        },
        {
          term: "Highest removable share",
          value: `${Math.round(Math.max(...AUTOMATABLE_TASKS.map((t) => t.automationRate)) * 100)} %`,
          note: "Never 100 %. Review, decision and sending always remain. Tasks that engage your liability cap far lower.",
        },
        {
          term: "Working day",
          value: `${ROI_MODEL_CONSTANTS.hoursPerDay} h`,
          note: "French statutory duration: 35 hours a week over 5 days.",
        },
        {
          term: "Working days",
          value: `${ROI_MODEL_CONSTANTS.workingDaysPerYear} / year`,
          note: "Excluding paid leave and RTT. Weekly volumes are annualised over 44 working weeks.",
        },
        {
          term: "Full-time equivalent",
          value: `${ROI_MODEL_CONSTANTS.annualHoursPerFte.toLocaleString("en-GB")} h / year`,
          note: "French statutory annual working time. Denominator for the FTE-recovered figure.",
        },
        {
          term: "Digital maturity",
          value: `${MATURITY_LEVELS.length} levels`,
          note: "Your current tools modulate both gain and lead time. A paper-based company recovers more slowly — but it can start the same immediate actions.",
        },
        {
          term: "Plausibility ceiling",
          value: "60 %",
          note: "Catalogued tasks can never represent more than 60 % of your team's capacity. Beyond that the estimate is scaled down: the rest of the day goes to your actual trade, travel and the unexpected.",
        },
      ];

  const faqItems = isFr
    ? [
        {
          id: "quelles-taches-automatiser",
          question: "Quelles tâches faut-il automatiser en premier dans une PME ?",
          answer:
            "Celles qui combinent un volume élevé, un temps unitaire significatif et un faible effort de mise en œuvre. En pratique, ce sont presque toujours les mêmes : les comptes-rendus de réunion, les relances de devis et de factures impayées, la prise de rendez-vous et le tri du courrier entrant. Notre simulateur les classe pour votre entreprise selon vos volumes réels, en pondérant le gain par l'effort — pas par le gain brut, sinon il recommanderait toujours le chantier le plus lourd en premier.",
        },
        {
          id: "comment-calculer-gains",
          question: "Comment calculer concrètement les gains d'une automatisation par l'IA ?",
          answer:
            "Partez de la tâche, pas de la technologie. Comptez son volume annuel, multipliez par le temps qu'elle prend une fois, puis par la part de ce temps réellement supprimable — jamais la totalité, il reste toujours la relecture et la décision. Vous obtenez des heures, convertibles en euros par le coût horaire chargé. C'est exactement l'enchaînement que notre simulateur applique, tâche par tâche, avec chaque hypothèse affichée.",
        },
        {
          id: "combien-de-temps",
          question: "Combien de temps prend ce simulateur ?",
          answer:
            "Entre deux et quatre minutes selon la taille de votre entreprise. Le questionnaire s'adapte : un artisan seul répond à huit questions, un cabinet de quarante personnes à seize. Tout se répond par tranches, en un appui, sans jamais taper un chiffre — et sans inscription.",
        },
        {
          id: "chiffres-exacts",
          question: "Les chiffres du simulateur sont-ils des chiffres réels ?",
          answer:
            "Ce sont des ordres de grandeur produits par un modèle d'estimation dont toutes les hypothèses sont publiées, et dont chaque tâche affiche sa propre justification. Ils ne constituent ni un engagement de résultat, ni un devis, ni un audit. Pour un chiffrage sur vos process réels, avec mesure avant et après, c'est l'objet de l'audit Axion-IA.",
        },
        {
          id: "pourquoi-tranches",
          question: "Pourquoi le questionnaire ne demande-t-il que des tranches ?",
          answer:
            "Parce que personne ne sait de tête s'il émet 34 ou 41 factures par mois, mais tout le monde sait que c'est entre 20 et 50. Une tranche est donc plus honnête qu'un chiffre précis inventé sur le moment — et elle se répond au pouce, sans ouvrir de logiciel. « Je ne sais pas » est également proposé partout : la tâche correspondante est alors exclue du total plutôt qu'estimée au jugé.",
        },
        {
          id: "que-contient-rapport",
          question: "Que contient le rapport final ?",
          answer:
            "Le temps et l'argent récupérables sur l'année avec leur fourchette, vos cinq premières tâches à automatiser avec pour chacune le volume constaté, le gain annuel et le délai de mise en œuvre, une feuille de route en trois vagues, la ventilation du gain par fonction, et ce qui ne s'automatise pas chez vous. Le rapport a une adresse permanente : vous pouvez le transmettre à votre associé ou à votre expert-comptable.",
        },
        {
          id: "donnees-collectees",
          question: "Mes réponses sont-elles enregistrées ?",
          answer:
            "Non. Le questionnaire et le calcul se déroulent entièrement dans votre navigateur : aucune réponse n'est transmise tant que vous ne demandez pas explicitement à recevoir le rapport par e-mail. Le rapport complet reste visible à l'écran sans rien saisir.",
        },
      ]
    : [
        {
          id: "quelles-taches-automatiser",
          question: "Which tasks should an SME automate first?",
          answer:
            "Those combining high volume, meaningful unit time and low implementation effort. In practice it is almost always the same handful: meeting minutes, quote and unpaid-invoice follow-ups, appointment booking and inbound mail triage. Our simulator ranks them for your company from your real volumes, weighting gain against effort — not raw gain, which would always recommend the heaviest project first.",
        },
        {
          id: "comment-calculer-gains",
          question: "How do you actually calculate the gains of AI automation?",
          answer:
            "Start from the task, not the technology. Count its annual volume, multiply by how long it takes once, then by the share of that time genuinely removable — never all of it, review and decision always remain. You get hours, convertible into euros through the fully-loaded hourly cost. That is exactly the chain our simulator applies, task by task, with every assumption on display.",
        },
        {
          id: "combien-de-temps",
          question: "How long does the simulator take?",
          answer:
            "Two to four minutes depending on your size. The questionnaire adapts: a sole trader answers eight questions, a forty-person firm sixteen. Everything is answered as a range, in one tap, without ever typing a figure — and without signing up.",
        },
        {
          id: "chiffres-exacts",
          question: "Are the simulator's figures real measurements?",
          answer:
            "They are orders of magnitude produced by an estimation model whose assumptions are all published, and where each task shows its own reasoning. They are neither a performance guarantee, nor a quote, nor an audit. For figures grounded in your actual processes, with before and after measurement, that is what the Axion-IA audit is for.",
        },
        {
          id: "pourquoi-tranches",
          question: "Why does the questionnaire only ask for ranges?",
          answer:
            "Because nobody knows off-hand whether they issue 34 or 41 invoices a month, but everyone knows it is between 20 and 50. A range is therefore more honest than a precise figure invented on the spot — and it can be answered with a thumb, without opening any software. “I don't know” is offered everywhere too: the matching task is then excluded from the total rather than guessed.",
        },
        {
          id: "que-contient-rapport",
          question: "What does the final report contain?",
          answer:
            "The time and money recoverable over a year with their range, your first five tasks to automate each with observed volume, annual gain and lead time, a three-wave roadmap, the split of the gain by function, and what cannot be automated in your case. The report has a permanent address: you can pass it to your partner or your accountant.",
        },
        {
          id: "donnees-collectees",
          question: "Are my answers stored?",
          answer:
            "No. The questionnaire and the calculation run entirely in your browser: nothing is transmitted unless you explicitly ask to receive the report by email. The full report stays visible on screen without entering anything.",
        },
      ];

  // ── JSON-LD ───────────────────────────────────────────────────────────────

  const primaryImage = buildPrimaryImageOfPage(PATH);

  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: PATH,
    name: meta.title,
    description: meta.description,
    speakable: true,
    ...(primaryImage ? { extra: { primaryImageOfPage: primaryImage } } : {}),
  });

  const webApplicationJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/${loc}${PATH}#simulateur`,
    name: isFr ? "Simulateur de gains IA" : "AI gains simulator",
    url: `${SITE_URL}/${loc}${PATH}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    browserRequirements: isFr ? "Navigateur récent" : "Modern browser",
    inLanguage: loc,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    provider: { "@id": `${SITE_URL}/#organization` },
    description: isFr
      ? "Établit un diagnostic à partir des volumes réels d'une entreprise et produit un rapport nominatif : premières tâches à automatiser classées par rapport gain/effort, temps et argent récupérables avec fourchette, feuille de route à 30 jours, 3 mois et 6 mois, et limites assumées."
      : "Builds a diagnostic from a company's real volumes and produces a tailored report: first tasks to automate ranked by gain against effort, time and money recoverable with a range, roadmap at 30 days, 3 months and 6 months, and stated limits.",
    featureList: isFr
      ? [
          "Questionnaire adaptatif de 10 à 16 questions",
          `Référentiel de ${AUTOMATABLE_TASKS.length} tâches automatisables`,
          "Classement des priorités par rapport gain / effort",
          "Feuille de route en trois vagues",
          "Fourchette basse et haute par niveau de confiance",
          "Rapport partageable par lien permanent",
        ]
      : [
          "Adaptive questionnaire of 10 to 16 questions",
          `Catalogue of ${AUTOMATABLE_TASKS.length} automatable tasks`,
          "Priorities ranked by gain against effort",
          "Three-wave roadmap",
          "Low and high range by confidence level",
          "Report shareable through a permanent link",
        ],
  } as const;

  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Comment estimer les gains d'une automatisation par l'IA dans son entreprise"
      : "How to estimate the gains of AI automation in your company",
    description: isFr
      ? "Quatre étapes pour obtenir, avec le simulateur Axion-IA, un rapport chiffré des tâches à automatiser en priorité dans votre entreprise."
      : "Four steps to obtain, with the Axion-IA simulator, a costed report of the tasks to automate first in your company.",
    totalTime: "PT4M",
    steps: howItWorks.map((s) => ({ name: s.name, text: s.text })),
  });

  const sectorsItemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Gains de temps IA estimés par secteur d'activité"
      : "Estimated AI time savings by sector",
    items: CLIENT_SECTORS.map((s, i) => ({
      position: i + 1,
      name: s.labelFr,
      url: `${SITE_URL}/${loc}/secteurs/${s.slug}`,
      description: isFr
        ? `Gains de temps IA pour ${s.fullFr}.`
        : `AI time savings for ${s.fullFr}.`,
    })),
  });

  const imageGraphJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: PATH });

  return (
    <>
      <JsonLd data={webPageJsonLd} />
      <JsonLd data={webApplicationJsonLd} />
      <JsonLd data={howToJsonLd} />
      <JsonLd data={sectorsItemListJsonLd} />
      {imageGraphJsonLd ? <JsonLd data={imageGraphJsonLd} /> : null}
      <JsonLd data={buildFaqSpeakableJsonLd({ items: faqItems, dateModified: MODEL_REVISED_AT })} />

      <div className="bg-halo-warm">
        <Container className="pt-6">
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </div>

      {/* ── HÉRO ─────────────────────────────────────────────────────────── */}
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Simulateur de gains · gratuit, sans inscription" : "Gains simulator · free, no sign-up"}
        title={isFr ? "Quelles tâches votre entreprise" : "Which tasks should your company"}
        titleEm={isFr ? "doit automatiser" : "automate"}
        titleTail={isFr ? " en premier ?" : " first?"}
        description={
          isFr
            ? "Dix questions sur vos volumes réels — devis, factures, appels, comptes-rendus — et vous repartez avec un rapport nominatif : vos cinq premières tâches à automatiser, le temps et l'argent récupérables, et le calendrier pour y arriver."
            : "Ten questions about your real volumes — quotes, invoices, calls, minutes — and you leave with a tailored report: your first five tasks to automate, the time and money recoverable, and the schedule to get there."
        }
        media={
          heroImage ? (
            <figure>
              <Image
                src={heroImage.src}
                alt={isFr ? heroImage.altFr : heroImage.altEn}
                width={heroImage.width}
                height={heroImage.height}
                priority
                sizes="(max-width: 1024px) 100vw, 48vw"
                className="mx-auto h-auto w-full max-w-[520px] rounded-2xl"
              />
              <UnsplashCredit
                photographerName={creditFor(heroImage.src)?.photographer}
                photographerUrl={creditFor(heroImage.src)?.photographerUrl}
                className="text-center text-[11px]"
              />
            </figure>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            <Cta href="#simulateur" variant="primary" size="lg" track="roi-hero-simulateur">
              {isFr ? "Commencer le diagnostic" : "Start the diagnostic"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" track="roi-hero-audit">
              {isFr ? "Faire mesurer sur mes process" : "Measure on my processes"}
            </Cta>
          </div>
          <ul role="list" className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {heroChips.map((chip) => (
              <li key={chip.label} className="text-fg-soft inline-flex items-center gap-2 text-sm">
                <chip.icon aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{chip.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── LE SIMULATEUR ────────────────────────────────────────────────── */}
      <Section id="simulateur" tone="canvas">
        <Container className="max-w-2xl">
          <SimulatorFlow
            locale={loc}
            initialAnswers={initialAnswers}
            initialShowReport={initialShowReport}
          />
        </Container>
      </Section>

      {/* ── BANDEAU ──────────────────────────────────────────────────────── */}
      {bannerImage ? (
        <Container className="pt-12 md:pt-16">
          <figure>
            <Image
              src={bannerImage.src}
              alt={isFr ? bannerImage.altFr : bannerImage.altEn}
              width={bannerImage.width}
              height={bannerImage.height}
              sizes="(max-width: 1366px) 100vw, 1366px"
              loading="lazy"
              className="shadow-card h-auto w-full rounded-2xl"
            />
            <figcaption className="text-fg-muted mt-3 text-[13px] leading-snug">
              {isFr
                ? "Le temps rendu ne disparaît pas : il retourne au conseil, à la relation client, au travail de fond."
                : "The time returned doesn't vanish: it goes back to advisory work, client relationships, deep work."}
              <UnsplashCredit
                photographerName={creditFor(bannerImage.src)?.photographer}
                photographerUrl={creditFor(bannerImage.src)?.photographerUrl}
                className="text-[11px]"
              />
            </figcaption>
          </figure>
        </Container>
      ) : null}

      {/* ── MODE D'EMPLOI (miroir visible du HowTo JSON-LD) ──────────────── */}
      <Section
        id="mode-emploi"
        tone="paper"
        eyebrow={isFr ? "Mode d'emploi" : "How it works"}
        title={isFr ? "Quatre étapes," : "Four steps,"}
        titleEm={isFr ? "trois minutes" : "three minutes"}
        description={
          isFr
            ? "Le simulateur ne vous demande rien que vous ne sachiez déjà sur votre entreprise. Aucun chiffre à taper : tout se répond par tranche, en un appui."
            : "The simulator asks nothing you don't already know about your company. No figure to type: everything is answered as a range, in one tap."
        }
      >
        <ol role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-4 lg:grid-cols-4">
          {howItWorks.map((s, i) => (
            <li
              key={s.name}
              id={`step-${i + 1}`}
              className="border-border bg-canvas shadow-subtle flex h-full flex-col gap-2.5 rounded-2xl border p-5"
            >
              <div className="flex items-center gap-2.5">
                <span className="bg-terracotta/10 text-terracotta inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <s.icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="text-fg-muted text-[12px] font-bold tracking-[0.16em] uppercase tabular-nums">
                  {isFr ? "Étape" : "Step"} {i + 1}
                </span>
              </div>
              <h3 className="text-fg text-[15px] leading-tight font-semibold tracking-tight">
                {s.name}
              </h3>
              <p className="text-fg-soft text-[13px] leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── MODÈLE D'ESTIMATION (E-E-A-T) ────────────────────────────────── */}
      <Section
        id="methodologie"
        tone="sand"
        eyebrow={isFr ? "Transparence" : "Transparency"}
        title={isFr ? "Notre modèle" : "Our estimation"}
        titleEm={isFr ? "d'estimation, à découvert" : "model, in the open"}
        description={
          isFr
            ? "Un simulateur qui cache ses hypothèses ne vaut rien. Voici exactement ce que le nôtre suppose, et ce qu'il ne prétend pas savoir."
            : "A simulator that hides its assumptions is worthless. Here is exactly what ours assumes, and what it doesn't claim to know."
        }
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_1fr]">
          <dl className="border-border divide-border divide-y border-y">
            {assumptions.map((a) => (
              <div key={a.term} className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[1fr_auto]">
                <dt className="text-fg text-[15px] font-semibold tracking-tight">{a.term}</dt>
                <dd className="text-terracotta-deep order-first text-lg font-bold tabular-nums sm:order-none sm:text-right sm:text-base">
                  {a.value}
                </dd>
                <p className="text-fg-soft text-[13px] leading-relaxed sm:col-span-2">{a.note}</p>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-5">
            <div className="border-terracotta/30 bg-paper shadow-subtle rounded-2xl border-2 p-6">
              <h3 className="text-fg text-base font-bold tracking-tight">
                {isFr ? "Ce que ce simulateur n'est pas" : "What this simulator is not"}
              </h3>
              <ul role="list" className="mt-3 flex flex-col gap-2.5">
                {(isFr
                  ? [
                      "Ce n'est pas une étude : nous ne publions aucun panel d'entreprises mesurées.",
                      "Ce n'est pas un engagement de résultat : vos gains dépendent de votre adoption interne.",
                      "Ce n'est pas un devis : aucun prix n'est établi sans étude de votre contexte.",
                      "Ce n'est pas un audit : il repose sur ce que vous déclarez, pas sur des mesures.",
                    ]
                  : [
                      "It is not a study: we publish no panel of measured companies.",
                      "It is not a performance guarantee: your gains depend on internal adoption.",
                      "It is not a quote: no price is set without studying your context.",
                      "It is not an audit: it rests on what you declare, not on measurements.",
                    ]
                ).map((item) => (
                  <li
                    key={item}
                    className="text-fg-soft flex items-start gap-2.5 text-[13px] leading-relaxed"
                  >
                    <span
                      aria-hidden="true"
                      className="text-terracotta mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-halo-warm border-border rounded-2xl border p-6">
              <p className="text-fg text-[15px] leading-relaxed" data-speakable data-answer>
                {isFr
                  ? "Pour obtenir un chiffrage réel, il faut mesurer vos process avant et après. C'est précisément ce que fait l'audit Axion-IA : un relevé des tâches, une mesure du temps passé, puis un plan d'implémentation chiffré."
                  : "To get real figures, your processes must be measured before and after. That is precisely what the Axion-IA audit does: a task inventory, a measurement of time spent, then a costed implementation plan."}
              </p>
              <Cta
                href="/audit"
                variant="primary"
                size="md"
                className="mt-4"
                track="roi-metho-audit"
              >
                {isFr ? "Découvrir l'audit" : "Discover the audit"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTEURS ─────────────────────────────────────────────────────── */}
      <Section
        id="secteurs"
        eyebrow={isFr ? "Par secteur" : "By sector"}
        title={isFr ? "Les gains ne tombent pas" : "Gains don't land"}
        titleEm={isFr ? "au même endroit" : "in the same place"}
        description={
          isFr
            ? "Un cabinet juridique gagne surtout sur la recherche documentaire ; un cabinet comptable, sur le rapprochement d'écritures. Le simulateur ajuste les temps et les tâches à votre métier — explorez aussi la page dédiée au vôtre."
            : "A law firm mostly gains on documentary research; an accounting firm, on reconciling entries. The simulator adjusts times and tasks to your trade — explore the page dedicated to yours as well."
        }
      >
        <ul
          role="list"
          className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5"
        >
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/secteurs/${s.slug}` as never}
                className="shadow-subtle hover:shadow-elevated group bg-paper flex h-full flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={`/illustrations/secteurs/${s.slug}.avif`}
                    alt={
                      isFr
                        ? `Gains de temps grâce à l'IA pour ${s.fullFr} — Axion-IA`
                        : `AI time savings for ${s.fullFr} — Axion-IA`
                    }
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, (min-width: 479px) 50vw, 100vw"
                    loading="lazy"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span
                    aria-hidden="true"
                    className="bg-paper/90 shadow-subtle absolute top-2.5 left-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-base"
                  >
                    {s.emoji}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <span className="text-fg text-sm font-semibold tracking-tight">{s.labelFr}</span>
                  <span className="text-terracotta mt-auto text-[13px] font-medium">
                    {isFr ? "Voir →" : "See →"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── ENGAGEMENT FONDATEUR ─────────────────────────────────────────── */}
      {portraitImage ? (
        <Section id="engagement" tone="mocha">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <Image
              src={portraitImage.src}
              alt={isFr ? portraitImage.altFr : portraitImage.altEn}
              width={portraitImage.width}
              height={portraitImage.height}
              sizes="(max-width: 1024px) 60vw, 30vw"
              loading="lazy"
              className="mx-auto h-auto w-full max-w-[280px] rounded-2xl object-cover"
            />
            <figure className="flex flex-col gap-4">
              <Quote aria-hidden="true" className="text-terracotta h-8 w-8" />
              <blockquote
                className="text-mocha-fg text-lg leading-relaxed font-medium md:text-xl"
                data-speakable
              >
                {isFr
                  ? "« La plupart des calculateurs de ROI vous demandent d'inventer le chiffre qui sert ensuite à vous impressionner. J'ai préféré ne demander que ce que vous savez, et vous dire aussi ce qui ne s'automatise pas. Un outil qui sait dire non est le seul qu'on croit quand il dit oui. »"
                  : "“Most ROI calculators ask you to invent the very figure they then use to impress you. I chose to ask only what you know, and to tell you what cannot be automated too. A tool that can say no is the only one you believe when it says yes.”"}
              </blockquote>
              <figcaption className="text-mocha-fg/80 text-sm">
                {isFr
                  ? "Williams — Fondateur d'Axion-IA, auteur du modèle d'estimation"
                  : "Williams — Founder of Axion-IA, author of the estimation model"}
              </figcaption>
            </figure>
          </div>
        </Section>
      ) : null}

      {/* ── VILLES (GEO / maillage) ──────────────────────────────────────── */}
      <Section
        id="villes"
        tone="sand"
        eyebrow={isFr ? "Partout en France" : "Across France"}
        title={isFr ? "Faites gagner du temps à vos équipes," : "Save your teams time,"}
        titleEm={isFr ? "près de chez vous" : "near you"}
        description={
          isFr
            ? "Nous formons vos équipes en présentiel dans toute la France. Trouvez votre ville :"
            : "We train your teams in person across France. Find your city:"
        }
      >
        <ul role="list" className="flex flex-wrap gap-x-2 gap-y-2.5">
          {villes.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/formations/par-ville/${v.slug}` as never}
                className="text-fg-soft bg-canvas border-border hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition"
              >
                {isFr ? `Formation IA ${v.nameFr}` : `AI training ${v.nameFr}`}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── FAQ (rendue — le FAQPage JSON-LD est émis plus haut) ─────────── */}
      <Section
        id="faq"
        eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
        title={isFr ? "Vos questions sur" : "Your questions about"}
        titleEm={isFr ? "l'estimation des gains" : "estimating the gains"}
      >
        <div className="max-w-3xl">
          <FaqAccordion items={faqItems} emitJsonLd={false} />
        </div>
      </Section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        tone="mocha"
        eyebrow={isFr ? "Aller plus loin" : "Go further"}
        title={isFr ? "Passez de l'estimation" : "Move from an estimate"}
        titleEm={isFr ? "à la mesure" : "to a measurement"}
        description={
          isFr
            ? "L'audit Axion-IA relève vos tâches réelles, mesure le temps qu'elles coûtent et livre un plan d'implémentation chiffré. Ce n'est plus une hypothèse : c'est votre entreprise."
            : "The Axion-IA audit inventories your actual tasks, measures the time they cost and delivers a costed implementation plan. No longer an assumption: your company."
        }
        cta={
          <>
            <Cta href="/audit" variant="primary" size="xl" track="roi-final-audit">
              {isFr ? "Demander un audit" : "Request an audit"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/appel" variant="outline" size="xl" track="roi-final-appel">
              {isFr ? "Réserver un appel" : "Book a call"}
            </Cta>
          </>
        }
      />
    </>
  );
}
