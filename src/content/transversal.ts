// Transversal content — about, FAQ, blog fixtures, help (Sprint 9).
// Replaced by Prisma in Sprint 15 for blog/help articles.

import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  MAINTENANCE_TIERS,
  formatAmount,
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
  // Ciblé / PME / ETI sont passés « À partir de 1 900 € · sur devis » (Will
  // 2026-06-03, suppression des bornes hautes) → prix d'entrée « dès X » et non
  // une fourchette (l'ancienne fourchette rendait « NaN € », priceMax absent).
  const cibleFrom = formatAmount(auditCibleTier.priceMin!, "fr", { compact: true });
  const pmeFrom = formatAmount(auditPmeTier.priceMin!, "fr", { compact: true });
  const etiFrom = formatAmount(auditEtiTier.priceMin!, "fr", { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, "fr", { compact: false });
  return `Module 1 — Interventions sur site (1 journée à partir de ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}, ${interventionsEntry}). Module 2 — Audit IA (4 niveaux : Flash dès ${flash}, Ciblé dès ${cibleFrom}, Stratégique PME dès ${pmeFrom}, Stratégique ETI dès ${etiFrom}). Module 3 — Implémentation IA (mise en production, ${implEntry}).`;
}

function modulesAnswerEn(): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, "en", { compact: false });
  const flash = formatAmount(auditFlashTier.priceFlat!, "en", { compact: true });
  // Targeted / SME / Mid-cap are all « from €1,900 · on request » (Will
  // 2026-06-03, upper bounds removed) → entry price « from X », not a range
  // (the former range rendered « NaN », priceMax being absent).
  const cibleFrom = formatAmount(auditCibleTier.priceMin!, "en", { compact: true });
  const pmeFrom = formatAmount(auditPmeTier.priceMin!, "en", { compact: true });
  const etiFrom = formatAmount(auditEtiTier.priceMin!, "en", { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, "en", { compact: false });
  return `Module 1 — On-site sessions (1 day from ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}, ${interventionsEntry}). Module 2 — AI audit (4 tiers: Flash from ${flash}, Targeted from ${cibleFrom}, Strategic SME from ${pmeFrom}, Strategic Mid-cap from ${etiFrom}). Module 3 — AI implementation (production deployment, ${implEntry}).`;
}

