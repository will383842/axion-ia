/**
 * Glossaire IA de référence (décision du 18/11/2026).
 *
 * Objectif : être la page de référence en France sur le vocabulaire de l'IA en entreprise,
 * pour Google et pour les assistants d'IA (ChatGPT, Perplexity, Mistral…).
 *
 * Source de vérité : `src/content/glossaire-reference/` (≈ 100 termes écrits à la main,
 * 120 à 200 mots chacun, structure fixe : définition citable, fonctionnement, exemple en
 * PME française, limite, termes liés, offre). Ce fichier en fait la vue consommée par les pages
 * `/glossaire` et `/glossaire/[slug]`, le sitemap, l'export Markdown et le générateur de contenu.
 *
 * Historique : jusqu'au 17/11/2026, 60 définitions d'une phrase (31 à 53 mots de prose française)
 * étaient `noindex`, faute de substance. Les 60 slugs sont conservés (jamais renommer un slug).
 * Les anciennes définitions en anglais ne sont plus portées : la version EN est désactivée
 * (`EN_LOCALE_ENABLED`), le glossaire est publié en français uniquement.
 */

import {
  TERMES_GLOSSAIRE,
  GLOSSAIRE_DATE_MISE_A_JOUR,
  type CategorieGlossaire,
  type OffreGlossaire,
} from "./glossaire-reference";

export type GlossaryCategory = CategorieGlossaire;
export type GlossaryOffer = OffreGlossaire;

/** Vue d'un terme utilisée par les pages et les consommateurs historiques. */
export interface GlossaryTermExtended {
  readonly slug: string;
  readonly term: string;
  /** Définition citable (première partie de la fiche). */
  readonly fr: string;
  /** Identique à `fr` : l'anglais n'est plus servi (EN désactivé), champ gardé pour compatibilité. */
  readonly en: string;
  readonly category: GlossaryCategory;
  readonly relatedSlugs: readonly string[];
  readonly aliases: readonly string[];
  /** Exemple concret en PME (un seul). */
  readonly examples: readonly string[];
  readonly definition: string;
  readonly fonctionnement: string;
  readonly exemple: string;
  readonly limite: string;
  readonly offre: GlossaryOffer;
}

/** Date de mise à jour visible sur les pages et reprise dans le JSON-LD. */
export const GLOSSARY_UPDATED_ISO = GLOSSAIRE_DATE_MISE_A_JOUR;

/** Liste complète des termes (≈ 100 au 18/11/2026). */
export const ALL_GLOSSARY_TERMS_EXTENDED: readonly GlossaryTermExtended[] = TERMES_GLOSSAIRE.map(
  (t) => ({
    slug: t.slug,
    term: t.term,
    fr: t.definition,
    en: t.definition,
    category: t.category,
    relatedSlugs: t.related,
    aliases: t.aliases,
    examples: [t.exemple],
    definition: t.definition,
    fonctionnement: t.fonctionnement,
    exemple: t.exemple,
    limite: t.limite,
    offre: t.offre,
  }),
);

const SLUG_INDEX = new Map<string, GlossaryTermExtended>(
  ALL_GLOSSARY_TERMS_EXTENDED.map((t) => [t.slug, t]),
);

export function getGlossaryTermBySlug(slug: string): GlossaryTermExtended | null {
  return SLUG_INDEX.get(slug) ?? null;
}

export function listGlossaryTermSlugs(): readonly string[] {
  return ALL_GLOSSARY_TERMS_EXTENDED.map((t) => t.slug);
}

/**
 * Seuil anti-contenu mince (HCU 2024) : une fiche dont la prose française (définition,
 * fonctionnement, exemple, limite) compte moins de 120 mots n'est ni indexée ni sitemappée.
 * SSOT partagé entre `/glossaire/[slug]/page.tsx` (qui émet `noindex`) et le sitemap.
 *
 * Décision du 18/11/2026 : le correctif était d'ÉCRIRE du contenu, pas de baisser la barre.
 * Les 100 fiches font 120 à 200 mots de prose française unique ; le seuil sert désormais de
 * filet pour qu'une fiche ajoutée trop courte ne parte jamais en `index`.
 * La métrique ne compte plus le texte anglais (non servi) : elle compte ce que la page rend.
 */
export const GLOSSARY_MIN_INDEX_WORDS = 120;

/** Plafond de longueur d'une fiche (garde du test). */
export const GLOSSARY_MAX_WORDS = 200;

