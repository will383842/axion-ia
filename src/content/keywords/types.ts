/**
 * Keyword Strategy Engine — Types canoniques
 *
 * Source de vérité : `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` v1.2 (2026-05-19).
 *
 * Ces types structurent les seeds consommés par :
 *   - `src/server/content-gen/generators/blog-from-keywords.ts` (génération article)
 *   - `src/server/queue/workers/content-keyword-sync-worker.ts` (monitoring GSC)
 *   - Console admin `/admin/content-gen/keyword-engine` (override manuel)
 *
 * Conventions :
 *   - `intent` reflète la dimension sémantique primaire (D1-D8 du prompt master).
 *   - `module` doit correspondre à un service Axion-IA réel (Section 1.1 du prompt).
 *   - `cible` couvre clients (12 segments) + partenaires (3 segments) + "toutes-cibles".
 *   - `urlCible` doit suivre les patterns Section 7 (`/fr/...`).
 *   - `niveau 1 + priorite 1` est invalide (HEAD ne peut pas être attaqué maintenant).
 */

export type KeywordIntent =
  | "transactionnel"
  | "benefice"
  | "informationnel"
  | "aeo"
  | "comparatif"
  | "local"
  | "partenaire"
  | "sectoriel";

export type KeywordModule =
  | "interventions-formations"
  | "coaching-1-to-1"
  | "audit"
  | "implementation"
  | "codage-developpement"
  | "maintenance-ia"
  | "transversal";

export type KeywordCible =
  | "tpe"
  | "pme"
  | "eti"
  | "grand-compte"
  | "ecole-privee"
  | "organisme-formation"
  | "universite-grande-ecole"
  | "association-professionnelle"
  | "collectivite-mairie"
  | "cci-chambre-metiers"
  | "syndicat-patronal"
  | "startup-scaleup"
  | "sous-traitant-dev"
  | "partenaire-commercial"
  | "prescripteur"
  | "toutes-cibles";

/**
 * Type KB cible (template de contenu) — mapping prompt Section 1.6.
 * Slug snake_case conservé pour cohérence avec `src/content/knowledge/types.ts`.
 */
export type KeywordKbType =
  | "automation_recipe"
  | "roi_calculator_template"
  | "industry_use_case"
  | "comparison"
  | "implementation_playbook"
  | "secteur_brief"
  | "dept_brief"
  | "metier_brief"
  | "competence_boost"
  | "intervention_module"
  | "guide"
  | "case_study"
  | "faq"
  | "glossary_term"
  | "tool_review";

export type KeywordPriorite = 1 | 2 | 3;
export type KeywordNiveau = 1 | 2 | 3;

export type KeywordSource = "gsc" | "autocomplete" | "concurrent" | "manuel";

export interface KeywordInjection {
  /** H1 optimisé bénéfice — JAMAIS le keyword brut (règle anti-cannibalisation R5). */
  readonly h1?: string;
  /** <title> ≤ 60 caractères, keyword principal + différenciateur court. */
  readonly metaTitle?: string;
  /** Meta description ≤ 155 caractères : bénéfice + preuve + CTA. */
  readonly metaDescription?: string;
  /** 2-3 H2 décomposant les sous-intentions du keyword. */
  readonly h2Variants?: readonly string[];
}

export interface KeywordVariables {
  /** Processus métier ciblé (ex: "facturation", "tri CV", "relance clients"). */
  readonly process?: string;
  /** Résultat condensé (ex: "+20% encaissements, 0 oubli"). */
  readonly resultat?: string;
  /** Nombre seul pour injection template (string pour préserver formats "3-8"). */
  readonly chiffre?: string;
  /** Unité associée (ex: "heures/semaine", "%", "€/mois"). */
  readonly unite?: string;
  /** Délai de matérialisation (ex: "dès le 1er mois", "en 4 semaines"). */
  readonly delai?: string;
}

export interface KeywordSeed {
  /** Mot-clé exact, naturel, en français (≥ 10 caractères). */
  readonly keyword: string;
  /** Dimension primaire D1-D8. */
  readonly intent: KeywordIntent;
  /** Type KB cible pour la génération de contenu. */
  readonly kbType?: KeywordKbType;
  /** Service Axion-IA associé. */
  readonly module: KeywordModule;
  /** Segment cible. */
  readonly cible: KeywordCible;
  /** Slug secteur si applicable (cf. `src/content/knowledge/sector-tags.ts`). */
  readonly secteur?: string;
  /** 1 = maintenant, 2 = mois 3-6, 3 = mois 6+ (interdit : niveau 1 + priorite 1). */
  readonly priorite: KeywordPriorite;
  /** 1 = HEAD (fort volume), 2 = BODY, 3 = LONGUE TRAÎNE. */
  readonly niveau: KeywordNiveau;
  /** Volume de recherche mensuel estimé (optionnel, pour priorisation). */
  readonly volume?: number;
  /** Injection dans le contenu (H1, meta, H2). */
  readonly injection?: KeywordInjection;
  /** Variables d'injection bénéfice (chiffres défendables). */
  readonly variables?: KeywordVariables;
  /** URL page destination, doit commencer par `/fr/`. */
  readonly urlCible: string;
  /** URL parent pour hiérarchie sémantique (canonical group). */
  readonly canonicalParent?: string;
  /** Origine du seed (manuel par défaut pour seeds générés par prompt master). */
  readonly source?: KeywordSource;
  /** Contexte, contrainte, schema.org à appliquer, keywords secondaires. */
  readonly note?: string;
}

/**
 * Résultat de validation d'un seed (cf. `src/content/keywords/validate.ts`).
 */
export interface KeywordValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}
