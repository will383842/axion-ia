/**
 * Keyword Strategy — Phase G3B : Web & Digital Augmentés par l'IA
 *
 * Généré le 2026-05-20.
 * Positionnement clair : Axion-IA n'est PAS une agence web.
 * Angle unique = "nous intégrons l'IA dans vos produits digitaux existants".
 * Verbes autorisés : augmenter, intégrer, booster, connecter, enrichir.
 * Verbes INTERDITS dans les injections : créer, développer from scratch, refaire, concevoir.
 *
 * URL budget :
 *   - /fr/codage-developpement/web-digital   (hub)
 *   - /fr/blog/[slug]                        (articles longue traîne)
 */

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — TRANSACTIONNEL : demande directe de service
// ─────────────────────────────────────────────────────────────────────────────

const KW_WEB_DIGITAL_TRANSACTIONNEL: KeywordSeed[] = [
  {
    keyword: "intégrer intelligence artificielle dans site web PME",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Intégrer l'IA dans votre site web PME — chatbot, search, personnalisation",
      metaTitle: "Intégrer l'IA dans votre site web PME | Axion-IA",
      metaDescription:
        "Axion-IA greffe l'IA sur votre site ou application : chatbot RAG, recherche sémantique, personnalisation. Next.js, Laravel, Shopify. Livraison 3-6",
      h2Variants: [
        "Pourquoi augmenter votre site avec l'IA plutôt que le refaire ?",
        "3 briques IA à greffer sur n'importe quel site web PME",
        "Résultats mesurés : taux de conversion et temps de support avant/après",
      ],
    },
    urlCible: "/fr/codage-developpement/web-digital",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
    note: "Keyword HEAD du hub. schema.org : Service + SoftwareApplication. Page cible à créer.",
  },
  {
    keyword: "chatbot IA intégré site web sur mesure",
    intent: "transactionnel",
    kbType: "automation_recipe",
    module: "codage-developpement",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Chatbot IA sur mesure intégré à votre site web — réponses 24h/7j sur vos vraies données",
      metaTitle: "Chatbot IA intégré site web sur mesure | Axion-IA",
      metaDescription:
        "Formé sur votre base documentaire, intégré à votre CMS ou site : notre chatbot IA répond précisément à vos visiteurs. Déploiement en 3 semaines.",
      h2Variants: [
        "Comment le chatbot IA connaît votre activité mieux qu'un script statique",
        "Intégration sur WordPress, Webflow, Shopify ou site custom",
        "ROI chatbot IA site web : tickets support évités et leads qualifiés",
      ],
    },
    variables: {
      process: "support et qualification visiteurs web",
      chiffre: "80",
      unite: "% des questions traitées automatiquement",
      delai: "dès J+21",
    },
    urlCible: "/fr/codage-developpement/web-digital",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "intégrer IA dans boutique e-commerce",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Augmenter votre boutique e-commerce avec l'IA — recommandations, search, service client",
      metaTitle: "Intégrer IA dans boutique e-commerce | Axion-IA",
      metaDescription:
        "Axion-IA greffe l'IA sur votre e-commerce existant : moteur de recommandation, recherche sémantique, chatbot SAV. Compatible Shopify, WooCommerce, custom.",
      h2Variants: [
        "Moteur de recommandation IA : les produits que vos clients veulent vraiment",
        "Recherche sémantique IA : trouver même quand on tape mal",
        "Chatbot SAV e-commerce : réduire les demandes email de 60 %",
      ],
    },
    urlCible: "/fr/codage-developpement/web-digital",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
    note: "Ne pas utiliser 'partenaire Shopify' — on intègre l'IA, on ne fait pas de dev Shopify.",
  },
  {
    keyword: "recherche intelligente IA site e-commerce",
    intent: "transactionnel",
    kbType: "automation_recipe",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Moteur de recherche IA pour votre e-commerce — résultats pertinents même avec des fautes",
      metaTitle: "Recherche IA e-commerce intelligente | Axion-IA",
      metaDescription:
        "Recherche sémantique, synonymes, intentions : Axion-IA intègre un moteur IA dans votre e-commerce. +25 % de clics vers panier en moyenne.",
      h2Variants: [
        "Recherche sémantique vs recherche par mot-clé exact : la différence",
        "Intégration sur Shopify, WooCommerce et sites custom en 2 semaines",
        "Mesurer l'impact de la recherche IA sur les conversions",
      ],
    },
    variables: {
      process: "moteur de recherche interne e-commerce",
      chiffre: "25",
      unite: "% de clics supplémentaires vers panier",
      delai: "dès J+14",
    },
    urlCible: "/fr/blog/recherche-ia-site-ecommerce",
    canonicalParent: "/fr/codage-developpement/web-digital",
    source: "manuel",
  },
  {
    keyword: "assistant IA intégré application web B2B",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Intégrer un assistant IA dans votre application web B2B — sans recodage intégral",
      metaTitle: "Assistant IA application web B2B | Axion-IA",
      metaDescription:
        "Axion-IA greffe un assistant IA dans votre app web B2B : aide contextuelle, suggestions, recherche documentaire. API LLM connectée à vos données métier.",
      h2Variants: [
        "Aide contextuelle IA : l'assistant qui connaît votre app",
        "Recherche documentaire IA dans votre base de connaissance métier",
        "Temps d'intégration : de 2 semaines (widget) à 6 semaines (deep integration)",
      ],
    },
    urlCible: "/fr/codage-developpement/web-digital",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "personnalisation IA site web visiteurs PME ETI",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Personnaliser votre site web avec l'IA — contenu adapté à chaque visiteur",
      metaTitle: "Personnalisation IA site web PME ETI | Axion-IA",
      metaDescription:
        "L'IA adapte le contenu, les CTAs et les offres de votre site à chaque profil visiteur. Axion-IA intègre la couche de personnalisation IA sans refonte.",
    },
    urlCible: "/fr/blog/personnalisation-ia-site-web-pme",
    canonicalParent: "/fr/codage-developpement/web-digital",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — BÉNÉFICE : résultats chiffrés