export const ABOUT_TIMELINE = [
  {
    id: "2026",
    date: "2026",
    fr: {
      title: "Création d'Axion-IA",
      description:
        "Lancement du cabinet IA opérationnel et de la plateforme axion-ia.com — mobile-first, multilingue FR/EN.",
    },
    en: {
      title: "Axion-IA founded",
      description:
        "Operational AI consultancy launched with the axion-ia.com platform — mobile-first, FR/EN multilingual.",
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
    id: "geo-france",
    fr: {
      question: "Couvrez-vous toute la France et l'international ?",
      answer:
        "Oui. Nous intervenons sur site dans les 13 régions de France métropolitaine, Corse comprise (Île-de-France, Auvergne-Rhône-Alpes, Provence-Alpes-Côte d'Azur, Occitanie, Nouvelle-Aquitaine, Hauts-de-France, Pays de la Loire, Bretagne, Grand Est, Normandie, Bourgogne-Franche-Comté, Centre-Val de Loire, Corse), dans les 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte), ainsi qu'auprès des entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec, etc.) — sur devis selon la zone et la mission.",
    },
    en: {
      question: "Couvrez-vous toute la France et l'international ?",
      answer:
        "Oui. Nous intervenons sur site dans les 13 régions de France métropolitaine, Corse comprise (Île-de-France, Auvergne-Rhône-Alpes, Provence-Alpes-Côte d'Azur, Occitanie, Nouvelle-Aquitaine, Hauts-de-France, Pays de la Loire, Bretagne, Grand Est, Normandie, Bourgogne-Franche-Comté, Centre-Val de Loire, Corse), dans les 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte), ainsi qu'auprès des entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec, etc.) — sur devis selon la zone et la mission.",
    },
  },
  {
    id: "geo-metropoles",
    fr: {
      question:
        "Intervenez-vous dans les métropoles régionales (Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes…) ?",
      answer:
        "Oui. Nos consultants se déplacent dans toutes les capitales régionales : Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Montpellier, Rennes, Nice, Reims, Saint-Étienne, Le Havre, Grenoble, Dijon, Angers — et plus généralement toute ville française.",
    },
    en: {
      question:
        "Do you work in regional cities (Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes…)?",
      answer:
        "Yes. Our consultants travel to every regional capital: Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Montpellier, Rennes, Nice, Reims, Saint-Étienne, Le Havre, Grenoble, Dijon, Angers — and more broadly any French city. Travel costs included.",
    },
  },
  {
    id: "geo-tpe-rural",
    fr: {
      question: "Et pour les TPE, PME et artisans en zone rurale ou petites villes ?",
      answer:
        "Absolument. Nous accompagnons artisans, commerçants, TPE, PME et ETI partout en France, y compris en zone rurale et petites villes. Le format à distance est souvent plus rentable pour ces structures — sans perdre en qualité d'accompagnement.",
    },
    en: {
      question: "What about SMEs, craftsmen in rural areas or small towns?",
      answer:
        "Absolutely. We support craftsmen, retailers, SMEs and mid-cap companies across France, including rural areas and small towns. Remote format is often more cost-effective for these structures — without losing quality of support.",
    },
  },
  {
    id: "geo-distance-international",
    fr: {
      question: "Pouvez-vous intervenir à distance ou à l'international ?",
      answer:
        "Oui aux deux. Visio sécurisée, partage d'écran chiffré, livrables sous 48h. Nous intervenons en français ou en anglais, dans toute l'Union européenne et au-delà (Suisse, Royaume-Uni, Québec, Maghreb francophone). Format hybride possible (présentiel + remote).",
    },
    en: {
      question: "Can you work fully remote or internationally?",
      answer:
        "Yes to both. Secure video calls, encrypted screen sharing, deliverables within 48h. We deliver in French or English, across the European Union and beyond (Switzerland, UK, Quebec, French-speaking North Africa). Hybrid format available (on-site + remote).",
    },
  },
  {
    id: "definition-axion-ia",
    fr: {
      question: "Qu'est-ce qu'Axion-IA ?",
      answer:
        "Axion-IA est un cabinet IA opérationnel pour entreprises, basé en France. Nous intervenons sur plusieurs modules : interventions sur site, audit, implémentation IA, accompagnement 1-to-1, sites web et SaaS augmentés à l'IA.",
    },
    en: {
      question: "What is Axion-IA?",
      answer:
        "Axion-IA is an operational AI consultancy for companies, based in France. We work across several modules: on-site interventions, audit, AI implementation, 1-to-1 support, and websites and SaaS augmented with AI.",
    },
  },
  {
    id: "les-3-modules-axion-ia",
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
    id: "securite-donnees-ia",
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
    id: "outils-ia",
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
    id: "no-code-position",
    fr: {
      question: "Utilisez-vous Zapier, Make ou des plateformes no-code ?",
      answer:
        "Non par défaut. Axion-IA livre du code custom de qualité production (Node.js, Python, TypeScript, infrastructures cloud-native) dans VOS systèmes — jamais dans des plateformes tierces qui louent l'accès à vos données. Pourquoi : souveraineté RGPD (vos données restent chez vous), zéro lock-in éditeur (vous possédez le code), performances 10× supérieures (appels API directs, pas de saut I/O entre étapes), conformité AI Act native (audit trail, versioning git, tests automatisés). Make, Zapier ou autres plateformes no-code sont disponibles uniquement sur demande client explicite — par exemple si votre équipe ops les utilise déjà en production. C'est notre différence avec les freelances IA qui assemblent des workflows préfabriqués : nous sommes des experts IA seniors qui construisent, nous ne collons pas des briques.",
    },
    en: {
      question: "Utilisez-vous Zapier, Make ou des plateformes no-code ?",
      answer:
        "Non par défaut. Axion-IA livre du code custom de qualité production (Node.js, Python, TypeScript, infrastructures cloud-native) dans VOS systèmes — jamais dans des plateformes tierces qui louent l'accès à vos données. Pourquoi : souveraineté RGPD (vos données restent chez vous), zéro lock-in éditeur (vous possédez le code), performances 10× supérieures (appels API directs, pas de saut I/O entre étapes), conformité AI Act native (audit trail, versioning git, tests automatisés). Make, Zapier ou autres plateformes no-code sont disponibles uniquement sur demande client explicite — par exemple si votre équipe ops les utilise déjà en production. C'est notre différence avec les freelances IA qui assemblent des workflows préfabriqués : nous sommes des experts IA seniors qui construisent, nous ne collons pas des briques.",
    },
  },
  {
    id: "facturation",
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
        "L'IA automatise les tâches répétitives à faible valeur (saisie, classement, rédaction d'e-mails standards, comptes-rendus, recherche d'informations) pour libérer du temps sur les missions à forte valeur ajoutée. En pratique : vos équipes produisent plus avec le même effectif, votre masse salariale n'augmente plus au rythme de votre croissance, et certains postes peuvent évoluer vers des missions plus stratégiques. C'est un levier de productivité — nous vous accompagnons sur le diagnostic technique et la transformation des process, pas sur l'organisation RH interne (qui reste votre décision).",
    },
    en: {
      question: "Will AI replace my employees?",
      answer:
        "AI automates low-value repetitive tasks (data entry, filing, standard email drafting, meeting notes, information search) to free up time for higher-value work. In practice: your teams produce more with the same headcount, your payroll no longer scales at the same pace as your growth, and some roles can evolve toward more strategic missions. It's a productivity lever — we support you on the technical diagnosis and process transformation, not on internal HR organisation (which stays your decision).",
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
        "Oui. Axion-IA accompagne des entreprises de toutes tailles, des TPE aux ETI et grands comptes. Pour les ETI et grands comptes, Axion-IA propose des programmes multi-sites sur devis, des audits stratégiques approfondis et des implémentations IA à large envergure avec gouvernance des données.",
    },
    en: {
      question: "Does Axion-IA work with mid-caps and large companies?",
      answer:
        "Yes. Axion-IA works with companies of all sizes, from small businesses to mid-caps and large companies. For mid-caps and large accounts, Axion-IA offers multi-site programmes (on request), in-depth strategic audits and large-scale AI implementations with data governance.",
    },
  },
  {
    id: "secteurs-ia",
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
        "Oui. Axion-IA propose une gamme de services accessible aux TPE : la formation collective (journée sur site) et l'audit sur place sont les formats d'entrée. Le POC d'implémentation permet de tester l'IA sur un process ciblé avant tout déploiement large.",
    },
    en: {
      question: "Is AI implementation suitable for small businesses?",
      answer:
        "Yes. Axion-IA offers a range accessible to small businesses: the group training (one day on site) and on-site audit are the entry-level formats. The implementation POC allows testing AI on a targeted process before any large-scale deployment.",
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
  // ── Batch perfection FAQ 2026-05-31 — extension couverture intentions ──────────
  {
    id: "tarifs-publics-transparents",
    fr: {
      question: "Les tarifs Axion-IA sont-ils publics et transparents ?",
      answer:
        "Oui. Axion-IA affiche des tarifs publics, sans devis opaque ni prix caché : chaque service (audit, intervention, implémentation, coaching) a un tarif d'entrée clair, et les missions sur mesure sont chiffrées sur devis détaillé avant tout engagement. Vous savez exactement ce que vous payez et pourquoi, avec un ROI estimé en amont.",
    },
    en: {
      question: "Is Axion-IA pricing public and transparent?",
      answer:
        "Yes. Axion-IA publishes public pricing, with no opaque quotes or hidden costs: each service (audit, session, implementation, coaching) has a clear entry price, and custom projects are quoted in detail before any commitment. You know exactly what you pay and why, with ROI estimated upfront.",
    },
  },
  {
    id: "aides-subventions-ia",
    fr: {
      question: "Existe-t-il des aides ou subventions pour un projet IA ?",
      answer:
        "Selon votre projet, certains audits ou diagnostics IA peuvent être partiellement co-financés en France : le programme France Num et ses diagnostics, des subventions régionales à la transformation numérique, des dispositifs BPI selon le cas, et les crédits d'impôt recherche/innovation (CIR/CII) pour les développements sur mesure. L'éligibilité dépend de votre taille, secteur et région ; nous vous orientons vers les dispositifs pertinents lors de l'audit.",
    },
    en: {
      question: "Are there grants or subsidies for an AI project?",
      answer:
        "Depending on your project, some AI audits or diagnostics can be partially co-funded in France: the France Num programme and its diagnostics, regional digital-transformation grants, BPI schemes where applicable, and research/innovation tax credits (CIR/CII) for custom development. Eligibility depends on your size, sector and region; we point you to the relevant schemes during the audit.",
    },
  },
  {
    id: "budget-demarrer-ia",
    fr: {
      question: "Quel budget prévoir pour démarrer l'IA dans mon entreprise ?",
      answer:
        "On peut démarrer sans gros budget. Un premier audit IA ou une intervention ciblée représente un investissement de quelques centaines à quelques milliers d'euros, avec un ROI souvent atteint en quelques semaines (heures gagnées, tâches automatisées). Une implémentation sur mesure (agents, automatisations, IA métier) se chiffre selon le périmètre. La bonne approche : commencer petit sur un cas à fort impact, prouver le ROI, puis étendre.",
    },
    en: {
      question: "What budget should I plan to get started with AI?",
      answer:
        "You can start without a big budget. A first AI audit or a targeted session is an investment of a few hundred to a few thousand euros, with ROI often reached within weeks (hours saved, tasks automated). A custom implementation (agents, automations, domain AI) is priced by scope. The right approach: start small on a high-impact case, prove ROI, then scale.",
    },
  },
  {
    id: "duree-audit-ia",
    fr: {
      question: "Combien de temps dure un audit IA ?",
      answer:
        "Un audit IA Axion-IA se déroule généralement sur quelques heures à quelques jours selon la taille de l'entreprise. La phase sur site ou en visio (cartographie des processus, identification des cas d'usage, estimation du ROI) dure souvent une demi-journée à une journée ; le rapport et la feuille de route sont remis dans la foulée, sous quelques jours ouvrés.",
    },
    en: {
      question: "How long does an AI audit take?",
      answer:
        "An Axion-IA audit usually runs from a few hours to a few days depending on company size. The on-site or remote phase (process mapping, use-case identification, ROI estimation) often lasts half a day to a day; the report and roadmap are delivered shortly after, within a few business days.",
    },
  },
  {
    id: "livrables-audit-ia",
    fr: {
      question: "Que contient le rapport d'un audit IA ?",
      answer:
        "Le rapport d'audit IA Axion-IA contient : une cartographie de vos processus et des points de friction, une liste priorisée de cas d'usage IA concrets, une estimation du ROI et du temps gagné pour chacun, les outils et l'architecture recommandés (avec contraintes RGPD et souveraineté), et une feuille de route séquencée. C'est un document actionnable, pas un rapport théorique.",
    },
    en: {
      question: "What does an AI audit report contain?",
      answer:
        "The Axion-IA audit report contains: a map of your processes and friction points, a prioritised list of concrete AI use cases, an ROI and time-saved estimate for each, recommended tools and architecture (with GDPR and sovereignty constraints), and a sequenced roadmap. It is an actionable document, not a theoretical report.",
    },
  },
  {
    id: "automatiser-taches-ia",
    fr: {
      question: "Quelles tâches peut-on automatiser avec l'IA en entreprise ?",
      answer:
        "Beaucoup de tâches répétitives à forte valeur : tri et réponse aux e-mails, rédaction de devis et comptes-rendus, classification et extraction de documents, relances clients, génération de contenus, synthèse de réunions, support client de premier niveau, analyse de données et reporting. L'IA ne remplace pas le métier : elle absorbe le travail répétitif pour libérer du temps sur les tâches à forte valeur ajoutée.",
    },
    en: {
      question: "Which business tasks can be automated with AI?",
      answer:
        "Many high-value repetitive tasks: email triage and replies, drafting quotes and reports, document classification and extraction, customer follow-ups, content generation, meeting summaries, first-level customer support, data analysis and reporting. AI does not replace the job: it absorbs repetitive work to free up time for high-value tasks.",
    },
  },
  {
    id: "ia-integration-outils",
    fr: {
      question: "Comment intégrer l'IA à mon CRM ou à mes outils existants ?",
      answer:
        "L'IA s'intègre à vos outils existants (CRM, ERP, messagerie, GED, tableurs) via leurs API ou des connecteurs, sans tout remplacer. Axion-IA privilégie une approche progressive : on greffe l'IA là où elle apporte le plus de valeur, en respectant votre stack et vos contraintes de sécurité. Pas besoin de refondre votre système d'information pour bénéficier de l'IA.",
    },
    en: {
      question: "How do I integrate AI with my CRM or existing tools?",
      answer:
        "AI integrates with your existing tools (CRM, ERP, email, document management, spreadsheets) via their APIs or connectors, without replacing everything. Axion-IA favours a gradual approach: we graft AI where it adds the most value, respecting your stack and security constraints. No need to overhaul your information system to benefit from AI.",
    },
  },
  {
    id: "agent-ia-definition",
    fr: {
      question: "Qu'est-ce qu'un agent IA ?",
      answer:
        "Un agent IA est un programme qui ne se contente pas de répondre : il accomplit des tâches de bout en bout de façon autonome. À partir d'un objectif, il peut consulter vos données, utiliser des outils (envoyer un e-mail, mettre à jour un CRM, générer un document), enchaîner plusieurs étapes et s'adapter. C'est la différence clé avec un simple chatbot, qui ne fait que dialoguer.",
    },
    en: {
      question: "What is an AI agent?",
      answer:
        "An AI agent is a program that does more than answer: it carries out tasks end to end autonomously. From a goal, it can consult your data, use tools (send an email, update a CRM, generate a document), chain several steps and adapt. That is the key difference from a simple chatbot, which only converses.",
    },
  },
  {
    id: "agent-vs-chatbot",
    fr: {
      question: "Quelle est la différence entre un agent IA et un chatbot ?",
      answer:
        "Un chatbot répond à des questions dans une conversation. Un agent IA agit : il exécute des tâches concrètes (traiter une commande, qualifier un lead, produire un rapport) en utilisant vos outils et vos données, avec plusieurs étapes autonomes. Le chatbot informe ; l'agent fait le travail. Axion-IA conçoit les deux selon votre besoin réel, en gardant l'humain dans la boucle pour les décisions sensibles.",
    },
    en: {
      question: "What is the difference between an AI agent and a chatbot?",
      answer:
        "A chatbot answers questions in a conversation. An AI agent acts: it performs concrete tasks (processing an order, qualifying a lead, producing a report) using your tools and data, across several autonomous steps. The chatbot informs; the agent does the work. Axion-IA designs both depending on your real need, keeping a human in the loop for sensitive decisions.",
    },
  },
  {
    id: "former-equipes-ia",
    fr: {
      question: "Comment monter mes équipes en compétence sur l'IA ?",
      answer:
        "Les sessions de prise en main Axion-IA sont pratiques, pas théoriques : on part de vos cas métier réels et vos équipes repartent autonomes sur des outils qu'elles utiliseront le lendemain. Sur site ou à distance, on couvre les bons réflexes, la rédaction de prompts efficaces, les pièges à éviter (confidentialité, vérification des réponses) et l'usage responsable. L'objectif : des équipes qui gagnent du temps en sécurité, pas des slides oubliés.",
    },
    en: {
      question: "How do I upskill my teams on AI?",
      answer:
        "Axion-IA hands-on sessions are practical, not theoretical: we start from your real business cases and your teams leave autonomous on tools they will use the next day. On-site or remote, we cover good habits, writing effective prompts, pitfalls to avoid (confidentiality, checking answers) and responsible use. The goal: teams that save time safely, not forgotten slides.",
    },
  },
  {
    id: "ia-generative-definition",
    fr: {
      question: "Qu'est-ce que l'IA générative ?",
      answer:
        "L'IA générative est une catégorie d'intelligence artificielle capable de produire du contenu nouveau — texte, code, images, synthèses — à partir d'une consigne en langage naturel. Des modèles comme Claude ou GPT en sont les moteurs. Pour une entreprise, l'intérêt n'est pas le gadget : c'est d'automatiser la rédaction, l'analyse et le traitement de l'information à grande échelle, en gardant un contrôle humain sur les résultats.",
    },
    en: {
      question: "What is generative AI?",
      answer:
        "Generative AI is a category of artificial intelligence able to produce new content — text, code, images, summaries — from a natural-language instruction. Models such as Claude or GPT are its engines. For a business, the point is not the gadget: it is automating writing, analysis and information processing at scale, while keeping human control over the results.",
    },
  },
  {
    id: "risques-ia-entreprise",
    fr: {
      question: "Quels sont les risques de l'IA en entreprise et comment les maîtriser ?",
      answer:
        "Les principaux risques sont la fuite de données confidentielles, les erreurs ou « hallucinations » de l'IA, la dépendance à un fournisseur, et la non-conformité (RGPD, AI Act). On les maîtrise par des règles claires : choisir des outils respectueux des données, ne jamais publier une sortie IA sans relecture humaine sur les sujets sensibles, tracer les usages, et privilégier des solutions souveraines quand les données sont critiques. Axion-IA cadre ces garde-fous dès l'audit.",
    },
    en: {
      question: "What are the risks of AI in business and how do you manage them?",
      answer:
        'The main risks are confidential data leaks, AI errors or "hallucinations", vendor lock-in, and non-compliance (GDPR, AI Act). You manage them with clear rules: choose data-respecting tools, never publish an AI output without human review on sensitive topics, log usage, and favour sovereign solutions when data is critical. Axion-IA frames these safeguards from the audit onward.',
    },
  },
  {
    id: "ia-hallucinations-fiabilite",
    fr: {
      question: "Comment éviter les erreurs et hallucinations de l'IA ?",
      answer:
        "Une « hallucination » est une réponse fausse présentée avec assurance. On la prévient en ancrant l'IA sur vos données vérifiées (au lieu de sa mémoire générale), en demandant des sources, en gardant une relecture humaine sur les sujets à enjeu, et en mesurant la qualité dans le temps. Bien cadrée, l'IA devient fiable pour la production ; livrée sans garde-fous, elle expose à l'erreur. C'est précisément ce qu'Axion-IA met en place.",
    },
    en: {
      question: "How do you avoid AI errors and hallucinations?",
      answer:
        'A "hallucination" is a false answer presented confidently. You prevent it by grounding AI on your verified data (instead of its general memory), asking for sources, keeping human review on high-stakes topics, and measuring quality over time. Properly framed, AI becomes reliable for production; delivered without safeguards, it exposes you to error. That is exactly what Axion-IA puts in place.',
    },
  },
  {
    id: "ia-souveraine-europe",
    fr: {
      question: "Qu'est-ce qu'une IA souveraine ou européenne ?",
      answer:
        "Une IA « souveraine » désigne des solutions où vos données restent hébergées et traitées dans un cadre maîtrisé (Europe, voire sur vos propres serveurs), conforme au RGPD, sans transfert incontrôlé hors UE. C'est essentiel pour les données sensibles (santé, juridique, RH, R&D). Axion-IA conçoit des architectures qui combinent performance et souveraineté selon votre niveau de sensibilité, jusqu'à des déploiements on-premise quand c'est nécessaire.",
    },
    en: {
      question: "What is sovereign or European AI?",
      answer:
        '"Sovereign" AI refers to solutions where your data stays hosted and processed within a controlled framework (Europe, or even your own servers), GDPR-compliant, with no uncontrolled transfer outside the EU. This is essential for sensitive data (health, legal, HR, R&D). Axion-IA designs architectures combining performance and sovereignty depending on your sensitivity level, up to on-premise deployments when needed.',
    },
  },
  {
    id: "deroule-mission-axion",
    fr: {
      question: "Comment se déroule une mission avec Axion-IA ?",
      answer:
        "Une mission suit quatre temps simples : un premier échange pour cerner votre besoin, un audit qui identifie les cas d'usage à fort ROI, la mise en œuvre (intervention, formation ou implémentation sur mesure), puis un accompagnement pour ancrer les usages et mesurer les gains. Vous gardez la main à chaque étape, les livrables sont concrets, et l'objectif reste un ROI mesurable — pas une démo sans suite.",
    },
    en: {
      question: "How does a mission with Axion-IA unfold?",
      answer:
        "A mission follows four simple steps: a first conversation to scope your need, an audit identifying high-ROI use cases, delivery (session, intervention or custom implementation), then support to embed usage and measure gains. You stay in control at every step, deliverables are concrete, and the goal remains measurable ROI — not a demo with no follow-up.",
    },
  },
  // ── Batch perfection FAQ 2026-05-31 #2 — secteurs, cas d'usage, comparatifs ────
  // (terminologie sûre : « session/intervention/accompagnement », jamais OPCO/CPF/
  //  Qualiopi ; aucun prix chiffré ni fait spécifique inventé.)
  {
    id: "ia-commerce-retail",
    fr: {
      question: "Comment l'IA peut-elle aider un commerce ou un retailer ?",
      answer:
        "Pour un commerce, l'IA automatise les tâches chronophages et améliore la relation client : réponses aux questions fréquentes, gestion des avis, descriptions produits, prévisions de stock, relances et fidélisation, analyse des ventes. L'objectif n'est pas de remplacer le contact humain mais de libérer du temps pour la vente et le conseil. On commence par un cas concret à fort impact, puis on étend.",
    },
    en: {
      question: "Comment l'IA peut-elle aider un commerce ou un retailer ?",
      answer:
        "Pour un commerce, l'IA automatise les tâches chronophages et améliore la relation client : réponses aux questions fréquentes, gestion des avis, descriptions produits, prévisions de stock, relances et fidélisation, analyse des ventes. L'objectif n'est pas de remplacer le contact humain mais de libérer du temps pour la vente et le conseil. On commence par un cas concret à fort impact, puis on étend.",
    },
  },
  {
    id: "ia-restauration-hotellerie",
    fr: {
      question: "L'IA est-elle utile pour un restaurant ou un hôtel ?",
      answer:
        "Oui. Dans la restauration et l'hôtellerie, l'IA aide sur la réservation et la prise de demandes, les réponses aux avis en ligne, la gestion des plannings, les prévisions d'affluence, le marketing local et les réponses aux questions des clients 24/7. Bien cadrée, elle réduit la charge administrative et améliore l'expérience client, sans dénaturer l'accueil humain.",
    },
    en: {
      question: "L'IA est-elle utile pour un restaurant ou un hôtel ?",
      answer:
        "Oui. Dans la restauration et l'hôtellerie, l'IA aide sur la réservation et la prise de demandes, les réponses aux avis en ligne, la gestion des plannings, les prévisions d'affluence, le marketing local et les réponses aux questions des clients 24/7. Bien cadrée, elle réduit la charge administrative et améliore l'expérience client, sans dénaturer l'accueil humain.",
    },
  },
  {
    id: "ia-btp-construction",
    fr: {
      question: "Comment l'IA s'applique-t-elle au BTP et à la construction ?",
      answer:
        "Dans le BTP, l'IA accélère le chiffrage et les devis, l'analyse de cahiers des charges, la rédaction de comptes-rendus de chantier, le suivi administratif et la veille appels d'offres. Elle aide aussi à structurer la donnée éparpillée (mails, PDF, photos). Le gain est surtout sur le temps de bureau, qui pèse lourd dans le secteur, pour recentrer les équipes sur le terrain.",
    },
    en: {
      question: "Comment l'IA s'applique-t-elle au BTP et à la construction ?",
      answer:
        "Dans le BTP, l'IA accélère le chiffrage et les devis, l'analyse de cahiers des charges, la rédaction de comptes-rendus de chantier, le suivi administratif et la veille appels d'offres. Elle aide aussi à structurer la donnée éparpillée (mails, PDF, photos). Le gain est surtout sur le temps de bureau, qui pèse lourd dans le secteur, pour recentrer les équipes sur le terrain.",
    },
  },
  {
    id: "ia-immobilier",
    fr: {
      question: "Comment l'IA aide-t-elle une agence immobilière ?",
      answer:
        "En immobilier, l'IA rédige les annonces, qualifie les leads entrants, répond aux demandes 24/7, prépare les estimations à partir de données de marché, organise les visites et automatise les relances. Elle fait gagner un temps précieux sur l'administratif et la prospection, pour que les agents se concentrent sur la relation et la négociation.",
    },
    en: {
      question: "Comment l'IA aide-t-elle une agence immobilière ?",
      answer:
        "En immobilier, l'IA rédige les annonces, qualifie les leads entrants, répond aux demandes 24/7, prépare les estimations à partir de données de marché, organise les visites et automatise les relances. Elle fait gagner un temps précieux sur l'administratif et la prospection, pour que les agents se concentrent sur la relation et la négociation.",
    },
  },
  {
    id: "ia-cabinet-comptable-conseil",
    fr: {
      question: "L'IA est-elle utile pour un cabinet comptable ou de conseil ?",
      answer:
        "Beaucoup. Pour un cabinet comptable ou de conseil, l'IA extrait et classe les pièces, pré-saisit les écritures, synthétise des documents volumineux, rédige des notes et des livrables, et automatise la relation client récurrente. Avec un cadre de confidentialité strict, elle absorbe la production répétitive pour redonner du temps au conseil à valeur ajoutée — le cœur du métier.",
    },
    en: {
      question: "L'IA est-elle utile pour un cabinet comptable ou de conseil ?",
      answer:
        "Beaucoup. Pour un cabinet comptable ou de conseil, l'IA extrait et classe les pièces, pré-saisit les écritures, synthétise des documents volumineux, rédige des notes et des livrables, et automatise la relation client récurrente. Avec un cadre de confidentialité strict, elle absorbe la production répétitive pour redonner du temps au conseil à valeur ajoutée — le cœur du métier.",
    },
  },
  {
    id: "ia-industrie-production",
    fr: {
      question: "Comment l'IA s'applique-t-elle à l'industrie et à la production ?",
      answer:
        "Dans l'industrie, l'IA aide sur la documentation technique, le support et la maintenance (recherche dans les manuels, diagnostics assistés), la qualité, les prévisions de demande, le reporting et l'administratif de production. Au-delà des usages lourds en data, beaucoup de gains rapides viennent de l'automatisation des tâches de bureau et de la mise à disposition de la connaissance interne.",
    },
    en: {
      question: "Comment l'IA s'applique-t-elle à l'industrie et à la production ?",
      answer:
        "Dans l'industrie, l'IA aide sur la documentation technique, le support et la maintenance (recherche dans les manuels, diagnostics assistés), la qualité, les prévisions de demande, le reporting et l'administratif de production. Au-delà des usages lourds en data, beaucoup de gains rapides viennent de l'automatisation des tâches de bureau et de la mise à disposition de la connaissance interne.",
    },
  },
  {
    id: "ia-e-commerce",
    fr: {
      question: "Comment booster un e-commerce avec l'IA ?",
      answer:
        "Pour un e-commerce, l'IA génère et optimise les fiches produits, personnalise les recommandations, automatise le service client et les retours, rédige les contenus SEO et e-mailings, et analyse les comportements d'achat. Résultat : plus de conversions et moins de temps passé sur les tâches répétitives. On priorise les leviers selon votre catalogue et votre trafic.",
    },
    en: {
      question: "Comment booster un e-commerce avec l'IA ?",
      answer:
        "Pour un e-commerce, l'IA génère et optimise les fiches produits, personnalise les recommandations, automatise le service client et les retours, rédige les contenus SEO et e-mailings, et analyse les comportements d'achat. Résultat : plus de conversions et moins de temps passé sur les tâches répétitives. On priorise les leviers selon votre catalogue et votre trafic.",
    },
  },
  {
    id: "automatiser-facturation-ia",
    fr: {
      question: "Peut-on automatiser la facturation et l'administratif avec l'IA ?",
      answer:
        "Oui. L'IA peut générer les devis et factures, extraire les données des justificatifs, rapprocher les paiements, relancer les impayés et préparer les éléments pour la comptabilité. Couplée à vos outils existants, elle réduit fortement la saisie manuelle et les erreurs. L'humain garde la validation finale ; l'IA fait le travail répétitif en amont.",
    },
    en: {
      question: "Peut-on automatiser la facturation et l'administratif avec l'IA ?",
      answer:
        "Oui. L'IA peut générer les devis et factures, extraire les données des justificatifs, rapprocher les paiements, relancer les impayés et préparer les éléments pour la comptabilité. Couplée à vos outils existants, elle réduit fortement la saisie manuelle et les erreurs. L'humain garde la validation finale ; l'IA fait le travail répétitif en amont.",
    },
  },
  {
    id: "automatiser-service-client-ia",
    fr: {
      question: "Comment automatiser le service client avec l'IA ?",
      answer:
        "L'IA peut répondre instantanément aux questions fréquentes, qualifier et router les demandes, rédiger des brouillons de réponse pour vos agents, et assurer un premier niveau 24/7. Le but n'est pas de supprimer l'humain mais de le décharger du répétitif et d'accélérer les réponses. Les cas complexes ou sensibles restent traités par vos équipes, avec l'IA en support.",
    },
    en: {
      question: "Comment automatiser le service client avec l'IA ?",
      answer:
        "L'IA peut répondre instantanément aux questions fréquentes, qualifier et router les demandes, rédiger des brouillons de réponse pour vos agents, et assurer un premier niveau 24/7. Le but n'est pas de supprimer l'humain mais de le décharger du répétitif et d'accélérer les réponses. Les cas complexes ou sensibles restent traités par vos équipes, avec l'IA en support.",
    },
  },
  {
    id: "ia-gestion-documents",
    fr: {
      question: "Comment l'IA gère et exploite mes documents ?",
      answer:
        "L'IA lit, classe et résume vos documents (PDF, e-mails, contrats, rapports), en extrait les informations clés et permet de les interroger en langage naturel (« retrouve la clause de résiliation »). Elle transforme une masse de fichiers dispersés en connaissance exploitable, en quelques secondes, avec un contrôle d'accès et de confidentialité adapté à vos données.",
    },
    en: {
      question: "Comment l'IA gère et exploite mes documents ?",
      answer:
        "L'IA lit, classe et résume vos documents (PDF, e-mails, contrats, rapports), en extrait les informations clés et permet de les interroger en langage naturel (« retrouve la clause de résiliation »). Elle transforme une masse de fichiers dispersés en connaissance exploitable, en quelques secondes, avec un contrôle d'accès et de confidentialité adapté à vos données.",
    },
  },
  {
    id: "ia-reporting-analyse-donnees",
    fr: {
      question: "L'IA peut-elle automatiser mon reporting et mes analyses ?",
      answer:
        "Oui. L'IA agrège vos données, génère des synthèses et des tableaux de bord commentés, repère les tendances et anomalies, et produit des rapports lisibles à partir de chiffres bruts. Vous passez moins de temps à compiler et plus à décider. Les analyses restent vérifiables : on garde la traçabilité des sources et un contrôle humain sur les conclusions.",
    },
    en: {
      question: "L'IA peut-elle automatiser mon reporting et mes analyses ?",
      answer:
        "Oui. L'IA agrège vos données, génère des synthèses et des tableaux de bord commentés, repère les tendances et anomalies, et produit des rapports lisibles à partir de chiffres bruts. Vous passez moins de temps à compiler et plus à décider. Les analyses restent vérifiables : on garde la traçabilité des sources et un contrôle humain sur les conclusions.",
    },
  },
  {
    id: "chatgpt-copilot-gemini-choisir",
    fr: {
      question: "ChatGPT, Copilot, Gemini, Claude : lequel choisir pour mon entreprise ?",
      answer:
        "Il n'y a pas de « meilleur » outil dans l'absolu : le bon choix dépend de vos usages, de vos outils existants et de vos contraintes de confidentialité. Copilot s'intègre à l'écosystème Microsoft, Gemini à Google, Claude et ChatGPT excellent sur le raisonnement et la rédaction. Axion-IA est indépendant des éditeurs : on recommande l'outil adapté à VOTRE contexte, pas celui d'un partenariat.",
    },
    en: {
      question: "ChatGPT, Copilot, Gemini, Claude : lequel choisir pour mon entreprise ?",
      answer:
        "Il n'y a pas de « meilleur » outil dans l'absolu : le bon choix dépend de vos usages, de vos outils existants et de vos contraintes de confidentialité. Copilot s'intègre à l'écosystème Microsoft, Gemini à Google, Claude et ChatGPT excellent sur le raisonnement et la rédaction. Axion-IA est indépendant des éditeurs : on recommande l'outil adapté à VOTRE contexte, pas celui d'un partenariat.",
    },
  },
  {
    id: "ia-gratuite-vs-payante",
    fr: {
      question: "Les versions gratuites d'IA suffisent-elles ou faut-il payer ?",
      answer:
        "Pour découvrir, les versions gratuites suffisent. Pour un usage professionnel, les versions payantes apportent ce qui compte vraiment : confidentialité (vos données ne servent pas à l'entraînement), modèles plus performants, limites d'usage plus hautes, et intégration à vos outils. Le coût est généralement modeste face au temps gagné — l'enjeu est surtout de bien configurer la confidentialité.",
    },
    en: {
      question: "Les versions gratuites d'IA suffisent-elles ou faut-il payer ?",
      answer:
        "Pour découvrir, les versions gratuites suffisent. Pour un usage professionnel, les versions payantes apportent ce qui compte vraiment : confidentialité (vos données ne servent pas à l'entraînement), modèles plus performants, limites d'usage plus hautes, et intégration à vos outils. Le coût est généralement modeste face au temps gagné — l'enjeu est surtout de bien configurer la confidentialité.",
    },
  },
  {
    id: "ia-droit-auteur-contenu",
    fr: {
      question: "Puis-je utiliser commercialement le contenu généré par IA ?",
      answer:
        "En général oui, mais avec nuances. Les principaux outils autorisent l'usage commercial des contenus que vous générez (vérifiez leurs conditions). En revanche, en France comme dans l'UE, un contenu purement généré par IA n'est pas automatiquement protégé par le droit d'auteur, et il faut rester vigilant sur les ressemblances avec des œuvres existantes. La bonne pratique : relire, adapter et apporter votre valeur humaine.",
    },
    en: {
      question: "Puis-je utiliser commercialement le contenu généré par IA ?",
      answer:
        "En général oui, mais avec nuances. Les principaux outils autorisent l'usage commercial des contenus que vous générez (vérifiez leurs conditions). En revanche, en France comme dans l'UE, un contenu purement généré par IA n'est pas automatiquement protégé par le droit d'auteur, et il faut rester vigilant sur les ressemblances avec des œuvres existantes. La bonne pratique : relire, adapter et apporter votre valeur humaine.",
    },
  },
  {
    id: "ia-biais-objectivite",
    fr: {
      question: "L'IA est-elle objective ou peut-elle être biaisée ?",
      answer:
        "L'IA n'est pas neutre : elle reflète les données sur lesquelles elle a été entraînée et peut reproduire des biais. Pour un usage professionnel, cela impose des garde-fous : vérifier les sorties sur les sujets sensibles (RH, juridique, finance), ne pas déléguer les décisions importantes à la machine, et documenter les usages. Bien encadrée, l'IA est un excellent assistant ; elle ne doit pas être un juge automatique.",
    },
    en: {
      question: "L'IA est-elle objective ou peut-elle être biaisée ?",
      answer:
        "L'IA n'est pas neutre : elle reflète les données sur lesquelles elle a été entraînée et peut reproduire des biais. Pour un usage professionnel, cela impose des garde-fous : vérifier les sorties sur les sujets sensibles (RH, juridique, finance), ne pas déléguer les décisions importantes à la machine, et documenter les usages. Bien encadrée, l'IA est un excellent assistant ; elle ne doit pas être un juge automatique.",
    },
  },
  {
    id: "ia-donnees-entrainement-confidentialite",
    fr: {
      question: "Mes données servent-elles à entraîner l'IA ?",
      answer:
        "Cela dépend de l'outil et de la formule. Avec les offres grand public gratuites, vos échanges peuvent parfois être réutilisés ; avec les offres professionnelles et API, les principaux fournisseurs s'engagent à ne pas entraîner leurs modèles sur vos données. C'est un point que nous vérifions systématiquement chez Axion-IA : on choisit des configurations où vos données restent les vôtres.",
    },
    en: {
      question: "Mes données servent-elles à entraîner l'IA ?",
      answer:
        "Cela dépend de l'outil et de la formule. Avec les offres grand public gratuites, vos échanges peuvent parfois être réutilisés ; avec les offres professionnelles et API, les principaux fournisseurs s'engagent à ne pas entraîner leurs modèles sur vos données. C'est un point que nous vérifions systématiquement chez Axion-IA : on choisit des configurations où vos données restent les vôtres.",
    },
  },
  {
    id: "erreurs-eviter-projet-ia",
    fr: {
      question: "Quelles erreurs éviter quand on se lance dans l'IA ?",
      answer:
        "Les pièges classiques : vouloir tout automatiser d'un coup, choisir l'outil avant le besoin, négliger la confidentialité des données, déployer sans former les équipes, et ne pas mesurer le ROI. La bonne méthode est inverse : partir d'un cas concret à fort impact, prouver le gain, sécuriser les données, embarquer les équipes, puis étendre. C'est exactement la démarche que cadre l'audit.",
    },
    en: {
      question: "Quelles erreurs éviter quand on se lance dans l'IA ?",
      answer:
        "Les pièges classiques : vouloir tout automatiser d'un coup, choisir l'outil avant le besoin, négliger la confidentialité des données, déployer sans former les équipes, et ne pas mesurer le ROI. La bonne méthode est inverse : partir d'un cas concret à fort impact, prouver le gain, sécuriser les données, embarquer les équipes, puis étendre. C'est exactement la démarche que cadre l'audit.",
    },
  },
  {
    id: "qui-pilote-ia-entreprise",
    fr: {
      question: "Qui doit piloter l'IA dans l'entreprise ?",
      answer:
        "Pas besoin d'un service informatique dédié. Le pilotage idéal associe la direction (vision et priorités), un référent métier motivé (le « champion » interne) et un accompagnement externe pour le cadrage et la montée en compétence. Dans les TPE/PME, c'est souvent le dirigeant lui-même qui impulse. L'essentiel : un sponsor clair et un premier cas d'usage concret pour embarquer les équipes.",
    },
    en: {
      question: "Qui doit piloter l'IA dans l'entreprise ?",
      answer:
        "Pas besoin d'un service informatique dédié. Le pilotage idéal associe la direction (vision et priorités), un référent métier motivé (le « champion » interne) et un accompagnement externe pour le cadrage et la montée en compétence. Dans les TPE/PME, c'est souvent le dirigeant lui-même qui impulse. L'essentiel : un sponsor clair et un premier cas d'usage concret pour embarquer les équipes.",
    },
  },
  // ── Batch FAQ #3 — par service (keyword-rich, EN = clone FR car EN désactivé).
  //    Services réels : audit · formation/interventions · implémentation ·
  //    sites web & SaaS IA · coaching 1-to-1. NDA OK → « formation » autorisé ;
  //    jamais OPCO/CPF/Qualiopi ; aucun prix chiffré inventé. ────────────────────
  {
    id: "audit-ia-tpe-pme",
    fr: {
      question: "Quel audit IA pour une TPE ou une PME ?",
      answer:
        "L'audit IA Axion-IA s'adapte aux TPE et PME : en une demi-journée à une journée, on cartographie vos processus, on identifie les cas d'usage IA les plus rentables pour votre taille et votre secteur, et on chiffre le ROI. Vous repartez avec une feuille de route concrète et priorisée — pas un rapport théorique. C'est le point de départ idéal pour démarrer l'IA sans se disperser.",
    },
    en: {
      question: "Quel audit IA pour une TPE ou une PME ?",
      answer:
        "L'audit IA Axion-IA s'adapte aux TPE et PME : en une demi-journée à une journée, on cartographie vos processus, on identifie les cas d'usage IA les plus rentables pour votre taille et votre secteur, et on chiffre le ROI. Vous repartez avec une feuille de route concrète et priorisée — pas un rapport théorique. C'est le point de départ idéal pour démarrer l'IA sans se disperser.",
    },
  },
  {
    id: "audit-maturite-ia-entreprise",
    fr: {
      question: "Qu'est-ce qu'un audit de maturité IA d'entreprise ?",
      answer:
        "Un audit de maturité IA évalue où en est votre entreprise face à l'intelligence artificielle : outils déjà utilisés, niveau des équipes, qualité et accessibilité de vos données, processus automatisables, et conformité (RGPD, AI Act). Il situe votre maturité et trace les prochaines étapes prioritaires. C'est une photographie objective qui évite d'investir au hasard et concentre les efforts là où l'IA rapporte vraiment.",
    },
    en: {
      question: "Qu'est-ce qu'un audit de maturité IA d'entreprise ?",
      answer:
        "Un audit de maturité IA évalue où en est votre entreprise face à l'intelligence artificielle : outils déjà utilisés, niveau des équipes, qualité et accessibilité de vos données, processus automatisables, et conformité (RGPD, AI Act). Il situe votre maturité et trace les prochaines étapes prioritaires. C'est une photographie objective qui évite d'investir au hasard et concentre les efforts là où l'IA rapporte vraiment.",
    },
  },
  {
    id: "cout-audit-ia-entreprise",
    fr: {
      question: "Combien coûte un audit IA pour une entreprise ?",
      answer:
        "Axion-IA pratique des tarifs publics et transparents pour l'audit IA, avec un tarif d'entrée clair selon le format (audit flash sur site ou audit approfondi), et un devis détaillé pour les missions plus larges. L'investissement reste modeste face au temps gagné identifié, et certains diagnostics peuvent être partiellement co-financés (France Num, BPI, subventions régionales) selon votre profil.",
    },
    en: {
      question: "Combien coûte un audit IA pour une entreprise ?",
      answer:
        "Axion-IA pratique des tarifs publics et transparents pour l'audit IA, avec un tarif d'entrée clair selon le format (audit flash sur site ou audit approfondi), et un devis détaillé pour les missions plus larges. L'investissement reste modeste face au temps gagné identifié, et certains diagnostics peuvent être partiellement co-financés (France Num, BPI, subventions régionales) selon votre profil.",
    },
  },
  {
    id: "premier-diagnostic-ia",
    fr: {
      question: "Comment se passe un premier diagnostic IA ?",
      answer:
        "Le premier diagnostic IA commence par un échange pour comprendre votre activité, vos irritants et vos objectifs. On observe ensuite vos processus et vos outils, on repère les tâches chronophages automatisables, et on identifie 2 à 3 cas d'usage à fort impact pour démarrer vite. L'objectif : sortir avec des actions concrètes et un ordre de priorité clair, pas une liste de bonnes intentions.",
    },
    en: {
      question: "Comment se passe un premier diagnostic IA ?",
      answer:
        "Le premier diagnostic IA commence par un échange pour comprendre votre activité, vos irritants et vos objectifs. On observe ensuite vos processus et vos outils, on repère les tâches chronophages automatisables, et on identifie 2 à 3 cas d'usage à fort impact pour démarrer vite. L'objectif : sortir avec des actions concrètes et un ordre de priorité clair, pas une liste de bonnes intentions.",
    },
  },
  {
    id: "formation-ia-entreprise",
    fr: {
      question: "Comment se passe une formation IA en entreprise ?",
      answer:
        "La formation IA Axion-IA est 100 % pratique et adaptée à vos métiers : on part de vos cas réels, pas de théorie. Sur site ou à distance, vos équipes manipulent les outils, apprennent à rédiger des prompts efficaces, à vérifier les réponses et à travailler en sécurité (confidentialité des données). Elles repartent autonomes et opérationnelles dès le lendemain, avec des gains de temps mesurables sur leurs tâches quotidiennes.",
    },
    en: {
      question: "Comment se passe une formation IA en entreprise ?",
      answer:
        "La formation IA Axion-IA est 100 % pratique et adaptée à vos métiers : on part de vos cas réels, pas de théorie. Sur site ou à distance, vos équipes manipulent les outils, apprennent à rédiger des prompts efficaces, à vérifier les réponses et à travailler en sécurité (confidentialité des données). Elles repartent autonomes et opérationnelles dès le lendemain, avec des gains de temps mesurables sur leurs tâches quotidiennes.",
    },
  },
  {
    id: "formation-chatgpt-claude-entreprise",
    fr: {
      question: "Proposez-vous une formation ChatGPT ou Claude pour les entreprises ?",
      answer:
        "Oui. Axion-IA forme vos équipes à l'usage professionnel des IA génératives (ChatGPT, Claude, Copilot, Gemini) selon vos outils et vos besoins. On va au-delà des bases : prompts métier efficaces, automatisations concrètes, bonnes pratiques de confidentialité et vérification des réponses. La formation est indépendante des éditeurs : on vous apprend à utiliser l'outil le plus adapté à votre contexte, pas à dépendre d'un seul.",
    },
    en: {
      question: "Proposez-vous une formation ChatGPT ou Claude pour les entreprises ?",
      answer:
        "Oui. Axion-IA forme vos équipes à l'usage professionnel des IA génératives (ChatGPT, Claude, Copilot, Gemini) selon vos outils et vos besoins. On va au-delà des bases : prompts métier efficaces, automatisations concrètes, bonnes pratiques de confidentialité et vérification des réponses. La formation est indépendante des éditeurs : on vous apprend à utiliser l'outil le plus adapté à votre contexte, pas à dépendre d'un seul.",
    },
  },
  {
    id: "atelier-ia-equipe",
    fr: {
      question: "Qu'est-ce qu'un atelier IA pour une équipe ?",
      answer:
        "Un atelier IA est une session courte et pratique où votre équipe travaille sur ses propres cas d'usage, en direct, avec un expert. En quelques heures, on identifie les tâches à automatiser, on teste des outils, et chacun repart avec des automatisations concrètes applicables immédiatement. C'est un format idéal pour lancer une dynamique IA dans l'équipe et lever les blocages, sans monopoliser des journées entières.",
    },
    en: {
      question: "Qu'est-ce qu'un atelier IA pour une équipe ?",
      answer:
        "Un atelier IA est une session courte et pratique où votre équipe travaille sur ses propres cas d'usage, en direct, avec un expert. En quelques heures, on identifie les tâches à automatiser, on teste des outils, et chacun repart avec des automatisations concrètes applicables immédiatement. C'est un format idéal pour lancer une dynamique IA dans l'équipe et lever les blocages, sans monopoliser des journées entières.",
    },
  },
  {
    id: "formation-ia-dirigeants",
    fr: {
      question: "Existe-t-il une formation IA pour dirigeants et managers ?",
      answer:
        "Oui. Axion-IA propose des formations et un accompagnement IA dédiés aux dirigeants, DG, DRH et managers : comment intégrer l'IA dans son quotidien (préparation de réunions, analyse, rédaction stratégique, veille), comment cadrer une démarche IA dans son entreprise, et comment piloter sans être expert technique. L'objectif est double : gagner du temps personnellement et savoir conduire la transformation IA de ses équipes.",
    },
    en: {
      question: "Existe-t-il une formation IA pour dirigeants et managers ?",
      answer:
        "Oui. Axion-IA propose des formations et un accompagnement IA dédiés aux dirigeants, DG, DRH et managers : comment intégrer l'IA dans son quotidien (préparation de réunions, analyse, rédaction stratégique, veille), comment cadrer une démarche IA dans son entreprise, et comment piloter sans être expert technique. L'objectif est double : gagner du temps personnellement et savoir conduire la transformation IA de ses équipes.",
    },
  },
  {
    id: "implementation-ia-sur-mesure",
    fr: {
      question: "Qu'est-ce qu'une implémentation IA sur mesure ?",
      answer:
        "L'implémentation IA sur mesure consiste à concevoir et déployer une solution IA adaptée à VOS processus : automatisation d'un workflow, agent IA métier, traitement documentaire, assistant interne, intégration à vos outils existants. Contrairement à un outil générique, elle épouse votre façon de travailler et vos contraintes (sécurité, RGPD). Axion-IA livre une solution opérationnelle, testée et documentée, avec un accompagnement pour l'ancrer durablement.",
    },
    en: {
      question: "Qu'est-ce qu'une implémentation IA sur mesure ?",
      answer:
        "L'implémentation IA sur mesure consiste à concevoir et déployer une solution IA adaptée à VOS processus : automatisation d'un workflow, agent IA métier, traitement documentaire, assistant interne, intégration à vos outils existants. Contrairement à un outil générique, elle épouse votre façon de travailler et vos contraintes (sécurité, RGPD). Axion-IA livre une solution opérationnelle, testée et documentée, avec un accompagnement pour l'ancrer durablement.",
    },
  },
  {
    id: "integration-ia-entreprise-concrete",
    fr: {
      question: "Comment intégrer concrètement l'IA dans mon entreprise ?",
      answer:
        "On procède par étapes : un audit identifie le cas d'usage à plus fort ROI, on déploie une première solution IA sur ce cas précis, on forme les équipes concernées, on mesure les gains, puis on étend. L'IA se greffe sur vos outils existants (CRM, ERP, messagerie) sans tout remplacer. Cette approche progressive prouve la valeur rapidement et évite les grands projets coûteux qui n'aboutissent pas.",
    },
    en: {
      question: "Comment intégrer concrètement l'IA dans mon entreprise ?",
      answer:
        "On procède par étapes : un audit identifie le cas d'usage à plus fort ROI, on déploie une première solution IA sur ce cas précis, on forme les équipes concernées, on mesure les gains, puis on étend. L'IA se greffe sur vos outils existants (CRM, ERP, messagerie) sans tout remplacer. Cette approche progressive prouve la valeur rapidement et évite les grands projets coûteux qui n'aboutissent pas.",
    },
  },
  {
    id: "chatbot-ia-entreprise",
    fr: {
      question: "Peut-on créer un chatbot ou un assistant IA pour mon entreprise ?",
      answer:
        "Oui. Axion-IA conçoit des assistants et chatbots IA sur mesure, branchés sur VOS contenus et vos données : réponse aux clients 24/7, support interne pour vos équipes, assistant commercial ou documentaire. Contrairement à un chatbot générique, il répond à partir de vos informations réelles, avec un cadre de confidentialité maîtrisé. On garde l'humain dans la boucle pour les cas sensibles.",
    },
    en: {
      question: "Peut-on créer un chatbot ou un assistant IA pour mon entreprise ?",
      answer:
        "Oui. Axion-IA conçoit des assistants et chatbots IA sur mesure, branchés sur VOS contenus et vos données : réponse aux clients 24/7, support interne pour vos équipes, assistant commercial ou documentaire. Contrairement à un chatbot générique, il répond à partir de vos informations réelles, avec un cadre de confidentialité maîtrisé. On garde l'humain dans la boucle pour les cas sensibles.",
    },
  },
  {
    id: "automatisation-ia-workflow-metier",
    fr: {
      question: "Comment automatiser un workflow métier avec l'IA ?",
      answer:
        "On cartographie d'abord votre processus (par exemple : réception d'une demande, qualification, réponse, suivi), puis on identifie les étapes où l'IA fait gagner du temps. On connecte l'IA à vos outils pour automatiser ces étapes, avec des points de contrôle humains aux moments clés. Résultat : un workflow plus rapide et fiable, où vos équipes se concentrent sur la valeur, pas sur la saisie répétitive.",
    },
    en: {
      question: "Comment automatiser un workflow métier avec l'IA ?",
      answer:
        "On cartographie d'abord votre processus (par exemple : réception d'une demande, qualification, réponse, suivi), puis on identifie les étapes où l'IA fait gagner du temps. On connecte l'IA à vos outils pour automatiser ces étapes, avec des points de contrôle humains aux moments clés. Résultat : un workflow plus rapide et fiable, où vos équipes se concentrent sur la valeur, pas sur la saisie répétitive.",
    },
  },
  {
    id: "creation-site-web-augmente-ia",
    fr: {
      question: "Axion-IA crée-t-il des sites web augmentés à l'IA ?",
      answer:
        "Oui. Axion-IA conçoit des sites web et plateformes augmentés à l'intelligence artificielle : assistant de navigation, recherche intelligente, génération et personnalisation de contenu, qualification automatique des visiteurs, chatbot intégré. L'IA n'est pas un gadget posé par-dessus : elle est pensée pour convertir et faire gagner du temps. On part de vos objectifs business et on construit un site rapide, moderne et réellement utile.",
    },
    en: {
      question: "Axion-IA crée-t-il des sites web augmentés à l'IA ?",
      answer:
        "Oui. Axion-IA conçoit des sites web et plateformes augmentés à l'intelligence artificielle : assistant de navigation, recherche intelligente, génération et personnalisation de contenu, qualification automatique des visiteurs, chatbot intégré. L'IA n'est pas un gadget posé par-dessus : elle est pensée pour convertir et faire gagner du temps. On part de vos objectifs business et on construit un site rapide, moderne et réellement utile.",
    },
  },
  {
    id: "saas-application-ia-sur-mesure",
    fr: {
      question: "Développez-vous des applications ou SaaS augmentés à l'IA sur mesure ?",
      answer:
        "Oui. Axion-IA développe des applications et plateformes SaaS sur mesure intégrant l'IA au cœur du produit : automatisations métier, analyse de données, génération de contenu, agents intelligents. On conçoit la solution autour de votre besoin réel et de vos contraintes (sécurité, RGPD, souveraineté des données), avec une attention forte à la performance et à l'expérience utilisateur. De l'idée au produit en ligne, avec un accompagnement continu.",
    },
    en: {
      question: "Développez-vous des applications ou SaaS augmentés à l'IA sur mesure ?",
      answer:
        "Oui. Axion-IA développe des applications et plateformes SaaS sur mesure intégrant l'IA au cœur du produit : automatisations métier, analyse de données, génération de contenu, agents intelligents. On conçoit la solution autour de votre besoin réel et de vos contraintes (sécurité, RGPD, souveraineté des données), avec une attention forte à la performance et à l'expérience utilisateur. De l'idée au produit en ligne, avec un accompagnement continu.",
    },
  },
  {
    id: "site-internet-intelligent-definition",
    fr: {
      question: "Qu'est-ce qu'un site internet augmenté à l'intelligence artificielle ?",
      answer:
        "Un site augmenté à l'IA intègre des fonctions intelligentes qui améliorent l'expérience et les résultats : recherche en langage naturel, recommandations personnalisées, assistant conversationnel, génération de contenu, qualification automatique des leads. Concrètement, il comprend mieux vos visiteurs, répond instantanément et convertit davantage. C'est la différence entre un site vitrine statique et un site qui travaille pour vous, 24/7.",
    },
    en: {
      question: "Qu'est-ce qu'un site internet augmenté à l'intelligence artificielle ?",
      answer:
        "Un site augmenté à l'IA intègre des fonctions intelligentes qui améliorent l'expérience et les résultats : recherche en langage naturel, recommandations personnalisées, assistant conversationnel, génération de contenu, qualification automatique des leads. Concrètement, il comprend mieux vos visiteurs, répond instantanément et convertit davantage. C'est la différence entre un site vitrine statique et un site qui travaille pour vous, 24/7.",
    },
  },
  {
    id: "integration-ia-site-existant",
    fr: {
      question: "Peut-on intégrer l'IA à mon site ou ma plateforme existante ?",
      answer:
        "Oui. Pas besoin de tout refaire : Axion-IA greffe des fonctions IA sur votre site ou plateforme actuelle — chatbot, recherche intelligente, génération de contenu, automatisation des formulaires et des leads. On s'adapte à votre technologie existante via ses API ou des connecteurs. Vous bénéficiez de l'IA rapidement, sans refonte coûteuse, et on peut faire évoluer le périmètre ensuite selon les résultats.",
    },
    en: {
      question: "Peut-on intégrer l'IA à mon site ou ma plateforme existante ?",
      answer:
        "Oui. Pas besoin de tout refaire : Axion-IA greffe des fonctions IA sur votre site ou plateforme actuelle — chatbot, recherche intelligente, génération de contenu, automatisation des formulaires et des leads. On s'adapte à votre technologie existante via ses API ou des connecteurs. Vous bénéficiez de l'IA rapidement, sans refonte coûteuse, et on peut faire évoluer le périmètre ensuite selon les résultats.",
    },
  },
  {
    id: "accompagnement-ia-individuel-dirigeant",
    fr: {
      question: "Proposez-vous un accompagnement IA individuel pour dirigeant ?",
      answer:
        "Oui. Le coaching IA 1-to-1 Axion-IA est un accompagnement individuel et confidentiel pour dirigeants : en quelques séances, vous apprenez à intégrer l'IA dans votre propre pratique (préparation de réunions, analyse, rédaction stratégique, veille sectorielle). Le rythme et les cas travaillés sont les vôtres. L'objectif : gagner plusieurs heures par semaine et prendre de meilleures décisions, plus vite, avec l'IA comme copilote personnel.",
    },
    en: {
      question: "Proposez-vous un accompagnement IA individuel pour dirigeant ?",
      answer:
        "Oui. Le coaching IA 1-to-1 Axion-IA est un accompagnement individuel et confidentiel pour dirigeants : en quelques séances, vous apprenez à intégrer l'IA dans votre propre pratique (préparation de réunions, analyse, rédaction stratégique, veille sectorielle). Le rythme et les cas travaillés sont les vôtres. L'objectif : gagner plusieurs heures par semaine et prendre de meilleures décisions, plus vite, avec l'IA comme copilote personnel.",
    },
  },
  {
    id: "mentorat-ia-dirigeant",
    fr: {
      question: "Qu'est-ce qu'un mentorat IA pour dirigeant ?",
      answer:
        "Le mentorat IA est un accompagnement individuel dans la durée : un expert vous guide pas à pas dans l'adoption de l'IA, répond à vos questions concrètes, et vous aide à prendre les bonnes décisions au bon moment. Contrairement à une formation ponctuelle, il s'inscrit dans le temps et s'adapte à l'évolution de vos besoins. C'est idéal pour un dirigeant qui veut monter en compétence sereinement, à son rythme.",
    },
    en: {
      question: "Qu'est-ce qu'un mentorat IA pour dirigeant ?",
      answer:
        "Le mentorat IA est un accompagnement individuel dans la durée : un expert vous guide pas à pas dans l'adoption de l'IA, répond à vos questions concrètes, et vous aide à prendre les bonnes décisions au bon moment. Contrairement à une formation ponctuelle, il s'inscrit dans le temps et s'adapte à l'évolution de vos besoins. C'est idéal pour un dirigeant qui veut monter en compétence sereinement, à son rythme.",
    },
  },
  {
    id: "coaching-ia-cadres-managers",
    fr: {
      question: "Le coaching IA est-il adapté aux cadres et aux managers ?",
      answer:
        "Tout à fait. Le coaching IA 1-to-1 s'adresse aussi aux cadres, managers et responsables d'équipe : apprendre à automatiser ses tâches, gagner du temps sur le reporting et la rédaction, mais aussi savoir faire monter son équipe en compétence sur l'IA. L'accompagnement est personnalisé selon votre métier et vos outils. Un manager qui maîtrise l'IA devient un multiplicateur de productivité pour toute son équipe.",
    },
    en: {
      question: "Le coaching IA est-il adapté aux cadres et aux managers ?",
      answer:
        "Tout à fait. Le coaching IA 1-to-1 s'adresse aussi aux cadres, managers et responsables d'équipe : apprendre à automatiser ses tâches, gagner du temps sur le reporting et la rédaction, mais aussi savoir faire monter son équipe en compétence sur l'IA. L'accompagnement est personnalisé selon votre métier et vos outils. Un manager qui maîtrise l'IA devient un multiplicateur de productivité pour toute son équipe.",
    },
  },
  {
    id: "coaching-ia-prise-en-main-outils",
    fr: {
      question: "Un coaching IA pour prendre en main les outils, c'est possible ?",
      answer:
        "Oui. Si vous voulez être autonome rapidement sur les outils IA (ChatGPT, Claude, automatisations, assistants), le coaching 1-to-1 est le format le plus efficace : on travaille sur VOS cas concrets, à votre rythme, jusqu'à ce que vous soyez à l'aise. Pas de cours générique : chaque séance produit des résultats utilisables tout de suite dans votre quotidien professionnel.",
    },
    en: {
      question: "Un coaching IA pour prendre en main les outils, c'est possible ?",
      answer:
        "Oui. Si vous voulez être autonome rapidement sur les outils IA (ChatGPT, Claude, automatisations, assistants), le coaching 1-to-1 est le format le plus efficace : on travaille sur VOS cas concrets, à votre rythme, jusqu'à ce que vous soyez à l'aise. Pas de cours générique : chaque séance produit des résultats utilisables tout de suite dans votre quotidien professionnel.",
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
      excerpt:
        "Comment préparer une intervention IA Axion-IA : les 3-5 process à cibler, les participants à mobiliser, les données à réunir et la journée à bloquer.",
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
      excerpt:
        "Le périmètre d'un audit IA Axion-IA : cartographie des process, 8-15 opportunités IA scorées et chiffrées, plan d'implémentation priorisé sur 5 jours.",
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
    slug: "facturation-tva",
    category: "Facturation & TVA",
    fr: {
      title: "Comment fonctionne la facturation et la TVA ?",
      excerpt: "Virement bancaire, TVA française 20 %, devis fixe.",
      body: "Axion-IA est une SAS française et applique la TVA française. Pour les clients professionnels de l'UE disposant d'un n° de TVA intracommunautaire valide : autoliquidation, facture sans TVA (art. 196 directive 2006/112/CE). Pour les clients français et les clients UE sans n° de TVA : TVA française à 20 %. Pour les clients hors UE : facture sans TVA (hors-champ). Paiement par virement, devis fixe, aucune mensualité. La facture est livrée en PDF signé sous 48 h après prestation.",
    },
    en: {
      title: "How does billing and VAT work?",
      excerpt: "Bank transfer, French 20% VAT, fixed quote.",
      body: "Axion-IA is a French company (SAS) and applies French VAT. For EU business clients with a valid intra-community VAT number: reverse charge, invoice without VAT. For French clients and EU clients without a VAT number: French VAT at 20%. For non-EU clients: invoice without VAT (out of scope). Payment by bank transfer, fixed quote, no subscriptions. Signed PDF invoice delivered within 48h of service.",
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

/**
 * Catégorisation des FAQ legacy (FAQ_GLOBAL) par thème — perfection FAQ 2026-05-31
 * (axe C, « allumer les hubs /faq/par-thematique »). Avant, toutes les FAQ legacy
 * tombaient dans "general" → 5 hubs sur 6 noindex (thin). Mapping vers l'enum
 * Prisma `FAQCategory` (general | interventions | implementation | audit |
 * pricing | process). Toute FAQ non mappée → "general" (fallback).
 */
const FAQ_GLOBAL_CATEGORY: Readonly<Record<string, string>> = {
  // interventions
  "geo-distance-international": "interventions",
  "competences-techniques": "interventions",
  "equipes-operationnelles": "interventions",
  "presentiel-distance": "interventions",
  "formation-ia-difference": "interventions",
  "coaching-1-to-1-dirigeant": "un-a-un",
  // implementation
  "no-code-position": "implementation",
  "delai-implementation": "implementation",
  "ia-on-premise": "implementation",
  "tpe-ia": "implementation",
  "accompagnement-post-implementation": "implementation",
  "site-web-augmente-ia": "implementation",
  // audit
  "audit-ia-definition": "audit",
  "roi-mesurer": "audit",
  "choisir-cabinet-ia": "audit",
  // pricing
  facturation: "pricing",
  "cout-projet-ia-pme": "pricing",
  "tarifs-publics-transparents": "pricing",
  "aides-subventions-ia": "pricing",
  "budget-demarrer-ia": "pricing",
  // process
  "securite-donnees-ia": "process",
  "confidentialite-projet-ia": "process",
  "rgpd-ia": "process",
  "risques-ia-entreprise": "process",
  "ia-souveraine-europe": "process",
  "deroule-mission-axion": "process",
  // audit (batch 2026-05-31)
  "duree-audit-ia": "audit",
  "livrables-audit-ia": "audit",
  // implementation (batch 2026-05-31)
  "automatiser-taches-ia": "implementation",
  "ia-integration-outils": "implementation",
  "agent-ia-definition": "implementation",
  "agent-vs-chatbot": "implementation",
  // interventions (batch 2026-05-31)
  "former-equipes-ia": "interventions",
  // implementation (batch #2 2026-05-31 — cas d'usage)
  "automatiser-facturation-ia": "implementation",
  "automatiser-service-client-ia": "implementation",
  "ia-gestion-documents": "implementation",
  "ia-reporting-analyse-donnees": "implementation",
  // process (batch #2 2026-05-31 — gouvernance/juridique)
  "ia-droit-auteur-contenu": "process",
  "ia-donnees-entrainement-confidentialite": "process",
  "erreurs-eviter-projet-ia": "process",
  "qui-pilote-ia-entreprise": "process",
  // general (batch #2) : secteurs (commerce/resto/btp/immo/compta/industrie/ecommerce),
  // comparatifs outils, biais → fallback "general"
  // ── batch #3 par service ──
  // audit
  "audit-ia-tpe-pme": "audit",
  "audit-maturite-ia-entreprise": "audit",
  "cout-audit-ia-entreprise": "audit",
  "premier-diagnostic-ia": "audit",
  // interventions / formation
  "formation-ia-entreprise": "interventions",
  "formation-chatgpt-claude-entreprise": "interventions",
  "atelier-ia-equipe": "interventions",
  "formation-ia-dirigeants": "interventions",
  // implementation
  "implementation-ia-sur-mesure": "implementation",
  "integration-ia-entreprise-concrete": "implementation",
  "chatbot-ia-entreprise": "implementation",
  "automatisation-ia-workflow-metier": "implementation",
  // sites web & SaaS IA (nouveau hub)
  "creation-site-web-augmente-ia": "sites-web",
  "saas-application-ia-sur-mesure": "sites-web",
  "site-internet-intelligent-definition": "sites-web",
  "integration-ia-site-existant": "sites-web",
  // coaching 1-to-1 (nouveau hub)
  "accompagnement-ia-individuel-dirigeant": "un-a-un",
  "mentorat-ia-dirigeant": "un-a-un",
  "coaching-ia-cadres-managers": "un-a-un",
  "coaching-ia-prise-en-main-outils": "un-a-un",
  // (tout le reste → "general")
};

/** Catégorie thématique d'une FAQ legacy (défaut "general"). */
export function getFaqGlobalCategory(id: string): string {
  return FAQ_GLOBAL_CATEGORY[id] ?? "general";
}

// slugify importé depuis @/lib/slug (SSOT V-10 2026-05-22).
// Anciennement défini inline ici — comportement identique préservé (maxLen default 80).

export { slugify };
