/**
 * Catalogue de mots-clés pré-remplis par verticale Axion-IA.
 * Utilisé par le wizard campagne pour pré-remplir la liste de keywords
 * et éviter que l'utilisateur parte d'une page blanche.
 *
 * Chaque liste = mots-clés validés SEO pour la verticale.
 * Modulable : l'utilisateur peut en ajouter/supprimer dans le wizard.
 */

export type VerticalSlug =
  "audits" | "interventions_formations" | "implementations" | "un_a_un" | "sites_web_augmentes";

export const KEYWORD_CATALOG: Record<VerticalSlug, ReadonlyArray<string>> = {
  audits: [
    "audit IA PME",
    "audit conformité AI Act",
    "diagnostic IA gratuit",
    "audit transformation digitale",
    "évaluation maturité IA entreprise",
    "audit data gouvernance",
    "audit ROI intelligence artificielle",
    "bilan IA entreprise",
    "audit sécurité systèmes IA",
    "audit éthique IA",
    "audit processus automatisables IA",
    "cartographie usages IA entreprise",
  ],

  interventions_formations: [
    "formation IA dirigeants PME",
    "formation intelligence artificielle équipes",
    "atelier IA pratique entreprise",
    "sensibilisation IA collaborateurs",
    "formation prompt engineering professionnel",
    "formation IA sans code",
    "initiation machine learning entreprise",
    "formation ChatGPT entreprise",
    "formation LLM équipes métier",
    "intervention IA sur site entreprise",
    "formation IA secteur industriel",
    "accompagnement montée en compétence IA",
  ],

  implementations: [
    "implémentation IA PME",
    "déploiement chatbot entreprise",
    "automatisation processus métier IA",
    "intégration LLM système information",
    "projet IA clé en main",
    "solution IA sur mesure PME",
    "implémentation RAG entreprise",
    "agent IA entreprise sur mesure",
    "automatisation RH IA",
    "automatisation facturation IA",
    "IA service client automatisé",
    "pipeline IA production industrielle",
  ],

  un_a_un: [
    "coaching IA dirigeant",
    "accompagnement IA personnalisé CEO",
    "mentoring transformation IA",
    "conseil IA stratégique dirigeant",
    "coaching CDO intelligence artificielle",
    "accompagnement stratégie IA PME",
    "mentorat IA startup",
    "conseil IA board of directors",
    "advisory IA ETI",
    "coaching IA DG",
  ],

  sites_web_augmentes: [
    "site web IA intégré",
    "chatbot site web PME",
    "assistant virtuel site e-commerce",
    "recommandation IA site web",
    "personnalisation IA site marchand",
    "développement IA web sur mesure",
    "search sémantique site web IA",
    "agent conversationnel site entreprise",
    "FAQ automatisée IA site web",
    "formulaire intelligent IA",
  ],
};

/** Retourne les keywords pré-remplis pour une verticale, triés alphabétiquement. */
export function getKeywordsForVertical(vertical: VerticalSlug): ReadonlyArray<string> {
  return [...(KEYWORD_CATALOG[vertical] ?? [])].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Map ServiceSector DB → VerticalSlug du catalog. */
export const SERVICE_SECTOR_TO_VERTICAL: Record<string, VerticalSlug> = {
  audits: "audits",
  interventions_formations: "interventions_formations",
  implementations: "implementations",
  un_a_un: "un_a_un",
  sites_web_augmentes: "sites_web_augmentes",
};
