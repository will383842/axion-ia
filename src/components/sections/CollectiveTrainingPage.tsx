// Composant template — pages détail des formations 4 h Collectives.
// Sprint 14.10.7 fix Will (2026-05-11) : tout format AVEC un tarif doit
// avoir sa page indexable dédiée. Les 2 formations 4 h (Démarrage IA
// Express + Atelier IA ciblé) — prix dérivé dynamiquement de pricing.ts
// (cf. intervention-4h) — avaient été câblées sur la page demande
// générique avant ; on les promeut en pages détail à part entière.
//
// Pattern miroir d'IndividualCoachingPage : hero + 3 chips + 4 bénéfices
// + programme demi-journée 9 h–13 h + FAQ + JSON-LD Service + FAQPage.

import type { ReactNode } from "react";
import { ArrowRight, Mail, Sparkles, Compass, Target, TrendingUp, Wrench } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { InterventionSchedule } from "@/components/sections/intervention-parts/InterventionSchedule";
import { InterventionBenefitsGrid } from "@/components/sections/intervention-parts/InterventionBenefitsGrid";
import { InterventionFaqList } from "@/components/sections/intervention-parts/InterventionFaqList";
import {
  getFamily,
  getDuration,
  INTERVENTION_FORMATS,
  type InterventionFormatEntry,
} from "@/content/interventions-taxonomy";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import { buildServiceJsonLd, buildFaqJsonLd } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

// ----------------------------------------------------------------------------
// Configs spécifiques aux 2 formations 4 h.
// ----------------------------------------------------------------------------

export type CollectiveTrainingSlug = "demarrage-ia-express" | "atelier-ia-cible";

interface TrainingBenefit {
  icon: typeof Compass;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
}

interface TrainingScheduleItem {
  time: string;
  titleFr: string;
  titleEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
}

interface TrainingConfig {
  slug: CollectiveTrainingSlug;
  contactObject: string;
  titleFr: string;
  titleEn: string;
  titleEmFr: string;
  titleEmEn: string;
  promiseFr: string;
  promiseEn: string;
  chipsFr: ReadonlyArray<string>;
  chipsEn: ReadonlyArray<string>;
  benefits: ReadonlyArray<TrainingBenefit>;
  schedule: ReadonlyArray<TrainingScheduleItem>;
  faq: ReadonlyArray<{ qFr: string; qEn: string; aFr: string; aEn: string }>;
}

// Prix d'entrée Essentielle dérivé de la SSOT (pricing.ts) — référencé dans la
// FAQ ci-dessous via template literal pour qu'un changement de tarif se propage.
const ESSENTIELLE_ENTRY_EUR = getTierById(
  INTERVENTION_TIERS,
  "intervention-essentielle",
).priceFlat!;

