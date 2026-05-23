// Transversal content — about, FAQ, blog fixtures, help (Sprint 9).
// Replaced by Prisma in Sprint 15 for blog/help articles.

import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  MAINTENANCE_TIERS,
  formatAmount,
  formatAmountRange,
  formatPrice,
  getEntryLabel,
  getTierById,
} from "@/content/pricing";
import { slugify } from "@/lib/slug";

// Helpers locaux pour dériver les phrases FAQ multilingues à partir du SSOT
// pricing. Aucun prix hardcodé : si Will modifie un tier, ces phrases se
// mettent à jour automatiquement au build/start.
const auditFlashTier = getTierById(AUDIT_TIERS, "audit-flash");
const auditCibleTier = getTierById(AUDIT_TIERS, "audit-cible");
const auditPmeTier = getTierById(AUDIT_TIERS, "audit-strategique-pme");
const auditEtiTier = getTierById(AUDIT_TIERS, "audit-strategique-eti");
const maintenanceStandard = getTierById(MAINTENANCE_TIERS, "maintenance-standard");

function modulesAnswerFr(): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, "fr", { compact: false });
  const flash = formatAmount(auditFlashTier.priceFlat!, "fr", { compact: true });
  const cibleRange = formatAmountRange(auditCibleTier.priceMin!, auditCibleTier.priceMax!, "fr", {
    compact: true,
  });
  const pmeRange = formatAmountRange(auditPmeTier.priceMin!, auditPmeTier.priceMax!, "fr", {
    compact: true,
  });
  const etiFrom = formatAmount(auditEtiTier.priceMin!, "fr", { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, "fr", { compact: false });
  return `Module 1 — Interventions sur site (1 journée à partir de ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}, ${interventionsEntry}). Module 2 — Audit IA (4 niveaux : Flash ${flash}, Ciblé ${cibleRange}, Stratégique PME ${pmeRange}, Stratégique ETI dès ${etiFrom}). Module 3 — Implémentation IA (mise en production, ${implEntry}).`;
}

function modulesAnswerEn(): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, "en", { compact: false });
  const flash = formatAmount(auditFlashTier.priceFlat!, "en", { compact: true });
  const cibleRange = formatAmountRange(auditCibleTier.priceMin!, auditCibleTier.priceMax!, "en", {
    compact: true,
  });
  const pmeRange = formatAmountRange(auditPmeTier.priceMin!, auditPmeTier.priceMax!, "en", {
    compact: true,
  });
  const etiFrom = formatAmount(auditEtiTier.priceMin!, "en", { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, "en", { compact: false });
  return `Module 1 — On-site sessions (1 day from ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}, ${interventionsEntry}). Module 2 — AI audit (4 tiers: Flash ${flash}, Targeted ${cibleRange}, Strategic SME ${pmeRange}, Strategic Mid-cap from ${etiFrom}). Module 3 — AI implementation (production deployment, ${implEntry}).`;
}

export const ABOUT_TIMELINE = [
  {
    id: "2024",
    date: "2024",
    fr: { title: "Création d'Axion-IA", description: "Lancement du cabinet IA opérationnel." },
    en: { title: "Axion-IA founded", description: "Operational AI consultancy launched." },
  },
  {
    id: "2025",
    date: "2025",
    fr: {
      title: "Premières interventions terrain",
      description: "10 missions opérationnelles, méthodologie itérée et stabilisée.",
    },
    en: {
      title: "First field engagements",
      description: "10 operational missions, methodology iterated and stabilized.",
    },
  },
  {
    id: "2026",
    date: "2026",
    fr: {
      title: "Plateforme axion-ia.com",
      description: "Refonte complète, mobile-first, multilingue FR/EN.",
    },
    en: {
      title: "Platform axion-ia.com",
      description: "Full revamp, mobile-first, FR/EN multilingual.",
    },
  },
] as const;

export const ABOUT_TEAM = [
  {
    id: "will",
    fr: {
      name: "Will",
      role: "Fondateur · lead consultant",
      bio: "10 ans en transformation digitale, opérationnel terrain.",
    },
    en: {
      name: "Will",
      role: "Founder · lead consultant",
      bio: "10 years in digital transformation, hands-on field practice.",
    },
  },
  // City Domination 2026-05-18 P1-13 (audit A11 P0) — Manon EN bio.
  // Persona éditoriale IA d'Axion-IA, transparence AI Act EU art. 50.
  // Doctrine v2.1 : zéro réseau social, supervision humaine, contenus IA-assistés.
  // Cf. /equipe/manon (FR) + /team/manon (EN) + AiContentDisclaimer composant.
  {
    id: "manon",
    fr: {
      name: "Manon",
      role: "Plume éditoriale IA · supervision humaine",
      bio: "Persona éditoriale IA d'Axion-IA. Rédige les contenus éditoriaux avec assistance d'IA générative (OpenAI, Anthropic, Perplexity), supervisée par l'équipe Axion-IA avant publication. Transparence AI Act EU art. 50.",
    },
    en: {
      name: "Manon",
      role: "AI editorial author · human supervision",
      bio: "Axion-IA's AI editorial persona. Drafts editorial content with generative AI assistance (OpenAI, Anthropic, Perplexity), supervised by the Axion-IA team before publication. EU AI Act art. 50 transparency.",
    },
  },
] as const;