// ─────────────────────────────────────────────────────────────────────────────

const KW_WEB_DIGITAL_BENEFICE: KeywordSeed[] = [
  {
    keyword: "augmenter taux de conversion e-commerce grâce à l'IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Augmenter le taux de conversion de votre e-commerce avec l'IA : +18 % en 6 semaines",
      metaTitle: "Augmenter conversions e-commerce IA — Axion-IA",
      metaDescription:
        "Recommandations, personnalisation, search : l'IA augmente le taux de conversion e-commerce de 15 à 25 %. Benchmarks et calculateur ROI par Axion-IA.",
      h2Variants: [
        "Quels modules IA impactent le plus le taux de conversion e-commerce ?",
        "Calculateur ROI : combien vaut +1 % de conversion sur votre CA ?",
        "Étude de cas : e-commerce PME, +18 % de conversion après intégration IA",
      ],
    },
    variables: {
      process: "optimisation du tunnel d'achat e-commerce",
      chiffre: "18",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/blog/augmenter-conversions-ecommerce-ia",
    canonicalParent: "/fr/codage-developpement/web-digital",
    source: "manuel",
  },
  {
    keyword: "réduire abandon panier e-commerce intelligence artificielle",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire l'abandon de panier de 30 % avec l'IA : relances et personnalisation",
      metaTitle: "Réduire abandon panier IA e-commerce — Axion-IA",
      metaDescription:
        "Relances IA personnalisées, offres contextuelles, chatbot relance : nos clients e-commerce réduisent l'abandon panier de 30 %. Déployé en 4 semaines.",
    },
    variables: {
      process: "relance abandon panier e-commerce",
      chiffre: "30",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/blog/reduire-abandon-panier-ia-ecommerce",
    canonicalParent: "/fr/codage-developpement/web-digital",
    source: "manuel",
  },
  {
    keyword: "automatiser fiches produit e-commerce avec IA générative",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Générer 500 fiches produit par heure avec l'IA — e-commerce sans rédacteur",
      metaTitle: "Automatiser fiches produit IA e-commerce | Axion-IA",
      metaDescription:
        "Pipeline IA de génération de fiches produit : titre SEO, description, bullet points, balises. Axion-IA connecte l'IA générative à votre catalogue.",
      h2Variants: [
        "Comment l'IA rédige des fiches produit qui convertissent et rankent",
        "Contrôle qualité et cohérence de marque dans les fiches IA",
        "ROI : coût rédaction manuelle vs pipeline IA sur 1 000 produits",
      ],
    },
    variables: {
      process: "rédaction et optimisation fiches produit",
      chiffre: "500",
      unite: "fiches/heure",
      delai: "dès J+14",
    },
    urlCible: "/fr/blog/automatiser-fiches-produit-ia-ecommerce",
    canonicalParent: "/fr/codage-developpement/web-digital",
    source: "manuel",
  },
  {
    keyword: "gain de temps support client site web IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Support client site web : économisez 8h/semaine grâce au chatbot IA",
      metaTitle: "Gain temps support client site web IA — Axion-IA",
      metaDescription:
        "Chatbot IA formé sur votre FAQ : 80 % des questions répondues automatiquement, 8h/semaine économisées sur le support. Axion-IA déploie en 3 semaines.",
    },
    variables: {
      process: "support et service client web",
      chiffre: "8",
      unite: "heures/semaine économisées",
      delai: "dès J+21",
    },
    urlCible: "/fr/blog/gain-temps-support-client-web-ia",
    canonicalParent: "/fr/codage-developpement/web-digital",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — INFORMATIONNEL + AEO : guides et questions naturelles
