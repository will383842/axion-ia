/**
 * sites-web-capabilities — données partagées du « champ des possibles » de la
 * vertical Sites web & SaaS augmentés. Consommé à la fois par la grille serveur
 * `SitesWebCapabilitiesGrid` (rendu on-page, indexable/citable LLM) et — si besoin —
 * par d'éventuelles vues client.
 *
 * 2026-06-04 (Will) — sortie du popup `SitesWebCapabilitiesDialog` vers une grille
 * affichée sur la page (densité + visibilité SEO/AEO, alignée sur les grilles
 * d'expertises des agences concurrentes). Élargi au périmètre complet revendiqué
 * « on fait tout » : UX/UI & product design + apps mobiles + e-commerce multi-CMS,
 * en plus des 12 domaines IA d'origine. Cf. mémoire [[positionnement-on-fait-tout]].
 *
 * Données pures (zéro JSX) → importable serveur comme client.
 */

import {
  Bot,
  SearchCheck,
  Sparkles,
  PencilLine,
  Workflow,
  ShoppingCart,
  ScanText,
  Languages,
  Gauge,
  ShieldCheck,
  Plug,
  BarChart3,
  PenTool,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

export interface Capability {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly introFr: string;
  readonly introEn: string;
  readonly itemsFr: ReadonlyArray<string>;
  readonly itemsEn: ReadonlyArray<string>;
}

export const SITES_WEB_CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: PenTool,
    titleFr: "UX/UI & product design",
    titleEn: "UX/UI & product design",
    introFr: "De la recherche utilisateur à l'interface.",
    introEn: "From user research to the interface.",
    itemsFr: [
      "UX research & personas",
      "Wireframes & user flows",
      "Design system & maquettes Figma",
      "Prototype testable & A/B testing",
    ],
    itemsEn: [
      "UX research & personas",
      "Wireframes & user flows",
      "Design system & Figma mockups",
      "Testable prototype & A/B testing",
    ],
  },
  {
    icon: Smartphone,
    titleFr: "Apps web & mobiles",
    titleEn: "Web & mobile apps",
    introFr: "Sur tous les supports, une base de code maîtrisée.",
    introEn: "Across every device, a codebase we own.",
    itemsFr: [
      "Natif iOS / Android (Swift, Kotlin)",
      "Multiplateforme (Flutter, React Native)",
      "PWA & web app",
      "Store deployment & suivi",
    ],
    itemsEn: [
      "Native iOS / Android (Swift, Kotlin)",
      "Cross-platform (Flutter, React Native)",
      "PWA & web app",
      "Store deployment & monitoring",
    ],
  },
  {
    icon: ShoppingCart,
    titleFr: "E-commerce",
    titleEn: "E-commerce",
    introFr: "Plus de conversion, sur tous les CMS.",
    introEn: "More conversion, on every CMS.",
    itemsFr: [
      "Shopify, WooCommerce, PrestaShop, Magento",
      "Recommandations, cross-sell & up-sell",
      "Descriptions produit auto",
      "Assistant d'achat & search produit",
    ],
    itemsEn: [
      "Shopify, WooCommerce, PrestaShop, Magento",
      "Recommendations, cross-sell & up-sell",
      "Auto product descriptions",
      "Shopping assistant & product search",
    ],
  },
  {
    icon: Bot,
    titleFr: "Chatbots & assistants",
    titleEn: "Chatbots & assistants",
    introFr: "Conversationnel ancré sur vos données.",
    introEn: "Conversational, grounded in your data.",
    itemsFr: [
      "Chatbot RAG zéro hallucination",
      "Assistant contextuel in-app",
      "Escalade humaine",
      "Voix & multilingue",
    ],
    itemsEn: [
      "Zero-hallucination RAG chatbot",
      "Contextual in-app assistant",
      "Human escalation",
      "Voice & multilingual",
    ],
  },
  {
    icon: SearchCheck,
    titleFr: "Recherche & découvrabilité",
    titleEn: "Search & discoverability",
    introFr: "Trouver par le sens, pas par mot-clé.",
    introEn: "Find by meaning, not by keyword.",
    itemsFr: [
      "Search sémantique vectorielle",
      "Autocomplétion intelligente",
      "Filtres & facettes IA",
      "Recherche fédérée",
    ],
    itemsEn: [
      "Vector semantic search",
      "Smart autocomplete",
      "AI filters & facets",
      "Federated search",
    ],
  },
  {
    icon: Sparkles,
    titleFr: "Personnalisation",
    titleEn: "Personalisation",
    introFr: "Une expérience unique par visiteur.",
    introEn: "A unique experience per visitor.",
    itemsFr: [
      "Contenu & CTA dynamiques",
      "Recommandations",
      "Segments temps réel",
      "Sans cookie tiers",
    ],
    itemsEn: [
      "Dynamic content & CTA",
      "Recommendations",
      "Real-time segments",
      "No third-party cookie",
    ],
  },
  {
    icon: PencilLine,
    titleFr: "Génération éditoriale",
    titleEn: "Editorial generation",
    introFr: "Du contenu conforme HCU + AI Act.",
    introEn: "HCU + AI Act compliant content.",
    itemsFr: ["Blog & guides piliers", "Fiches produit", "FAQ & méta SEO", "Traductions"],
    itemsEn: ["Blog & pillar guides", "Product pages", "FAQ & SEO meta", "Translations"],
  },
  {
    icon: Workflow,
    titleFr: "Automatisations & agents",
    titleEn: "Automations & agents",
    introFr: "Des workflows qui agissent seuls.",
    introEn: "Workflows that act on their own.",
    itemsFr: [
      "Agents autonomes",
      "Automatisations métier",
      "Make, n8n, Zapier",
      "Intégrations CRM/ERP",
    ],
    itemsEn: [
      "Autonomous agents",
      "Business automations",
      "Make, n8n, Zapier",
      "CRM/ERP integrations",
    ],
  },
  {
    icon: ScanText,
    titleFr: "Vision & documents",
    titleEn: "Vision & documents",
    introFr: "Lire et structurer l'image et le PDF.",
    introEn: "Read and structure image and PDF.",
    itemsFr: [
      "OCR & extraction",
      "Classification",
      "Modération d'images",
      "Indexation documentaire",
    ],
    itemsEn: ["OCR & extraction", "Classification", "Image moderation", "Document indexing"],
  },
  {
    icon: Languages,
    titleFr: "Multilingue & international",
    titleEn: "Multilingual & international",
    introFr: "Un site qui parle à chaque marché.",
    introEn: "A site that speaks to each market.",
    itemsFr: ["Traduction IA", "Contenu localisé", "hreflang propre", "Détection de langue"],
    itemsEn: ["AI translation", "Localised content", "Clean hreflang", "Language detection"],
  },
  {
    icon: Gauge,
    titleFr: "Performance & SEO/AEO",
    titleEn: "Performance & SEO/AEO",
    introFr: "Visible des moteurs et des LLM.",
    introEn: "Visible to engines and LLMs.",
    itemsFr: [
      "Web Vitals au cordeau",
      "JSON-LD & schema",
      "AI Overviews & GEO",
      "Citabilité Perplexity/Claude",
    ],
    itemsEn: [
      "Tight Web Vitals",
      "JSON-LD & schema",
      "AI Overviews & GEO",
      "Perplexity/Claude citability",
    ],
  },
  {
    icon: Plug,
    titleFr: "Intégrations & API",
    titleEn: "Integrations & API",
    introFr: "On se branche sur votre existant.",
    introEn: "We plug into what you have.",
    itemsFr: [
      "Claude, OpenAI, Mistral",
      "Webhooks & API REST/GraphQL",
      "Widget JS ou plugin",
      "Toute stack",
    ],
    itemsEn: [
      "Claude, OpenAI, Mistral",
      "Webhooks & REST/GraphQL API",
      "JS widget or plugin",
      "Any stack",
    ],
  },
  {
    icon: BarChart3,
    titleFr: "Analytics & pilotage",
    titleEn: "Analytics & steering",
    introFr: "Comprendre pour décider.",
    introEn: "Understand to decide.",
    itemsFr: [
      "Insights conversationnels",
      "Scoring & intentions",
      "Tableaux de bord",
      "A/B testing IA",
    ],
    itemsEn: ["Conversational insights", "Scoring & intent", "Dashboards", "AI A/B testing"],
  },
  {
    icon: ShieldCheck,
    titleFr: "Conformité & confiance",
    titleEn: "Compliance & trust",
    introFr: "Vos données, vos règles.",
    introEn: "Your data, your rules.",
    itemsFr: [
      "RGPD natif · hébergement UE",
      "Garde-fous & filtrage",
      "Logs & traçabilité",
      "Propriété du code",
    ],
    itemsEn: [
      "GDPR native · EU hosting",
      "Guardrails & filtering",
      "Logs & traceability",
      "Code ownership",
    ],
  },
];
