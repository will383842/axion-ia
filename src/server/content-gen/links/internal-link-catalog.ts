/**
 * Catalogue de liens internes pour injection post-LLM (P4 Sprint P1-12).
 *
 * Construit une Map<topic, URL[]> des pages du site Axion-IA à partir
 * de patterns statiques connus (services, verticales, villes, guides).
 * Utilisée lors de la génération pour injecter 3-5 liens internes contextuels
 * dans le bodyHtml post-génération.
 *
 * V1 : catalogue statique (topics hardcodés via routing connu).
 * V2 (Sprint S+7) : scan dynamique filesystem + DB Article.publishStatus=published.
 */

import { linkPhraseOutsideAnchors } from "./anchor-safe-link";

/** Entrée du catalogue : topic → URL canonique FR. */
export interface InternalLinkEntry {
  readonly topic: string;
  readonly url: string;
  readonly keywords: readonly string[];
}

const STATIC_CATALOG: readonly InternalLinkEntry[] = [
  {
    topic: "audit IA",
    url: "/audit",
    keywords: [
      "audit",
      "audits",
      "diagnostic IA",
      "évaluation IA",
      "audit intelligence artificielle",
    ],
  },
  {
    topic: "formations IA",
    url: "/formations",
    keywords: ["intervention", "formation", "atelier", "sensibilisation IA", "accompagnement"],
  },
  {
    topic: "implémentation IA",
    url: "/implementation",
    keywords: ["implémentation", "déploiement", "intégration IA", "mise en place", "projet IA"],
  },
  {
    topic: "coaching IA un-à-un",
    url: "/un-a-un",
    keywords: [
      "coaching",
      "accompagnement personnalisé",
      "1-to-1",
      "coaching dirigeant",
      "mentorat IA",
    ],
  },
  {
    topic: "site web IA",
    url: "/sites-web-augmentes",
    keywords: ["site web", "développement web", "site augmenté", "web IA", "digital IA"],
  },
  {
    topic: "cabinet conseil IA",
    url: "/",
    keywords: ["Axion-IA", "cabinet IA", "conseil IA", "consultant IA France"],
  },
  {
    topic: "contact Axion-IA",
    url: "/contact",
    keywords: ["contact", "devis", "rendez-vous", "prise de contact"],
  },
  {
    topic: "demande de devis IA",
    url: "/demande-devis",
    keywords: ["tarif", "prix", "coût", "budget IA", "tarification", "devis"],
  },
  {
    topic: "glossaire IA",
    url: "/glossaire",
    keywords: ["glossaire", "définition IA", "vocabulaire IA", "lexique"],
  },
  {
    topic: "blog IA",
    url: "/blog",
    keywords: ["blog", "articles IA", "actualités IA", "ressources"],
  },
];

/**
 * Retourne les entrées de catalogue les plus pertinentes pour les topics donnés.
 * Limite à 5 entrées pour ne pas surcharger l'article.
 */
export function getRelevantInternalLinks(
  topics: string[],
  excludeUrls: string[] = [],
  maxLinks = 5,
): InternalLinkEntry[] {
  if (!topics || topics.length === 0) return [];

  const normalizedTopics = topics.map((t) => t.toLowerCase());
  const seen = new Set<string>(excludeUrls);
  const results: InternalLinkEntry[] = [];

  for (const entry of STATIC_CATALOG) {
    if (seen.has(entry.url)) continue;
    const entryKeywordsNorm = entry.keywords.map((k) => k.toLowerCase());
    const matches = normalizedTopics.some((t) =>
      entryKeywordsNorm.some((k) => k.includes(t) || t.includes(k)),
    );
    if (matches) {
      results.push(entry);
      seen.add(entry.url);
      if (results.length >= maxLinks) break;
    }
  }

  return results;
}

/**
 * Injecte des liens internes contextuels dans le bodyHtml post-génération.
 * Remplace la première occurrence du keyword dans une phrase sans lien.
 * Limite 1 lien par phrase, 5 max par article.
 */
export function injectInternalLinks(bodyHtml: string, primaryKeyword: string): string {
  const topics = primaryKeyword
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter((t) => t.length > 3);
  const links = getRelevantInternalLinks(topics);

  if (links.length === 0) return bodyHtml;

  let result = bodyHtml;
  let injected = 0;
  for (const link of links) {
    if (injected >= 5) break;
    for (const kw of link.keywords) {
      // Ne pas injecter si le lien existe déjà dans le texte
      if (result.includes(`href="${link.url}"`)) break;
      // Lie kw uniquement dans le texte libre — jamais dans une balise ni dans
      // le texte d'un <a>…</a> existant (anti ancres imbriquées, audit 2026-07-03).
      const next = linkPhraseOutsideAnchors(result, kw, link.url);
      if (next) {
        result = next;
        injected++;
        break;
      }
    }
  }
  return result;
}