/** Nombre de mots de la prose française d'une fiche (quatre champs d'écriture). */
export function glossaryTermWordCount(term: GlossaryTermExtended): number {
  const text = [term.definition, term.fonctionnement, term.exemple, term.limite].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** True si la fiche est assez substantielle pour être indexée. */
export function isGlossaryTermIndexable(slug: string): boolean {
  const term = getGlossaryTermBySlug(slug);
  if (!term) return false;
  return glossaryTermWordCount(term) >= GLOSSARY_MIN_INDEX_WORDS;
}

/** Les N termes liés d'un slug (slugs inconnus ignorés ; un test couvre l'intégrité). */
export function getRelatedGlossaryTerms(
  slug: string,
  limit: number = 5,
): readonly GlossaryTermExtended[] {
  const term = getGlossaryTermBySlug(slug);
  if (!term) return [];
  const related: GlossaryTermExtended[] = [];
  for (const relSlug of term.relatedSlugs) {
    const t = SLUG_INDEX.get(relSlug);
    if (t) related.push(t);
    if (related.length >= limit) break;
  }
  return related;
}

/** Libellés français des catégories. */
export const GLOSSARY_CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  foundational: "Fondamentaux",
  agents: "Agents et outils",
  rag: "Connaissance et recherche",
  models: "Modèles",
  infra: "Exploitation",
  security: "Sécurité et réglementation",
  evaluation: "Qualité et évaluation",
  usages: "Usages en entreprise",
  gouvernance: "Gouvernance et pilotage",
  visibilite: "Visibilité dans les moteurs",
};

/**
 * Offres Axion-IA proposées en bas de fiche (lien interne, formulation sobre).
 * Les noms sont ceux des sources uniques : `src/content/offre.ts` (« La Journée IA ») et
 * `src/content/services.ts` (« Formations IA », « Implémentation IA », « Audit IA »).
 */
export const GLOSSARY_OFFERS: Record<
  GlossaryOffer,
  {
    readonly href: "/journee-ia" | "/formations" | "/implementation" | "/audit";
    readonly texte: string;
    readonly lien: string;
  }
> = {
  "journee-ia": {
    href: "/journee-ia",
    texte: "Pour passer de la théorie à la pratique dans votre entreprise,",
    lien: "découvrez La Journée IA : un audit le matin, une formation l’après-midi, dans vos locaux",
  },
  formations: {
    href: "/formations",
    texte: "Pour en parler avec vos équipes et les faire monter en compétence,",
    lien: "découvrez nos Formations IA",
  },
  automatisations: {
    href: "/implementation",
    texte: "Pour mettre cela en œuvre sur une tâche répétitive de votre entreprise,",
    lien: "découvrez notre service Implémentation IA",
  },
  cartographie: {
    href: "/audit",
    texte: "Pour savoir par où commencer selon vos usages réels,",
    lien: "faites le point avec notre Audit IA",
  },
};

/**
 * Pages de la base de connaissances du site qui traitent déjà le terme : fiches `/faq/<id>`
 * (identifiants de `FAQ_GLOBAL`, `src/content/transversal.ts`). Les libellés sont lus dans la
 * FAQ au rendu : un seul texte, jamais recopié ici. Un identifiant inconnu est ignoré et un test
 * le détecte.
 */
export const GLOSSARY_FAQ_LINKS: Readonly<Record<string, readonly string[]>> = {
  agent: ["agent-ia-definition", "agent-vs-chatbot"],
  "ia-agentique": ["agent-ia-definition"],
  chatbot: ["chatbot-ia-entreprise", "agent-vs-chatbot"],
  hallucination: ["ia-hallucinations-fiabilite"],
  "rgpd-gdpr": ["rgpd-ia"],
  "donnee-personnelle": ["rgpd-ia"],
  "ai-act": ["ai-act-2026"],
  "maitrise-ia-article-4": ["ai-act-2026"],
  "systeme-ia-haut-risque": ["ai-act-2026"],
  "ia-souveraine": ["ia-souveraine-europe"],
  "on-premise-ai": ["ia-souveraine-europe"],
  "roi-ia": ["roi-mesurer"],
  automatisation: ["ia-vs-automatisation", "automatiser-taches-ia"],
  rpa: ["ia-vs-automatisation"],
  workflow: ["automatisation-ia-workflow-metier"],
  biais: ["ia-biais-objectivite"],
  "donnees-entrainement": ["ia-donnees-entrainement-confidentialite"],
  "opt-out-training": ["ia-donnees-entrainement-confidentialite"],
  dpa: ["securite-donnees-ia"],
  "pii-detection": ["securite-donnees-ia"],
  "shadow-ai": ["securite-donnees-ia"],
  copilote: ["chatgpt-copilot-gemini-choisir"],
  "gpt-openai": ["chatgpt-copilot-gemini-choisir"],
  "gemini-google": ["chatgpt-copilot-gemini-choisir"],
  "claude-anthropic": ["chatgpt-copilot-gemini-choisir"],
};
