/**
 * KB-5 — Mapping pur Glossaire hardcode → `KnowledgeEntry` `type='glossary_term'`.
 *
 * Source : `src/app/[locale]/glossaire/page.tsx` const `TERMS` (12 entrées).
 * V1 : on duplique les 12 entrées ici en SSOT pour éviter coupling fort avec
 * le composant page.tsx. Le composant `glossaire/page.tsx` sera refactor en
 * Sprint KB-6 pour lire depuis DB.
 *
 * Décision Will 2026-05-13 : migrer en DB dès KB-5 (Q3 SYNTHESIS).
 */

import type { Locale } from "../../../prisma/generated/client";

export interface GlossaryTermHardcode {
  readonly slug: string;
  readonly term: string;
  readonly fr: string;
  readonly en: string;
}

/**
 * 12 termes IA essentiels (snapshot 2026-05-13 depuis `glossaire/page.tsx`).
 * Aligné avec `DefinedTermSet` JSON-LD existant.
 */
export const GLOSSARY_TERMS_HARDCODE: readonly GlossaryTermHardcode[] = [
  {
    slug: "llm",
    term: "LLM",
    fr: "Large Language Model — modèle de langage entraîné sur des milliards de paramètres pour générer du texte cohérent (GPT-4, Claude, Llama).",
    en: "Large Language Model — language model trained on billions of parameters to generate coherent text (GPT-4, Claude, Llama).",
  },
  {
    slug: "rag",
    term: "RAG",
    fr: "Retrieval-Augmented Generation — pattern qui ancre la génération IA sur des documents propriétaires via recherche vectorielle pour éviter les hallucinations.",
    en: "Retrieval-Augmented Generation — pattern grounding AI generation on proprietary documents via vector search to avoid hallucinations.",
  },
  {
    slug: "fine-tuning",
    term: "Fine-tuning",
    fr: "Spécialisation d'un modèle de base sur vos données. Coûte 8-50 k€, justifié seulement après 6-12 mois d'usage en RAG.",
    en: "Specialising a base model on your data. Costs €8-50k, justified only after 6-12 months of RAG usage.",
  },
  {
    slug: "agent",
    term: "Agent",
    fr: "IA capable de planifier, utiliser des outils (web, API, code) et boucler jusqu'à atteindre un objectif. Coût d'inférence 5-10× supérieur à un LLM.",
    en: "AI capable of planning, using tools (web, API, code) and looping until reaching a goal. Inference cost 5-10× higher than an LLM.",
  },
  {
    slug: "mcp",
    term: "MCP",
    fr: "Model Context Protocol — protocole open standard pour connecter des LLMs à des outils externes (databases, APIs, file systems) de façon réutilisable.",
    en: "Model Context Protocol — open standard protocol to connect LLMs to external tools (databases, APIs, file systems) in a reusable way.",
  },
  {
    slug: "vectorisation",
    term: "Vectorisation",
    fr: "Transformation d'un texte en vecteur numérique haute-dimension (typiquement 768-3072 dim) pour permettre la recherche sémantique.",
    en: "Transforming text into a high-dimensional numeric vector (typically 768-3072 dim) to enable semantic search.",
  },
  {
    slug: "hallucination",
    term: "Hallucination",
    fr: "Génération d'information factuellement fausse mais formulée avec assurance. Mitigée par RAG + citations sources + validation humaine.",
    en: "Generating factually false information stated with confidence. Mitigated by RAG + source citations + human validation.",
  },
  {
    slug: "prompt-engineering",
    term: "Prompt engineering",
    fr: "Discipline d'écriture des instructions LLM. Couvre 80 % des cas avant de justifier un fine-tuning. ROI très élevé.",
    en: "Discipline of writing LLM instructions. Covers 80% of cases before justifying fine-tuning. Very high ROI.",
  },
  {
    slug: "tokens",
    term: "Tokens",
    fr: "Unités fondamentales facturées par les API LLM. ~4 caractères/token en français. 1 page A4 ≈ 500 tokens.",
    en: "Fundamental units billed by LLM APIs. ~4 chars/token in English. 1 A4 page ≈ 500 tokens.",
  },
  {
    slug: "embedding",
    term: "Embedding",
    fr: "Représentation vectorielle d'un texte produite par un modèle dédié (text-embedding-3, BGE-M3). Briques de base de la recherche RAG.",
    en: "Vector representation of text produced by a dedicated model (text-embedding-3, BGE-M3). Building blocks of RAG search.",
  },
  {
    slug: "context-window",
    term: "Context window",
    fr: "Volume de texte qu'un LLM peut considérer simultanément. GPT-4o : 128k tokens, Claude Opus 4 : 1M tokens, Gemini 1.5 Pro : 2M tokens.",
    en: "Volume of text an LLM can consider at once. GPT-4o: 128k tokens, Claude Opus 4: 1M tokens, Gemini 1.5 Pro: 2M tokens.",
  },
  {
    slug: "inference",
    term: "Inference",
    fr: "Exécution d'un modèle entraîné sur de nouvelles entrées. Facturé à l'usage (tokens). 60-80 % du coût total IA en production.",
    en: "Running a trained model on new inputs. Usage-billed (tokens). 60-80% of total AI production cost.",
  },
] as const;

export interface GlossaryEntryInput {
  readonly slug: string;
  readonly term: string;
  readonly translations: Array<{
    readonly locale: Locale;
    readonly title: string;
    readonly slug: string;
    readonly body: string;
    readonly bodyText: string;
    readonly excerpt: string;
  }>;
}

/**
 * Map un terme hardcode → format d'input prêt pour insert KnowledgeEntry + translations.
 * Body : `<p>{description}</p>` HTML simple ; bodyText = description plain.
 */
export function mapGlossaryTermInput(t: GlossaryTermHardcode): GlossaryEntryInput {
  return {
    slug: t.slug,
    term: t.term,
    translations: [
      {
        locale: "fr",
        title: t.term,
        slug: t.slug,
        body: `<p>${escapeHtml(t.fr)}</p>`,
        bodyText: t.fr,
        excerpt: t.fr.slice(0, 200),
      },
      {
        locale: "en",
        title: t.term,
        slug: t.slug,
        body: `<p>${escapeHtml(t.en)}</p>`,
        bodyText: t.en,
        excerpt: t.en.slice(0, 200),
      },
    ],
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