export interface FaqEntry {
  id: string;
  fr: { question: string; answer: string };
  en: { question: string; answer: string };
}

export const FAQ_GLOBAL: ReadonlyArray<FaqEntry> = [
  {
    id: "geo-paris",
    fr: {
      question: "Réalisez-vous des audits IA à Paris et en Île-de-France ?",
      answer:
        "Oui. Notre siège est à Paris et nous intervenons dans toute l'Île-de-France (75, 92, 93, 94, 77, 78, 91, 95) en présentiel ou à distance. Délai de premier rendez-vous : 5 jours ouvrés.",
    },
    en: {
      question: "Do you provide AI audits in Paris and Île-de-France?",
      answer:
        "Yes. Our office is in Paris and we operate across the whole Île-de-France region (75, 92, 93, 94, 77, 78, 91, 95) on-site or remote. First meeting within 5 working days.",
    },
  },
  {
    id: "geo-metropoles",
    fr: {
      question:
        "Intervenez-vous dans les métropoles régionales (Lyon, Marseille, Toulouse, Bordeaux) ?",
      answer:
        "Oui. Nous nous déplaçons régulièrement à Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Montpellier, Rennes, Nice. Frais de déplacement inclus pour les capitales régionales.",
    },
    en: {
      question: "Do you work in regional cities (Lyon, Marseille, Toulouse, Bordeaux)?",
      answer:
        "Yes. We regularly travel to Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Montpellier, Rennes, Nice. Travel costs included for regional capitals.",
    },
  },
  {
    id: "geo-province",
    fr: {
      question: "Et en province ou en zone rurale, pour les TPE et PME ?",
      answer:
        "Absolument. Nous accompagnons artisans, commerçants, PME et ETI partout en France métropolitaine. Le mode distance est souvent plus efficace pour ces formats, sans perdre en qualité d'accompagnement.",
    },
    en: {
      question: "What about smaller towns or rural areas, for SMEs?",
      answer:
        "Absolutely. We support craftsmen, retailers, SMEs and mid-cap companies across mainland France. Remote mode is often more effective for these formats, without losing quality of support.",
    },
  },
  {
    id: "geo-distance",
    fr: {
      question: "Pouvez-vous réaliser l'audit ou la formation à distance ?",
      answer:
        "Oui, intégralement à distance si vous préférez. Visio sécurisée, partage d'écran chiffré, livrables transmis sous 48h. Nous proposons aussi un format hybride (1 jour sur site + suite à distance).",
    },
    en: {
      question: "Can the audit or training be delivered fully remote?",
      answer:
        "Yes, fully remote if you prefer. Secure video calls, encrypted screen sharing, deliverables within 48h. We also offer a hybrid format (1 day on-site + remote follow-up).",
    },
  },
  {
    id: "definition",
    fr: {
      question: "Qu'est-ce qu'Axion-IA ?",
      answer:
        "Axion-IA est un cabinet IA opérationnel pour entreprises. Nous intervenons sur site (ou à distance) pour identifier, démontrer et implémenter des usages IA générant un ROI chiffré et mesurable.",
    },
    en: {
      question: "What is Axion-IA?",
      answer:
        "Axion-IA is an operational AI consultancy for companies. We work on site (or remote) to identify, demonstrate and implement AI use cases generating costed, measurable ROI.",
    },
  },
  {
    id: "modules",
    fr: {
      question: "Quels sont les 3 modules ?",
      answer: modulesAnswerFr(),
    },
    en: {
      question: "What are the 3 modules?",
      answer: modulesAnswerEn(),
    },
  },
  {
    id: "data-security",
    fr: {
      question: "Mes données sont-elles partagées ?",
      answer:
        "Non. Hébergement UE par défaut (Hetzner Frankfurt). Aucun envoi de données sensibles à des tiers sans consentement explicite. Modèles IA hébergés chez vous ou sur infra dédiée si requis.",
    },
    en: {
      question: "Is my data shared?",
      answer:
        "No. EU hosting by default (Hetzner Frankfurt). No sensitive data sent to third parties without explicit consent. AI models hosted with you or on dedicated infra if required.",
    },
  },
  {
    id: "tools",
    fr: {
      question: "Quels outils IA utilisez-vous ?",
      answer:
        "Mix de modèles open-source (Llama, Mistral) et propriétaires (GPT-4, Claude) selon le cas. Justifié dans chaque devis. Aucun lock-in technologique.",
    },
    en: {
      question: "Which AI tools do you use?",
      answer:
        "Mix of open-source (Llama, Mistral) and proprietary models (GPT-4, Claude) depending on the case. Justified in every quote. No technology lock-in.",
    },
  },
  {
    id: "billing",
    fr: {
      question: "Comment se passe la facturation ?",
      answer:
        "Devis fixe + virement + facture (régime TVA UE selon résidence du client). Aucune mensualité, aucun engagement.",
    },
    en: {
      question: "How does billing work?",
      answer:
        "Fixed quote + bank transfer + invoice (EU VAT regime according to client residence). No subscriptions, no commitments.",
    },
  },
  {
    id: "comment-commencer",
    fr: {
      question: "Par où commencer avec l'IA dans mon entreprise ?",
      answer:
        "La première étape recommandée est une intervention de découverte (demi-journée ou journée) pour identifier 3 à 5 process candidats à l'IA dans votre contexte réel. Axion-IA arrive sur site avec ses modèles IA et travaille sur vos données pour démontrer des gains concrets avant tout engagement.",
    },
    en: {
      question: "Where do I start with AI in my company?",
      answer:
        "The recommended first step is a discovery session (half-day or full day) to identify 3 to 5 AI candidate processes in your real context. Axion-IA arrives on site with its AI models and works on your data to demonstrate concrete gains before any commitment.",
    },
  },
  {
    id: "delai-implementation",
    fr: {
      question: "Quel est le délai pour implémenter l'IA en entreprise ?",
      answer:
        "Un projet d'implémentation IA Axion-IA se déroule en 6 à 8 semaines : 1 semaine de cadrage, 2 à 4 semaines de prototype, 1 à 2 semaines de tests, 1 semaine de déploiement. 30 jours de support inclus. Pour une formation seule, les équipes sont opérationnelles dès le lendemain.",
    },
    en: {
      question: "How long does it take to implement AI in a company?",
      answer:
        "An Axion-IA AI implementation project takes 6 to 8 weeks: 1 week scoping, 2 to 4 weeks prototype, 1 to 2 weeks testing, 1 week deployment. 30 days support included. For training alone, teams are operational from the next day.",
    },
  },
  {
    id: "ia-remplace-salaries",
    fr: {
      question: "L'IA va-t-elle remplacer mes salariés ?",
      answer:
        "Non. L'IA telle que déployée par Axion-IA automatise les tâches répétitives (rédaction d'emails, comptes-rendus, classement, recherche d'informations) pour libérer du temps sur les tâches à valeur ajoutée. L'objectif est d'augmenter la productivité de vos équipes, pas de les remplacer.",
    },
    en: {
      question: "Will AI replace my employees?",
      answer:
        "No. AI as deployed by Axion-IA automates repetitive tasks (email writing, meeting notes, filing, information search) to free up time for value-added work. The goal is to boost your teams' productivity, not to replace them.",
    },
  },
  {
    id: "competences-techniques",
    fr: {
      question: "Faut-il avoir des compétences techniques pour bénéficier d'une intervention IA ?",
      answer:
        "Non. Les interventions Axion-IA sont conçues pour des équipes non-techniques. Aucune installation logicielle n'est requise de votre côté. Le formateur arrive avec son propre équipement et adapte les exemples à vos métiers réels (RH, comptabilité, commercial, opérations, etc.).",
    },
    en: {
      question: "Do you need technical skills to benefit from an AI session?",
      answer:
        "No. Axion-IA sessions are designed for non-technical teams. No software installation is required on your end. The trainer arrives with their own equipment and adapts examples to your real business roles (HR, accounting, sales, operations, etc.).",
    },
  },
  {
    id: "roi-mesurer",
    fr: {
      question: "Comment mesurer le ROI d'un projet IA ?",
      answer:
        "Axion-IA mesure le ROI sur 3 dimensions : temps gagné par collaborateur (observable dès J+3), coût des tâches automatisées (calculé avant/après) et qualité des livrables (erreurs réduites, délais respectés). Le simulateur /roi permet d'estimer le gain avant toute intervention.",
    },
    en: {
      question: "How do you measure the ROI of an AI project?",
      answer:
        "Axion-IA measures ROI on 3 dimensions: time saved per employee (observable from day 3), cost of automated tasks (calculated before/after) and deliverable quality (fewer errors, deadlines met). The /roi simulator lets you estimate gains before any session.",
    },
  },
  {
    id: "ai-act-2026",
    fr: {
      question: "Quelles sont les obligations légales des entreprises face à l'AI Act 2026 ?",
      answer:
        "L'AI Act européen (entrée en vigueur progressive jusqu'à août 2026) impose aux entreprises utilisant l'IA générative de : (1) informer les utilisateurs que le contenu est généré par IA (art. 50), (2) documenter les usages IA à risque limité, (3) nommer un interlocuteur conformité IA. Axion-IA intègre la conformité AI Act dans ses implémentations.",
    },
    en: {
      question: "What are companies' legal obligations under the 2026 AI Act?",
      answer:
        "The EU AI Act (phased enforcement until August 2026) requires companies using generative AI to: (1) inform users that content is AI-generated (art. 50), (2) document limited-risk AI uses, (3) appoint an AI compliance contact. Axion-IA integrates AI Act compliance into its implementations.",
    },
  },
  {
    id: "pme-ia",
    fr: {
      question: "Comment l'IA peut-elle aider une PME concrètement ?",
      answer:
        "Pour une PME, les gains IA les plus rapides portent sur : la rédaction d'emails et propositions commerciales (−70 % du temps), les comptes-rendus de réunion (automatiques), la recherche d'informations et veille (5× plus rapide), la qualification de prospects (scoring automatisé) et la génération de rapports internes.",
    },
    en: {
      question: "How can AI concretely help an SME?",
      answer:
        "For an SME, the fastest AI gains come from: email and commercial proposal writing (−70% time), meeting notes (automated), information research and monitoring (5× faster), prospect qualification (automated scoring) and internal report generation.",
    },
  },
  {
    id: "chatgpt-vs-claude",
    fr: {
      question: "Quelle est la différence entre ChatGPT et Claude ?",
      answer:
        "ChatGPT (OpenAI) et Claude (Anthropic) sont deux modèles de LLM leaders. Claude se distingue par une fenêtre de contexte très longue (idéal pour analyser de longs documents), une approche de sécurité renforcée (Constitutional AI), et d'excellentes performances en rédaction et analyse. Le choix dépend du cas d'usage : Axion-IA recommande le modèle le plus adapté à votre contexte.",
    },
    en: {
      question: "What is the difference between ChatGPT and Claude?",
      answer:
        "ChatGPT (OpenAI) and Claude (Anthropic) are two leading LLM models. Claude stands out for its very long context window (ideal for analysing long documents), enhanced safety approach (Constitutional AI), and excellent writing and analysis performance. The choice depends on the use case: Axion-IA recommends the most suitable model for your context.",
    },
  },
  {
    id: "audit-ia-definition",
    fr: {
      question: "Qu'est-ce qu'un audit IA d'entreprise ?",
      answer:
        "Un audit IA Axion-IA est un diagnostic de 1 à 5 jours qui cartographie vos process existants, identifie 8 à 15 opportunités IA scorées ROI/complexité, chiffre chaque opportunité (effort + coût + délai) et livre un plan d'implémentation priorisé. Le livrable est un document PDF de 25 à 40 pages avec atelier de restitution.",
    },
    en: {
      question: "What is a company AI audit?",
      answer:
        "An Axion-IA AI audit is a 1 to 5-day diagnostic that maps your existing processes, identifies 8 to 15 AI opportunities scored by ROI/complexity, costs each opportunity (effort + cost + timeline) and delivers a prioritised implementation plan. The deliverable is a 25 to 40-page PDF with a debrief workshop.",
    },
  },
  {
    id: "equipes-operationnelles",
    fr: {
      question:
        "En combien de temps les équipes sont-elles opérationnelles après une formation IA ?",
      answer:
        "Dès le lendemain. Les formations Axion-IA sont 100 % pratiques sur des cas réels de l'entreprise. Les participants repartent avec des workflows immédiatement applicables, des prompts personnalisés et une liste de 5 premières actions concrètes à mener dans leur poste.",
    },
    en: {
      question: "How quickly are teams operational after AI training?",
      answer:
        "From the next day. Axion-IA trainings are 100% practical on real company cases. Participants leave with immediately applicable workflows, personalised prompts and a list of 5 first concrete actions for their role.",
    },
  },
  {
    id: "eti-grands-comptes",
    fr: {
      question: "Axion-IA travaille-t-il avec les ETI et grands comptes ?",
      answer:
        "Oui. Axion-IA accompagne des entreprises de toutes tailles, des TPE aux ETI et grands comptes. Pour les ETI et grands comptes (25-80k€ de projet), Axion-IA propose des programmes multi-sites, des audits stratégiques approfondis et des implémentations IA à large envergure avec gouvernance des données.",
    },
    en: {
      question: "Does Axion-IA work with mid-caps and large companies?",
      answer:
        "Yes. Axion-IA works with companies of all sizes, from small businesses to mid-caps and large companies. For mid-caps and large accounts (€25-80k projects), Axion-IA offers multi-site programmes, in-depth strategic audits and large-scale AI implementations with data governance.",
    },
  },
  {
    id: "secteurs",
    fr: {
      question: "Quels secteurs sont concernés par l'IA générative ?",
      answer:
        "Tous les secteurs économiques sont concernés. Axion-IA intervient notamment dans : le conseil et les services professionnels (juridique, comptabilité, RH), l'industrie (production, maintenance, qualité), la santé (documentation, analyse), le retail (e-commerce, relation client), le BTP (devis, reporting), et l'éducation.",
    },
    en: {
      question: "Which sectors are affected by generative AI?",
      answer:
        "All economic sectors are affected. Axion-IA works in particular in: consulting and professional services (legal, accounting, HR), industry (production, maintenance, quality), healthcare (documentation, analysis), retail (e-commerce, customer relations), construction (quotes, reporting) and education.",
    },
  },
  {
    id: "choisir-cabinet-ia",
    fr: {
      question: "Comment choisir un cabinet IA ?",
      answer:
        "4 critères clés : (1) le cabinet intervient-il sur site avec vos données réelles (pas juste des slides) ? (2) livre-t-il un ROI chiffré et mesurable ? (3) maîtrise-t-il plusieurs modèles IA (pas un revendeur d'un seul outil) ? (4) propose-t-il un accompagnement post-déploiement ? Axion-IA répond positivement aux 4 critères.",
    },
    en: {
      question: "How do you choose an AI consultancy?",
      answer:
        "4 key criteria: (1) does the consultancy work on site with your real data (not just slides)? (2) does it deliver a costed, measurable ROI? (3) does it master multiple AI models (not a reseller of a single tool)? (4) does it offer post-deployment support? Axion-IA meets all 4 criteria.",
    },
  },
  {
    id: "ia-on-premise",
    fr: {
      question: "Peut-on faire de l'IA sans envoyer ses données dans le cloud ?",
      answer:
        "Oui. Axion-IA maîtrise le déploiement de modèles IA en local (on-premise) ou sur infrastructure dédiée hébergée en UE. Pour les cas sensibles (données médicales, données clients confidentielles), des modèles open-source (Llama, Mistral) peuvent être hébergés dans votre propre infrastructure.",
    },
    en: {
      question: "Can you use AI without sending your data to the cloud?",
      answer:
        "Yes. Axion-IA masters the deployment of AI models locally (on-premise) or on dedicated EU-hosted infrastructure. For sensitive cases (medical data, confidential customer data), open-source models (Llama, Mistral) can be hosted in your own infrastructure.",
    },
  },
  {
    id: "ia-vs-automatisation",
    fr: {
      question: "Quelle est la différence entre l'IA et l'automatisation traditionnelle ?",
      answer:
        "L'automatisation traditionnelle (RPA, scripts) suit des règles prédéfinies strictes et ne gère pas les exceptions. L'IA générative comprend le langage naturel, s'adapte aux variations et génère du contenu ou des analyses. Axion-IA utilise les deux en fonction du cas : RPA pour les flux structurés, IA pour les tâches nécessitant compréhension et génération.",
    },
    en: {
      question: "What is the difference between AI and traditional automation?",
      answer:
        "Traditional automation (RPA, scripts) follows strict predefined rules and doesn't handle exceptions. Generative AI understands natural language, adapts to variations and generates content or analyses. Axion-IA uses both depending on the case: RPA for structured flows, AI for tasks requiring understanding and generation.",
    },
  },
  {
    id: "presentiel-distance",
    fr: {
      question: "Axion-IA intervient-il à distance ou sur site ?",
      answer:
        "Les deux. Le format préféré est sur site (France et international) car il permet de travailler directement sur vos outils et données. Les interventions à distance sont possibles via visioconférence pour les équipes dispersées géographiquement ou pour les formations de suivi.",
    },
    en: {
      question: "Does Axion-IA work remotely or on site?",
      answer:
        "Both. The preferred format is on site (France and internationally) as it allows working directly on your tools and data. Remote sessions are possible via videoconference for geographically dispersed teams or follow-up training.",
    },
  },
  {
    id: "heures-semaine-pme",
    fr: {
      question: "Combien d'heures par semaine l'IA peut-elle libérer dans une PME ?",
      answer:
        "Axion-IA observe en moyenne 5 à 15 heures libérées par collaborateur et par semaine après une formation et un déploiement IA. Les gains varient selon le poste : commercial (propositions, devis), RH (offres d'emploi, comptes-rendus), comptabilité (rapports, relances) et direction (synthèses, analyses).",
    },
    en: {
      question: "How many hours per week can AI free up in an SME?",
      answer:
        "Axion-IA observes an average of 5 to 15 hours freed per employee per week after AI training and deployment. Gains vary by role: sales (proposals, quotes), HR (job ads, meeting notes), accounting (reports, reminders) and management (summaries, analyses).",
    },
  },
  {
    id: "tpe-ia",
    fr: {
      question: "L'implémentation IA est-elle adaptée aux TPE ?",
      answer:
        "Oui. Axion-IA propose une gamme de services accessible aux TPE : l'intervention Essentielle (journée de formation) et l'audit Flash sont les formats d'entrée. Le POC d'implémentation permet de tester l'IA sur un process ciblé avant tout déploiement large.",
    },
    en: {
      question: "Is AI implementation suitable for small businesses?",
      answer:
        "Yes. Axion-IA offers a range accessible to small businesses: the Essential session (training day) and Flash audit are the entry-level formats. The implementation POC allows testing AI on a targeted process before any large-scale deployment.",
    },
  },
  {
    id: "confidentialite-projet-ia",
    fr: {
      question: "Comment garantir la confidentialité des données lors d'un projet IA ?",
      answer:
        "Axion-IA signe un accord de confidentialité contractuel avant toute intervention. Les données client ne quittent jamais votre infrastructure sans accord explicite. Les échantillons utilisés pour les démos sont systématiquement anonymisés. Hébergement des modèles et données exclusivement en UE (Hetzner Frankfurt).",
    },
    en: {
      question: "How do you guarantee data confidentiality in an AI project?",
      answer:
        "Axion-IA signs a contractual confidentiality agreement before any engagement. Client data never leaves your infrastructure without explicit consent. Samples used for demos are systematically anonymised. Models and data hosted exclusively in the EU (Hetzner Frankfurt).",
    },
  },
  {
    id: "accompagnement-post-implementation",
    fr: {
      question: "Axion-IA propose-t-il un accompagnement après l'implémentation ?",
      answer:
        "Oui. 30 jours de support correctif sont inclus dans tout projet d'implémentation. Au-delà, un contrat de maintenance mensuel optionnel est disponible pour les corrections, montées de version et optimisations continues. Axion-IA propose aussi des sessions de formation de suivi pour les nouvelles recrues ou les nouvelles fonctionnalités IA.",
    },
    en: {
      question: "Does Axion-IA offer support after implementation?",
      answer:
        "Yes. 30 days of corrective support are included in every implementation project. Beyond that, an optional monthly maintenance contract is available for corrections, version upgrades and continuous optimisation. Axion-IA also offers follow-up training sessions for new hires or new AI features.",
    },
  },
  {
    id: "cout-projet-ia-pme",
    fr: {
      question: "Combien coûte un projet IA pour une PME ?",
      answer:
        "Les tarifs Axion-IA démarrent à partir de quelques centaines d'euros pour une formation (demi-journée) et plusieurs milliers d'euros pour un audit complet ou une implémentation. Chaque projet fait l'objet d'un devis fixe sans surprise. Consultez la page tarifs ou demandez un devis gratuit.",
    },
    en: {
      question: "How much does an AI project cost for an SME?",
      answer:
        "Axion-IA pricing starts from a few hundred euros for training (half-day) and several thousand euros for a full audit or implementation. Each project has a fixed quote with no surprises. See the pricing page or request a free quote.",
    },
  },
  {
    id: "rgpd-ia",
    fr: {
      question: "Qu'est-ce que le RGPD implique pour les projets IA ?",
      answer:
        "Le RGPD impose plusieurs obligations pour les projets IA : base légale pour tout traitement de données personnelles, information des personnes concernées, droit à l'effacement, durées de conservation définies et mesures de sécurité appropriées. Axion-IA intègre la conformité RGPD dans ses implémentations et peut recommander un DPO si nécessaire.",
    },
    en: {
      question: "What does GDPR imply for AI projects?",
      answer:
        "GDPR imposes several obligations for AI projects: legal basis for any personal data processing, information to data subjects, right to erasure, defined retention periods and appropriate security measures. Axion-IA integrates GDPR compliance into its implementations and can recommend a DPO if needed.",
    },
  },
  {
    id: "formation-ia-difference",
    fr: {
      question:
        "Quelle est la différence entre une formation IA générale et l'intervention Axion-IA ?",
      answer:
        "Une formation IA générale présente les outils de manière théorique. L'intervention Axion-IA est 100 % pratique : le formateur travaille directement sur vos emails, vos documents, vos données et vos process réels. Vous repartez avec des workflows opérationnels sur votre cas spécifique, pas des notions génériques.",
    },
    en: {
      question: "What is the difference between a generic AI training and an Axion-IA session?",
      answer:
        "Generic AI training presents tools theoretically. An Axion-IA session is 100% practical: the trainer works directly on your emails, documents, data and real processes. You leave with operational workflows for your specific case, not generic concepts.",
    },
  },
  {
    id: "site-web-augmente-ia",
    fr: {
      question: "Qu'est-ce qu'un site web augmenté par l'IA ?",
      answer:
        "Un site web augmenté par l'IA intègre des fonctions d'intelligence artificielle directement dans votre interface : recherche sémantique, chatbot métier personnalisé, génération de contenu automatisé, recommandation de produits ou services, et analyse des comportements visiteurs. Axion-IA conçoit et implémente ces couches IA sur votre site existant (WordPress, Next.js, Webflow…) sans refonte complète.",
    },
    en: {
      question: "What is an AI-augmented website?",
      answer:
        "An AI-augmented website integrates artificial intelligence features directly into your interface: semantic search, custom business chatbot, automated content generation, product or service recommendations, and visitor behaviour analytics. Axion-IA designs and implements these AI layers on your existing site (WordPress, Next.js, Webflow…) without a complete rebuild.",
    },
  },
  {
    id: "coaching-1-to-1-dirigeant",
    fr: {
      question: "À quoi sert le coaching 1-to-1 IA pour les dirigeants ?",
      answer:
        "Le coaching 1-to-1 Axion-IA est un accompagnement individuel pour les dirigeants, DG, DRH ou directeurs de service. En 3 à 5 séances, vous apprenez à intégrer l'IA dans votre propre pratique quotidienne : préparation de réunions, analyse de données, rédaction stratégique, veille sectorielle automatisée. L'objectif : gagner 5 à 10 heures par semaine et prendre de meilleures décisions plus vite.",
    },
    en: {
      question: "What is the 1-to-1 AI coaching for executives?",
      answer:
        "Axion-IA 1-to-1 coaching is individual support for CEOs, managing directors, HRDs or department heads. In 3 to 5 sessions, you learn to integrate AI into your own daily practice: meeting preparation, data analysis, strategic writing, automated sector monitoring. The goal: save 5 to 10 hours per week and make better decisions faster.",
    },
  },
];

