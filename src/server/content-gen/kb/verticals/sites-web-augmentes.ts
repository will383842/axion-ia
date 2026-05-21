/**
 * KB metadata stub — verticale sites_web_augmentes (B.3 P1.5 2026-05-21).
 *
 * Utilise par le pipeline content-gen pour cibler les keywords et le contexte
 * KB de la verticale "Sites web augmentes par l'IA".
 *
 * Phase P4 : enrichir `kbSectorTags` avec les termes specifiques au secteur
 * et ajouter les use cases dans la KB (knowledge base).
 */

import type { ServiceSector } from "../../../../../prisma/generated/client";

export interface VerticalKbMetadata {
  readonly sector: ServiceSector;
  readonly slug: string;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly hubPath: string;
  readonly kbSectorTags: ReadonlyArray<string>;
  readonly primaryKeywords: ReadonlyArray<string>;
  readonly contentTypeWeights: Partial<
    Record<
      | "blog_article"
      | "blog_from_keywords"
      | "guide_pilier"
      | "landing_ville"
      | "faq_standalone"
      | "comparison"
      | "qa_derived",
      number
    >
  >;
}

export const sitesWebAugmentesVertical: VerticalKbMetadata = {
  sector: "sites_web_augmentes",
  slug: "sites-web-augmentes",
  labelFr: "Sites web augmentes par l'IA",
  labelEn: "AI-augmented websites",
  hubPath: "/sites-web-augmentes",
  kbSectorTags: [
    "chatbot-rag",
    "search-semantique",
    "generation-contenu",
    "personnalisation-ia",
    "site-web-ia",
    "agence-web-ia",
    "web-digital-ia",
  ],
  primaryKeywords: [
    "sites web augmentes intelligence artificielle",
    "agence site web IA France",
    "chatbot RAG site web PME",
    "search semantique site web",
    "generation contenu automatique site web",
    "personnalisation dynamique site web IA",
    "integration IA site web entreprise",
    "refonte site web intelligence artificielle",
  ],
  // Poids content types : guide + blog privilegies pour cette verticale
  // (forte demande informationnelle "comment augmenter mon site avec l'IA").
  contentTypeWeights: {
    guide_pilier: 35,
    blog_from_keywords: 30,
    blog_article: 20,
    faq_standalone: 10,
    landing_ville: 5,
  },
};
