// Page-outil « Simulateur de gains IA » (/roi) — refonte 2026-07-09.
//
// Trois défauts corrigés par rapport à la version précédente :
//   1. Les deux visuels étaient des `IllustrationPlaceholder` : la production
//      affichait des cadres pointillés portant l'ID de slot et le nom du fichier
//      cible. Remplacés par de vraies photos curées (`page-images.ts` → SSOT).
//   2. Un `FAQPage` JSON-LD était émis alors qu'AUCUNE FAQ n'était rendue.
//      Structured data sans contenu visible = violation des règles Google.
//      La FAQ est désormais affichée (`FaqAccordion`, `emitJsonLd={false}` pour
//      qu'un seul nœud FAQPage existe : celui, speakable, émis ici).
//   3. Le simulateur ne prenait que 2 curseurs. Il porte maintenant le secteur,
//      le scénario d'adoption, la ventilation par famille de tâches et une
//      valorisation financière optionnelle.
//
// ⚠️ Les chiffres affichés sont des HYPOTHÈSES DE MODÈLE, jamais une étude. La
// section « Notre modèle d'estimation » les expose intégralement. Ne pas
// réintroduire de formulation du type « observé sur N entreprises » sans étude
// publiable : article L121-2 du Code de la consommation.
//
// Server Component pur ; seuls `RoiSimulator` et `StickyMobileCta` portent du JS.

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Clock,
  FileText,
  Gauge,
  MousePointerClick,
  PenLine,
  Quote,
  Search,
  SlidersHorizontal,
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
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { RoiSimulator, type RoiSimulatorLabels } from "@/components/roi/RoiSimulator";
import { ADOPTION_EFFICIENCY, ROI_CONSTANTS } from "@/components/roi/compute";
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
}

const PATH = "/roi";

/** Date de dernière révision éditoriale du modèle — alimente `dateModified`. */
const MODEL_REVISED_AT = "2026-07-09T00:00:00.000Z";

// Le bloc « villes » suit la cohorte indexable, qui s'élargit avec le temps.
export const revalidate = 3600;

