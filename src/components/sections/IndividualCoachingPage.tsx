// Composant template — pages détail des 2 formats Coaching individuel.
// Sprint 14.10.7 (Will 2026-05-11) : 2 formats 1 jour différenciés par profil
// maturité (découverte vs avancé), même objectif fonctionnel (audit poste +
// automatismes + plan implémentation devis).
//
// Le composant template factorise la structure (hero + bénéfices + programme
// jour + FAQ + CTA) ; les 2 configs `COACHING_CONFIGS` portent les seules
// variations. Ajouter un 3ᵉ format = 1 entrée dans la map + 1 fichier page.tsx
// wrapper (~25 lignes).

import type { ReactNode } from "react";
import { ArrowRight, Mail, Clock, Sparkles, Compass, Target, TrendingUp } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getFamily,
  INTERVENTION_FORMATS,
  type InterventionFormatEntry,
} from "@/content/interventions-taxonomy";
import { buildServiceJsonLd } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

// ----------------------------------------------------------------------------
// Configs spécifiques aux 2 formats — seules variations vs template commun.
// ----------------------------------------------------------------------------

export type IndividualCoachingSlug = "coaching-decouverte" | "coaching-avance";

interface CoachingBenefit {
  icon: typeof Compass;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
}

interface CoachingScheduleItem {
  time: string;
  titleFr: string;
  titleEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
}

interface CoachingConfig {
  /** Slug intervention (clé dans INTERVENTION_FORMATS). */
  slug: IndividualCoachingSlug;
  /** Objet pré-rempli formulaire contact. */
  contactObject: string;
  /** H1 hero — variation localisée. */
  titleFr: string;
  titleEn: string;
  titleEmFr: string;
  titleEmEn: string;
  /** Promesse 1 ligne sous le H1. */
  promiseFr: string;
  promiseEn: string;
  /** 3 chips ROI sous le hero. */
  chipsFr: ReadonlyArray<string>;
  chipsEn: ReadonlyArray<string>;
  /** 4 bénéfices structurants. */
  benefits: ReadonlyArray<CoachingBenefit>;
  /** Programme type de la journée (9 h – 17 h). */
  schedule: ReadonlyArray<CoachingScheduleItem>;
  /** FAQ 3-4 questions. */
  faq: ReadonlyArray<{ qFr: string; qEn: string; aFr: string; aEn: string }>;
}

