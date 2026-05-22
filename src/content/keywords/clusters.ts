/**
 * Keyword Clusters Catalog — V-12 P1 correction (2026-05-22).
 *
 * 5 clusters canoniques par verticale (25) + 1 transversal = 26 clusters.
 * Mapping déterministe via `assignClusterId(seed, vertical)` consommé par
 * `prisma/seeds/content-gen/seed-keywords.ts` pour peupler `Keyword.clusterId`.
 *
 * Source d'autorité : ce fichier (pas de surcouche admin V1).
 *
 * Stratégie d'assignment (ordre d'évaluation) :
 *   1. urlCible patterns ciblés (signal le plus fiable)
 *   2. Mots-clés présents dans `keyword` (fallback sémantique)
 *   3. Défaut par verticale
 */
import type { KeywordModule, KeywordSeed } from "./types";

export type KeywordClusterId =
  // audits
  | "audit-securite-conformite"
  | "audit-performance-couts"
  | "audit-strategie-roadmap"
  | "audit-prompt-engineering"
  | "audit-equipe-vendors"
  // interventions_formations
  | "formation-debutants-decouverte"
  | "formation-dirigeants-strategie"
  | "formation-techniques-developpeurs"
  | "formation-metiers-sectorielle"
  | "formation-certifications-evaluation"
  // un_a_un (coaching-1-to-1)
  | "coaching-dirigeants-comex"
  | "coaching-techniques-cto"
  | "coaching-transformation-personnel"
  | "coaching-strategie-investissement"
  | "coaching-ai-literacy-execbrief"
  // implementations
  | "implementation-conversationnel"
  | "implementation-data-integration"
  | "implementation-automation-rpa"
  | "implementation-vision-nlp-analyse"
  | "implementation-secteurs-specifiques"
  // sites_web_augmentes (codage-developpement)
  | "web-seo-aeo-geo"
  | "web-content-generation"
  | "web-personnalisation-experience"
  | "web-chatbot-search-vocal"
  | "web-vitals-performance"
  // catch-all
  | "transversal";

export interface KeywordCluster {
  readonly id: KeywordClusterId;
  readonly label: string;
  readonly vertical: string;
  /** Patterns urlCible (substring match, lowercase) — signal primaire. */
  readonly urlPatterns: readonly string[];
  /** Termes-clés (substring match dans keyword/note, lowercase) — signal secondaire. */
  readonly keywordHints: readonly string[];
}