// ─────────────────────────────────────────────────────────────────────────────

const KW_WEB_DIGITAL_INFO_AEO: KeywordSeed[] = [
  {
    keyword: "comment ajouter l'IA à un site web existant ?",
    intent: "aeo",
    kbType: "faq",
    module: "codage-developpement",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Comment ajouter l'IA à un site web existant ? Les 4 briques à greffer en priorité",
      metaTitle: "Comment ajouter l'IA à un site web ? — Axion-IA",
      metaDescription:
        "Chatbot, search sémantique, recommandations, personnalisation : les 4 modules IA à intégrer en priorité sur un site existant. Guide pratique 2026.",
      h2Variants: [
        "1. Chatbot IA : la brique la plus rapide à déployer",
        "2. Recherche sémantique : l'impact immédiat sur l'expérience",
        "4. Personnalisation IA : le module le plus ROI à 3 mois",
      ],
    },
    urlCible: "/fr/faq/comment-ajouter-ia-site-web",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort. schema.org FAQPage + HowTo. Maillage vers /fr/codage-developpement/web-digital.",
  },
  {
    keyword: "quels usages de l'IA pour un site e-commerce en 2026 ?",
    intent: "aeo",
    kbType: "faq",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Quels usages de l'IA pour un e-commerce en 2026 ? Les 7 cas qui convertissent",
      metaTitle: "Usages IA e-commerce 2026 : les 7 qui convertissent",
      metaDescription:
        "Recommandations, fiches produit, search, chatbot SAV, pricing dynamique : 7 usages IA e-commerce avec ROI mesurable en 2026. Guide Axion-IA.",
      h2Variants: [
        "1. Moteur de recommandation IA : le ROI le plus rapide",
        "3. Génération automatique de fiches produit IA",
        "7. Pricing dynamique IA : ajuster en temps réel",
      ],
    },
    urlCible: "/fr/faq/usages-ia-ecommerce-2026",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort. schema.org FAQPage.",
  },
  {
    keyword: "différence entre site web IA et site web classique",
    intent: "informationnel",
    kbType: "comparison",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Site web IA vs site web classique : ce qui change vraiment pour vos visiteurs",
      metaTitle: "Site web augmenté IA vs classique — Axion-IA",
      metaDescription:
        "Personnalisation, réponses instantanées, search pertinent : ce que l'IA change concrètement dans l'expérience visiteur vs un site statique.",
    },
    urlCible: "/fr/blog/site-web-ia-vs-site-classique",
    canonicalParent: "/fr/codage-developpement/web-digital",
    source: "manuel",
  },
  {
    keyword: "combien coûte intégrer l'IA dans un site web ?",
    intent: "aeo",
    kbType: "faq",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Combien coûte l'intégration de l'IA dans un site web ? Fourchettes 2026",
      metaTitle: "Coût intégration IA site web — fourchettes 2026",
      metaDescription:
        "De 2 000 € (chatbot FAQ) à 25 000 € (recommandations + search + perso) : les fourchettes réelles d'intégration IA site web selon le périmètre.",
    },
    urlCible: "/fr/faq/cout-integration-ia-site-web",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort. schema.org FAQPage.",
  },
  {
    keyword: "intégrer IA dans application Next.js Laravel existante",
    intent: "informationnel",
    kbType: "guide",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Intégrer l'IA dans une application Next.js ou Laravel — guide technique 2026",
      metaTitle: "Intégrer IA Next.js Laravel application — Axion-IA",
      metaDescription:
        "Chatbot RAG, search sémantique, assistant LLM : 3 façons d'ajouter l'IA dans une application Next.js ou Laravel sans tout refaire. Guide Axion-IA.",
    },
    urlCible: "/fr/blog/integrer-ia-application-nextjs-laravel",
    canonicalParent: "/fr/codage-developpement/web-digital",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT AGRÉGÉ
// ─────────────────────────────────────────────────────────────────────────────

export const KW_WEB_DIGITAL_G3B: KeywordSeed[] = [
  ...KW_WEB_DIGITAL_TRANSACTIONNEL,
  ...KW_WEB_DIGITAL_BENEFICE,
  ...KW_WEB_DIGITAL_INFO_AEO,
];

export const G3B_STATS = {
  transactionnel: KW_WEB_DIGITAL_TRANSACTIONNEL.length,
  benefice: KW_WEB_DIGITAL_BENEFICE.length,
  infoAeo: KW_WEB_DIGITAL_INFO_AEO.length,
  total: KW_WEB_DIGITAL_G3B.length,
} as const;