const COACHING_CONFIGS: Record<IndividualCoachingSlug, CoachingConfig> = {
  "coaching-decouverte": {
    slug: "coaching-decouverte",
    contactObject: "coaching-decouverte-1j",
    titleFr: "Coaching IA · Découverte personnelle",
    titleEn: "AI Coaching · Personal discovery",
    titleEmFr: "1 jour pour démarrer",
    titleEmEn: "1 day to get started",
    promiseFr:
      "Vous arrivez à votre poste de travail le matin. Le soir, l'IA est installée, configurée et 3 à 5 automatismes tournent déjà. Concret, dès le lendemain.",
    promiseEn:
      "You arrive at your workstation in the morning. By evening, AI is installed, configured and 3 to 5 automations are already running. Concrete results from day one.",
    chipsFr: [
      "3 à 5 automatismes opérationnels",
      "Outils IA installés",
      "Plan implémentation chiffré",
    ],
    chipsEn: ["3-5 working automations", "AI tools installed", "Quantified implementation plan"],
    benefits: [
      {
        icon: Compass,
        titleFr: "Audit complet de votre poste",
        titleEn: "Full audit of your workstation",
        bodyFr:
          "On regarde ensemble vos vrais chronophages : boîte mail, reporting, recherches, comptes-rendus, contenus. On identifie quoi est automatisable maintenant et quoi nécessite un programme dédié.",
        bodyEn:
          "We look at your real time-sinks together: inbox, reporting, research, meeting notes, content. We identify what can be automated now and what needs a dedicated programme.",
      },
      {
        icon: Sparkles,
        titleFr: "Installation des outils essentiels",
        titleEn: "Essential tools installed",
        bodyFr:
          "ChatGPT / Claude, extensions navigateur, transcripteurs de réunion, intégrations bureau — installés et configurés sur votre poste, avec vos accès. Vous êtes opérationnel·le immédiatement.",
        bodyEn:
          "ChatGPT / Claude, browser extensions, meeting transcribers, desktop integrations — installed and configured on your workstation with your logins. You're operational immediately.",
      },
      {
        icon: TrendingUp,
        titleFr: "3 à 5 automatismes mis en place",
        titleEn: "3 to 5 automations in place",
        bodyFr:
          "Pendant la journée, on fait — pas seulement on parle. Templates de prompts pour vos cas récurrents, workflows simples, intégrations entre vos outils existants. Tout testé sur vos vraies données.",
        bodyEn:
          "During the day, we do — not just talk. Prompt templates for your recurring cases, simple workflows, integrations between your existing tools. All tested on your real data.",
      },
      {
        icon: Target,
        titleFr: "Plan implémentation pour aller plus loin",
        titleEn: "Implementation plan to go further",
        bodyFr:
          "Tout n'est pas réalisable en 1 jour. Pour les chantiers plus lourds (CRM, ERP, agents complexes), vous repartez avec un plan d'implémentation chiffré, prêt à exécuter par vos équipes ou par nous sur devis.",
        bodyEn:
          "Not everything is doable in 1 day. For heavier projects (CRM, ERP, complex agents), you leave with a quantified implementation plan, ready to execute by your teams or by us on request.",
      },
    ],
    schedule: [
      {
        time: "9 h 00",
        titleFr: "Accueil + tour d'horizon de votre poste",
        titleEn: "Welcome + tour of your workstation",
      },
      {
        time: "9 h 30",
        titleFr: "Cartographie des chronophages réels",
        titleEn: "Mapping real time-sinks",
        descriptionFr: "On liste vos tâches répétitives, on chiffre le temps perdu, on priorise.",
        descriptionEn: "We list your repetitive tasks, quantify time lost, prioritise.",
      },
      {
        time: "11 h 00",
        titleFr: "Installation des outils IA essentiels",
        titleEn: "Installing essential AI tools",
        descriptionFr:
          "ChatGPT / Claude, extensions, transcripteurs — installés et testés sur vos accès.",
        descriptionEn:
          "ChatGPT / Claude, extensions, transcribers — installed and tested with your logins.",
      },
      {
        time: "12 h 30",
        titleFr: "Pause déjeuner (12 h 30 – 14 h)",
        titleEn: "Lunch break (12:30 – 14:00)",
      },
      {
        time: "14 h 00",
        titleFr: "Mise en place des 3-5 premiers automatismes",
        titleEn: "Setting up the first 3-5 automations",
        descriptionFr:
          "Templates prompts, workflows simples, intégrations bureau — testés sur vos vraies données.",
        descriptionEn:
          "Prompt templates, simple workflows, desktop integrations — tested on your real data.",
      },
      {
        time: "16 h 00",
        titleFr: "Plan d'implémentation pour aller plus loin",
        titleEn: "Implementation plan to go further",
        descriptionFr:
          "Chiffrage des chantiers plus lourds + recommandations pour vos équipes ou pour nous sur devis.",
        descriptionEn:
          "Quantification of heavier projects + recommendations for your teams or us on request.",
      },
      {
        time: "17 h 00",
        titleFr: "Synthèse + ressources fournies + clôture",
        titleEn: "Synthesis + resources shared + close",
      },
    ],
    faq: [
      {
        qFr: "Je n'ai jamais utilisé l'IA, c'est pour moi ?",
        qEn: "I've never used AI — is this for me?",
        aFr: "Oui — c'est exactement le bon format. La journée est calibrée pour quelqu'un qui démarre. Pas de jargon, pas de présupposé, on part de zéro et on construit ensemble.",
        aEn: "Yes — this is exactly the right format. The day is calibrated for someone starting out. No jargon, no assumptions, we start from zero and build together.",
      },
      {
        qFr: "Vous installez sur quel matériel ?",
        qEn: "Which hardware do you install on?",
        aFr: "Votre poste de travail habituel — Windows, macOS, Linux. On utilise vos vrais accès (boîte mail, drive, outils métier) pour que vous soyez opérationnel·le dès le lendemain matin sur les mêmes outils.",
        aEn: "Your usual workstation — Windows, macOS, Linux. We use your real logins (inbox, drive, business tools) so you're operational the next morning on the same tools.",
      },
      {
        qFr: "Si je veux aller plus loin après la journée ?",
        qEn: "What if I want to go further after the day?",
        aFr: "Le plan d'implémentation que vous emportez chiffre ce qui reste à faire. Vous pouvez l'exécuter en interne, ou nous le confier sur devis via le module Implémentation IA.",
        aEn: "The implementation plan you take with you quantifies what remains to do. You can execute it internally, or commission us via the AI Implementation module on request.",
      },
    ],
  },
  "coaching-avance": {
    slug: "coaching-avance",
    contactObject: "coaching-avance-1j",
    titleFr: "Coaching IA · Productivité avancée",
    titleEn: "AI Coaching · Advanced productivity",
    titleEmFr: "1 jour pour maxer",
    titleEmEn: "1 day to level up",
    promiseFr:
      "Vous utilisez déjà ChatGPT ou Claude. On audite votre stack, on industrialise, on monte d'un cran : workflows multi-outils, agents personnels, Claude CLI / API. À la sortie, vous avez l'arsenal complet d'un pro IA.",
    promiseEn:
      "You already use ChatGPT or Claude. We audit your stack, industrialise it, level up: multi-tool workflows, personal agents, Claude CLI / API. By the end, you have the complete arsenal of an AI pro.",
    chipsFr: ["Workflows multi-outils", "Agents personnels", "Claude CLI / API maîtrisés"],
    chipsEn: ["Multi-tool workflows", "Personal agents", "Claude CLI / API mastered"],
    benefits: [
      {
        icon: Compass,
        titleFr: "Audit de votre stack IA actuelle",
        titleEn: "Audit of your current AI stack",
        bodyFr:
          "On regarde ce que vous utilisez vraiment et comment. On identifie les outils sous-exploités, les workflows manuels qui devraient être automatisés et les intégrations manquantes.",
        bodyEn:
          "We look at what you actually use and how. We identify under-leveraged tools, manual workflows that should be automated, and missing integrations.",
      },
      {
        icon: Sparkles,
        titleFr: "Workflows IA multi-outils",
        titleEn: "Multi-tool AI workflows",
        bodyFr:
          "On crée des chaînes : Claude → vos notes → vos docs → votre CRM, ou ChatGPT → API → automation. Plus de copier-coller manuel entre 5 onglets.",
        bodyEn:
          "We build chains: Claude → your notes → your docs → your CRM, or ChatGPT → API → automation. No more manual copy-pasting between 5 tabs.",
      },
      {
        icon: TrendingUp,
        titleFr: "Agents personnels + Claude CLI / API",
        titleEn: "Personal agents + Claude CLI / API",
        bodyFr:
          "Configuration d'agents IA personnels (Claude Projects, Custom GPTs, Claude Code en CLI) pour vos cas récurrents. Vous appelez l'IA en 1 commande au lieu de réécrire le contexte à chaque fois.",
        bodyEn:
          "Configuration of personal AI agents (Claude Projects, Custom GPTs, Claude Code CLI) for your recurring cases. You call AI in 1 command instead of rewriting context every time.",
      },
      {
        icon: Target,
        titleFr: "Plan d'industrialisation pour votre équipe",
        titleEn: "Industrialisation plan for your team",
        bodyFr:
          "Vous voulez que vos collaborateurs montent au même niveau ? On chiffre le déploiement (formation équipe Approfondie, agents partagés, MCP servers internes) — prêt à exécuter en interne ou par nous sur devis.",
        bodyEn:
          "Want your team at the same level? We quantify the rollout (Deep Dive team training, shared agents, internal MCP servers) — ready to execute internally or by us on request.",
      },
    ],
    schedule: [
      {
        time: "9 h 00",
        titleFr: "Accueil + audit de votre stack actuelle",
        titleEn: "Welcome + audit of your current stack",
      },
      {
        time: "9 h 30",
        titleFr: "Diagnostic : outils sous-exploités, workflows manuels",
        titleEn: "Diagnosis: under-leveraged tools, manual workflows",
        descriptionFr:
          "On liste ce qui devrait être automatisé et ne l'est pas. Priorisation par ROI.",
        descriptionEn: "We list what should be automated and isn't. Prioritisation by ROI.",
      },
      {
        time: "11 h 00",
        titleFr: "Mise en place de workflows multi-outils",
        titleEn: "Setting up multi-tool workflows",
        descriptionFr:
          "Claude → notes → docs → CRM, ou ChatGPT → API → automation. Testés sur vos vrais cas.",
        descriptionEn:
          "Claude → notes → docs → CRM, or ChatGPT → API → automation. Tested on your real cases.",
      },
      {
        time: "12 h 30",
        titleFr: "Pause déjeuner (12 h 30 – 14 h)",
        titleEn: "Lunch break (12:30 – 14:00)",
      },
      {
        time: "14 h 00",
        titleFr: "Agents personnels + Claude CLI / API",
        titleEn: "Personal agents + Claude CLI / API",
        descriptionFr:
          "Configuration de Claude Projects / Custom GPTs / Claude Code CLI pour vos cas récurrents.",
        descriptionEn:
          "Configuration of Claude Projects / Custom GPTs / Claude Code CLI for your recurring cases.",
      },
      {
        time: "16 h 00",
        titleFr: "Plan d'industrialisation pour votre équipe",
        titleEn: "Industrialisation plan for your team",
        descriptionFr:
          "Chiffrage du déploiement IA à l'échelle équipe — formation, agents partagés, MCP.",
        descriptionEn: "Quantification of team-scale AI rollout — training, shared agents, MCP.",
      },
      {
        time: "17 h 00",
        titleFr: "Synthèse + ressources fournies + clôture",
        titleEn: "Synthesis + resources shared + close",
      },
    ],
    faq: [
      {
        qFr: "Quel est le pré-requis exact ?",
        qEn: "What's the exact prerequisite?",
        aFr: "Avoir utilisé ChatGPT ou Claude au moins quotidiennement pendant 2-3 mois. Si vous découvrez, prenez le format Découverte personnelle d'abord — vous gagnerez beaucoup plus.",
        aEn: "Having used ChatGPT or Claude at least daily for 2-3 months. If you're starting, take the Personal Discovery format first — you'll gain much more.",
      },
      {
        qFr: "Claude Code CLI, c'est pour moi qui ne code pas ?",
        qEn: "Claude Code CLI — is that for me if I don't code?",
        aFr: "Oui, partiellement. Le CLI sert aussi à automatiser des tâches non-code (manipulation de fichiers, génération de rapports, glue scripts). On adapte la journée à votre métier — si vous codez, on creuse plus profond ; sinon, on reste sur les usages bureau avancés.",
        aEn: "Yes, partially. The CLI also serves to automate non-code tasks (file manipulation, report generation, glue scripts). We adapt the day to your role — if you code, we go deeper; otherwise, we stay on advanced desktop use.",
      },
      {
        qFr: "Mes données restent privées ?",
        qEn: "Does my data stay private?",
        aFr: "Oui. On utilise vos comptes pros (Claude Team, ChatGPT Enterprise si vous l'avez) et on évite tout outil qui exporterait vos données vers du training tiers. Audit confidentialité fait en début de journée.",
        aEn: "Yes. We use your pro accounts (Claude Team, ChatGPT Enterprise if you have it) and avoid any tool that would export your data to third-party training. Confidentiality audit done at the start of the day.",
      },
    ],
  },
};