export const KEYWORD_CLUSTERS: readonly KeywordCluster[] = [
  // ─── audits ──────────────────────────────────────────────────────────────
  {
    id: "audit-securite-conformite",
    label: "Sécurité / RGPD / AI Act / Biais",
    vertical: "audits",
    urlPatterns: [
      "/fr/audit/securite",
      "/fr/audit/rgpd",
      "/fr/audit/ai-act",
      "/fr/audit/conformite",
      "/fr/audit/bias",
      "/fr/audit/ethique",
      "/fr/audit/fraude",
    ],
    keywordHints: [
      "sécurité",
      "securite",
      "rgpd",
      "ai act",
      "conformité",
      "conformite",
      "biais",
      "bias",
      "éthique",
      "ethique",
      "vulnérabilité",
      "vulnerabilite",
      "pentest",
      "injection prompt",
      "dpia",
      "fraude",
    ],
  },
  {
    id: "audit-performance-couts",
    label: "Performance / Coûts / Infrastructure",
    vertical: "audits",
    urlPatterns: [
      "/fr/audit/performance",
      "/fr/audit/couts",
      "/fr/audit/cout",
      "/fr/audit/roi",
      "/fr/audit/infrastructure",
      "/fr/audit/infra",
      "/fr/audit/mlops",
      "/fr/audit/gpu",
      "/fr/audit/latence",
    ],
    keywordHints: [
      "performance",
      "coût",
      "cout",
      "tokens",
      "facture",
      "latence",
      "benchmark",
      "infrastructure",
      "mlops",
      "gpu",
      "on-premise",
      "cloud",
      "optimisation",
    ],
  },
  {
    id: "audit-strategie-roadmap",
    label: "Stratégie / Roadmap / Exécutif",
    vertical: "audits",
    urlPatterns: [
      "/fr/audit/strategie",
      "/fr/audit/roadmap",
      "/fr/audit/vision",
      "/fr/audit/dirigeant",
      "/fr/audit/executif",
    ],
    keywordHints: [
      "stratégie",
      "strategie",
      "feuille de route",
      "roadmap",
      "vision",
      "dirigeant",
      "exécutif",
      "executif",
      "comex",
      "transformation",
    ],
  },
  {
    id: "audit-prompt-engineering",
    label: "Prompt Engineering / LLM Ops",
    vertical: "audits",
    urlPatterns: [
      "/fr/audit/prompt",
      "/fr/audit/llm",
      "/fr/audit/fine-tuning",
      "/fr/audit/finetuning",
    ],
    keywordHints: [
      "prompt",
      "prompts",
      "fine-tuning",
      "fine tuning",
      "finetuning",
      "llm ops",
      "llmops",
      "qualité prompts",
    ],
  },
  {
    id: "audit-equipe-vendors",
    label: "Équipe / Compétences / Fournisseurs",
    vertical: "audits",
    urlPatterns: [
      "/fr/audit/equipe",
      "/fr/audit/competences",
      "/fr/audit/skill",
      "/fr/audit/literacy",
      "/fr/audit/fournisseur",
      "/fr/audit/vendor",
      "/fr/audit/due-diligence",
    ],
    keywordHints: [
      "compétences",
      "competences",
      "skill",
      "literacy",
      "ai literacy",
      "fournisseur",
      "vendor",
      "due diligence",
      "sous-traitant",
      "prestataire",
      "salariés",
      "salaries",
      "équipe",
      "equipe",
      "formation",
    ],
  },

  // ─── interventions_formations ────────────────────────────────────────────
  {
    id: "formation-debutants-decouverte",
    label: "Découverte / Débutants",
    vertical: "interventions_formations",
    urlPatterns: [
      "/fr/interventions/decouverte",
      "/fr/interventions/debutant",
      "/fr/interventions/initiation",
      "/fr/formation/decouverte",
      "/fr/formation/debutant",
    ],
    keywordHints: [
      "débutant",
      "debutant",
      "initiation",
      "découverte",
      "decouverte",
      "première",
      "premiere",
      "novice",
      "tous niveaux",
      "grand public",
    ],
  },
  {
    id: "formation-dirigeants-strategie",
    label: "Dirigeants / Stratégie",
    vertical: "interventions_formations",
    urlPatterns: [
      "/fr/interventions/dirigeant",
      "/fr/interventions/comex",
      "/fr/interventions/executif",
      "/fr/interventions/ceo",
      "/fr/formation/dirigeant",
      "/fr/formation/comex",
    ],
    keywordHints: [
      "dirigeant",
      "ceo",
      "comex",
      "exécutif",
      "executif",
      "stratégie",
      "strategie",
      "leader",
      "direction",
      "patron",
    ],
  },
  {
    id: "formation-techniques-developpeurs",
    label: "Développeurs / Techniques",
    vertical: "interventions_formations",
    urlPatterns: [
      "/fr/interventions/developpeur",
      "/fr/interventions/technique",
      "/fr/interventions/prompt",
      "/fr/interventions/rag",
      "/fr/interventions/fine-tuning",
      "/fr/formation/developpeur",
      "/fr/formation/prompt",
      "/fr/formation/rag",
    ],
    keywordHints: [
      "développeur",
      "developpeur",
      "tech",
      "prompt engineering",
      "rag",
      "vectoriel",
      "fine-tuning",
      "llm",
      "api claude",
      "embedding",
    ],
  },
  {
    id: "formation-metiers-sectorielle",
    label: "Métiers / Sectorielle",
    vertical: "interventions_formations",
    urlPatterns: [
      "/fr/interventions/marketing",
      "/fr/interventions/rh",
      "/fr/interventions/finance",
      "/fr/interventions/juridique",
      "/fr/interventions/sante",
      "/fr/interventions/industrie",
      "/fr/interventions/secteur",
      "/fr/formation/marketing",
      "/fr/formation/rh",
      "/fr/formation/finance",
      "/fr/formation/juridique",
      "/fr/formation/secteur",
    ],
    keywordHints: [
      "marketing",
      "rh",
      "ressources humaines",
      "finance",
      "juridique",
      "comptable",
      "comptabilité",
      "comptabilite",
      "vente",
      "commercial",
      "santé",
      "sante",
      "industrie",
      "secteur",
      "métier",
      "metier",
      "btp",
      "retail",
      "logistique",
    ],
  },
  {
    id: "formation-certifications-evaluation",
    label: "Certifications / Évaluation",
    vertical: "interventions_formations",
    urlPatterns: [
      "/fr/interventions/certification",
      "/fr/interventions/evaluation",
      "/fr/interventions/diplome",
      "/fr/formation/certification",
      "/fr/formation/evaluation",
    ],
    keywordHints: [
      "certification",
      "certifié",
      "certifie",
      "évaluation",
      "evaluation",
      "diplôme",
      "diplome",
      "validation",
      "examen",
      "attestation",
    ],
  },

  // ─── un_a_un (coaching-1-to-1) ───────────────────────────────────────────
  {
    id: "coaching-dirigeants-comex",
    label: "Dirigeants / COMEX",
    vertical: "un_a_un",
    urlPatterns: [
      "/fr/coaching/dirigeant",
      "/fr/coaching/comex",
      "/fr/coaching/ceo",
      "/fr/coaching/executif",
      "/fr/1-to-1/dirigeant",
      "/fr/un-a-un/dirigeant",
    ],
    keywordHints: [
      "dirigeant",
      "ceo",
      "comex",
      "patron",
      "président",
      "president",
      "direction générale",
      "direction generale",
      "exécutif",
      "executif",
    ],
  },
  {
    id: "coaching-techniques-cto",
    label: "CTO / Techniques",
    vertical: "un_a_un",
    urlPatterns: [
      "/fr/coaching/cto",
      "/fr/coaching/technique",
      "/fr/coaching/tech-lead",
      "/fr/1-to-1/cto",
      "/fr/un-a-un/cto",
    ],
    keywordHints: ["cto", "tech lead", "technique", "architecte", "lead tech", "head of"],
  },
  {
    id: "coaching-transformation-personnel",
    label: "Transformation personnelle",
    vertical: "un_a_un",
    urlPatterns: [
      "/fr/coaching/transformation",
      "/fr/coaching/personnel",
      "/fr/coaching/individuel",
      "/fr/1-to-1/transformation",
      "/fr/un-a-un/transformation",
    ],
    keywordHints: [
      "transformation",
      "personnel",
      "accompagnement",
      "individuel",
      "mentoring",
      "mentorat",
    ],
  },
  {
    id: "coaching-strategie-investissement",
    label: "Stratégie / Investissement",
    vertical: "un_a_un",
    urlPatterns: [
      "/fr/coaching/strategie",
      "/fr/coaching/investissement",
      "/fr/coaching/decision",
      "/fr/1-to-1/strategie",
      "/fr/un-a-un/strategie",
    ],
    keywordHints: [
      "stratégie",
      "strategie",
      "investissement",
      "décision",
      "decision",
      "budget",
      "vision",
      "roadmap",
    ],
  },
  {
    id: "coaching-ai-literacy-execbrief",
    label: "AI Literacy / Exec Brief",
    vertical: "un_a_un",
    urlPatterns: [
      "/fr/coaching/literacy",
      "/fr/coaching/brief",
      "/fr/coaching/sensibilisation",
      "/fr/1-to-1/literacy",
      "/fr/un-a-un/literacy",
    ],
    keywordHints: [
      "literacy",
      "sensibilisation",
      "exec brief",
      "executive brief",
      "briefing",
      "comprendre",
      "découverte",
      "decouverte",
    ],
  },

  // ─── implementations ─────────────────────────────────────────────────────
  {
    id: "implementation-conversationnel",
    label: "Conversationnel (chatbot/voice/agents)",
    vertical: "implementations",
    urlPatterns: [
      "/fr/implementation/chatbot",
      "/fr/implementation/voice",
      "/fr/implementation/voix",
      "/fr/implementation/agent",
      "/fr/implementation/conversationnel",
    ],
    keywordHints: [
      "chatbot",
      "agent",
      "voice",
      "voix",
      "voicebot",
      "conversationnel",
      "assistant",
      "ivr",
    ],
  },
  {
    id: "implementation-data-integration",
    label: "Intégration Data (CRM/ERP/RAG)",
    vertical: "implementations",
    urlPatterns: [
      "/fr/implementation/crm",
      "/fr/implementation/erp",
      "/fr/implementation/rag",
      "/fr/implementation/data",
      "/fr/implementation/integration",
    ],
    keywordHints: [
      "crm",
      "erp",
      "rag",
      "intégration",
      "integration",
      "data",
      "base de données",
      "base de donnees",
      "salesforce",
      "hubspot",
    ],
  },
  {
    id: "implementation-automation-rpa",
    label: "Automation / RPA",
    vertical: "implementations",
    urlPatterns: [
      "/fr/implementation/automation",
      "/fr/implementation/rpa",
      "/fr/implementation/workflow",
      "/fr/implementation/automatisation",
    ],
    keywordHints: [
      "automation",
      "automatisation",
      "rpa",
      "workflow",
      "orchestration",
      "tâches répétitives",
      "taches repetitives",
    ],
  },
  {
    id: "implementation-vision-nlp-analyse",
    label: "Vision / NLP / Analyse prédictive",
    vertical: "implementations",
    urlPatterns: [
      "/fr/implementation/vision",
      "/fr/implementation/nlp",
      "/fr/implementation/analyse",
      "/fr/implementation/predictif",
      "/fr/implementation/recommandation",
    ],
    keywordHints: [
      "vision",
      "ocr",
      "nlp",
      "analyse prédictive",
      "analyse predictive",
      "recommandation",
      "computer vision",
      "image",
    ],
  },
  {
    id: "implementation-secteurs-specifiques",
    label: "Secteurs spécifiques",
    vertical: "implementations",
    urlPatterns: [
      "/fr/implementation/sante",
      "/fr/implementation/finance",
      "/fr/implementation/juridique",
      "/fr/implementation/industrie",
      "/fr/implementation/retail",
      "/fr/implementation/secteur",
      "/fr/implementation/ecommerce",
    ],
    keywordHints: [
      "santé",
      "sante",
      "finance",
      "juridique",
      "industrie",
      "retail",
      "ecommerce",
      "e-commerce",
      "btp",
      "logistique",
      "transport",
    ],
  },

  // ─── sites_web_augmentes (codage-developpement) ──────────────────────────
  {
    id: "web-seo-aeo-geo",
    label: "SEO / AEO / GEO",
    vertical: "sites_web_augmentes",
    urlPatterns: [
      "/fr/codage-developpement/seo",
      "/fr/codage-developpement/aeo",
      "/fr/codage-developpement/geo",
      "/fr/codage-developpement/answer-engine",
      "/fr/codage-developpement/generative-engine",
      "/fr/codage-developpement/schema",
    ],
    keywordHints: [
      "seo",
      "aeo",
      "geo ia",
      "generative engine",
      "answer engine",
      "schema markup",
      "schema.org",
      "json-ld",
      "ranking",
      "moteur",
    ],
  },
  {
    id: "web-content-generation",
    label: "Génération de contenu",
    vertical: "sites_web_augmentes",
    urlPatterns: [
      "/fr/codage-developpement/content",
      "/fr/codage-developpement/contenu",
      "/fr/codage-developpement/pseo",
      "/fr/codage-developpement/programmatique",
      "/fr/codage-developpement/article",
    ],
    keywordHints: [
      "génération de contenu",
      "generation de contenu",
      "pseo",
      "programmatique",
      "article ia",
      "content ia",
      "rédaction",
      "redaction",
    ],
  },
  {
    id: "web-personnalisation-experience",
    label: "Personnalisation / Expérience",
    vertical: "sites_web_augmentes",
    urlPatterns: [
      "/fr/codage-developpement/personnalisation",
      "/fr/codage-developpement/experience",
      "/fr/codage-developpement/recommandation",
      "/fr/codage-developpement/cdp",
    ],
    keywordHints: [
      "personnalisation",
      "expérience utilisateur",
      "experience utilisateur",
      "ux ia",
      "recommandation",
      "cdp",
      "segmentation",
    ],
  },
  {
    id: "web-chatbot-search-vocal",
    label: "Chatbot site / Search vocal",
    vertical: "sites_web_augmentes",
    urlPatterns: [
      "/fr/codage-developpement/chatbot",
      "/fr/codage-developpement/search",
      "/fr/codage-developpement/vocal",
      "/fr/codage-developpement/recherche",
    ],
    keywordHints: [
      "chatbot site",
      "chatbot web",
      "search vocal",
      "recherche vocale",
      "moteur recherche",
      "assistant site",
    ],
  },
  {
    id: "web-vitals-performance",
    label: "Web Vitals / Performance",
    vertical: "sites_web_augmentes",
    urlPatterns: [
      "/fr/codage-developpement/vitals",
      "/fr/codage-developpement/performance",
      "/fr/codage-developpement/lcp",
      "/fr/codage-developpement/core-web-vitals",
    ],
    keywordHints: [
      "core web vitals",
      "web vitals",
      "lcp",
      "inp",
      "cls",
      "lighthouse",
      "performance web",
      "vitesse site",
    ],
  },

  // ─── catch-all ───────────────────────────────────────────────────────────
  {
    id: "transversal",
    label: "Transversal (brand, presse, positionnements, maintenance)",
    vertical: "transversal",
    urlPatterns: [
      "/fr/a-propos",
      "/fr/presse",
      "/fr/ressources",
      "/fr/maintenance",
      "/fr/contact",
    ],
    keywordHints: [
      "axion-ia",
      "axion ia",
      "axionia",
      "presse",
      "manifeste",
      "à propos",
      "a propos",
      "maintenance",
    ],
  },
] as const;