const TRAINING_CONFIGS: Record<CollectiveTrainingSlug, TrainingConfig> = {
  "demarrage-ia-express": {
    slug: "demarrage-ia-express",
    contactObject: "demarrage-ia-express",
    titleFr: "Démarrage IA Express",
    titleEn: "AI Express Kickoff",
    titleEmFr: "4 heures pour démarrer",
    titleEmEn: "4 hours to kick off",
    promiseFr:
      "Une demi-journée (4 h) pour démystifier l'IA dans votre équipe : panorama des outils 2026, démos live sur des cas réels de votre secteur, 2-3 prompts opérationnels testés ensemble. À la fin, votre équipe a une vision claire et des quick-wins prêts à appliquer dès le lendemain.",
    promiseEn:
      "A half-day (4 h) to demystify AI for your team: 2026 tools panorama, live demos on real cases from your sector, 2-3 operational prompts tested together. By the end, your team has a clear vision and quick-wins ready to apply from day one.",
    chipsFr: ["Panorama IA 2026", "Démos live secteur", "2-3 prompts opérationnels"],
    chipsEn: ["2026 AI panorama", "Live sector demos", "2-3 working prompts"],
    benefits: [
      {
        icon: Compass,
        titleFr: "Panorama IA opérationnelle 2026",
        titleEn: "2026 operational AI panorama",
        bodyFr:
          "Tour d'horizon des outils IA qui comptent vraiment en 2026 : ChatGPT, Claude, Gemini, outils métier. On clarifie quoi sert à quoi, quels sont les vrais cas d'usage et ce qui n'est encore que du bruit.",
        bodyEn:
          "Overview of the AI tools that really matter in 2026: ChatGPT, Claude, Gemini, business-specific tools. We clarify what's for what, the real use cases, and what's still just hype.",
      },
      {
        icon: Sparkles,
        titleFr: "Démos live sur votre secteur",
        titleEn: "Live demos on your sector",
        bodyFr:
          "Pas de démos génériques. On vient avec des exemples concrets de votre secteur (e-commerce, BTP, services, industrie, etc.) — ce que font vraiment les concurrents et ce qui marche dans votre métier.",
        bodyEn:
          "No generic demos. We bring concrete examples from your sector (e-commerce, construction, services, industry, etc.) — what your competitors really do and what works in your role.",
      },
      {
        icon: TrendingUp,
        titleFr: "2-3 prompts opérationnels testés",
        titleEn: "2-3 operational prompts tested",
        bodyFr:
          "Pendant la séance, on construit ensemble 2-3 prompts adaptés à votre quotidien (rédaction, analyse, synthèse, traduction) — testés sur vos vrais cas avec un retour immédiat.",
        bodyEn:
          "During the session, we build together 2-3 prompts adapted to your daily work (writing, analysis, synthesis, translation) — tested on your real cases with immediate feedback.",
      },
      {
        icon: Target,
        titleFr: "Plan d'action immédiat",
        titleEn: "Immediate action plan",
        bodyFr:
          "Votre équipe repart avec une liste claire des prochaines étapes : outils à installer, comptes à créer, prochaines actions. Quick-wins activables dès le lendemain matin.",
        bodyEn:
          "Your team leaves with a clear list of next steps: tools to install, accounts to create, next actions. Quick-wins ready to apply the next morning.",
      },
    ],
    schedule: [
      {
        time: "9 h 00",
        titleFr: "Accueil + tour de table",
        titleEn: "Welcome + round table",
      },
      {
        time: "9 h 30",
        titleFr: "Panorama IA opérationnelle 2026",
        titleEn: "2026 operational AI panorama",
        descriptionFr: "Tour des outils qui comptent vraiment + état de l'art secteur.",
        descriptionEn: "Tour of the tools that really matter + sector state of the art.",
      },
      {
        time: "10 h 30",
        titleFr: "Démos live sur cas réels",
        titleEn: "Live demos on real cases",
        descriptionFr: "Exemples concrets de votre secteur — testés en séance.",
        descriptionEn: "Concrete examples from your sector — tested live.",
      },
      {
        time: "11 h 30",
        titleFr: "Pause",
        titleEn: "Break",
      },
      {
        time: "11 h 45",
        titleFr: "Atelier prompts opérationnels",
        titleEn: "Operational prompts workshop",
        descriptionFr: "On construit ensemble 2-3 prompts adaptés à votre quotidien.",
        descriptionEn: "We build together 2-3 prompts adapted to your daily work.",
      },
      {
        time: "12 h 45",
        titleFr: "Synthèse + plan d'action + clôture",
        titleEn: "Synthesis + action plan + close",
      },
    ],
    faq: [
      {
        qFr: "Aucun de mes collaborateurs n'a utilisé d'IA, c'est trop tôt ?",
        qEn: "None of my team has used AI — is it too early?",
        aFr: "Non, c'est le moment idéal. Le format est calibré pour démarrer de zéro. On ne suppose aucune connaissance préalable, on part de votre quotidien et on construit progressivement.",
        aEn: "No, it's the ideal time. The format is calibrated to start from scratch. We assume no prior knowledge, start from your daily work and build progressively.",
      },
      {
        qFr: "On peut faire ça à distance ou il faut être sur site ?",
        qEn: "Can we do this remotely or do we need on-site?",
        aFr: "Sur site recommandé pour ce format court — l'énergie et l'interaction collective comptent beaucoup. À distance possible si contrainte logistique, devis ajusté.",
        aEn: "On-site recommended for this short format — the energy and collective interaction matter a lot. Remote possible if logistical constraint, quote adjusted.",
      },
      {
        qFr: "Et après ces 4 h, qu'est-ce que je fais ?",
        qEn: "What do I do after these 4 hours?",
        aFr: `Vous repartez avec un plan d'action. Si vous voulez aller plus loin, le format Essentielle 1 jour (${formatAmount(ESSENTIELLE_ENTRY_EUR, "fr", { compact: true })} HT) reprend la base et l'approfondit sur les cas métier. L'Approfondie 2 jours installe l'IA en équipe à l'échelle.`,
        aEn: `You leave with an action plan. If you want to go further, the Essential 1-day format (${formatAmount(ESSENTIELLE_ENTRY_EUR, "en", { compact: true })} excl. VAT) covers the basics in depth on business cases. The Deep Dive 2 days installs AI across the team at scale.`,
      },
    ],
  },
  "atelier-ia-cible": {
    slug: "atelier-ia-cible",
    contactObject: "atelier-ia-cible",
    titleFr: "Atelier IA ciblé",
    titleEn: "Targeted AI Workshop",
    titleEmFr: "4 heures sur un cas précis",
    titleEmEn: "4 hours on a specific case",
    promiseFr:
      "Une demi-journée (4 h) focalisée sur UN cas d'usage métier précis (rédaction commerciale, analyse de documents, structuration de reporting, traduction…). À la fin, chaque participant repart avec le cas implémenté sur son poste de travail, prêt à utiliser.",
    promiseEn:
      "A half-day (4 h) focused on ONE specific business case (sales writing, document analysis, reporting structuring, translation…). By the end, each participant leaves with the case implemented on their workstation, ready to use.",
    chipsFr: [
      "1 cas d'usage précis",
      "Implémenté sur chaque poste",
      "Prêt à utiliser le soir même",
    ],
    chipsEn: [
      "1 specific use case",
      "Implemented on each workstation",
      "Ready to use that evening",
    ],
    benefits: [
      {
        icon: Target,
        titleFr: "1 cas d'usage métier, profondeur maximale",
        titleEn: "1 business case, maximum depth",
        bodyFr:
          "On ne survole pas. La demi-journée entière est consacrée à UN cas d'usage précis (que vous choisissez en amont). Résultat : maîtrise réelle au lieu d'une vague vue d'ensemble.",
        bodyEn:
          "We don't skim. The entire half-day is dedicated to ONE specific use case (you choose it upstream). Result: real mastery instead of a vague overview.",
      },
      {
        icon: Wrench,
        titleFr: "Implémenté sur chaque poste",
        titleEn: "Implemented on each workstation",
        bodyFr:
          "Chaque participant configure le cas sur son propre poste, avec ses propres accès. Pas de démo regardée passivement — on fait, on teste, on corrige ensemble.",
        bodyEn:
          "Each participant configures the case on their own workstation, with their own logins. No passive demo — we do, test, fix together.",
      },
      {
        icon: Sparkles,
        titleFr: "Templates + prompts maison",
        titleEn: "Templates + custom prompts",
        bodyFr:
          "À la fin, vous repartez avec les templates et prompts construits ensemble, documentés et prêts à être partagés au reste de l'équipe.",
        bodyEn:
          "By the end, you leave with the templates and prompts built together, documented and ready to share with the rest of the team.",
      },
      {
        icon: TrendingUp,
        titleFr: "Opérationnel dès le soir même",
        titleEn: "Operational that evening",
        bodyFr:
          "Pas d'attente, pas de POC. Le cas est testé sur vos vraies données pendant la séance. Le soir même, l'outil tourne déjà sur vos workflows réels.",
        bodyEn:
          "No waiting, no POC. The case is tested on your real data during the session. That very evening, the tool is already running on your real workflows.",
      },
    ],
    schedule: [
      {
        time: "9 h 00",
        titleFr: "Accueil + cadrage du cas d'usage",
        titleEn: "Welcome + use case framing",
      },
      {
        time: "9 h 30",
        titleFr: "Démo du cas en action",
        titleEn: "Demo of the case in action",
        descriptionFr: "Présentation du workflow IA cible — comment ça marche, sur quels outils.",
        descriptionEn: "Presentation of the target AI workflow — how it works, on which tools.",
      },
      {
        time: "10 h 15",
        titleFr: "Installation + configuration sur les postes",
        titleEn: "Setup + configuration on workstations",
        descriptionFr: "Chaque participant configure les outils sur son poste avec ses accès.",
        descriptionEn:
          "Each participant configures the tools on their workstation with their logins.",
      },
      {
        time: "11 h 30",
        titleFr: "Pause",
        titleEn: "Break",
      },
      {
        time: "11 h 45",
        titleFr: "Pratique sur vos vrais cas",
        titleEn: "Practice on your real cases",
        descriptionFr:
          "Application du workflow sur les vraies données métier de chaque participant.",
        descriptionEn: "Application of the workflow on each participant's real business data.",
      },
      {
        time: "12 h 45",
        titleFr: "Synthèse + templates remis + clôture",
        titleEn: "Synthesis + templates shared + close",
      },
    ],
    faq: [
      {
        qFr: "Quels cas d'usage pouvez-vous traiter ?",
        qEn: "What use cases can you handle?",
        aFr: "Rédaction commerciale et marketing, analyse de documents (contrats, CV, devis), automatisation de reporting, traduction professionnelle, synthèse de réunions, génération d'images, recherche, gestion de mails… On valide le cas en cadrage avant la séance pour s'assurer qu'il colle au format 4 h.",
        aEn: "Sales and marketing writing, document analysis (contracts, CVs, quotes), reporting structuring, professional translation, meeting synthesis, image generation, research, email management… We validate the case in framing before the session to ensure it fits the 4-h format.",
      },
      {
        qFr: "Et si le cas s'avère trop large pour 4 h ?",
        qEn: "What if the case turns out too broad for 4 h?",
        aFr: "On peut soit splitter sur 2 demi-journées (devis adapté), soit basculer vers le format Approfondie 2 jours qui permet de creuser plusieurs cas en parallèle. On décide ensemble en cadrage.",
        aEn: "We can either split over 2 half-days (quote adjusted), or switch to the 2-day Deep Dive format which allows several cases in parallel. We decide together in framing.",
      },
      {
        qFr: "Quel niveau IA est requis pour les participants ?",
        qEn: "What AI level is required for participants?",
        aFr: "Aucun. Le format est conçu pour démarrer de zéro sur un cas précis. Si vos équipes sont déjà à l'aise avec ChatGPT/Claude, on creuse les fonctionnalités avancées (prompts complexes, agents, Code).",
        aEn: "None. The format is designed to start from scratch on a specific case. If your teams are already comfortable with ChatGPT/Claude, we go deeper into advanced features (complex prompts, agents, Code).",
      },
    ],
  },
};