// ----------------------------------------------------------------------------
// Composant template
// ----------------------------------------------------------------------------

interface Props {
  slug: IndividualCoachingSlug;
  locale: Locale;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export function IndividualCoachingPage({ slug, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const config = COACHING_CONFIGS[slug];
  const entry: InterventionFormatEntry | undefined = INTERVENTION_FORMATS.find(
    (e) => e.slug === slug,
  );
  const family = getFamily("individuel");
  const contactHref = `/interventions/demande?objet=${encodeURIComponent(config.contactObject)}`;

  // Breadcrumbs : href = clé canonique FR (routing.pathnames) ; next-intl
  // résout la traduction EN automatiquement via le Link.
  const breadcrumbItems = [
    { href: "/interventions", label: isFr ? "Interventions" : "Sessions" },
    {
      href: "/interventions/individuel",
      label: isFr ? family.labelFr : family.labelEn,
    },
    {
      href: `/interventions/${slug}`,
      label: isFr ? config.titleFr : config.titleEn,
    },
  ];

  // Service JSON-LD
  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path: `/interventions/${slug}`,
    name: `${isFr ? config.titleFr : config.titleEn} · Axion-IA`,
    description: isFr ? config.promiseFr : config.promiseEn,
    serviceType: "AI coaching",
    priceEur: 0,
    areasServed: buildServiceAreasServed(locale),
  });

