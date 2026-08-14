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
// ⚠️ Les chiffres restent des HYPOTHÈSES DE MODÈLE, jamais une étude. Le bloc
// « Le modèle, à découvert » les expose, et chaque tâche du rapport porte sa
// propre justification. Ne pas réintroduire de formulation du type « observé
// sur N entreprises » sans étude publiable : art. L121-2 du Code de la
// consommation.
//
// ── Coupe du 2026-08-14 : la page passe au format tunnel ──────────────────
// Will, après lecture mobile : « la page a trop de texte, je veux exactement le
// même niveau et le même design que les pages des autres tunnels de vente ».
// Cinq sections éditoriales ont été retirées — photo d'en-tête isolée, mode
// d'emploi en quatre cartes, tableau détaillé des hypothèses, portrait du
// fondateur, cartes illustrées des secteurs. La page passait ~17 000 px ; il
// en reste ~5 000.
//
// 🔴 Ce qui est CONSERVÉ, et pourquoi on ne le recoupe pas :
//   - les 4 « ce que ce simulateur n'est pas » : ce sont les mentions qui
//     tiennent la promesse commerciale à distance d'un engagement de résultat
//     (obligation de MOYENS, cf. CGV). Elles ne sont pas du décor éditorial ;
//   - les 7 hypothèses du modèle, repliées dans un accordéon CSS : un
//     simulateur qui cache ses hypothèses ne vaut rien, mais elles n'ont pas
//     à retarder la première question. Repliées, elles pèsent une ligne à
//     l'écran et restent entières dans le DOM, donc indexées ;
//   - la FAQ et le maillage secteurs / villes : c'est ce qui fait que `/roi`
//     est la seule des trois pages de tunnel à être indexée. `/simulateur` et
//     `/diagnostic` sont `noindex` : si `/roi` perd son contenu, plus aucune
//     des trois n'existe pour Google.
//
// Server Component pur ; seul `SimulatorFlow` porte du JS. L'accordéon des
// hypothèses réutilise `FaqAccordion`, qui est en `<details>/<summary>` pur :
// zéro octet ajouté au First Load JS.

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, ListChecks, Route, ShieldCheck } from "lucide-react";
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
  // Plus de `portrait` : la citation du fondateur a été retirée avec la coupe du
  // 2026-08-14, et l'entrée correspondante a quitté le manifeste `/roi` — le
  // sitemap images ne déclare que des images RÉELLEMENT affichées.
  const villes = getVillesIndexableNow().slice(0, 60);

  const creditFor = (src: string) => {
    const slot = src.split("/").pop()?.replace(".avif", "") ?? "";
    return ROI_PHOTO_CREDITS[slot];
  };

  const breadcrumbItems = [{ href: PATH, label: isFr ? "Simulateur de gains" : "Gains simulator" }];

  // ── Contenu ───────────────────────────────────────────────────────────────

  const heroChips = [
    {
      icon: ListChecks,
      label: isFr ? "Vos premières tâches à automatiser" : "Your first tasks to automate",
    },
    { icon: Clock, label: isFr ? "Temps et argent récupérables" : "Time and money recoverable" },
    {
      icon: Route,
      label: isFr ? "Feuille de route 30 j / 3 mois / 6 mois" : "Roadmap 30 d / 3 mo / 6 mo",
    },
    { icon: ShieldCheck, label: isFr ? "Ce qui ne s'automatise pas" : "What cannot be automated" },
  ] as const;

  // Hypothèses du modèle — E-E-A-T. Lues depuis le SSOT, jamais recopiées.
  //
  // Rendues dans un accordéon replié (`FaqAccordion`, CSS pur) et non plus dans
  // un tableau de définitions déployé : elles occupaient à elles seules un écran
  // et demi sur mobile. Repliées, elles pèsent sept lignes — et le contenu reste
  // entier dans le DOM, donc lisible par un moteur comme par un lecteur d'écran.
  const assumptions = isFr
    ? [
        {
          id: "referentiel",
          question: `Tâches au référentiel — ${AUTOMATABLE_TASKS.length}`,
          answer:
            "Chaque tâche porte son temps unitaire de référence, la part de ce temps réellement supprimable, son délai de mise en œuvre et la justification de ce taux. Rien n'est agrégé sans être traçable.",
        },
        {
          id: "part-supprimable",
          question: `Part supprimable la plus élevée — ${Math.round(Math.max(...AUTOMATABLE_TASKS.map((t) => t.automationRate)) * 100)} %`,
          answer:
            "Jamais 100 %. Il reste toujours la relecture, la décision et l'envoi. Les tâches qui engagent votre responsabilité plafonnent bien plus bas.",
        },
        {
          id: "journee",
          question: `Journée de travail — ${ROI_MODEL_CONSTANTS.hoursPerDay} h`,
          answer: "Durée légale française : 35 heures hebdomadaires réparties sur 5 jours.",
        },
        {
          id: "jours-ouvres",
          question: `Jours ouvrés — ${ROI_MODEL_CONSTANTS.workingDaysPerYear} / an`,
          answer:
            "Hors congés payés et RTT. Les volumes hebdomadaires sont annualisés sur 44 semaines ouvrées.",
        },
        {
          id: "etp",
          question: `Équivalent temps plein — ${ROI_MODEL_CONSTANTS.annualHoursPerFte.toLocaleString("fr-FR")} h / an`,
          answer:
            "Durée légale annuelle du travail en France. Sert de dénominateur au calcul d'ETP récupérés.",
        },
        {
          id: "maturite",
          question: `Maturité numérique — ${MATURITY_LEVELS.length} niveaux`,
          answer:
            "Vos outils actuels modulent le gain et le délai. Une entreprise encore sur papier récupère moins vite — mais elle peut lancer les mêmes actions immédiates.",
        },
        {
          id: "plafond",
          question: "Plafond de vraisemblance — 60 %",
          answer:
            "Les tâches du référentiel ne peuvent jamais représenter plus de 60 % de la capacité de votre équipe. Au-delà, l'estimation est réduite : le reste de la journée part dans votre métier, les déplacements et les imprévus.",
        },
      ]
    : [
        {
          id: "referentiel",
          question: `Tasks in the catalogue — ${AUTOMATABLE_TASKS.length}`,
          answer:
            "Each task carries its reference unit time, the share of that time genuinely removable, its lead time and the reasoning behind that rate. Nothing is aggregated without being traceable.",
        },
        {
          id: "part-supprimable",
          question: `Highest removable share — ${Math.round(Math.max(...AUTOMATABLE_TASKS.map((t) => t.automationRate)) * 100)} %`,
          answer:
            "Never 100 %. Review, decision and sending always remain. Tasks that engage your liability cap far lower.",
        },
        {
          id: "journee",
          question: `Working day — ${ROI_MODEL_CONSTANTS.hoursPerDay} h`,
          answer: "French statutory duration: 35 hours a week over 5 days.",
        },
        {
          id: "jours-ouvres",
          question: `Working days — ${ROI_MODEL_CONSTANTS.workingDaysPerYear} / year`,
          answer:
            "Excluding paid leave and RTT. Weekly volumes are annualised over 44 working weeks.",
        },
        {
          id: "etp",
          question: `Full-time equivalent — ${ROI_MODEL_CONSTANTS.annualHoursPerFte.toLocaleString("en-GB")} h / year`,
          answer: "French statutory annual working time. Denominator for the FTE-recovered figure.",
        },
        {
          id: "maturite",
          question: `Digital maturity — ${MATURITY_LEVELS.length} levels`,
          answer:
            "Your current tools modulate both gain and lead time. A paper-based company recovers more slowly — but it can start the same immediate actions.",
        },
        {
          id: "plafond",
          question: "Plausibility ceiling — 60 %",
          answer:
            "Catalogued tasks can never represent more than 60 % of your team's capacity. Beyond that the estimate is scaled down: the rest of the day goes to your actual trade, travel and the unexpected.",
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

  // 🔴 Le `HowTo` a été RETIRÉ avec la section « Mode d'emploi » qui en était le
  // miroir visible, pas oublié. Un balisage structuré doit décrire ce que la
  // page affiche : garder les quatre étapes en JSON-LD alors qu'aucune n'est
  // plus rendue serait exactement le cas que Google qualifie de contenu
  // structuré non visible, sanctionné par l'ignorance de tout le balisage de la
  // page. Si le mode d'emploi revient un jour à l'écran, `buildHowToJsonLd`
  // existe toujours et se réimporte en une ligne.

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
      <JsonLd data={sectorsItemListJsonLd} />
      {imageGraphJsonLd ? <JsonLd data={imageGraphJsonLd} /> : null}
      <JsonLd data={buildFaqSpeakableJsonLd({ items: faqItems, dateModified: MODEL_REVISED_AT })} />

      <div className="bg-halo-warm">
        <Container className="pt-6">
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </div>

      {/* ── HÉRO ─────────────────────────────────────────────────────────── */}
      {/* ── L'OUTIL EN TÊTE, DANS LE MÊME HABIT QUE LE TUNNEL ───────────
          Avant le 2026-08-14, cette page ouvrait sur un en-tête complet —
          titre en trois lignes, photo, deux boutons, liste de gages — et le
          simulateur n'arrivait qu'en DEUXIÈME section. Sur un téléphone,
          l'outil n'était visible sur aucun écran d'accueil : il fallait faire
          défiler pour découvrir qu'il existait, sur une page de 17 000 px.
          Le visiteur venu de Google repartait avant.

          Désormais l'outil EST l'accueil, et il porte l'habit sombre des pages
          de tunnel (`tone="mocha"`, le ton sombre natif du site + le thème
          sombre du questionnaire). Le contenu de référencement suit dessous —
          il reste indispensable pour que la page se positionne, mais il ne
          bloque plus l'accès à l'outil. */}
      {/* Rembourrage vertical resserré : le gabarit de section applique
          `py-24` sur mobile, soit 96 px perdus en haut d'un écran de 664 px
          avant même le premier mot. Sur cette page l'objectif est que la
          première QUESTION soit visible sans défiler. */}
      {/* 🔴 `.bg-vsl` et NON `tone="mocha"`. Les deux sont sombres, mais pas de
          la même façon : `bg-mocha-rich` est le brun du site, plus clair, et le
          commentaire de `globals.css` le dit — « `.bg-vsl` est plus sombre que
          `.bg-mocha-rich` ». `.bg-vsl` porte l'encre `--color-ink` et les deux
          halos qui font l'identité des pages `/diagnostic` et `/simulateur`.
          Un visiteur qui passe d'une page à l'autre doit reconnaître le même
          endroit : c'est tout l'objet. On sort donc du gabarit `Section` pour
          reprendre EXACTEMENT le motif des pages de tunnel. */}
      <section id="simulateur" className="bg-vsl scroll-mt-24 pt-8 pb-16 sm:pt-10 sm:pb-20">
        <Container className="max-w-2xl">
          {/* Typographie alignée sur `/simulateur` et `/diagnostic` : 28 px sur
              mobile, sans empattement, interlignage serré. Le grand titre serif
              du site prenait trois lignes et repoussait l'outil hors de
              l'écran. */}
          <h1 className="text-mocha-fg text-[28px] leading-[1.12] font-bold tracking-tight text-balance sm:text-[36px]">
            {isFr ? (
              <>
                Quelles tâches votre entreprise{" "}
                <em className="text-terracotta-on-mocha not-italic">doit automatiser</em> en premier
                ?
              </>
            ) : (
              <>
                Which tasks should your company{" "}
                <em className="text-terracotta-on-mocha not-italic">automate</em> first?
              </>
            )}
          </h1>

          {/* 🔴 Intro d'UNE ligne, reprise mot pour mot de `/simulateur`.
              La version longue — « vos cinq premières tâches, le temps et
              l'argent récupérables, et le calendrier pour y arriver » — tenait
              en quatre lignes sur mobile et repoussait d'autant la première
              question. Sur une page dont le seul travail est de faire
              commencer le questionnaire, tout ce qui précède la première
              question est du temps pendant lequel on peut perdre le visiteur.
              Le détail du modèle est déjà repris plus bas, où il rassure ceux
              qui le cherchent sans retarder ceux qui veulent commencer. */}
          <p className="text-mocha-fg-muted mt-3 text-[16px] leading-relaxed text-pretty">
            {isFr
              ? "Une dizaine de questions sur vos volumes réels. Trois minutes, sans inscription."
              : "A dozen questions about your real volumes. Three minutes, no sign-up."}
          </p>

          {/* Même cadre bordé que dans le tunnel : il détache le questionnaire
              du fond et signale « ici, on agit ». Sans lui, l'outil flottait
              sur l'encre et se confondait avec le texte. */}
          <div className="border-border-on-mocha bg-mocha/40 mt-6 rounded-3xl border p-5 sm:p-8">
            <SimulatorFlow
              locale={loc}
              initialAnswers={initialAnswers}
              initialShowReport={initialShowReport}
              tone="dark"
            />
          </div>

          {/* Les gages descendent SOUS l'outil : avant, ils s'intercalaient
              entre le titre et le questionnaire et retardaient la première
              question de plusieurs centaines de pixels. */}
          <ul
            role="list"
            className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-6"
          >
            {heroChips.map((chip) => (
              <li
                key={chip.label}
                className="text-mocha-fg/75 inline-flex items-center gap-2 text-sm"
              >
                <chip.icon
                  aria-hidden="true"
                  className="text-terracotta-on-mocha h-4 w-4 shrink-0"
                  strokeWidth={2}
                />
                <span>{chip.label}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>
      {/* ── PHOTO REPRÉSENTATIVE + RENVOI VERS L'AUDIT ───────────────────
          Une seule photo ici, et c'est celle marquée `representativeOfPage`
          dans le manifeste : c'est elle qui sert d'`og:image` et de
          `primaryImageOfPage`. Une image annoncée dans le balisage mais absente
          de la page est un mensonge structuré — on la garde donc à l'écran,
          compacte, plutôt que de la retirer du manifeste. */}
      {heroImage ? (
        <Section tone="canvas" className="py-12 sm:py-14 lg:py-16">
          <Container className="max-w-2xl">
            <figure>
              <Image
                src={heroImage.src}
                alt={isFr ? heroImage.altFr : heroImage.altEn}
                width={heroImage.width}
                height={heroImage.height}
                sizes="(max-width: 640px) 100vw, 520px"
                className="mx-auto h-auto w-full max-w-[520px] rounded-2xl"
              />
              <UnsplashCredit
                photographerName={creditFor(heroImage.src)?.photographer}
                photographerUrl={creditFor(heroImage.src)?.photographerUrl}
                className="text-center text-[11px]"
              />
            </figure>
            <div className="mt-6 flex justify-center">
              <Cta href="/audit" variant="outline" size="lg" track="roi-hero-audit">
                {isFr ? "Faire mesurer sur mes process" : "Measure on my processes"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* ── LE MODÈLE, À DÉCOUVERT ───────────────────────────────────────
          Ce qui reste du chapitre « Notre modèle d'estimation » : une phrase,
          les quatre mentions qui bornent la promesse, et les sept hypothèses
          repliées. Le tableau de définitions déployé occupait un écran et demi
          sur mobile pour une information que presque personne ne lit avant
          d'avoir vu son résultat — mais que tout le monde doit pouvoir
          retrouver. */}
      <Section
        id="methodologie"
        tone="sand"
        className="py-16 sm:py-20 lg:py-24"
        eyebrow={isFr ? "Transparence" : "Transparency"}
        title={isFr ? "Le modèle," : "The model,"}
        titleEm={isFr ? "à découvert" : "in the open"}
        description={
          isFr
            ? "Un simulateur qui cache ses hypothèses ne vaut rien. Voici ce que le nôtre suppose, et ce qu'il ne prétend pas savoir."
            : "A simulator that hides its assumptions is worthless. Here is what ours assumes, and what it doesn't claim to know."
        }
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          {/* 🔴 Ces quatre lignes ne sont pas de l'habillage éditorial : ce sont
              elles qui maintiennent l'estimation du côté de l'obligation de
              MOYENS. Les retirer ferait du simulateur une promesse chiffrée. */}
          <div className="border-terracotta/30 bg-paper shadow-subtle rounded-2xl border-2 p-5 sm:p-6">
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
            <p className="text-fg mt-5 text-[15px] leading-relaxed" data-speakable data-answer>
              {isFr
                ? "Pour un chiffrage réel, il faut mesurer vos process avant et après. C'est l'objet de l'audit Axion-IA : relevé des tâches, mesure du temps passé, plan d'implémentation chiffré."
                : "For real figures, your processes must be measured before and after. That is what the Axion-IA audit does: a task inventory, a measurement of time spent, a costed implementation plan."}
            </p>
            <Cta href="/audit" variant="primary" size="md" className="mt-4" track="roi-metho-audit">
              {isFr ? "Découvrir l'audit" : "Discover the audit"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
          </div>

          {/* Accordéon `<details>` pur — aucun octet de JS ajouté. Replié, il
              tient en sept lignes ; déplié, il livre exactement ce que le
              tableau livrait avant. */}
          <div>
            <h3 className="text-fg text-base font-bold tracking-tight">
              {isFr ? "Les hypothèses, une par une" : "The assumptions, one by one"}
            </h3>
            <FaqAccordion items={assumptions} emitJsonLd={false} className="mt-1" />
          </div>
        </div>
      </Section>

      {/* ── BANDEAU ──────────────────────────────────────────────────────── */}
      {bannerImage ? (
        <Container className="pt-10 md:pt-12">
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

      {/* ── FAQ (rendue — le FAQPage JSON-LD est émis plus haut) ─────────── */}
      <Section
        id="faq"
        className="py-16 sm:py-20 lg:py-24"
        eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
        title={isFr ? "Vos questions sur" : "Your questions about"}
        titleEm={isFr ? "l'estimation des gains" : "estimating the gains"}
      >
        <div className="max-w-3xl">
          <FaqAccordion items={faqItems} emitJsonLd={false} />
        </div>
      </Section>

      {/* ── MAILLAGE : SECTEURS ET VILLES ────────────────────────────────
          Les dix secteurs étaient rendus en cartes illustrées, les soixante
          villes en pastilles : deux traitements pour la même chose, et la
          grille de photos pesait à elle seule plus d'un écran. Un seul
          traitement désormais, en pastilles — le maillage interne (les ~70
          liens qui font vivre cette page dans l'index) est intact, l'encombrement
          divisé. */}
      <Section
        id="ou-aller"
        tone="sand"
        className="py-16 sm:py-20 lg:py-24"
        eyebrow={isFr ? "Aller au précis" : "Get specific"}
        title={isFr ? "Les gains ne tombent pas" : "Gains don't land"}
        titleEm={isFr ? "au même endroit" : "in the same place"}
        description={
          isFr
            ? "Un cabinet juridique gagne surtout sur la recherche documentaire ; un cabinet comptable, sur le rapprochement d'écritures. Le simulateur ajuste les temps à votre métier — et nous formons vos équipes en présentiel partout en France."
            : "A law firm mostly gains on documentary research; an accounting firm, on reconciling entries. The simulator adjusts times to your trade — and we train your teams in person across France."
        }
      >
        <h3 className="text-fg-muted text-[12px] font-bold tracking-[0.16em] uppercase">
          {isFr ? "Par secteur" : "By sector"}
        </h3>
        <ul role="list" className="mt-3 flex flex-wrap gap-2">
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/secteurs/${s.slug}` as never}
                className="text-fg-soft bg-canvas border-border hover:border-terracotta hover:text-terracotta inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition"
              >
                <span aria-hidden="true">{s.emoji}</span>
                {s.labelFr}
              </Link>
            </li>
          ))}
        </ul>

        {/* 🔴 Les soixante villes sont REPLIÉES, pas réduites. Déployées, elles
            occupaient à elles seules trois écrans de téléphone — soit un tiers
            de la page — pour soixante libellés quasi identiques. Repliées, elles
            tiennent en une ligne, et les soixante liens restent dans le DOM :
            `<details>` masque visuellement, il ne retire rien du document, donc
            le maillage interne est intact pour les moteurs comme pour un lecteur
            d'écran. Ne pas remplacer par un rendu conditionnel en JS, qui lui
            supprimerait vraiment les liens. */}
        <details className="group border-border mt-8 border-t">
          <summary className="text-fg flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-medium">
            <span>
              {isFr
                ? `Formations en présentiel dans ${villes.length} villes`
                : `In-person training in ${villes.length} cities`}
            </span>
            <span
              aria-hidden="true"
              className="text-fg-muted shrink-0 text-xl leading-none transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <ul role="list" className="flex flex-wrap gap-2 pb-2">
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
        </details>
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