// ----------------------------------------------------------------------------
// Composant template
// ----------------------------------------------------------------------------

interface Props {
  slug: CollectiveTrainingSlug;
  locale: Locale;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export function CollectiveTrainingPage({ slug, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const config = TRAINING_CONFIGS[slug];
  const entry: InterventionFormatEntry | undefined = INTERVENTION_FORMATS.find(
    (e) => e.slug === slug,
  );
  const family = getFamily("collectives");
  const duration = getDuration("4h");
  const fourHTier = getTierById(INTERVENTION_TIERS, "intervention-4h");
  const priceFr = formatAmount(fourHTier.priceFlat!, "fr");
  const priceEn = formatAmount(fourHTier.priceFlat!, "en");
  // Will (audit /interventions 2026-05-12) — les 2 formations 4 h à prix
  // fixe (cf. pricing.ts intervention-4h) sont bookables direct sur le
  // calendrier (enum DB ajouté via migration 20260512120000_collective_4h_enum_values).
  // Avant : CTAs câblées sur /interventions/demande (formulaire), incohérent
  // avec les autres formats à prix fixe (Essentielle, Approfondie, etc.).
  const bookingHref = `/reserver?intervention=${slug}`;

  // Sprint 14.10.7 fix charte couleur : tout en terracotta (orange Axion-IA).
  // L'`accent` taxonomy est toujours terracotta pour ces 2 formations 4 h
  // (charte respectée). Variable retirée car plus de variation conditionnelle.

  const breadcrumbItems = [
    { href: "/interventions", label: isFr ? "Interventions" : "Sessions" },
    {
      href: "/interventions/collectives",
      label: isFr ? family.labelFr : family.labelEn,
    },
    {
      href: "/interventions/collectives/4h",
      label: isFr ? duration.labelFr : duration.labelEn,
    },
    {
      href: `/interventions/${slug}`,
      label: isFr ? config.titleFr : config.titleEn,
    },
  ];

  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path: `/interventions/${slug}`,
    name: `${isFr ? config.titleFr : config.titleEn} · Axion-IA`,
    description: isFr ? config.promiseFr : config.promiseEn,
    serviceType: "AI training",
    priceEur: fourHTier.priceFlat!,
    areasServed: buildServiceAreasServed(locale),
  });

