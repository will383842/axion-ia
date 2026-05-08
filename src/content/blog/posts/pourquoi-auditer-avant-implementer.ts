// Migré depuis `transversal.ts` en Sprint 14.10 (split content factory).
// Auto-promu tier-1 (validation Will à l'origine, contenu rédigé manuellement).
import type { BlogPost } from "../types";

export const POST: BlogPost = {
  slug: "pourquoi-auditer-avant-implementer",
  publishedAt: "2026-04-12",
  updatedAt: "2026-04-12",
  readingTime: "6 min",
  category: "Méthodologie",
  author: "Will",
  tags: ["audit", "methodologie", "roi"],
  serviceTypes: ["audit", "implementation"],
  format: "article",
  // V1 stub court — sera enrichi (>600 mots + directAnswer + FAQ) puis re-promu
  // tier-1 par Will. Pour le moment tier-2 (anti-doorway HCU 2024).
  indexationTier: "tier-2-noindex-follow",
  qualityScore: 60,
  fr: {
    title: "Pourquoi auditer avant d'implémenter",
    excerpt: "L'audit identifie où l'IA crée de la valeur sans casser vos workflows existants.",
    body: "Implémenter de l'IA sans audit revient à ouvrir un projet de digitalisation sans backlog priorisé : on consomme du temps et du budget sur des sujets qui n'ont pas de valeur. L'audit IA Axion-IA cartographie en 5 jours toutes les opportunités, scorées par ROI estimé et complexité, livrant un plan d'attaque actionnable.",
  },
  en: {
    title: "Why audit before you implement",
    excerpt: "The audit pinpoints where AI creates value without breaking your existing workflows.",
    body: "Implementing AI without an audit is like running a digitalization project without a prioritized backlog: time and budget go to topics that don't drive value. The Axion-IA AI audit maps every opportunity in 5 days, scored by estimated ROI and complexity, delivering an actionable plan.",
  },
};
