// Migré depuis `transversal.ts` en Sprint 14.10 (split content factory).
import type { BlogPost } from "../types";

export const POST: BlogPost = {
  slug: "ia-custom-quand-vraiment",
  publishedAt: "2026-05-01",
  updatedAt: "2026-05-01",
  readingTime: "12 min",
  category: "Stratégie",
  author: "Will",
  tags: ["ia-custom", "fine-tuning", "strategie"],
  companySizes: ["pme", "eti", "grand-compte"],
  serviceTypes: ["implementation"],
  format: "article",
  // V1 stub court — sera enrichi (>600 mots + directAnswer + FAQ) puis re-promu tier-1.
  indexationTier: "tier-2-noindex-follow",
  qualityScore: 62,
  fr: {
    title: "IA Custom : quand est-ce vraiment nécessaire ?",
    excerpt: "À partir de quel moment passer de l'IA générique au fine-tuning sur vos données ?",
    body: "Le fine-tuning IA n'est rarement justifié avant 6-12 mois d'usage de modèles génériques. Les signaux objectifs : volume de données spécifiques métier > 10 k exemples, exigence de latence sous 100 ms, contraintes de souveraineté ou de coût d'inférence. AxionIA déconseille systématiquement le fine-tuning prématuré, qui consomme 8 000 à 50 000 € sans garantie de gain par rapport à du prompt engineering soigné.",
  },
  en: {
    title: "Custom AI: when is it really necessary?",
    excerpt: "When do you move from generic AI to fine-tuning on your data?",
    body: "AI fine-tuning is rarely justified before 6-12 months of using generic models. Objective signals: domain-specific data volume > 10k examples, sub-100ms latency requirement, sovereignty or inference cost constraints. AxionIA systematically discourages premature fine-tuning, which costs €8k-50k with no guaranteed gain over careful prompt engineering.",
  },
};
