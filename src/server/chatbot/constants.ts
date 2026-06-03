// Constantes & réglages par défaut du chatbot (doc 05 §1.1, ADR-CB-02/05).
//
// Réglages stockés dans `ChatTenant.reglages` (Json) → modifiables par tenant via
// la console admin (T-21) sans redeploy. Les défauts ci-dessous encodent les
// décisions verrouillées (D-LLM-TIER, D-CONFIRM…).

/** Clé du tenant unique au MVP (transmise par le widget). */
export const CHATBOT_TENANT_KEY = "axion-ia";

/** Palier LLM par intention (D-LLM-TIER 🔒). « sonnet » = qualité, « haiku » = éco. */
export type LlmTier = "sonnet" | "haiku";

export interface LlmTierByIntent {
  /** Classification d'intention. */
  readonly classification: LlmTier;
  /** Recherche catalogue / raisonnement sur offres. */
  readonly recherche: LlmTier;
  /** Repli / cross-sell. */
  readonly repli: LlmTier;
  /** Comparaison d'offres. */
  readonly comparaison: LlmTier;
  /** FAQ simple (réponse depuis 1 chunk). */
  readonly faqSimple: LlmTier;
  /** Reformulation / réponse cache. */
  readonly reformulation: LlmTier;
}

export interface TenantSettings {
  /** Palier LLM par intention (D-LLM-TIER). */
  readonly llmTier: LlmTierByIntent;
  /** Seuil de confiance retrieval [0..1] sous lequel on escalade (T-11). */
  readonly confidenceThreshold: number;
  /** Cache sémantique (T-26). */
  readonly cache: {
    readonly enabled: boolean;
    /** Similarité cosine min pour un hit. */
    readonly similarityThreshold: number;
    readonly ttlHours: number;
  };
  /** Confirmation avant envoi des liens (D-CONFIRM 🔒) + raccourci « envoie direct ». */
  readonly confirmBeforeLinks: boolean;
  /** Nombre max de cartes d'offre par réponse (D-LIENS-FORMAT 🔒 : 3-4). */
  readonly maxOfferCards: number;
  /** Cap coût mensuel USD (D-LLM / cost-cap). */
  readonly costCapUsdPerMonth: number;
  /** Curseur de conversion (0 = informatif, 1 = très orienté lead/RDV). */
  readonly conversionCursor: number;
  /** RGPD : rétention conversations (mois). */
  readonly retentionMonths: number;
  /** Pages où le widget est actif (rollout canary). `["*"]` = partout. */
  readonly pages: ReadonlyArray<string>;
}

/** Réglages par défaut (décisions verrouillées). */
export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  llmTier: {
    classification: "sonnet",
    recherche: "sonnet",
    repli: "sonnet",
    comparaison: "sonnet",
    faqSimple: "haiku",
    reformulation: "haiku",
  },
  confidenceThreshold: 0.35,
  cache: { enabled: true, similarityThreshold: 0.92, ttlHours: 24 },
  confirmBeforeLinks: true,
  maxOfferCards: 4,
  costCapUsdPerMonth: 50,
  conversionCursor: 0.5,
  retentionMonths: 24,
  pages: ["*"],
};

/** Métadonnées du tenant par défaut (seed T-03). */
export const DEFAULT_TENANT = {
  cle: CHATBOT_TENANT_KEY,
  nom: "Axion-IA",
  domaine: "axion-ia.com",
} as const;

/** Top-k retrieval (T-06) avant rerank (T-10/T-41). */
export const RETRIEVAL_TOP_K = 20;
/** Nombre de chunks injectés au prompt après rerank (T-07/T-41). */
export const RERANK_TOP_N = 5;