  const faqJsonLd =
    config.faq.length > 0
      ? buildFaqJsonLd({
          items: config.faq.map((f) => ({
            question: isFr ? f.qFr : f.qEn,
            answer: isFr ? f.aFr : f.aEn,
          })),
        })
      : null;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Formation équipe · 4 heures" : "Team training · 4 hours"}
              {entry?.badgeFr ? (
                <>
                  <span className="mx-2 opacity-50">·</span>
                  {isFr ? entry.badgeFr : entry.badgeEn}
                </>
              ) : null}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {isFr ? config.titleFr : config.titleEn}{" "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? config.titleEmFr : config.titleEmEn}
              </span>
            </h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr ? config.promiseFr : config.promiseEn}
            </p>

            {/* Bandeau prix + chips ROI */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="bg-terracotta text-mocha-fg rounded-full px-4 py-1.5 text-base font-bold tracking-tight tabular-nums shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]">
                {isFr ? priceFr : priceEn}
              </span>
              <span className="text-fg-soft text-[13px]">
                {isFr ? "2 à 20 personnes · sur site" : "2 to 20 people · on site"}
              </span>
            </div>

            <ul className="mt-6 flex flex-wrap gap-2">
              {(isFr ? config.chipsFr : config.chipsEn).map((chip) => (
                <li
                  key={chip}
                  className="bg-terracotta-soft text-terracotta-deep border-terracotta/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold tracking-tight"
                >
                  <ArrowRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  {chip}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta
                href={bookingHref}
                size="lg"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
              >
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Réserver cette formation" : "Book this training"}
              </Cta>
              <Cta href="/interventions/collectives/4h" variant="outline" size="lg">
                {isFr ? "← Autres formations 4 h" : "← Other 4-h trainings"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* PROGRAMME DEMI-JOURNÉE — JUSTE APRÈS LE HERO (Will 2026-05-12) */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Programme type · 9 h – 13 h" : "Standard programme · 9 a.m. – 1 p.m."}
        title={isFr ? "Le détail" : "Detailed"}
        titleEm={isFr ? "de votre demi-journée" : "half-day breakdown"}
        description={
          isFr
            ? "Programme cadré en amont par appel. La trame reste celle-ci, le contenu s'adapte à votre contexte métier."
            : "Programme framed upstream by call. The frame stays the same, content adapts to your business context."
        }
        contentClassName={TIGHT_X}
      >
        <InterventionSchedule items={config.schedule} isFr={isFr} />
      </Section>

      {/* 4 BÉNÉFICES */}
      <Section
        eyebrow={isFr ? "Ce que vous obtenez" : "What you get"}
        title={isFr ? "4 bénéfices" : "4 benefits"}
        titleEm={isFr ? "concrets en 4 heures" : "concrete in 4 hours"}
        description={
          isFr
            ? "À la fin de la demi-journée, voici ce que votre équipe maîtrise."
            : "By the end of the half-day, here's what your team masters."
        }
        contentClassName={TIGHT_X}
      >
        <InterventionBenefitsGrid items={config.benefits} isFr={isFr} />
      </Section>

      {/* FAQ */}
      <Section
        tone="sand"
        eyebrow="FAQ"
        title={isFr ? "Questions" : "Questions"}
        titleEm={isFr ? "fréquentes" : "we hear often"}
        contentClassName={TIGHT_X}
      >
        <InterventionFaqList items={config.faq} isFr={isFr} />
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? "Réservez cette formation 4 heures" : "Book this 4-hour training"}
        description={
          isFr
            ? `${priceFr} pour 2 à 20 personnes sur site. Cadrage par appel où l'on prend le temps de tout cadrer à la perfection, devis et planning sous 48 h ouvrées. Aucun engagement avant signature.`
            : `${priceEn} for 2 to 20 people on site. Framing call where we take the time to scope your project perfectly, quote and schedule within 48 business hours. No commitment before signing.`
        }
        cta={
          <Cta
            href={bookingHref}
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          >
            <Mail aria-hidden="true" className="h-4 w-4" />
            {isFr ? "Réserver cette formation" : "Book this training"}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}
    </>
  );
}
