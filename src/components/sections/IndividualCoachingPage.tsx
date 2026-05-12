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
import { ArrowRight, Mail, Sparkles, Compass, Target, TrendingUp } from "lucide-react";
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
      "Vous arrivez à votre poste de travail le matin. Le soir, vous maîtrisez les bons outils IA, vous avez appris 3 à 5 méthodes opérationnelles à appliquer immédiatement, et vous savez exactement où l'IA vous fera gagner du temps. Concret, dès le lendemain.",
    promiseEn:
      "You arrive at your workstation in the morning. By evening, you master the right AI tools, you've learnt 3 to 5 operational methods to apply immediately, and you know exactly where AI will save you time. Concrete results from day one.",
    chipsFr: ["3 à 5 méthodes maîtrisées", "Outils IA pris en main", "Plan d'action chiffré"],
    chipsEn: ["3-5 methods mastered", "AI tools mastered", "Quantified action plan"],
    benefits: [
      {
        icon: Compass,
        titleFr: "Audit complet de votre poste",
        titleEn: "Full audit of your workstation",
        bodyFr:
          "On regarde ensemble vos vrais chronophages : boîte mail, reporting, recherches, comptes-rendus, contenus. On identifie où l'IA va vous faire gagner du temps maintenant et ce qui nécessitera un accompagnement plus long.",
        bodyEn:
          "We look at your real time-sinks together: inbox, reporting, research, meeting notes, content. We identify where AI will save you time now and what will need a longer programme.",
      },
      {
        icon: Sparkles,
        titleFr: "Prise en main des outils essentiels",
        titleEn: "Hands-on with essential tools",
        bodyFr:
          "ChatGPT / Claude, extensions navigateur, transcripteurs de réunion. Vous apprenez à les utiliser efficacement sur vos vraies données, vos vrais documents, votre vrai quotidien. À la sortie, vous êtes autonome.",
        bodyEn:
          "ChatGPT / Claude, browser extensions, meeting transcribers. You learn to use them efficiently on your real data, your real documents, your real daily work. You leave autonomous.",
      },
      {
        icon: TrendingUp,
        titleFr: "3 à 5 méthodes opérationnelles maîtrisées",
        titleEn: "3 to 5 operational methods mastered",
        bodyFr:
          "Pendant la journée, on pratique — pas seulement on parle. Templates de prompts pour vos cas récurrents, méthodes de travail avec l'IA, workflows simples sur vos outils existants. Vous repartez avec les techniques maîtrisées et un cahier de prompts personnel.",
        bodyEn:
          "During the day, we practise — not just talk. Prompt templates for your recurring cases, work methods with AI, simple workflows on your existing tools. You leave with the techniques mastered and a personal prompt notebook.",
      },
      {
        icon: Target,
        titleFr: "Plan d'action chiffré pour aller plus loin",
        titleEn: "Quantified action plan to go further",
        bodyFr:
          "À l'issue de la journée, vous avez en main un plan d'action priorisé : ce que vous pouvez appliquer seul·e dès demain, et ce qui mériterait un accompagnement dédié plus tard (sur devis). Vous décidez en pleine connaissance de cause.",
        bodyEn:
          "By the end of the day, you have a prioritised action plan in hand: what you can apply on your own tomorrow, and what would deserve dedicated support later (on request). You decide with full knowledge.",
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
        titleFr: "Prise en main des outils IA essentiels",
        titleEn: "Hands-on with essential AI tools",
        descriptionFr:
          "ChatGPT / Claude, extensions, transcripteurs — on apprend à les utiliser efficacement sur vos vrais cas.",
        descriptionEn:
          "ChatGPT / Claude, extensions, transcribers — we learn to use them effectively on your real cases.",
      },
      {
        time: "12 h 30",
        titleFr: "Pause déjeuner (12 h 30 – 14 h)",
        titleEn: "Lunch break (12:30 – 14:00)",
      },
      {
        time: "14 h 00",
        titleFr: "Pratique sur 3 à 5 cas concrets",
        titleEn: "Practice on 3 to 5 real cases",
        descriptionFr:
          "Templates de prompts, méthodes de travail, workflows simples — pratiqués sur vos vrais documents et données.",
        descriptionEn:
          "Prompt templates, work methods, simple workflows — practised on your real documents and data.",
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
          "On regarde ce que vous utilisez vraiment et comment. On identifie les outils sous-exploités, les méthodes qui peuvent être améliorées avec l'IA et les fonctionnalités avancées que vous n'utilisez pas encore.",
        bodyEn:
          "We look at what you actually use and how. We identify under-leveraged tools, methods that can be improved with AI, and advanced features you don't use yet.",
      },
      {
        icon: Sparkles,
        titleFr: "Workflows IA multi-outils",
        titleEn: "Multi-tool AI workflows",
        bodyFr:
          "Vous apprenez à enchaîner les outils IA : passer un document de Claude à vos notes, vers vos docs, vers votre CRM. Méthode complète enseignée pas-à-pas sur vos vrais cas — plus de copier-coller manuel entre 5 onglets.",
        bodyEn:
          "You learn to chain AI tools: move a document from Claude to your notes, to your docs, to your CRM. Complete method taught step-by-step on your real cases — no more manual copy-pasting between 5 tabs.",
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
        titleFr: "Diagnostic : outils sous-exploités, méthodes à améliorer",
        titleEn: "Diagnosis: under-leveraged tools, methods to improve",
        descriptionFr:
          "On liste ce que l'IA peut accélérer dans votre quotidien. Priorisation par gain de temps.",
        descriptionEn:
          "We list where AI can accelerate your daily work. Prioritisation by time saved.",
      },
      {
        time: "11 h 00",
        titleFr: "Maîtrise des workflows multi-outils",
        titleEn: "Mastering multi-tool workflows",
        descriptionFr:
          "Méthodes d'enchaînement : passer d'un outil à l'autre avec l'IA. Pratiqué sur vos vrais cas.",
        descriptionEn:
          "Chaining methods: moving from one tool to another with AI. Practised on your real cases.",
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
      <section className="bg-halo-warm relative overflow-hidden py-16 sm:py-20 lg:py-24">
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
              <Cta
                href={contactHref}
                size="lg"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
              >
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

      {/* PROGRAMME JOUR — JUSTE APRÈS LE HERO (Will 2026-05-12) */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Programme type · 9 h – 17 h" : "Standard programme · 9 a.m. – 5 p.m."}
        title={isFr ? "Le détail" : "Detailed"}
        titleEm={isFr ? "de votre journée" : "day breakdown"}
        description={
          isFr
            ? "Programme cadré en amont, adapté en début de matinée selon votre tour d'horizon."
            : "Programme framed upstream, adapted at the start of the morning based on your overview."
        }
        contentClassName={TIGHT_X}
      >
        <InterventionSchedule items={config.schedule} isFr={isFr} />
      </Section>

      {/* 4 BÉNÉFICES */}
      <Section
        eyebrow={isFr ? "Ce que vous obtenez" : "What you get"}
        title={isFr ? "4 bénéfices" : "4 benefits"}
        titleEm={isFr ? "concrets et chiffrés" : "concrete and quantified"}
        description={
          isFr
            ? "À la fin de la journée, voici ce que vous maîtrisez."
            : "By the end of the day, here's what you master."
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
        title={
          isFr ? "Cadrage 20 minutes avant de réserver" : "20-minute framing call before booking"
        }
        description={
          isFr
            ? "On vous appelle, on comprend votre contexte et votre poste, on chiffre. Devis sous 48 h ouvrées. Aucun engagement avant signature."
            : "We call you, understand your context and workstation, quote. Quote within 48 business hours. No commitment before signing."
        }
        cta={
          <Cta
            href={contactHref}
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          >
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