// Blog : split Sprint 14.10 (2026-05-08) — `BlogPost` + données + helpers
// déplacés dans `src/content/blog/`. Les exports ci-dessous restent disponibles
// pour rétrocompatibilité avec les pages /blog/* + sitemap + getRelatedBlogPosts.
export type { BlogPost, BlogPostCopy, BlogFaqItem } from "@/content/blog";
export {
  BLOG_POSTS,
  getBlogPost,
  getAllBlogSlugs,
  getAllBlogCategorySlugs,
  getBlogPostsByCategory,
  getBlogCategoryLabel,
  getAllBlogTagSlugs,
  getBlogPostsByTag,
  getAllBlogAuthorSlugs,
  getBlogPostsByAuthor,
  getBlogAuthorLabel,
} from "@/content/blog";

// Help center articles — Sprint 14 fixtures, replaced by Prisma in Sprint 15.
export interface HelpArticle {
  slug: string;
  category: string; // displayed label
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
}

export const HELP_ARTICLES: ReadonlyArray<HelpArticle> = [
  {
    slug: "preparer-une-intervention",
    category: "Avant l'intervention",
    fr: {
      title: "Comment préparer une intervention IA ?",
      excerpt: "Liste des données, participants et objectifs à clarifier avant le jour J.",
      body: "Une intervention Axion-IA réussie repose sur 4 préparatifs : (1) lister 3-5 process candidats à l'IA, (2) inviter 1 décideur + 2-3 opérationnels concernés, (3) préparer un échantillon de données anonymisées (factures, emails, comptes-rendus) pour démos, (4) bloquer 1 journée complète sans réunions parallèles. Aucune installation logicielle n'est requise — l'intervenant arrive avec son équipement et ses modèles IA.",
    },
    en: {
      title: "How to prepare an AI session?",
      excerpt: "List the data, participants and objectives to clarify before the day.",
      body: "A successful Axion-IA session relies on 4 preparations: (1) list 3-5 candidate processes for AI, (2) invite 1 decision-maker + 2-3 operational staff, (3) prepare an anonymised data sample (invoices, emails, meeting notes) for demos, (4) block a full day with no parallel meetings. No software installation is required — the consultant arrives with their own equipment and AI models.",
    },
  },
  {
    slug: "perimetre-audit-ia",
    category: "Comprendre un audit IA",
    fr: {
      title: "Quel est le périmètre d'un audit IA Axion-IA ?",
      excerpt: "Cartographie complète, chiffrage par opportunité, plan d'implémentation priorisé.",
      body: "L'audit IA Axion-IA couvre 5 jours d'analyse : (1) cartographie de vos process actuels via interviews ; (2) identification de 8-15 opportunités IA scorées ROI/complexité ; (3) chiffrage individuel chaque opportunité (effort + coût + délai) ; (4) plan d'implémentation priorisé ; (5) recommandations gouvernance données + sourcing modèles. Livrable : document PDF 25-40 pages + atelier de restitution 2 h.",
    },
    en: {
      title: "What is the scope of an Axion-IA AI audit?",
      excerpt: "Complete mapping, per-opportunity costing, prioritised implementation plan.",
      body: "The Axion-IA AI audit covers 5 days of analysis: (1) mapping your current processes via interviews; (2) identifying 8-15 AI opportunities scored ROI/complexity; (3) individual costing of each opportunity (effort + cost + timeline); (4) prioritised implementation plan; (5) data governance + model sourcing recommendations. Deliverable: 25-40 page PDF + 2h debrief workshop.",
    },
  },
  {
    slug: "phases-implementation",
    category: "Implémentation IA",
    fr: {
      title: "Quelles sont les phases d'un projet d'implémentation ?",
      excerpt: "5 phases clés : cadrage, prototype, tests, déploiement, support.",
      body: "Un projet d'implémentation IA Axion-IA suit 5 phases : (1) cadrage technique 1 semaine — choix du modèle, architecture, données ; (2) prototype 2-4 semaines — version fonctionnelle sur jeu de données réel ; (3) tests utilisateurs 1-2 semaines — validation par 3-5 opérationnels ; (4) déploiement production 1 semaine — mise en service progressive ; (5) support 30 jours inclus. Total 6-8 semaines pour la majorité des cas.",
    },
    en: {
      title: "What are the phases of an implementation project?",
      excerpt: "5 key phases: scoping, prototype, testing, deployment, support.",
      body: "An Axion-IA AI implementation project follows 5 phases: (1) technical scoping 1 week — model choice, architecture, data; (2) prototype 2-4 weeks — functional version on real data; (3) user testing 1-2 weeks — validation by 3-5 operational staff; (4) production deployment 1 week — progressive go-live; (5) 30-day support included. Total 6-8 weeks for most cases.",
    },
  },
  {
    slug: "facturation-tva-ee",
    category: "Facturation & TVA EE",
    fr: {
      title: "Comment fonctionne la facturation TVA UE ?",
      excerpt: "Virement SEPA/SWIFT, TVA selon résidence du client, devis fixe.",
      body: "Axion-IA applique le régime TVA UE. Pour les clients UE B2B avec n° TVA intracommunautaire valide : autoliquidation, facture sans TVA. Pour clients UE B2C ou sans n° TVA : TVA UE applicable selon le siège du cabinet. Pour clients hors UE : facture sans TVA, hors-champ. Paiement par virement SEPA/SWIFT, devis fixe, aucune mensualité. La facture est livrée par PDF signé sous 48 h après prestation.",
    },
    en: {
      title: "How does EU VAT billing work?",
      excerpt: "SEPA/SWIFT bank transfer, VAT according to client residence, fixed quote.",
      body: "Axion-IA applies the EU VAT regime. For EU B2B clients with valid intracommunity VAT number: reverse charge, invoice without VAT. For EU B2C or clients without VAT number: EU VAT applicable based on the consultancy's home jurisdiction. For non-EU clients: invoice without VAT, out of scope. Payment via SEPA/SWIFT bank transfer, fixed quote, no subscriptions. Signed PDF invoice delivered within 48h of service.",
    },
  },
  {
    slug: "securite-donnees",
    category: "Sécurité & données",
    fr: {
      title: "Comment Axion-IA sécurise mes données ?",
      excerpt: "Hébergement UE Hetzner Frankfurt, RGPD strict, pas de partage tiers.",
      body: "Toutes les données client sont hébergées sur Hetzner CPX32 à Frankfurt (UE). Aucun partage avec des tiers sans consentement explicite. Les modèles IA peuvent être hébergés chez vous (on-prem) ou sur infrastructure dédiée si requis. Politique RGPD complète, exercice des droits sous 30 jours, DPO joignable à contact@axion-ia.com. Anonymisation systématique des échantillons utilisés pour démos.",
    },
    en: {
      title: "How does Axion-IA secure my data?",
      excerpt: "EU hosting Hetzner Frankfurt, strict GDPR, no third-party sharing.",
      body: "All client data is hosted on Hetzner CPX32 in Frankfurt (EU). No sharing with third parties without explicit consent. AI models can be hosted with you (on-prem) or on dedicated infrastructure if required. Complete GDPR policy, rights exercise within 30 days, DPO reachable at contact@axion-ia.com. Systematic anonymisation of samples used for demos.",
    },
  },
  {
    slug: "support-post-livraison",
    category: "Support post-livraison",
    fr: {
      title: "Quel support après livraison ?",
      excerpt: "30 jours de maintenance corrective inclus, escalade chaude.",
      body: `Tout projet Axion-IA inclut 30 jours de support post-livraison : maintenance corrective sur les bugs identifiés, escalade chaude par email/téléphone (réponse sous 4 h ouvrées), 1 itération de fine-tuning si dérive de qualité observée. Au-delà, contrat de maintenance optionnel à ${formatPrice(maintenanceStandard, "fr")} (4 h/mois forfait). Aucun support n'est facturé pendant les 30 jours initiaux.`,
    },
    en: {
      title: "What post-delivery support?",
      excerpt: "30 days of corrective maintenance included, warm escalation.",
      body: `Every Axion-IA project includes 30 days of post-delivery support: corrective maintenance on identified bugs, warm escalation by email/phone (response within 4 business hours), 1 fine-tuning iteration if quality drift observed. Beyond that, optional maintenance contract at ${formatPrice(maintenanceStandard, "en")} (4h/month flat fee). No support is billed during the initial 30 days.`,
    },
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function getAllHelpSlugs(): string[] {
  return HELP_ARTICLES.map((a) => a.slug);
}

export function getAllHelpCategorySlugs(): string[] {
  const cats = new Set(HELP_ARTICLES.map((a) => slugify(a.category)));
  return [...cats];
}

export function getHelpArticlesByCategory(slug: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => slugify(a.category) === slug);
}

export function getHelpCategoryLabel(slug: string): string | undefined {
  const found = HELP_ARTICLES.find((a) => slugify(a.category) === slug);
  return found?.category;
}

export function getFaqEntry(id: string): FaqEntry | undefined {
  return FAQ_GLOBAL.find((f) => f.id === id);
}

export function getAllFaqIds(): string[] {
  return FAQ_GLOBAL.map((f) => f.id);
}

// slugify importé depuis @/lib/slug (SSOT V-10 2026-05-22).
// Anciennement défini inline ici — comportement identique préservé (maxLen default 80).

export { slugify };
