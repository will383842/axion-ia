// Configs SSOT des pages détail format — Sprint 14.10.7 (Will 2026-05-12).
//
// Centralise le contenu de chaque page détail format (hero + chips + benefits
// + programme + FAQ) pour les formats Dirigeants et Conférence (en plus
// des coachings individuels et formations 4 h qui ont leur propre template).
//
// Avantage : 1 seule source de vérité pour le contenu format, le template
// `InterventionDetailPage` rend chaque page de façon identique → harmonie
// visuelle parfaite entre les pages.

import {
  Compass,
  Sparkles,
  TrendingUp,
  Target,
  Inbox,
  Eye,
  Lightbulb,
  Users,
  Mic,
  Coffee,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type InterventionDetailSlug =
  | "dirigeant-productivite"
  | "dirigeant-vision-strategique"
  | "claude-dirigeant"
  | "conference-pleniere"
  | "conference-keynote"
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
  /** Famille pour breadcrumbs (collectives / individuel / dirigeants / conference). */
  familySlug: "dirigeants" | "conference" | "individuel" | "collectives";
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
// DIRIGEANTS — 3 formats (Productivité / Vision stratégique / Claude)
// ============================================================================

const DIRIGEANT_PRODUCTIVITE_BENEFITS: ReadonlyArray<DetailBenefit> = [
  {
    icon: Inbox,
    titleFr: "Libérer vos heures dirigeant",
    titleEn: "Free your executive hours",
    bodyFr:
      "Boîte mail, préparation de réunions, reporting, comptes-rendus, suivi commercial : on cartographie vos chronophages réels et on identifie ce qui peut passer en IA — chiffré en heures par semaine.",
    bodyEn:
      "Inbox, meeting prep, reporting, meeting notes, sales follow-up: we map your real time-sinks and identify what can move to AI — quantified in hours per week.",
  },
  {
    icon: TrendingUp,
    titleFr: "Augmenter vos marges",
    titleEn: "Lift your margins",
    bodyFr:
      "Gains de productivité personnels, accélération commerciale, réduction des coûts cachés — chaque levier chiffré en € attendus, pas en promesses vagues.",
    bodyEn:
      "Personal productivity gains, sales acceleration, hidden cost reduction — each lever quantified in expected €, not vague promises.",
  },
  {
    icon: Compass,
    titleFr: "Décider seul sur l'IA",
    titleEn: "Call your own AI shots",
    bodyFr:
      "Vision 12-24 mois pour votre entreprise + grille d'arbitrage personnelle — vous tranchez vos prochains investissements IA en autonomie, sans dépendre d'un cabinet.",
    bodyEn:
      "12-24 month vision for your company + personal decision framework — you decide on future AI investments in autonomy, no consulting dependency.",
  },
  {
    icon: Target,
    titleFr: "Plan d'exécution sous 7 jours",
    titleEn: "Execution plan within 7 days",
    bodyFr:
      "Rapport complet livré sous 7 jours : synthèse de la journée + recherches & vérifications post-séance + plan d'exécution priorisé et chiffré, prêt à lancer par vos équipes ou par nous.",
    bodyEn:
      "Full report delivered within 7 days: day-of synthesis + post-session research & validation + prioritised quantified execution plan, ready to ship by your teams or by us.",
  },
];

const DIRIGEANT_PRODUCTIVITE_SCHEDULE: ReadonlyArray<DetailScheduleItem> = [
  {
    time: "9 h 00",
    titleFr: "Accueil + cadrage 1-to-1 avec le dirigeant",
    titleEn: "Welcome + 1-on-1 framing with the executive",
  },
  {
    time: "9 h 30",
    titleFr: "Cartographie de votre journée type",
    titleEn: "Mapping your typical day",
    descriptionFr:
      "Boîte mail, réunions, reporting, comptes-rendus, suivi — on liste les chronophages réels et leur poids horaire.",
    descriptionEn:
      "Inbox, meetings, reporting, meeting notes, follow-up — we list the real time-sinks and their hourly weight.",
  },
  {
    time: "11 h 00",
    titleFr: "Pause café",
    titleEn: "Coffee break",
  },
  {
    time: "11 h 15",
    titleFr: "Atelier 1 — Quick-wins IA personnels",
    titleEn: "Workshop 1 — Personal AI quick-wins",
    descriptionFr:
      "Méthodes IA appliquées à vos vrais cas dirigeant, testées en live sur vos vraies données.",
    descriptionEn:
      "AI methods applied to your real executive cases, tested live on your real data.",
  },
  {
    time: "12 h 30",
    titleFr: "Déjeuner avec le dirigeant (12 h 30 – 14 h)",
    titleEn: "Lunch with the executive (12:30 – 14:00)",
  },
  {
    time: "14 h 00",
    titleFr: "Atelier 2 — Méthodes prioritaires par fonction",
    titleEn: "Workshop 2 — Priority methods by function",
    descriptionFr: "Pratique sur vos vrais dossiers : préparation, synthèse, rédaction, recherche.",
    descriptionEn: "Practice on your real files: preparation, synthesis, writing, research.",
  },
  {
    time: "15 h 30",
    titleFr: "Pause",
    titleEn: "Break",
  },
  {
    time: "15 h 45",
    titleFr: "Atelier 3 — Vision IA 12-24 mois pour votre entreprise",
    titleEn: "Workshop 3 — 12-24 month AI vision for your company",
    descriptionFr:
      "Grille d'arbitrage personnelle pour décider vos prochains investissements IA en autonomie.",
    descriptionEn: "Personal decision framework to choose your future AI investments in autonomy.",
  },
  {
    time: "17 h 00",
    titleFr: "Synthèse + ressources fournies + clôture",
    titleEn: "Synthesis + takeaways + close",
    descriptionFr:
      "Référentiel dirigeant, méthodes pratiquées, lectures recommandées — rapport sous 7 jours.",
    descriptionEn:
      "Executive reference sheet, methods practised, recommended reading — full report within 7 days.",
  },
];

const DIRIGEANT_PRODUCTIVITE_FAQ: ReadonlyArray<DetailFaq> = [
  {
    qFr: "Y a-t-il de l'implémentation pendant la journée ?",
    qEn: "Is there implementation during the day?",
    aFr: "Non. La journée est 100 % formation et stratégie : on identifie, on chiffre, on priorise. L'implémentation se fait après — soit par vos équipes (le rapport est prêt à exécuter), soit par nous via le module Implémentation IA.",
    aEn: "No. The day is 100 % training and strategy: we identify, quantify, prioritise. Implementation happens after — either by your teams (the report is ready to execute), or by us via the AI Implementation module.",
  },
  {
    qFr: "Que contient exactement le rapport sous 7 jours ?",
    qEn: "What's exactly in the 7-day report?",
    aFr: "Synthèse de la journée + recherches complémentaires faites après la séance (vérification des outils, comparatifs, chiffrages affinés) + plan d'exécution priorisé avec coûts, gains attendus et calendrier indicatif. Document directement actionnable.",
    aEn: "Day-of synthesis + complementary research done after the session (tool validation, comparisons, refined quantification) + prioritised execution plan with costs, expected gains and indicative timeline. A directly actionable document.",
  },
  {
    qFr: "Pour qui est-ce vraiment fait ?",
    qEn: "Who is this really for?",
    aFr: "Fondateurs, DG, dirigeants de TPE / PME / ETI / grandes entreprises. Le format strictement 1-to-1 (vous seul·e avec moi, pas de comité) garantit que la journée colle exactement à votre contexte et à vos enjeux personnels — confidentialité totale.",
    aEn: "Founders, CEOs, executives of small to enterprise companies. The strictly 1-on-1 format (just you and me, no committee) guarantees the day fits your context and personal stakes exactly — total confidentiality.",
  },
];

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
// CONFÉRENCE — 2 formats (Plénière 1 j / Keynote 1-2 h)
// ============================================================================

const CONFERENCE_PLENIERE_BENEFITS: ReadonlyArray<DetailBenefit> = [
  {
    icon: Users,
    titleFr: "Toute l'entreprise au même niveau",
    titleEn: "Whole company at the same level",
    bodyFr:
      "En 1 journée, 30 à 500+ collaborateurs partagent le même socle IA 2026 : outils, usages, vocabulaire, limites. Plus de personnes perdues, plus de fantasmes — un référentiel commun pour avancer.",
    bodyEn:
      "In 1 day, 30 to 500+ employees share the same 2026 AI foundation: tools, uses, vocabulary, limits. No more lost people, no more fantasies — a common reference to move forward.",
  },
  {
    icon: Sparkles,
    titleFr: "Démos live sur cas réels",
    titleEn: "Live demos on real cases",
    bodyFr:
      "Pas de slides théoriques. Des exemples concrets de votre secteur testés en live devant l'audience : rédaction, analyse, recherche, synthèse. Tout le monde voit l'IA opérer en temps réel.",
    bodyEn:
      "No theoretical slides. Concrete examples from your sector tested live for the audience: writing, analysis, research, synthesis. Everyone sees AI operate in real time.",
  },
  {
    icon: Compass,
    titleFr: "Ateliers groupes pratiques",
    titleEn: "Practical group workshops",
    bodyFr:
      "Pendant la journée, ateliers en petits groupes : chaque participant manipule l'IA sur ses vrais outils, ses vrais cas. Apprentissage actif, pas passif.",
    bodyEn:
      "During the day, small-group workshops: each participant manipulates AI on their real tools, their real cases. Active learning, not passive.",
  },
  {
    icon: Target,
    titleFr: "Q&A complète + ressources",
    titleEn: "Full Q&A + takeaways",
    bodyFr:
      "Session Q&A finale ouverte (30-45 min) + ressources pédagogiques fournies (référentiel outils, prompts type, lectures recommandées) pour prolonger après la journée.",
    bodyEn:
      "Final open Q&A session (30-45 min) + learning takeaways (tool reference, sample prompts, recommended reading) to extend beyond the day.",
  },
];

const CONFERENCE_PLENIERE_SCHEDULE: ReadonlyArray<DetailScheduleItem> = [
  {
    time: "9 h 00",
    titleFr: "Accueil + cadrage des thèmes",
    titleEn: "Welcome + theme framing",
  },
  {
    time: "9 h 30",
    titleFr: "Conférence — panorama IA opérationnelle 2026",
    titleEn: "Talk — 2026 operational AI panorama",
    descriptionFr: "2 h · outils principaux + démos live + idées d'usages par secteur.",
    descriptionEn: "2 h · main tools + live demos + use-case ideas by sector.",
  },
  {
    time: "11 h 30",
    titleFr: "Pause",
    titleEn: "Break",
  },
  {
    time: "11 h 45",
    titleFr: "Ateliers pratiques par groupes",
    titleEn: "Hands-on group workshops",
    descriptionFr: "1 h 15 · mise en pratique sur les cas d'usage métier.",
    descriptionEn: "1 h 15 · applied practice on domain use cases.",
  },
  {
    time: "13 h 00",
    titleFr: "Pause déjeuner",
    titleEn: "Lunch break",
  },
  {
    time: "14 h 00",
    titleFr: "Démos live + retours d'ateliers",
    titleEn: "Live demos + workshop debrief",
    descriptionFr: "2 h · approfondissement et confrontation à la réalité terrain.",
    descriptionEn: "2 h · deepening and confrontation with field reality.",
  },
  {
    time: "16 h 00",
    titleFr: "Pause",
    titleEn: "Break",
  },
  {
    time: "16 h 15",
    titleFr: "Q&A ouverte",
    titleEn: "Open Q&A",
    descriptionFr: "45 min · questions libres et plan d'action.",
    descriptionEn: "45 min · open questions and action plan.",
  },
  {
    time: "17 h 00",
    titleFr: "Ressources pédagogiques fournies + clôture",
    titleEn: "Learning takeaways shared + close",
  },
];

const CONFERENCE_PLENIERE_FAQ: ReadonlyArray<DetailFaq> = [
  {
    qFr: "Combien de personnes peut-on accueillir ?",
    qEn: "How many people can attend?",
    aFr: "De 30 à 500+ personnes. Au-delà de 200, prévoir une organisation salle plénière + sous-salles ateliers. On cadre l'effectif et le format en amont par appel.",
    aEn: "From 30 to 500+ people. Beyond 200, plan a plenary room + workshop sub-rooms setup. We frame headcount and format upstream by call.",
  },
  {
    qFr: "Faut-il préparer quelque chose en amont ?",
    qEn: "Anything to prepare upstream?",
    aFr: "Quelques éléments : effectifs précis, profils types, 3-5 cas métier prioritaires pour adapter les démos, accès Wi-Fi salle, support écran. On envoie une checklist 15 jours avant.",
    aEn: "A few things: precise headcount, typical profiles, 3-5 priority business cases to adapt demos, room Wi-Fi, screen support. We send a checklist 15 days before.",
  },
  {
    qFr: "Et après la conférence ?",
    qEn: "What about after the conference?",
    aFr: "Les participants repartent avec un référentiel outils + prompts. Si vous voulez approfondir avec certaines équipes, basculer vers l'Approfondie 2 jours ou les coachings individuels. La conférence amorce, les formations transforment.",
    aEn: "Participants leave with a tool + prompt reference. To go further with specific teams, switch to the 2-day Deep Dive or individual coachings. The conference kicks off, trainings transform.",
  },
];

const CONFERENCE_KEYNOTE_BENEFITS: ReadonlyArray<DetailBenefit> = [
  {
    icon: Mic,
    titleFr: "Format dense et percutant",
    titleEn: "Dense, impactful format",
    bodyFr:
      "1 à 2 heures concentrées : panorama IA 2026, démos live percutantes, exemples concrets de votre secteur. Pas de blabla — chaque minute compte pour marquer l'audience.",
    bodyEn:
      "1 to 2 concentrated hours: 2026 AI panorama, impactful live demos, concrete examples from your sector. No fluff — every minute counts to mark the audience.",
  },
  {
    icon: Coffee,
    titleFr: "Adapté aux contextes événementiels",
    titleEn: "Adapted to event contexts",
    bodyFr:
      "Soirée client, afterwork d'entreprise, séminaire externe, convention, salon. Format calibré pour fonctionner après une journée de travail ou intégré dans un événement plus large.",
    bodyEn:
      "Client evening, corporate afterwork, external seminar, convention, trade show. Format calibrated to work after a workday or integrated in a larger event.",
  },
  {
    icon: Sparkles,
    titleFr: "Démos live, pas slides",
    titleEn: "Live demos, not slides",
    bodyFr:
      "Pendant la keynote : démos live sur des cas réels — l'audience voit l'IA opérer, pas une présentation théorique. Mémorable et concret.",
    bodyEn:
      "During the keynote: live demos on real cases — the audience sees AI operate, not a theoretical presentation. Memorable and concrete.",
  },
  {
    icon: Target,
    titleFr: "Q&A finale ouverte",
    titleEn: "Open final Q&A",
    bodyFr:
      "15 à 30 minutes de Q&A en fin de keynote pour répondre aux vraies questions de votre audience. Format propice aux échanges directs.",
    bodyEn:
      "15 to 30 minutes of Q&A at the end of the keynote to answer your audience's real questions. Format conducive to direct exchanges.",
  },
];

const CONFERENCE_KEYNOTE_FAQ: ReadonlyArray<DetailFaq> = [
  {
    qFr: "Quel public-type pour la keynote ?",
    qEn: "Which audience profile for the keynote?",
    aFr: "Clients, prospects, partenaires, collaborateurs lors d'un événement externe ou interne. Tous niveaux IA acceptés — le format est calibré pour parler à tout le monde, du débutant au curieux confirmé.",
    aEn: "Clients, prospects, partners, employees at an external or internal event. All AI levels welcome — the format is calibrated to speak to everyone, from beginner to seasoned curious.",
  },
  {
    qFr: "Combien de personnes maximum ?",
    qEn: "Maximum audience size?",
    aFr: "Jusqu'à 500+ personnes. Le format keynote scale bien — l'interaction passe par la Q&A finale, pas par des ateliers. Plus l'audience est large, plus on calibre les démos pour parler à tous.",
    aEn: "Up to 500+ people. The keynote format scales well — interaction happens through the final Q&A, not workshops. The larger the audience, the more we calibrate demos to speak to everyone.",
  },
  {
    qFr: "Peut-on combiner keynote + ateliers le lendemain ?",
    qEn: "Can we combine keynote + workshops the next day?",
    aFr: "Oui — c'est même un excellent format : keynote soir J pour marquer + Approfondie 2 jours J+1 pour les équipes prioritaires. On packagize sur devis.",
    aEn: "Yes — it's actually an excellent format: evening keynote on day D for impact + 2-day Deep Dive on D+1 for priority teams. We package on request.",
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
    "dirigeant-productivite": {
      slug: "dirigeant-productivite",
      formatSlug: "dirigeants",
      familySlug: "dirigeants",
      contactObject: "dirigeants",
      titleFr: "Productivité dirigeant",
      titleEn: "Executive productivity",
      titleEmFr: "1 jour 1-to-1 pour gagner vos heures",
      titleEmEn: "1 day 1-on-1 to reclaim your hours",
      promiseFr:
        "Une journée strictement 1-to-1 (vous seul·e avec moi) pour optimiser VOTRE journée dirigeant. Boîte mail, prépa réunions, reporting, comptes-rendus, suivi commercial — on installe les bons usages IA pour vous faire gagner plusieurs heures par semaine. Le soir : plan d'action chiffré sous 7 jours.",
      promiseEn:
        "A strictly 1-on-1 day (just you and me) to optimise YOUR executive day. Inbox, meeting prep, reporting, meeting notes, sales follow-up — we install the right AI methods to save you several hours per week. By evening: quantified action plan within 7 days.",
      chipsFr: ["Plusieurs heures gagnées/sem", "Confidentialité totale", "Rapport sous 7 jours"],
      chipsEn: ["Hours saved per week", "Total confidentiality", "Report within 7 days"],
      benefits: DIRIGEANT_PRODUCTIVITE_BENEFITS,
      schedule: DIRIGEANT_PRODUCTIVITE_SCHEDULE,
      faq: DIRIGEANT_PRODUCTIVITE_FAQ,
      priceFlatEur: 990,
      groupSizeFr: "1 dirigeant (1-to-1 strict)",
      groupSizeEn: "1 executive (strict 1-on-1)",
    },
    "dirigeant-vision-strategique": {
      slug: "dirigeant-vision-strategique",
      formatSlug: "dirigeant-vision-strategique",
      familySlug: "dirigeants",
      contactObject: "dirigeant-vision-strategique",
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
    "conference-pleniere": {
      slug: "conference-pleniere",
      formatSlug: "conference",
      familySlug: "conference",
      contactObject: "conference",
      titleFr: "Conférence plénière",
      titleEn: "Plenary talk",
      titleEmFr: "1 journée immersive",
      titleEmEn: "1 immersive day",
      promiseFr:
        "Plénière 1 journée pour mettre toute l'entreprise au même niveau IA — séminaires internes, kick-off annuels, formations grande échelle. 30 à 500+ personnes, panorama IA 2026, démos live, ateliers groupes, Q&A complète. Tout le monde repart au même niveau.",
      promiseEn:
        "1-day plenary to bring your whole company to the same AI level — internal seminars, annual kick-offs, large-scale onboarding. 30 to 500+ people, 2026 AI panorama, live demos, group workshops, full Q&A. Everyone leaves at the same level.",
      chipsFr: ["30 à 500+ personnes", "Démos live secteur", "Ressources fournies"],
      chipsEn: ["30 to 500+ people", "Live sector demos", "Takeaways shared"],
      benefits: CONFERENCE_PLENIERE_BENEFITS,
      schedule: CONFERENCE_PLENIERE_SCHEDULE,
      faq: CONFERENCE_PLENIERE_FAQ,
      groupSizeFr: "Grands effectifs · 30 à 500+ personnes",
      groupSizeEn: "Large audiences · 30 to 500+ people",
    },
    "conference-keynote": {
      slug: "conference-keynote",
      formatSlug: "conference-keynote",
      familySlug: "conference",
      contactObject: "conference-keynote",
      titleFr: "Keynote IA · événementielle",
      titleEn: "AI Keynote · event format",
      titleEmFr: "1 à 2 h pour marquer",
      titleEmEn: "1 to 2 hours to mark",
      promiseFr:
        "Keynote 1 à 2 heures sur l'IA opérationnelle 2026 — pour soirées clients, afterworks d'entreprise, séminaires externes, conventions, salons. Format dense, percutant, démos live, Q&A finale. L'audience repart marquée et inspirée.",
      promiseEn:
        "1 to 2 hour keynote on operational AI 2026 — for client evenings, corporate afterworks, external seminars, conventions, trade shows. Dense, impactful, live demos, final Q&A. The audience leaves marked and inspired.",
      chipsFr: ["Format soir OK", "20 à 500+ personnes", "Démos live percutantes"],
      chipsEn: ["Evening OK", "20 to 500+ people", "Impactful live demos"],
      benefits: CONFERENCE_KEYNOTE_BENEFITS,
      schedule: null, // Pas de programme fixe — adapté à l'événement
      scheduleTitleFr: "Format flexible",
      scheduleTitleEn: "Flexible format",
      faq: CONFERENCE_KEYNOTE_FAQ,
      groupSizeFr: "Audience événement · 20 à 500+ personnes",
      groupSizeEn: "Event audience · 20 to 500+ people",
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