  // FAQPage JSON-LD pour AEO
  const faqJsonLd =
    config.faq.length > 0
      ? ({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: config.faq.map((f) => ({
            "@type": "Question",
            name: isFr ? f.qFr : f.qEn,
            acceptedAnswer: {
              "@type": "Answer",
              text: isFr ? f.aFr : f.aEn,
            },
          })),
        } as const)
      : null;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-cool text-fg relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Coaching individuel · 1 jour" : "Individual coaching · 1 day"}
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

            {/* 3 chips bénéfice ROI */}
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
              <Cta href={contactHref} size="lg">
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Demander ce coaching" : "Request this coaching"}
              </Cta>
              <Cta href="/interventions/individuel" variant="outline" size="lg">
                {isFr ? "← Autres coachings individuels" : "← Other individual coachings"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* 4 BÉNÉFICES */}
      <Section
        eyebrow={isFr ? "Ce que vous obtenez" : "What you get"}
        title={isFr ? "4 bénéfices" : "4 benefits"}
        titleEm={isFr ? "concrets et chiffrés" : "concrete and quantified"}
        description={
          isFr
            ? "On ne parle pas dans le vide. À la fin de la journée, voici ce qui est en place sur votre poste."
            : "We don't talk in a vacuum. By the end of the day, here's what's in place on your workstation."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:gap-7">
          {config.benefits.map((b, i) => {
            const BenefitIcon = b.icon;
            return (
              <article
                key={i}
                className="bg-paper border-border shadow-subtle rounded-2xl border p-6 sm:p-7"
              >
                <div className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl">
                  <BenefitIcon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="text-fg text-lg leading-snug font-semibold">
                  {isFr ? b.titleFr : b.titleEn}
                </h3>
                <p className="text-fg-soft mt-3 text-[14.5px] leading-relaxed">
                  {isFr ? b.bodyFr : b.bodyEn}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      {/* PROGRAMME JOUR */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Programme type" : "Standard programme"}
        title={isFr ? "Une journée" : "One day"}
        titleEm={isFr ? "structurée 9 h – 17 h" : "structured 9 a.m. – 5 p.m."}
        description={
          isFr
            ? "Programme adapté en début de matinée selon votre tour d'horizon. La trame reste celle-ci."
            : "Programme adapted at the start of the morning based on your overview. The frame stays the same."
        }
        contentClassName={TIGHT_X}
      >
        <ol className="border-border/60 mx-auto max-w-3xl border-l-2 pl-6">
          {config.schedule.map((item, i) => (
            <li key={i} className="relative pb-6 last:pb-0">
              <span
                aria-hidden="true"
                className="bg-terracotta ring-terracotta-soft absolute -left-[31px] mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full ring-4"
              >
                <Clock aria-hidden="true" className="text-paper h-2 w-2" strokeWidth={3} />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-terracotta-deep text-[13px] font-bold tracking-wide uppercase tabular-nums">
                  {item.time}
                </span>
                <span className="text-fg text-[15px] font-semibold">
                  {isFr ? item.titleFr : item.titleEn}
                </span>
              </div>
              {item.descriptionFr || item.descriptionEn ? (
                <p className="text-fg-soft mt-1 text-[13.5px] leading-relaxed">
                  {isFr ? item.descriptionFr : item.descriptionEn}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="text-fg-muted mx-auto mt-6 max-w-3xl text-[12.5px] leading-relaxed">
          {isFr
            ? "Frais de logement, repas et forfait trajet en sus, facturés au cas par cas selon la distance et la durée. Devis transparent fourni avant signature."
            : "Lodging, meals and travel allowance billed separately, calculated case by case based on distance and duration. Transparent quote provided before signature."}
        </p>
      </Section>

      {/* FAQ */}
      <Section
        tone="sand"
        eyebrow="FAQ"
        title={isFr ? "Questions" : "Questions"}
        titleEm={isFr ? "fréquentes" : "we hear often"}
        contentClassName={TIGHT_X}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {config.faq.map((f, i) => (
            <details
              key={i}
              className="bg-paper border-border group/faq open:shadow-subtle rounded-2xl border p-5"
            >
              <summary className="text-fg flex cursor-pointer items-start justify-between gap-3 text-base font-semibold">
                <span>{isFr ? f.qFr : f.qEn}</span>
                <span
                  aria-hidden="true"
                  className="bg-terracotta-soft text-terracotta-deep mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs transition-transform duration-200 group-open/faq:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-fg-soft mt-3 text-[14.5px] leading-relaxed">
                {isFr ? f.aFr : f.aEn}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={
          isFr ? "Cadrage 20 minutes avant de réserver" : "20-minute framing call before booking"
        }
        description={
          isFr
            ? "On vous appelle, on comprend votre contexte et votre poste, on chiffre. Devis sous 48 h ouvrées. Aucun engagement avant signature."
            : "We call you, understand your context and workstation, quote. Quote within 48 business hours. No commitment before signing."
        }
        cta={
          <Cta href={contactHref} size="lg">
            <Mail aria-hidden="true" className="h-4 w-4" />
            {isFr ? "Demander ce coaching" : "Request this coaching"}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}
    </>
  );
}