/**
 * Mapping module → verticale (synchrone avec MODULE_TO_VERTICAL du seeder).
 */
const MODULE_TO_VERTICAL: Record<KeywordModule, string> = {
  audit: "audits",
  "interventions-formations": "interventions_formations",
  implementation: "implementations",
  "coaching-1-to-1": "un_a_un",
  "codage-developpement": "sites_web_augmentes",
  "maintenance-ia": "transversal",
  transversal: "transversal",
};

/** Cluster fallback déterministe par verticale. */
const DEFAULT_CLUSTER_BY_VERTICAL: Record<string, KeywordClusterId> = {
  audits: "audit-strategie-roadmap",
  interventions_formations: "formation-debutants-decouverte",
  un_a_un: "coaching-transformation-personnel",
  implementations: "implementation-data-integration",
  sites_web_augmentes: "web-content-generation",
  transversal: "transversal",
};

/**
 * Assigne un clusterId à un seed selon urlCible + keyword + module.
 *
 * Ordre de priorité :
 *   1. Match urlPatterns substring (signal le plus fiable)
 *   2. Match keywordHints dans keyword (fallback sémantique)
 *   3. Default cluster par verticale
 */
export function assignClusterId(seed: KeywordSeed): KeywordClusterId {
  const vertical = MODULE_TO_VERTICAL[seed.module] ?? "transversal";
  const url = seed.urlCible.toLowerCase();
  const text = seed.keyword.toLowerCase();

  // 1. Match urlPatterns (filtré par verticale pour cohérence)
  const verticalClusters = KEYWORD_CLUSTERS.filter((c) => c.vertical === vertical);
  for (const cluster of verticalClusters) {
    if (cluster.urlPatterns.some((p) => url.includes(p))) {
      return cluster.id;
    }
  }

  // 2. Match keywordHints (filtré par verticale)
  for (const cluster of verticalClusters) {
    if (cluster.keywordHints.some((h) => text.includes(h))) {
      return cluster.id;
    }
  }

  // 3. Fallback
  return DEFAULT_CLUSTER_BY_VERTICAL[vertical] ?? "transversal";
}

/** Tous les IDs de clusters pour validation. */
export const ALL_CLUSTER_IDS: readonly KeywordClusterId[] = KEYWORD_CLUSTERS.map((c) => c.id);
