// Configs SSOT des pages détail format — Sprint 14.10.7 (Will 2026-05-12).
//
// Centralise le contenu de chaque page détail format (hero + chips + benefits
// + programme + FAQ) pour les formats Dirigeants + Claude Implementation
// Individuel (les coachings individuels et formations 4 h ont leur propre
// template). Famille Conférence retirée 2026-05-28.
//
// Avantage : 1 seule source de vérité pour le contenu format, le template
// `InterventionDetailPage` rend chaque page de façon identique → harmonie
// visuelle parfaite entre les pages.

import { Compass, Sparkles, TrendingUp, Target, Eye, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { INTERVENTION_TIERS, getTierById } from "./pricing";

export type InterventionDetailSlug =
  | "dirigeant-vision-strategique"
  | "claude-dirigeant"
  | "claude-implementation-individuel";

export interface DetailBenefit {
  icon: LucideIcon;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
}

export interface DetailScheduleItem {
  time: string;
  titleFr: string;
  titleEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
}

export interface DetailFaq {
  qFr: string;
  qEn: string;
  aFr: string;
  aEn: string;
}

export interface InterventionDetailConfig {
  slug: InterventionDetailSlug;
  /** Slug du format dans INTERVENTION_FORMATS pour lookup taxonomy. */
  formatSlug: string;
  /** Famille pour breadcrumbs (collectives / individuel / dirigeants). */
  familySlug: "dirigeants" | "individuel" | "collectives";
  /** Objet pré-rempli pour /interventions/demande. */
  contactObject: string;
  titleFr: string;
  titleEn: string;
  titleEmFr: string;
  titleEmEn: string;
  promiseFr: string;
  promiseEn: string;
  chipsFr: ReadonlyArray<string>;
  chipsEn: ReadonlyArray<string>;
  benefits: ReadonlyArray<DetailBenefit>;
  /** Programme : `null` si format sur devis sans planning fixe (Will). */
  schedule: ReadonlyArray<DetailScheduleItem> | null;
  scheduleTitleFr?: string;
  scheduleTitleEn?: string;
  faq: ReadonlyArray<DetailFaq>;
  /** Si défini : prix fixe en € HT pour le badge hero. */
  priceFlatEur?: number;
  /** Si défini : tag effectif pour le badge hero. */
  groupSizeFr: string;
  groupSizeEn: string;
}

// ============================================================================
// DIRIGEANTS — 2 formats (Vision stratégique / Claude)
// ============================================================================

const DIRIGEANT_VISION_BENEFITS: ReadonlyArray<DetailBenefit> = [
  {
    icon: Eye,
    titleFr: "Voir clairement où va votre secteur",
    titleEn: "See clearly where your sector is heading",
    bodyFr:
      "Panorama IA 2026 ciblé sur VOTRE secteur d'activité : ce que font vraiment les concurrents, qui prend de l'avance, quels usages se généralisent. Pas de buzz, des faits.",
    bodyEn:
      "2026 AI panorama focused on YOUR sector: what competitors actually do, who is gaining ground, which uses are becoming standard. No buzz, just facts.",
  },
  {
    icon: Lightbulb,
    titleFr: "Identifier les opportunités stratégiques",
    titleEn: "Identify strategic opportunities",
    bodyFr:
      "On regarde votre business model et on identifie 5 à 10 leviers IA stratégiques : nouvelles offres possibles, optimisations process majeurs, services additionnels, gains de marge — chacun chiffré en potentiel.",
    bodyEn:
      "We look at your business model and identify 5 to 10 strategic AI levers: possible new offerings, major process optimisations, additional services, margin gains — each quantified in potential.",
  },
  {
    icon: Compass,
    titleFr: "Penser différemment l'entreprise",
    titleEn: "Think the company differently",
    bodyFr:
      "Atelier de réflexion stratégique : comment l'IA peut transformer votre organisation, vos métiers, votre rapport client. Pas un plan à exécuter — un déclic pour penser autrement.",
    bodyEn:
      "Strategic thinking workshop: how AI can transform your organisation, your roles, your customer relationship. Not a plan to execute — a shift to think differently.",
  },
  {
    icon: Target,
    titleFr: "Plan stratégique en surface, pas un audit",
    titleEn: "Surface strategic plan, not a full audit",
    bodyFr:
      "À l'issue : note de cadrage stratégique sous 7 jours, avec priorités identifiées et orientations. Pas un audit complet (plus long, plus profond) — un point de départ clair pour vos décisions.",
    bodyEn:
      "By the end: strategic framing note within 7 days, with identified priorities and orientations. Not a full audit (longer, deeper) — a clear starting point for your decisions.",
  },
];

const DIRIGEANT_VISION_SCHEDULE: ReadonlyArray<DetailScheduleItem> = [
  {
    time: "9 h 00",
    titleFr: "Accueil + état de votre entreprise (vision dirigeant)",
    titleEn: "Welcome + state of your company (executive view)",
  },
  {
    time: "9 h 30",
    titleFr: "Panorama IA 2026 ciblé sur votre secteur",
    titleEn: "2026 AI panorama focused on your sector",
    descriptionFr:
      "État de l'art, mouvements concurrents, signaux faibles, opportunités émergentes.",
    descriptionEn: "State of the art, competitor moves, weak signals, emerging opportunities.",
  },
  {
    time: "11 h 00",
    titleFr: "Pause café",
    titleEn: "Coffee break",
  },
  {
    time: "11 h 15",
    titleFr: "Atelier 1 — Cartographie stratégique de votre business",
    titleEn: "Workshop 1 — Strategic mapping of your business",
    descriptionFr:
      "Forces, faiblesses, modèle économique — où l'IA peut accélérer, où elle peut menacer.",
    descriptionEn:
      "Strengths, weaknesses, business model — where AI can accelerate, where it can threaten.",
  },
  {
    time: "12 h 30",
    titleFr: "Déjeuner stratégique (12 h 30 – 14 h)",
    titleEn: "Strategic lunch (12:30 – 14:00)",
  },
  {
    time: "14 h 00",
    titleFr: "Atelier 2 — 5 à 10 leviers stratégiques chiffrés",
    titleEn: "Workshop 2 — 5 to 10 quantified strategic levers",
    descriptionFr:
      "Nouvelles offres, optimisations majeures, services additionnels — potentiel quantifié.",
    descriptionEn:
      "New offerings, major optimisations, additional services — quantified potential.",
  },
  {
    time: "15 h 30",
    titleFr: "Pause",
    titleEn: "Break",
  },
  {
    time: "15 h 45",
    titleFr: "Atelier 3 — Penser différemment grâce à l'IA",
    titleEn: "Workshop 3 — Think differently thanks to AI",
    descriptionFr:
      "Brainstorming dirigé : comment transformer l'organisation, les métiers, la relation client.",
    descriptionEn:
      "Guided brainstorming: how to transform the organisation, roles, customer relationship.",
  },
  {
    time: "17 h 00",
    titleFr: "Synthèse + note de cadrage stratégique sous 7 jours",
    titleEn: "Synthesis + strategic framing note within 7 days",
  },
];

const DIRIGEANT_VISION_FAQ: ReadonlyArray<DetailFaq> = [
  {
    qFr: "Quelle différence avec un audit IA complet ?",
    qEn: "What's the difference with a full AI audit?",
    aFr: "Vision IA = 1 journée 1-to-1 avec vous, en surface (panorama, leviers, déclic). Audit IA = analyse approfondie sur plusieurs jours/semaines, multi-services, multi-entretiens. Vision = point de départ stratégique ; audit = plan d'action détaillé chiffré.",
    aEn: "AI Vision = 1 day 1-on-1 with you, at surface level (panorama, levers, shift). AI Audit = deep analysis over several days/weeks, multi-department, multi-interview. Vision = strategic starting point; audit = detailed quantified action plan.",
  },
  {
    qFr: "Est-ce que c'est applicable à mon secteur ?",
    qEn: "Is it applicable to my sector?",
    aFr: "Oui. La journée est construite sur VOTRE secteur, pas générique. On vous demande en amont 3 sujets clés pour préparer un panorama réellement utile. Tous secteurs : industrie, services, BTP, e-commerce, professions libérales, etc.",
    aEn: "Yes. The day is built on YOUR sector, not generic. We ask for 3 key topics upstream to prepare a truly useful panorama. All sectors: industry, services, construction, e-commerce, professional services, etc.",
  },
  {
    qFr: "Et après la journée, si je veux approfondir ?",
    qEn: "What if I want to dig deeper after the day?",
    aFr: "La note de cadrage sous 7 jours identifie les priorités. Si vous voulez un audit complet, on bascule vers le module Audit IA (sur devis selon profondeur). Si vous voulez former vos équipes, vers le module Interventions équipe.",
    aEn: "The framing note within 7 days identifies priorities. If you want a full audit, we move to the AI Audit module (on request based on depth). If you want to train your teams, to the Team Interventions module.",
  },
];

const CLAUDE_DIRIGEANT_BENEFITS: ReadonlyArray<DetailBenefit> = [
  {
    icon: Sparkles,
    titleFr: "Maîtrise de Claude Chat avancé",
    titleEn: "Master advanced Claude Chat",
    bodyFr:
      "Prompts longs, contextes riches, raisonnement, analyse de documents stratégiques. Vous apprenez à utiliser Claude comme un véritable conseiller stratégique de poche.",
    bodyEn:
      "Long prompts, rich contexts, reasoning, strategic document analysis. You learn to use Claude as a true pocket strategic advisor.",
  },
  {
    icon: Compass,
    titleFr: "Projects avec mémoire stratégique",
    titleEn: "Projects with strategic memory",
    bodyFr:
      "Configuration de Claude Projects dédiés à vos dossiers récurrents : roadmap entreprise, suivi concurrence, préparation board. Mémoire persistante, fichiers attachés, accès rapide.",
    bodyEn:
      "Setup of Claude Projects dedicated to your recurring files: company roadmap, competition tracking, board prep. Persistent memory, attached files, quick access.",
  },
  {
    icon: TrendingUp,
    titleFr: "Claude Code CLI pour vos dossiers",
    titleEn: "Claude Code CLI for your files",
    bodyFr:
      "Pas que pour le code : Claude Code CLI traite aussi vos fichiers Excel, Word, PDF complexes en ligne de commande. Idéal pour les manipulations de documents stratégiques confidentiels.",
    bodyEn:
      "Not just for code: Claude Code CLI also handles your complex Excel, Word, PDF files via command line. Ideal for confidential strategic document manipulation.",
  },
  {
    icon: Target,
    titleFr: "Confidentialité totale",
    titleEn: "Total confidentiality",
    bodyFr:
      "Configuration avec votre compte Claude Team (ou Enterprise) — vos données ne servent jamais à entraîner les modèles. Audit confidentialité fait en début de journée, avant toute manipulation.",
    bodyEn:
      "Setup with your Claude Team (or Enterprise) account — your data never trains the models. Confidentiality audit done at the start of the day, before any manipulation.",
  },
];

const CLAUDE_DIRIGEANT_SCHEDULE: ReadonlyArray<DetailScheduleItem> = [
  {
    time: "9 h 00",
    titleFr: "Accueil + audit confidentialité",
    titleEn: "Welcome + confidentiality audit",
    descriptionFr:
      "Configuration Claude Team/Enterprise, garanties sur vos données, périmètre fichiers autorisés.",
    descriptionEn: "Claude Team/Enterprise setup, data guarantees, scope of authorised files.",
  },
  {
    time: "9 h 30",
    titleFr: "Claude Chat avancé · maîtrise approfondie",
    titleEn: "Advanced Claude Chat · deep mastery",
    descriptionFr:
      "Prompts longs, contextes, raisonnement, analyse docs sur vos vrais dossiers stratégiques.",
    descriptionEn:
      "Long prompts, contexts, reasoning, document analysis on your real strategic files.",
  },
  {
    time: "11 h 00",
    titleFr: "Pause café",
    titleEn: "Coffee break",
  },
  {
    time: "11 h 15",
    titleFr: "Claude Projects · mémoire stratégique",
    titleEn: "Claude Projects · strategic memory",
    descriptionFr:
      "Configuration de 2-3 Projects dédiés à vos cas dirigeant : roadmap, concurrence, board.",
    descriptionEn:
      "Setup of 2-3 Projects dedicated to your executive cases: roadmap, competition, board.",
  },
  {
    time: "12 h 30",
    titleFr: "Déjeuner (12 h 30 – 14 h)",
    titleEn: "Lunch (12:30 – 14:00)",
  },
  {
    time: "14 h 00",
    titleFr: "Claude Code CLI · manipulation de documents complexes",
    titleEn: "Claude Code CLI · complex document manipulation",
    descriptionFr:
      "Excel, Word, PDF, données structurées — Claude Code en CLI sur vos vrais fichiers.",
    descriptionEn: "Excel, Word, PDF, structured data — Claude Code CLI on your real files.",
  },
  {
    time: "15 h 30",
    titleFr: "Pause",
    titleEn: "Break",
  },
  {
    time: "15 h 45",
    titleFr: "Workflows intégrés Chat + Projects + CLI",
    titleEn: "Integrated Chat + Projects + CLI workflows",
    descriptionFr:
      "Méthodes complètes sur vos cas récurrents — un dirigeant qui maîtrise Claude bout en bout.",
    descriptionEn:
      "Complete methods on your recurring cases — an executive mastering Claude end to end.",
  },
  {
    time: "17 h 00",
    titleFr: "Synthèse + cahier de prompts dirigeant + clôture",
    titleEn: "Synthesis + executive prompt notebook + close",
  },
];

const CLAUDE_DIRIGEANT_FAQ: ReadonlyArray<DetailFaq> = [
  {
    qFr: "Pourquoi Claude et pas ChatGPT ou Gemini ?",
    qEn: "Why Claude over ChatGPT or Gemini?",
    aFr: "Claude (Anthropic) est l'IA la plus avancée sur le raisonnement long, l'analyse de documents stratégiques et la confidentialité. Pour un dirigeant qui traite des dossiers sensibles, c'est l'outil de choix en 2026.",
    aEn: "Claude (Anthropic) is the most advanced AI on long reasoning, strategic document analysis, and confidentiality. For an executive handling sensitive files, it's the tool of choice in 2026.",
  },
  {
    qFr: "Faut-il déjà avoir utilisé Claude ?",
    qEn: "Do I need prior Claude experience?",
    aFr: "Non. Le format est calibré pour démarrer de zéro sur Claude — même si vous avez déjà utilisé ChatGPT, Claude a ses spécificités que la journée vous fait maîtriser.",
    aEn: "No. The format is calibrated to start from scratch on Claude — even if you've used ChatGPT, Claude has its specifics that the day will teach you to master.",
  },
  {
    qFr: "Mes données restent confidentielles ?",
    qEn: "Does my data stay confidential?",
    aFr: "Oui — on utilise votre propre compte Claude Team ou Enterprise (qui ne sert jamais à entraîner les modèles Anthropic). Audit confidentialité fait en début de journée. Vous gardez la maîtrise complète.",
    aEn: "Yes — we use your own Claude Team or Enterprise account (which never trains Anthropic's models). Confidentiality audit done at the start of the day. You keep full control.",
  },
];

// ============================================================================
// INDIVIDUEL — Claude Implementation
// ============================================================================

const CLAUDE_INDIVIDUEL_BENEFITS: ReadonlyArray<DetailBenefit> = [
  {
    icon: Sparkles,
    titleFr: "Installation et configuration Claude complète",
    titleEn: "Complete Claude installation and configuration",
    bodyFr:
      "Compte Claude Team configuré sur votre poste, extensions, intégrations bureau, accès rapides clavier. Vous êtes opérationnel·le immédiatement sur tous les surfaces Claude.",
    bodyEn:
      "Claude Team account configured on your workstation, extensions, desktop integrations, keyboard shortcuts. You're operational immediately on all Claude surfaces.",
  },
  {
    icon: Compass,
    titleFr: "Claude Chat + Projects + Code CLI",
    titleEn: "Claude Chat + Projects + Code CLI",
    bodyFr:
      "Les 3 surfaces Claude maîtrisées : Chat pour le quotidien, Projects pour vos dossiers récurrents avec mémoire, Code CLI pour les manipulations de fichiers et la productivité avancée.",
    bodyEn:
      "All 3 Claude surfaces mastered: Chat for daily work, Projects for your recurring files with memory, Code CLI for file manipulation and advanced productivity.",
  },
  {
    icon: TrendingUp,
    titleFr: "Agents personnels Claude",
    titleEn: "Personal Claude agents",
    bodyFr:
      "Configuration de 3 à 5 agents Claude personnels pour vos cas récurrents : assistant rédaction, agent recherche, copilote analyse. Vous appelez l'IA en 1 commande au lieu de réécrire le contexte.",
    bodyEn:
      "Setup of 3 to 5 personal Claude agents for your recurring cases: writing assistant, research agent, analysis copilot. You call AI in 1 command instead of rewriting context.",
  },
  {
    icon: Target,
    titleFr: "Workflows métier dédiés",
    titleEn: "Dedicated business workflows",
    bodyFr:
      "On adapte tous les usages Claude à votre métier précis (juridique, commercial, RH, marketing, technique, etc.). Vous repartez avec des méthodes maîtrisées pour votre quotidien réel.",
    bodyEn:
      "We adapt all Claude uses to your exact role (legal, sales, HR, marketing, technical, etc.). You leave with mastered methods for your real daily work.",
  },
];

const CLAUDE_INDIVIDUEL_SCHEDULE: ReadonlyArray<DetailScheduleItem> = [
  {
    time: "9 h 00",
    titleFr: "Accueil + état de vos usages IA actuels",
    titleEn: "Welcome + state of your current AI uses",
  },
  {
    time: "9 h 30",
    titleFr: "Claude Chat · prise en main approfondie",
    titleEn: "Claude Chat · deep hands-on",
    descriptionFr: "Prompts longs, contextes, analyse de docs sur vos vrais cas métier.",
    descriptionEn: "Long prompts, contexts, document analysis on your real business cases.",
  },
  {
    time: "11 h 00",
    titleFr: "Pause café",
    titleEn: "Coffee break",
  },
  {
    time: "11 h 15",
    titleFr: "Claude Projects · mémoire métier",
    titleEn: "Claude Projects · business memory",
    descriptionFr:
      "Configuration de 2-3 Projects dédiés à vos cas récurrents avec fichiers attachés.",
    descriptionEn: "Setup of 2-3 Projects dedicated to your recurring cases with attached files.",
  },
  {
    time: "12 h 30",
    titleFr: "Pause déjeuner (12 h 30 – 14 h)",
    titleEn: "Lunch break (12:30 – 14:00)",
  },
  {
    time: "14 h 00",
    titleFr: "Claude Code CLI · productivité avancée",
    titleEn: "Claude Code CLI · advanced productivity",
    descriptionFr:
      "Manipulation fichiers, traitement batch, workflows complexes en ligne de commande.",
    descriptionEn: "File manipulation, batch processing, complex workflows via command line.",
  },
  {
    time: "15 h 30",
    titleFr: "Pause",
    titleEn: "Break",
  },
  {
    time: "15 h 45",
    titleFr: "Configuration des agents personnels",
    titleEn: "Personal agents setup",
    descriptionFr: "3 à 5 agents Claude dédiés à vos cas récurrents — appelables en 1 commande.",
    descriptionEn:
      "3 to 5 Claude agents dedicated to your recurring cases — callable in 1 command.",
  },
  {
    time: "17 h 00",
    titleFr: "Synthèse + cahier de prompts personnels + clôture",
    titleEn: "Synthesis + personal prompt notebook + close",
  },
];

const CLAUDE_INDIVIDUEL_FAQ: ReadonlyArray<DetailFaq> = [
  {
    qFr: "Pourquoi Claude plutôt que ChatGPT ?",
    qEn: "Why Claude over ChatGPT?",
    aFr: "Claude (Anthropic) excelle sur le raisonnement long, l'analyse de documents et la confidentialité. Si vous traitez des fichiers structurés (Excel, PDF, contrats, code), Claude est nettement supérieur en 2026.",
    aEn: "Claude (Anthropic) excels at long reasoning, document analysis, and confidentiality. If you handle structured files (Excel, PDF, contracts, code), Claude is clearly superior in 2026.",
  },
  {
    qFr: "Faut-il être technique pour utiliser Claude Code CLI ?",
    qEn: "Do I need to be technical for Claude Code CLI?",
    aFr: "Le CLI sert aussi à automatiser des tâches non-code (manipulation de fichiers, génération de rapports, traitement batch). On adapte le volet Code à votre métier — si vous codez, on creuse ; sinon, on reste sur les usages bureau.",
    aEn: "The CLI also serves to automate non-code tasks (file manipulation, report generation, batch processing). We adapt the Code part to your role — if you code, we go deep; otherwise, we stay on desktop uses.",
  },
  {
    qFr: "Mes données restent privées ?",
    qEn: "Does my data stay private?",
    aFr: "Oui — on utilise votre compte Claude Team ou Enterprise (qui ne sert jamais à entraîner les modèles). Audit confidentialité fait en début de journée. Vous gardez la maîtrise complète.",
    aEn: "Yes — we use your Claude Team or Enterprise account (which never trains the models). Confidentiality audit done at the start of the day. You keep full control.",
  },
];

// ============================================================================
// CONFIG MAP
// ============================================================================

export const INTERVENTION_DETAIL_CONFIGS: Record<InterventionDetailSlug, InterventionDetailConfig> =
  {
    "dirigeant-vision-strategique": {
      slug: "dirigeant-vision-strategique",
      formatSlug: "dirigeant-vision-strategique",
      familySlug: "dirigeants",
      contactObject: "dirigeant-vision-strategique",
      priceFlatEur: getTierById(INTERVENTION_TIERS, "intervention-dirigeant-vision").priceFlat!,
      titleFr: "Vision IA stratégique",
      titleEn: "Strategic AI vision",
      titleEmFr: "Le déclic en 1 journée",
      titleEmEn: "The shift in 1 day",
      promiseFr:
        "Une journée 1-to-1 pour ouvrir les yeux du dirigeant sur ce que l'IA change DANS SON SECTEUR. Panorama des opportunités stratégiques, ce que font vraiment vos concurrents, comment penser différemment votre entreprise, quels leviers stratégiques activer. Pas un audit — un déclic stratégique.",
      promiseEn:
        "A 1-on-1 day to open the executive's eyes to what AI changes IN THEIR SECTOR. Strategic opportunity panorama, what competitors actually do, how to think your company differently, which strategic levers to activate. Not an audit — a strategic shift.",
      chipsFr: [
        "Panorama sectoriel ciblé",
        "5-10 leviers chiffrés",
        "Note de cadrage sous 7 jours",
      ],
      chipsEn: ["Targeted sector panorama", "5-10 quantified levers", "Framing note within 7 days"],
      benefits: DIRIGEANT_VISION_BENEFITS,
      schedule: DIRIGEANT_VISION_SCHEDULE,
      faq: DIRIGEANT_VISION_FAQ,
      groupSizeFr: "1 dirigeant (1-to-1 strict)",
      groupSizeEn: "1 executive (strict 1-on-1)",
    },
    "claude-dirigeant": {
      slug: "claude-dirigeant",
      formatSlug: "claude-dirigeant",
      familySlug: "dirigeants",
      contactObject: "claude-dirigeant",
      priceFlatEur: getTierById(INTERVENTION_TIERS, "intervention-claude-dirigeant").priceFlat!,
      titleFr: "Intervention Claude · Dirigeant",
      titleEn: "Claude Intervention · Executive",
      titleEmFr: "Maîtrise totale en 1 journée",
      titleEmEn: "Total mastery in 1 day",
      promiseFr:
        "Une journée 1-to-1 avec le dirigeant 100 % dédiée à Claude (Anthropic). Chat avancé, Projects avec mémoire stratégique, Code CLI pour vos dossiers confidentiels. À la sortie, vous maîtrisez l'outil IA de pointe pour toutes vos décisions stratégiques.",
      promiseEn:
        "A 1-on-1 executive day 100 % focused on Claude (Anthropic). Advanced Chat, Projects with strategic memory, Code CLI for your confidential files. By the end, you master the cutting-edge AI tool for all your strategic decisions.",
      chipsFr: ["Chat · Projects · Code CLI", "Mémoire stratégique", "Confidentialité Anthropic"],
      chipsEn: ["Chat · Projects · Code CLI", "Strategic memory", "Anthropic confidentiality"],
      benefits: CLAUDE_DIRIGEANT_BENEFITS,
      schedule: CLAUDE_DIRIGEANT_SCHEDULE,
      faq: CLAUDE_DIRIGEANT_FAQ,
      groupSizeFr: "1 dirigeant (1-to-1 strict)",
      groupSizeEn: "1 executive (strict 1-on-1)",
    },
    "claude-implementation-individuel": {
      slug: "claude-implementation-individuel",
      formatSlug: "claude-implementation-individuel",
      familySlug: "individuel",
      contactObject: "claude-implementation-individuel",
      titleFr: "Implémentation Claude · Individuel",
      titleEn: "Claude Implementation · Individual",
      titleEmFr: "Claude installé en 1 journée",
      titleEmEn: "Claude installed in 1 day",
      promiseFr:
        "Une journée 1-to-1 sur votre poste, 100 % Claude (Anthropic) : installation, configuration Chat + Projects + Code CLI, agents personnels Claude pour vos cas récurrents, workflows métier dédiés. À la sortie, vous maîtrisez Claude pour votre travail quotidien.",
      promiseEn:
        "A 1-on-1 day on your workstation, 100 % Claude (Anthropic): installation, Chat + Projects + Code CLI configuration, personal Claude agents for your recurring cases, dedicated business workflows. By the end, you master Claude for your daily work.",
      chipsFr: ["3 surfaces Claude maîtrisées", "Agents personnels", "Workflows métier"],
      chipsEn: ["3 Claude surfaces mastered", "Personal agents", "Business workflows"],
      benefits: CLAUDE_INDIVIDUEL_BENEFITS,
      schedule: CLAUDE_INDIVIDUEL_SCHEDULE,
      faq: CLAUDE_INDIVIDUEL_FAQ,
      groupSizeFr: "1 personne (1-to-1 strict)",
      groupSizeEn: "1 person (strict 1-on-1)",
    },
  };