function metaFor(isFr: boolean) {
  return {
    title: isFr
      ? "Simulateur de gains IA · combien d'heures votre équipe gagnera · Axion-IA"
      : "AI gains simulator · how many hours your team will save · Axion-IA",
    description: isFr
      ? "Combien d'heures votre équipe gagnera-t-elle après une formation IA ? Choisissez votre secteur, votre effectif et votre scénario d'adoption : heures rendues, jours libérés, ETP récupérés, et valeur financière si vous le souhaitez. Modèle d'estimation transparent."
      : "How many hours will your team save after an AI training? Pick your sector, headcount and adoption scenario: hours freed, days returned, FTE recovered, and the financial value if you want it. Transparent estimation model.",
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const { title, description } = metaFor(locale === "fr");
  return buildProductMetadata({ locale, path: PATH, title, description });
}

export default async function RoiPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const meta = metaFor(isFr);

  const pageImages = getPageImages(PATH);
  const heroImage = pageImages.find((i) => i.slot === "hero");
  const bannerImage = pageImages.find((i) => i.slot === "banner");
  const taskImages = pageImages.filter((i) => i.slot === "grid");
  const portraitImage = pageImages.find((i) => i.slot === "portrait");
  const villes = getVillesIndexableNow().slice(0, 60);

  // Crédit photographe par fichier (CGU Unsplash §9). Clé = basename du slot.
  // Le portrait du fondateur n'est pas une photo Unsplash → pas de crédit.
  const creditFor = (src: string) => {
    const slot = src.split("/").pop()?.replace(".avif", "") ?? "";
    return ROI_PHOTO_CREDITS[slot];
  };

  const breadcrumbItems = [{ href: PATH, label: isFr ? "Simulateur de gains" : "Gains simulator" }];

  // ── Contenu ───────────────────────────────────────────────────────────────

  const heroChips = [
    { icon: Clock, label: isFr ? "Heures rendues / jour" : "Hours freed / day" },
    { icon: Calendar, label: isFr ? "Jours libérés / mois" : "Days freed / month" },
    { icon: Users, label: isFr ? "ETP récupérés / an" : "FTE recovered / year" },
    { icon: Gauge, label: isFr ? "Modèle transparent" : "Transparent model" },
  ] as const;

  const simulatorLabels: RoiSimulatorLabels = isFr
    ? {
        intro:
          "Choisissez votre secteur, votre effectif et le scénario d'adoption qui vous ressemble. Le résultat s'affiche en heures, en jours et en équivalents temps plein — pas en jargon.",
        sector: "Votre secteur d'activité",
        sectorGeneric: "Tous secteurs (profil moyen)",
        sectorHint:
          "Le secteur ajuste la répartition des heures rendues entre rédaction, recherche, synthèse et reporting.",
        teamSize: "Combien de collaborateurs concernés ?",
        hoursDailyOnRepetitive: "Heures par jour sur tâches répétitives ?",
        hoursDailyHint:
          "Rédaction d'emails, comptes-rendus, recherche d'infos, classement, synthèses. Estimez à la louche, par personne et par jour.",
        adoption: "Votre scénario d'adoption",
        adoptionHint:
          "L'écart entre une équipe qui outille réellement ses workflows et une équipe qui « a suivi la formation » est le premier facteur de variance. À vous de choisir votre hypothèse.",
        adoptionPrudent: "Prudent",
        adoptionRealiste: "Réaliste",
        adoptionAmbitieux: "Ambitieux",
        adoptionPrudentHint: "Adoption partielle, quelques usages ancrés.",
        adoptionRealisteHint: "Usage régulier sur les tâches ciblées.",
        adoptionAmbitieuxHint: "Workflows outillés, pratique quotidienne.",
        resultIntro: "Voici à quoi ressemblera votre semaine",
        hoursSavedPerDay: "Gagnées par jour, par personne",
        pctTimeFreedSentence: "Soit {pct} % de la journée rendus à la valeur ajoutée.",
        daysLiberatedPerMonth: "Jours libérés par mois sur l'équipe",
        fteRecovered: "Équivalents temps plein récupérés sur l'année",
        emailsAssistedPerMonth: "Emails rédigés avec assistance / mois",
        reportsAssistedPerMonth: "Comptes-rendus assistés / mois",
        breakdownTitle: "D'où viennent ces heures",
        breakdownHint:
          "Répartition des heures rendues entre les quatre familles de tâches, selon le profil de votre secteur.",
        taskRedaction: "Rédaction",
        taskRecherche: "Recherche d'information",
        taskSynthese: "Synthèse & comptes-rendus",
        taskReporting: "Reporting",
        hoursPerWeekShort: "h/sem",
        moneyToggle: "Voir la valeur financière",
        moneyIntro:
          "Le temps rendu a une valeur. Réglez votre coût horaire chargé moyen pour la traduire en euros.",
        hourlyCost: "Coût horaire chargé moyen",
        hourlyCostHint:
          "Salaire brut + charges patronales, ramené à l'heure travaillée. Ajustez selon vos profils.",
        annualValue: "Valeur annuelle",
        annualValueHint: "Heures rendues sur l'année × coût horaire chargé.",
        trainingCost: "Coût formation",
        trainingCostHintOne: "Formation Essentielle, 1 session sur site.",
        trainingCostHintMany: "Formation Essentielle, {sessions} sessions sur site.",
        payback: "Retour sur la formation",
        paybackHint: "Jours ouvrés avant que les heures rendues couvrent le coût.",
        paybackNone: "—",
        workingDays: "j ouvrés",
        estimateNote:
          "Ordres de grandeur issus d'un modèle d'estimation dont toutes les hypothèses sont détaillées plus bas. Vos résultats réels dépendent de votre adoption interne, de vos outils et de vos process. Ces chiffres ne constituent pas un engagement de résultat.",
        liveSummary:
          "Estimation mise à jour : {hours} heures gagnées par jour et par personne, {days} jours libérés par mois sur l'équipe, {fte} équivalents temps plein récupérés sur l'année.",
      }
    : {
        intro:
          "Pick your sector, your headcount and the adoption scenario that fits you. Results show up in hours, days and full-time equivalents — not in jargon.",
        sector: "Your sector",
        sectorGeneric: "All sectors (average profile)",
        sectorHint:
          "The sector adjusts how the freed hours split across writing, research, summarising and reporting.",
        teamSize: "How many employees involved?",
        hoursDailyOnRepetitive: "Hours per day on repetitive tasks?",
        hoursDailyHint:
          "Email writing, minutes, info research, filing, summaries. Estimate roughly, per person, per day.",
        adoption: "Your adoption scenario",
        adoptionHint:
          "The gap between a team that actually rewires its workflows and a team that merely attended the training is the single largest source of variance. You choose the assumption.",
        adoptionPrudent: "Cautious",
        adoptionRealiste: "Realistic",
        adoptionAmbitieux: "Ambitious",
        adoptionPrudentHint: "Partial adoption, a few habits stick.",
        adoptionRealisteHint: "Regular use on the targeted tasks.",
        adoptionAmbitieuxHint: "Tooled workflows, daily practice.",
        resultIntro: "Here's what your week will look like",
        hoursSavedPerDay: "Saved per day, per person",
        pctTimeFreedSentence: "That's {pct} % of the day returned to value-add work.",
        daysLiberatedPerMonth: "Days freed per month across the team",
        fteRecovered: "Full-time equivalents recovered per year",
        emailsAssistedPerMonth: "AI-assisted emails / month",
        reportsAssistedPerMonth: "AI-assisted minutes / month",
        breakdownTitle: "Where these hours come from",
        breakdownHint:
          "How the freed hours split across the four task families, based on your sector's profile.",
        taskRedaction: "Writing",
        taskRecherche: "Information research",
        taskSynthese: "Summaries & minutes",
        taskReporting: "Reporting",
        hoursPerWeekShort: "h/wk",
        moneyToggle: "See the financial value",
        moneyIntro:
          "Time returned has a value. Set your average fully-loaded hourly cost to translate it into euros.",
        hourlyCost: "Average fully-loaded hourly cost",
        hourlyCostHint:
          "Gross salary plus employer contributions, per hour worked. Adjust to your profiles.",
        annualValue: "Annual value",
        annualValueHint: "Hours freed per year × fully-loaded hourly cost.",
        trainingCost: "Training cost",
        trainingCostHintOne: "Essential training, 1 on-site session.",
        trainingCostHintMany: "Essential training, {sessions} on-site sessions.",
        payback: "Payback",
        paybackHint: "Working days before the freed hours cover the cost.",
        paybackNone: "—",
        workingDays: "working days",
        estimateNote:
          "Orders of magnitude from an estimation model whose assumptions are all spelled out below. Your actual results depend on internal adoption, tools and processes. These figures are not a performance guarantee.",
        liveSummary:
          "Estimate updated: {hours} hours saved per day per person, {days} days freed per month across the team, {fte} full-time equivalents recovered per year.",
      };

  // Les 4 familles de tâches, appariées aux photos du manifeste (même ordre).
  const taskFamilies = (
    isFr
      ? [
          {
            icon: PenLine,
            title: "Rédaction",
            body: "Emails, propositions, réponses types, contenus. La tâche la plus universelle, et celle où l'assistance se voit dès le premier jour.",
          },
          {
            icon: Search,
            title: "Recherche d'information",
            body: "Retrouver une clause, une procédure, un historique client. Le temps perdu à chercher est invisible dans les tableaux de bord — et considérable.",
          },
          {
            icon: FileText,
            title: "Synthèse & comptes-rendus",
            body: "Transformer une réunion, un appel ou vingt pages en un résumé actionnable. Un gain immédiat pour les métiers documentaires.",
          },
          {
            icon: BarChart3,
            title: "Reporting",
            body: "Extraire, croiser, mettre en forme, commenter. Les tâches les plus mécaniques du mois, souvent concentrées sur quelques personnes.",
          },
        ]
      : [
          {
            icon: PenLine,
            title: "Writing",
            body: "Emails, proposals, standard replies, content. The most universal task, and the one where assistance shows from day one.",
          },
          {
            icon: Search,
            title: "Information research",
            body: "Finding a clause, a procedure, a customer history. Time lost searching is invisible in dashboards — and considerable.",
          },
          {
            icon: FileText,
            title: "Summaries & minutes",
            body: "Turning a meeting, a call or twenty pages into an actionable summary. An immediate win for document-heavy roles.",
          },
          {
            icon: BarChart3,
            title: "Reporting",
            body: "Extract, cross-reference, format, comment. The most mechanical tasks of the month, often concentrated on a few people.",
          },
        ]
  ).map((f, i) => ({ ...f, image: taskImages[i] }));

  // Étapes d'usage du simulateur — miroir visible du HowTo JSON-LD.
  const howToSteps = isFr
    ? [
        {
          icon: MousePointerClick,
          name: "Choisissez votre secteur",
          text: "Le secteur présélectionne un volume typique de tâches répétitives et ajuste la répartition des heures rendues entre rédaction, recherche, synthèse et reporting.",
        },
        {
          icon: Users,
          name: "Indiquez votre effectif",
          text: "Renseignez le nombre de collaborateurs réellement concernés par la formation, pas l'effectif total de l'entreprise.",
        },
        {
          icon: Clock,
          name: "Estimez les heures répétitives",
          text: "Comptez, par personne et par jour, les heures passées à rédiger, chercher, résumer et reporter. Une estimation à la louche suffit.",
        },
        {
          icon: SlidersHorizontal,
          name: "Choisissez votre scénario d'adoption",
          text: "Prudent, réaliste ou ambitieux : vous fixez vous-même l'hypothèse d'efficacité, de 40 % à 75 % du temps répétitif. Le résultat s'actualise instantanément.",
        },
      ]
    : [
        {
          icon: MousePointerClick,
          name: "Pick your sector",
          text: "The sector preselects a typical volume of repetitive tasks and adjusts how freed hours split across writing, research, summarising and reporting.",
        },
        {
          icon: Users,
          name: "Enter your headcount",
          text: "Fill in the number of employees actually involved in the training, not the company's total headcount.",
        },
        {
          icon: Clock,
          name: "Estimate the repetitive hours",
          text: "Count, per person per day, the hours spent writing, searching, summarising and reporting. A rough estimate is enough.",
        },
        {
          icon: SlidersHorizontal,
          name: "Choose your adoption scenario",
          text: "Cautious, realistic or ambitious: you set the efficiency assumption yourself, from 40 % to 75 % of repetitive time. Results update instantly.",
        },
      ];

  // Hypothèses du modèle — E-E-A-T. Toutes lues depuis le SSOT `compute.ts`.
  const assumptions = isFr
    ? [
        {
          term: "Efficacité sur les tâches répétitives",
          value: `${Math.round(ADOPTION_EFFICIENCY.prudent * 100)} % · ${Math.round(ADOPTION_EFFICIENCY.realiste * 100)} % · ${Math.round(ADOPTION_EFFICIENCY.ambitieux * 100)} %`,
          note: "Selon le scénario d'adoption que vous choisissez. C'est le seul levier d'incertitude que nous exposons explicitement, plutôt que d'imposer un chiffre unique.",
        },
        {
          term: "Journée de travail",
          value: `${ROI_CONSTANTS.hoursPerDay} h`,
          note: "Durée légale française : 35 heures hebdomadaires réparties sur 5 jours.",
        },
        {
          term: "Jours ouvrés",
          value: `${ROI_CONSTANTS.workingDaysPerMonth} / mois · ${ROI_CONSTANTS.workingDaysPerYear} / an`,
          note: "Moyenne annuelle lissée, hors congés payés et RTT.",
        },
        {
          term: "Équivalent temps plein",
          value: `${ROI_CONSTANTS.annualHoursPerFte.toLocaleString("fr-FR")} h / an`,
          note: "Durée légale annuelle du travail en France. Sert de dénominateur au calcul d'ETP récupérés.",
        },
        {
          term: "Emails rédigés",
          value: `${ROI_CONSTANTS.emailsSentPerDayPerPerson} / jour / personne`,
          note: "Hypothèse de volume avant assistance. Sert uniquement à rendre le gain tangible, jamais à le calculer.",
        },
        {
          term: "Comptes-rendus produits",
          value: `${ROI_CONSTANTS.reportsPerMonthPerPerson} / mois / personne`,
          note: "Même statut : une hypothèse de volume, pas une mesure.",
        },
        {
          term: "Coût de la formation",
          value: "Tarif public Essentielle",
          note: "Lu directement depuis notre grille tarifaire publique, selon l'effectif et le nombre de sessions nécessaires (30 personnes maximum par session).",
        },
      ]
    : [
        {
          term: "Efficiency on repetitive tasks",
          value: `${Math.round(ADOPTION_EFFICIENCY.prudent * 100)} % · ${Math.round(ADOPTION_EFFICIENCY.realiste * 100)} % · ${Math.round(ADOPTION_EFFICIENCY.ambitieux * 100)} %`,
          note: "Depending on the adoption scenario you pick. It's the only uncertainty lever we expose explicitly, rather than imposing a single number.",
        },
        {
          term: "Working day",
          value: `${ROI_CONSTANTS.hoursPerDay} h`,
          note: "French statutory duration: 35 hours a week over 5 days.",
        },
        {
          term: "Working days",
          value: `${ROI_CONSTANTS.workingDaysPerMonth} / month · ${ROI_CONSTANTS.workingDaysPerYear} / year`,
          note: "Smoothed annual average, excluding paid leave and RTT.",
        },
        {
          term: "Full-time equivalent",
          value: `${ROI_CONSTANTS.annualHoursPerFte.toLocaleString("en-GB")} h / year`,
          note: "French statutory annual working time. Denominator for the FTE-recovered figure.",
        },
        {
          term: "Emails written",
          value: `${ROI_CONSTANTS.emailsSentPerDayPerPerson} / day / person`,
          note: "Volume assumption before assistance. It only makes the gain tangible; it never drives the calculation.",
        },
        {
          term: "Minutes produced",
          value: `${ROI_CONSTANTS.reportsPerMonthPerPerson} / month / person`,
          note: "Same status: a volume assumption, not a measurement.",
        },
        {
          term: "Training cost",
          value: "Public Essential rate",
          note: "Read straight from our public price list, based on headcount and the number of sessions required (30 people maximum per session).",
        },
      ];

  const faqItems = isFr
    ? [
        {
          id: "combien-heures",
          question: "Combien d'heures par jour l'IA peut-elle libérer dans mon équipe ?",
          answer:
            "Cela dépend de deux choses : le temps que vos équipes passent aujourd'hui sur des tâches répétitives, et le degré d'adoption réel des outils après la formation. Notre modèle applique une efficacité de 40 % (adoption prudente) à 75 % (workflows outillés, pratique quotidienne) sur ce temps répétitif. Pour une personne consacrant 3 heures par jour à la rédaction, la recherche et la synthèse, cela représente 1,2 à 2,3 heures rendues par jour.",
        },
        {
          id: "comment-calculer-roi",
          question: "Comment calculer le ROI d'une formation IA pour une PME ?",
          answer:
            "Commencez par le temps, pas par l'argent. Estimez les heures quotidiennes passées sur les tâches répétitives, multipliez par votre effectif concerné et par une hypothèse d'efficacité assumée. Vous obtenez des heures rendues, convertibles en jours libérés puis en équivalents temps plein. La conversion en euros n'est qu'une dernière étape : heures annuelles rendues × coût horaire chargé. Notre simulateur enchaîne ces étapes et affiche chaque hypothèse.",
        },
        {
          id: "quand-resultats",
          question: "En combien de temps les résultats sont-ils visibles après une formation IA ?",
          answer:
            "Les premiers réflexes s'installent dès les jours suivants, parce que les participants travaillent sur leurs propres cas pendant la formation. Mais un gain de temps mesurable suppose que les nouveaux usages remplacent durablement les anciens : comptez plutôt 4 à 8 semaines de pratique régulière avant de pouvoir constater un effet stable sur la charge de travail.",
        },
        {
          id: "chiffres-exacts",
          question: "Les chiffres du simulateur sont-ils des chiffres réels ?",
          answer:
            "Non, et nous ne le prétendons pas. Ce sont des ordres de grandeur produits par un modèle d'estimation dont toutes les hypothèses sont publiées sur cette page. Ils ne constituent pas un engagement de résultat. Pour un chiffrage sur vos process réels, avec mesure avant/après, c'est l'objet de l'audit Axion-IA.",
        },
        {
          id: "pourquoi-scenarios",
          question: "Pourquoi trois scénarios d'adoption plutôt qu'un seul chiffre ?",
          answer:
            "Parce que l'écart entre une équipe qui reconstruit réellement ses workflows et une équipe qui a simplement suivi une formation est le premier facteur de variance des résultats — bien avant le secteur ou la taille. Afficher un chiffre unique reviendrait à masquer cette incertitude. Nous préférons vous laisser choisir votre hypothèse en connaissance de cause.",
        },
        {
          id: "secteur-change-quoi",
          question: "Qu'est-ce que le choix du secteur change au résultat ?",
          answer:
            "Le secteur ajuste deux choses : le volume typique d'heures répétitives présélectionné, et la répartition des heures rendues entre les quatre familles de tâches. Un cabinet juridique passe davantage de temps en recherche documentaire ; un cabinet comptable, en reporting. Le total de temps gagné reste piloté par vos propres curseurs.",
        },
        {
          id: "formation-financable",
          question: "La formation qui produit ces gains est-elle finançable ?",
          answer:
            "Nos formations IA sont éligibles aux dispositifs de financement de la formation professionnelle selon votre situation (OPCO, France Travail). Nous étudions votre prise en charge et montons le dossier avec vous.",
        },
      ]
    : [
        {
          id: "combien-heures",
          question: "How many hours per day can AI free up in my team?",
          answer:
            "It depends on two things: how much time your teams currently spend on repetitive tasks, and how deeply the tools are actually adopted after training. Our model applies an efficiency of 40 % (cautious adoption) to 75 % (tooled workflows, daily practice) to that repetitive time. For someone spending 3 hours a day writing, searching and summarising, that's 1.2 to 2.3 hours returned per day.",
        },
        {
          id: "comment-calculer-roi",
          question: "How do you calculate the ROI of AI training for an SME?",
          answer:
            "Start with time, not money. Estimate the daily hours spent on repetitive tasks, multiply by the headcount involved and by an efficiency assumption you own. You get freed hours, convertible into days and then into full-time equivalents. Converting to euros is only the last step: annual hours freed × fully-loaded hourly cost. Our simulator chains these steps and shows every assumption.",
        },
        {
          id: "quand-resultats",
          question: "How quickly are results visible after AI training?",
          answer:
            "The first reflexes appear within days, because participants work on their own cases during the training. But measurable time savings require the new habits to durably replace the old ones: expect 4 to 8 weeks of regular practice before a stable effect on workload can be observed.",
        },
        {
          id: "chiffres-exacts",
          question: "Are the simulator's figures real measurements?",
          answer:
            "No, and we don't claim they are. They are orders of magnitude produced by an estimation model whose assumptions are all published on this page. They are not a performance guarantee. For figures grounded in your actual processes, with before/after measurement, that is what the Axion-IA audit is for.",
        },
        {
          id: "pourquoi-scenarios",
          question: "Why three adoption scenarios rather than a single number?",
          answer:
            "Because the gap between a team that genuinely rebuilds its workflows and a team that merely attended a training is the largest source of variance in outcomes — ahead of sector or size. Showing a single number would hide that uncertainty. We would rather let you pick your assumption knowingly.",
        },
        {
          id: "secteur-change-quoi",
          question: "What does picking a sector change in the result?",
          answer:
            "The sector adjusts two things: the typical volume of repetitive hours preselected, and how the freed hours split across the four task families. A law firm spends more time on documentary research; an accounting firm, on reporting. The total time saved stays driven by your own sliders.",
        },
        {
          id: "formation-financable",
          question: "Can the training that produces these gains be funded?",
          answer:
            "Our AI trainings are eligible for professional training funding schemes depending on your situation (OPCO, France Travail). We study your funding and build the file with you.",
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

  // Le simulateur EST une application web gratuite : on le déclare comme telle.
  // Pas d'`aggregateRating` inventé — l'outil n'est pas noté.
  const webApplicationJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/${loc}${PATH}#simulateur`,
    name: isFr ? "Simulateur de gains de temps IA" : "AI time-savings simulator",
    url: `${SITE_URL}/${loc}${PATH}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    browserRequirements: isFr ? "Navigateur récent" : "Modern browser",
    inLanguage: loc,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    provider: { "@id": `${SITE_URL}/#organization` },
    description: isFr
      ? "Estime les heures rendues, les jours libérés et les équivalents temps plein récupérés par une équipe après une formation IA, à partir du secteur, de l'effectif, du temps passé sur les tâches répétitives et du scénario d'adoption retenu."
      : "Estimates the hours freed, days returned and full-time equivalents recovered by a team after an AI training, from sector, headcount, time spent on repetitive tasks and the chosen adoption scenario.",
    featureList: isFr
      ? [
          "Préréglages par secteur d'activité",
          "Trois scénarios d'adoption (40 %, 60 %, 75 %)",
          "Ventilation des heures rendues par famille de tâches",
          "Conversion en équivalents temps plein",
          "Valorisation financière optionnelle et délai de retour",
        ]
      : [
          "Sector presets",
          "Three adoption scenarios (40 %, 60 %, 75 %)",
          "Freed hours broken down by task family",
          "Conversion into full-time equivalents",
          "Optional financial valuation and payback delay",
        ],
  } as const;

  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: PATH,
    name: isFr
      ? "Comment estimer les gains de temps d'une formation IA"
      : "How to estimate the time savings of an AI training",
    description: isFr
      ? "Quatre étapes pour estimer, avec le simulateur Axion-IA, les heures rendues à une équipe après une formation à l'intelligence artificielle."
      : "Four steps to estimate, with the Axion-IA simulator, the hours returned to a team after an artificial-intelligence training.",
    totalTime: "PT2M",
    steps: howToSteps.map((s) => ({ name: s.name, text: s.text })),
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
        eyebrow={isFr ? "Simulateur de gains · gratuit" : "Gains simulator · free"}
        title={isFr ? "Combien d'heures votre équipe" : "How many hours will your team"}
        titleEm={isFr ? "gagnera" : "save"}
        titleTail={isFr ? " après la formation ?" : " after training?"}
        description={
          isFr
            ? "Pas de pourcentage de ROI sorti d'un chapeau. Des heures rendues à vos équipes, un modèle d'estimation dont chaque hypothèse est publiée — et la valeur en euros seulement si vous la demandez."
            : "No ROI percentage pulled from a hat. Hours returned to your teams, an estimation model whose every assumption is published — and the value in euros only if you ask for it."
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
              {isFr ? "Lancer le simulateur" : "Run the simulator"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" track="roi-hero-audit">
              {isFr ? "Faire mesurer sur mes process" : "Measure on my processes"}
            </Cta>
          </div>
          <ul role="list" className="flex flex-wrap gap-x-5 gap-y-2.5">
            {heroChips.map((chip) => (
              <li key={chip.label} className="text-fg-soft inline-flex items-center gap-2 text-sm">
                <chip.icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                <span>{chip.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── LE SIMULATEUR ────────────────────────────────────────────────── */}
      <Section id="simulateur" tone="canvas">
        <Container className="max-w-6xl">
          <RoiSimulator locale={loc} labels={simulatorLabels} />
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

      {/* ── LES 4 FAMILLES DE TÂCHES ─────────────────────────────────────── */}
      <Section
        id="familles"
        tone="paper"
        eyebrow={isFr ? "D'où viennent les heures" : "Where the hours come from"}
        title={isFr ? "Quatre familles de tâches," : "Four task families,"}
        titleEm={isFr ? "un même levier" : "one lever"}
        description={
          isFr
            ? "Les gains d'une formation IA ne se répartissent pas au hasard. Ils se concentrent sur quatre familles de tâches, dont le poids varie selon votre métier."
            : "The gains of an AI training don't spread at random. They concentrate on four task families, whose weight varies with your trade."
        }
      >
        <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-4">
          {taskFamilies.map((f) => (
            <li
              key={f.title}
              className="border-border bg-canvas shadow-subtle flex h-full flex-col overflow-hidden rounded-2xl border"
            >
              {f.image ? (
                <div className="relative aspect-[3/2] overflow-hidden">
                  <Image
                    src={f.image.src}
                    alt={isFr ? f.image.altFr : f.image.altEn}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 479px) 50vw, 100vw"
                    loading="lazy"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <span className="bg-terracotta/10 text-terracotta inline-flex h-10 w-10 items-center justify-center rounded-xl">
                  <f.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="text-fg text-base font-semibold tracking-tight">{f.title}</h3>
                <p className="text-fg-soft text-sm leading-relaxed">{f.body}</p>
                {f.image ? (
                  <UnsplashCredit
                    photographerName={creditFor(f.image.src)?.photographer}
                    photographerUrl={creditFor(f.image.src)?.photographerUrl}
                    className="mt-auto pt-2 text-[11px]"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── MODE D'EMPLOI (miroir visible du HowTo JSON-LD) ──────────────── */}
      <Section
        id="mode-emploi"
        eyebrow={isFr ? "Mode d'emploi" : "How it works"}
        title={isFr ? "Quatre réglages," : "Four settings,"}
        titleEm={isFr ? "deux minutes" : "two minutes"}
        description={
          isFr
            ? "Le simulateur ne vous demande rien que vous ne sachiez déjà sur votre équipe."
            : "The simulator asks nothing you don't already know about your team."
        }
      >
        <ol role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-4 lg:grid-cols-4">
          {howToSteps.map((s, i) => (
            <li
              key={s.name}
              id={`step-${i + 1}`}
              className="border-border bg-paper shadow-subtle flex h-full flex-col gap-2.5 rounded-2xl border p-5"
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
                      "Ce n'est pas un devis : le coût affiché suit notre grille publique, sans étude de votre contexte.",
                    ]
                  : [
                      "It is not a study: we publish no panel of measured companies.",
                      "It is not a performance guarantee: your gains depend on internal adoption.",
                      "It is not a quote: the cost shown follows our public price list, with no study of your context.",
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
            ? "Un cabinet juridique gagne surtout sur la recherche documentaire ; un cabinet comptable, sur le reporting. Choisissez votre secteur dans le simulateur, ou explorez la page dédiée à votre métier."
            : "A law firm mostly gains on documentary research; an accounting firm, on reporting. Pick your sector in the simulator, or explore the page dedicated to your trade."
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
                  ? "« J'aurais pu afficher un chiffre unique et flatteur. J'ai préféré vous montrer les trois hypothèses et vous laisser choisir la vôtre. Un simulateur qui ne dit pas ce qu'il suppose ne vous aide pas à décider. »"
                  : "“I could have shown a single flattering number. I chose to show you the three assumptions instead, and let you pick yours. A simulator that won't say what it assumes doesn't help you decide.”"}
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

      <StickyMobileCta
        href="/audit"
        label={isFr ? "Demander un audit" : "Request an audit"}
        track="roi-sticky-audit"
      />
    </>
  );
}
