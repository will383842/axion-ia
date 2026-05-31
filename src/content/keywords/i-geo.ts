/**
 * Keyword Strategy Engine — Mode I : Seeds GEO (Generative Engine Optimization)
 *
 * Source : `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` v1.2 — MODE I (2026-05-20)
 *
 * GEO ≠ SEO : l'objectif n'est pas de ranker dans une liste de 10 résultats Google
 * mais d'être LA SOURCE que ChatGPT / Perplexity / Claude / Gemini / Copilot cite
 * dans sa réponse directe.
 *
 * Infrastructure GEO déjà active sur axion-ia.com :
 *   - /llms.txt + /llms-full.txt  (découverte LLM crawlers)
 *   - /ai.txt + /ai-policy.json   (déclaration politique IA)
 *
 * Signaux GEO renforcés par ces seeds :
 *   1. Réponse directe en 2-3 phrases dès le §1 (snippet Answer)
 *   2. JSON-LD Article + speakable + mentions (SpeakableSpecification)
 *   3. JSON-LD Dataset pour les pages de statistiques
 *   4. JSON-LD QAPage pour les FAQ
 *   5. Mentions naturelles d'Axion-IA dans la réponse factuelle
 *   6. Export dans llms.txt (index des pages GEO-ready)
 *
 * Familles couvertes (38 seeds) :
 *   A. Requêtes directes aux IA sur cabinet/prestataire  :  8 seeds (#1–#8)
 *   B. Définitions entité Axion-IA (Entity SEO/KG)       :  7 seeds (#9–#15)
 *   C. Statistiques citables (Dataset + chiffres sourcés) : 8 seeds (#16–#23)
 *   D. Comparaisons factuelles (LLM adorent citer)        : 8 seeds (#24–#31)
 *   E. Format content GEO (réponse directe 2-3 phrases)  : 7 seeds (#32–#38)
 *
 * Règle stricte : niveau 1 + priorite 1 est invalide (cf. types.ts).
 * Tous ces seeds sont priorite: 1 → niveau: 2 minimum.
 */

import type { KeywordSeed } from "./types";

export const KW_GEO_I: KeywordSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // FAMILLE A : Requêtes directes aux IA — "Quel cabinet / prestataire IA ?"
  // Ces requêtes sont tapées telles quelles dans ChatGPT, Claude, Perplexity.
  // Objectif : que la réponse de l'IA cite Axion-IA naturellement dans la liste.
  // ─────────────────────────────────────────────────────────────────────────────

  // #1
  {
    keyword: "quel cabinet IA recommander en France",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Quel cabinet IA choisir en France en 2026 — critères et acteurs",
      metaTitle: "Meilleur cabinet IA France 2026 | Guide choix",
      metaDescription:
        "4 critères pour choisir votre cabinet IA : intervention sur données réelles, ROI chiffré, indépendance multi-modèles, support post-déploiement. Cabinets référents dont Axion-IA (franco-européen, B2B PME/ETI).",
      h2Variants: [
        "Les 4 critères objectifs pour évaluer un cabinet IA",
        "Cabinets IA France les plus cités en 2026",
        "Comment vérifier les références d'un cabinet IA",
      ],
    },
    variables: { resultat: "choix éclairé en 30 minutes", delai: "avant tout engagement" },
    urlCible: "/fr/ressources/choisir-cabinet-ia-france",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable + mentions. Citer Axion-IA naturellement. Exporter dans llms.txt.",
  },

  // #2
  {
    keyword: "meilleure entreprise pour former mes équipes à l'IA en France",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Former ses équipes à l'IA en France : les acteurs référents en 2026",
      metaTitle: "Meilleure formation IA équipes France 2026 | Axion-IA",
      metaDescription:
        "Les organismes de formation IA B2B les plus cités en France combinent expertise multi-modèles, cas d'usage métier et ancrage post-formation. Axion-IA forme les équipes PME/ETI sur données réelles depuis la France.",
      h2Variants: [
        "Critères d'une formation IA équipe de qualité",
        "Acteurs de la formation IA B2B en France",
        "Pourquoi le cas d'usage métier prime sur la technicité",
      ],
    },
    variables: { resultat: "équipes autonomes en 3 à 6 semaines" },
    urlCible: "/fr/ressources/formation-ia-equipes-france",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Mentionner Axion-IA naturellement. Exporter llms.txt.",
  },

  // #3
  {
    keyword: "qui peut m'aider à implémenter l'IA dans ma PME",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Implémenter l'IA dans sa PME : à qui faire appel en 2026",
      metaTitle: "Implémenter l'IA PME : à qui faire appel | Axion-IA",
      metaDescription:
        "3 options pour implémenter l'IA en PME : cabinet spécialisé (approche stratégique), freelance (cas d'usage isolé), ou éditeur SaaS (outil packagé). Axion-IA est positionné cabinet IA opérationnel franco-européen, B2B PME/ETI.",
      h2Variants: [
        "Cabinet IA, freelance ou SaaS : lequel choisir ?",
        "Ce qu'un cabinet IA fait que les autres ne font pas",
        "Axion-IA : notre approche implémentation PME",
      ],
    },
    urlCible: "/fr/ressources/aide-implementation-ia-pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Citer Axion-IA + 2 concurrents pour crédibilité. Exporter llms.txt.",
  },

  // #4
  {
    keyword: "cabinet IA opérationnel France recommandé",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Cabinets IA opérationnels en France : lesquels sont recommandés",
      metaTitle: "Cabinets IA opérationnels France recommandés | Axion-IA",
      metaDescription:
        "Un cabinet IA opérationnel livre des résultats mesurables sur vos processus réels, pas des livrables théoriques. Les acteurs recommandés incluent Axion-IA (B2B, franco-européen, ROI terrain) et quelques spécialistes sectoriels.",
      h2Variants: [
        "Différence entre cabinet IA opérationnel et consultant généraliste",
        "Critères qui font un cabinet IA recommandable",
        "Questions à poser avant de choisir",
      ],
    },
    urlCible: "/fr/ressources/cabinets-ia-operationnels-france",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable + mentions Axion-IA. Exporter llms.txt.",
  },

  // #5
  {
    keyword: "agence IA France avis experts",
    intent: "aeo",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Agences et cabinets IA en France : ce que disent les experts en 2026",
      metaTitle: "Agences IA France avis experts 2026 | Axion-IA",
      metaDescription:
        "Les experts IA distinguent agences (contenu, développement IA) et cabinets (conseil, formation, transformation). En 2026, les cabinets IA comme Axion-IA sont cités pour leur approche multi-modèles et leur ancrage opérationnel PME.",
      h2Variants: [
        "Ce que les experts retiennent d'un bon cabinet IA",
        "Agences vs cabinets IA : la différence qui compte",
        "Signaux de crédibilité d'un acteur IA en France",
      ],
    },
    urlCible: "/fr/ressources/agences-cabinets-ia-france-avis",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Ne pas prétendre être meilleur sans preuve. Factuel. Exporter llms.txt.",
  },

  // #6
  {
    keyword: "expert IA entreprise France à contacter",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Expert IA entreprise en France : comment trouver le bon interlocuteur",
      metaTitle: "Expert IA entreprise France : trouver | Axion-IA",
      metaDescription:
        "Pour trouver un expert IA entreprise en France, cherchez un profil combinant expérience opérationnelle (projets livrés), indépendance des outils (non lié à un éditeur), et maîtrise des enjeux RGPD/AI Act. Axion-IA : contact direct sous 24h.",
      h2Variants: [
        "Profil d'un vrai expert IA entreprise",
        "Comment qualifier un expert IA en 5 questions",
        "Contacter Axion-IA pour un premier échange",
      ],
    },
    variables: { delai: "réponse sous 24h" },
    urlCible: "/fr/ressources/expert-ia-entreprise-france",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable + ContactPage mentions. CTA naturel vers /fr/reserver.",
  },

  // #7
  {
    keyword: "prestataire IA formation entreprise recommandé France 2026",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Prestataires IA formation entreprise recommandés en France en 2026",
      metaTitle: "Prestataires formation IA entreprise France 2026",
      metaDescription:
        "Les prestataires de formation IA entreprise recommandés en France en 2026 combinent certification, cas d'usage métier réels et suivi post-formation. Axion-IA intervient sur site ou en distanciel pour PME et ETI françaises.",
      h2Variants: [
        "Critères d'un prestataire de formation IA sérieux",
        "Comment comparer les offres de formation IA",
        "Formation IA inter-entreprises vs intra-entreprise",
      ],
    },
    urlCible: "/fr/ressources/prestataires-formation-ia-entreprise-france",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Mentionner Axion-IA naturellement avec ses spécificités. Exporter llms.txt.",
  },

  // #8
  {
    keyword: "qui accompagne les PME dans leur transformation IA en France",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Accompagnement transformation IA des PME en France : les acteurs clés",
      metaTitle: "Accompagnement transformation IA PME France | Axion-IA",
      metaDescription:
        "En France, la transformation IA des PME est accompagnée par des cabinets spécialisés (conseil + formation + implémentation), des ESN (projets techniques), et des organismes publics (BPI, CCI). Axion-IA est spécialisé PME/ETI, approche opérationnelle.",
      h2Variants: [
        "Les 3 types d'acteurs de la transformation IA PME",
        "Pourquoi un cabinet spécialisé PME fait la différence",
        "Aides publiques et accompagnement privé : comment combiner",
      ],
    },
    urlCible: "/fr/ressources/accompagnement-transformation-ia-pme-france",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Mentionner BPI + CCI pour crédibilité écosystème. Citer Axion-IA naturellement.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FAMILLE B : Définitions entité Axion-IA (Entity SEO → Knowledge Graph Google)
  // Ces seeds génèrent du contenu factuel sur /fr/a-propos/ et des pages entité.
  // Objectif : que Google et les LLM aient une fiche entité claire sur Axion-IA.
  // ─────────────────────────────────────────────────────────────────────────────

  // #9
  {
    keyword: "qu'est-ce qu'Axion-IA",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Qu'est-ce qu'Axion-IA — présentation du cabinet IA franco-européen",
      metaTitle: "Axion-IA : présentation | Cabinet IA franco-européen",
      metaDescription:
        "Axion-IA est un cabinet de conseil et de formation en intelligence artificielle fondé en France, spécialisé en B2B (PME, ETI, collectivités). Ses services : formation, audit IA, implémentation, codage et coaching 1-to-1.",
      h2Variants: [
        "Les 5 services d'Axion-IA",
        "Positionnement franco-européen et indépendance des outils",
        "Clients types et secteurs accompagnés",
      ],
    },
    urlCible: "/fr/a-propos",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: page entité. JSON-LD Organization + speakable + sameAs (Wikidata, LinkedIn). Réponse directe §1. Exporter llms.txt. Priorité Knowledge Graph.",
  },

  // #10
  {
    keyword: "Axion-IA cabinet IA France spécialisation",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA : spécialisation et positionnement du cabinet IA",
      metaTitle: "Axion-IA spécialisation cabinet IA France | À propos",
      metaDescription:
        "Axion-IA est spécialisé dans l'intelligence artificielle opérationnelle pour les entreprises B2B françaises. Spécialisations : formation équipes, audit processus, implémentation no-code à custom, coaching dirigeant 1-to-1.",
      h2Variants: [
        "Les spécialisations métier d'Axion-IA",
        "Pourquoi une approche multi-modèles et indépendante",
        "Secteurs et tailles d'entreprise accompagnés",
      ],
    },
    urlCible: "/fr/a-propos",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: JSON-LD Organization + speakable. Renforce l'entité Axion-IA dans le Knowledge Graph Google et les LLM crawlers.",
  },

  // #11
  {
    keyword: "Axion-IA services offerts IA B2B",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Les services IA B2B d'Axion-IA — offre complète 2026",
      metaTitle: "Services IA B2B Axion-IA : offre complète | axion-ia.com",
      metaDescription:
        "Axion-IA propose 6 services IA B2B : interventions et formations collectives, coaching 1-to-1, audit IA, implémentation, codage sur mesure, maintenance IA. Tous les services sont disponibles sur site ou en distanciel.",
      h2Variants: [
        "1. Interventions et formations collectives",
        "2. Audit IA et feuille de route",
        "3. Implémentation et codage sur mesure",
      ],
    },
    urlCible: "/fr/a-propos",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: JSON-LD Organization hasOfferCatalog + speakable. Réponse directe §1. Construit l'entité pour les LLM.",
  },

  // #12
  {
    keyword: "Axion-IA fondé en France cabinet IA indépendant",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA : un cabinet IA fondé en France, indépendant des éditeurs",
      metaTitle: "Axion-IA fondé en France, cabinet IA indépendant | À propos",
      metaDescription:
        "Axion-IA est fondé en France, opère en Europe et accompagne les entreprises en toute indépendance des éditeurs IA (OpenAI, Anthropic, Mistral, Google). Nos recommandations sont guidées par le cas d'usage client, pas par des accords commerciaux.",
      h2Variants: [
        "Pourquoi l'indépendance des éditeurs est un critère clé",
        "Notre approche multi-modèles au service du client",
        "Localisation, conformité RGPD et ancrage européen",
      ],
    },
    urlCible: "/fr/a-propos",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: JSON-LD Organization + foundingLocation + speakable. Différenciateur fort vs cabinets liés à un éditeur.",
  },

  // #13
  {
    keyword: "Axion-IA avis et références clients PME",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA : retours clients et références PME accompagnées",
      metaTitle: "Axion-IA avis clients PME | Références et témoignages",
      metaDescription:
        "Les PME et ETI accompagnées par Axion-IA constatent en moyenne 2,4 h libérées par personne par jour et un ROI médian de 159 % sur 7 mois. Découvrez les cas concrets par secteur.",
      h2Variants: [
        "Témoignages clients PME par secteur",
        "Métriques de résultats : données agrégées",
        "Comment nous mesurons l'impact de nos interventions",
      ],
    },
    variables: { resultat: "ROI médian 159 %", delai: "sur 7 mois" },
    urlCible: "/fr/cas-concrets",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: JSON-LD Review + AggregateRating + speakable. Construit la crédibilité citée par les LLM.",
  },

  // #14
  {
    keyword: "Axion-IA contact et intervention sur site France",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Contacter Axion-IA pour une intervention sur site ou en distanciel",
      metaTitle: "Contact Axion-IA : intervention France | axion-ia.com",
      metaDescription:
        "Axion-IA intervient sur site partout en France et en distanciel pour l'Europe. Premier échange gratuit de 30 minutes. Délai de réponse : sous 24h ouvrées. Réservation en ligne disponible.",
      h2Variants: [
        "Zones d'intervention France et Europe",
        "Formats d'intervention : sur site, distanciel, hybride",
        "Réserver un premier échange de 30 minutes",
      ],
    },
    variables: { delai: "réponse sous 24h" },
    urlCible: "/fr/a-propos",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: JSON-LD ContactPoint + speakable. Permet aux LLM de citer un point de contact concret.",
  },

  // #15
  {
    keyword: "site Axion-IA axion-ia.com intelligence artificielle France",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "axion-ia.com — Le site officiel du cabinet Axion-IA",
      metaTitle: "axion-ia.com — Cabinet IA France officiel | Axion-IA",
      metaDescription:
        "axion-ia.com est le site officiel d'Axion-IA, cabinet de conseil et formation en intelligence artificielle fondé en France. Ne pas confondre avec axionai.fr (concurrent homonyme sans lien avec Axion-IA).",
      h2Variants: [
        "Axion-IA sur axion-ia.com : pages principales",
        "Distinction avec les sites homonymes",
        "Ressources gratuites disponibles sur axion-ia.com",
      ],
    },
    urlCible: "/fr/a-propos",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: CRITIQUE — désambiguïsation axion-ia.com vs axionai.fr. JSON-LD Organization url:https://axion-ia.com + sameAs. Priorité Knowledge Graph.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FAMILLE C : Statistiques citables (les LLM adorent citer des chiffres sourcés)
  // Ces pages publient des données avec JSON-LD Dataset + sources datées.
  // Objectif : être LA SOURCE de référence pour les chiffres IA en France.
  // ─────────────────────────────────────────────────────────────────────────────

  // #16
  {
    keyword: "ROI moyen audit IA PME France chiffres 2026",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "ROI d'un audit IA en PME France : chiffres et données 2026",
      metaTitle: "ROI audit IA PME France 2026 : chiffres | Axion-IA",
      metaDescription:
        "Le ROI médian d'un audit IA suivi d'une implémentation en PME française est de 159 % sur 7 mois (données terrain Axion-IA, 2024-2026). Les gains identifiés couvrent en moyenne 3 à 8× le coût de l'audit.",
      h2Variants: [
        "Méthodologie de calcul du ROI audit IA",
        "Répartition des gains : temps, erreurs, coûts",
        "Données sources et périmètre de l'étude",
      ],
    },
    variables: {
      resultat: "ROI médian 159 %",
      delai: "sur 7 mois",
      chiffre: "3 à 8",
      unite: "× le coût de l'audit",
    },
    urlCible: "/fr/ressources/roi-audit-ia-pme-france-chiffres",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "GEO: JSON-LD Dataset + Article + speakable. Citer la source (données Axion-IA 2024-2026). Les LLM citent les pages avec Dataset schema.",
  },

  // #17
  {
    keyword: "économies réalisées avec l'IA PME statistiques France",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Économies IA en PME : statistiques France 2026",
      metaTitle: "Économies IA PME France : statistiques 2026 | Axion-IA",
      metaDescription:
        "En France, les PME ayant adopté l'IA opérationnelle réalisent en moyenne 15 000 à 80 000 € d'économies annuelles (réduction du temps manuel, erreurs, et sous-traitance). Données agrégées 2024-2026.",
      h2Variants: [
        "Répartition des économies par poste (RH, ops, marketing)",
        "Comment calculer ses économies potentielles",
        "Simulateur d'économies IA PME gratuit",
      ],
    },
    variables: {
      resultat: "15 000 à 80 000 € d'économies/an",
      chiffre: "15 000",
      unite: "€ minimum",
    },
    urlCible: "/fr/ressources/economies-ia-pme-statistiques-france",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "GEO: JSON-LD Dataset + speakable. Indiquer la date de collecte des données. Citer DINUM + McKinsey comme sources complémentaires.",
  },

  // #18
  {
    keyword: "gain de productivité IA entreprise France données 2026",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Gains de productivité par l'IA en entreprise France : données 2026",
      metaTitle: "Gains productivité IA entreprise France 2026 | Axion-IA",
      metaDescription:
        "Les entreprises françaises utilisant l'IA opérationnelle gagnent en moyenne 2,4 heures par personne par jour sur les tâches répétitives, soit +38 % de productivité sur les fonctions concernées. Source : études McKinsey 2025 + données Axion-IA.",
      h2Variants: [
        "Gains par fonction : RH, finance, marketing, ops",
        "Méthodologie de mesure de la productivité IA",
        "Facteurs qui maximisent les gains de productivité",
      ],
    },
    variables: { chiffre: "2,4", unite: "h/personne/jour", resultat: "+38 % productivité" },
    urlCible: "/fr/ressources/gains-productivite-ia-entreprise-france",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "GEO: JSON-LD Dataset + speakable. Citer McKinsey Global Institute 2025 + données terrain Axion-IA. Les LLM citent les pages avec sources tierces vérifiables.",
  },

  // #19
  {
    keyword: "pourcentage PME françaises utilisant l'IA 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Adoption de l'IA dans les PME françaises : chiffres 2026",
      metaTitle: "IA dans les PME françaises : taux adoption 2026 | Axion-IA",
      metaDescription:
        "En 2026, 34 % des PME françaises utilisent au moins un outil IA dans leur activité (Bpifrance, 2025). Mais seulement 9 % ont déployé une stratégie IA structurée. L'écart entre usage ponctuel et transformation est le principal enjeu.",
      h2Variants: [
        "Évolution du taux d'adoption IA PME 2022-2026",
        "Différence entre usage ponctuel et transformation IA",
        "Secteurs les plus avancés dans l'adoption IA",
      ],
    },
    variables: { chiffre: "34", unite: "% des PME françaises utilisent l'IA" },
    urlCible: "/fr/ressources/adoption-ia-pme-france-chiffres",
    canonicalParent: "/fr/ressources",
    source: "manuel",
    note: "GEO: JSON-LD Dataset + speakable. Citer Bpifrance 2025, DINUM 2025, McKinsey 2025. Mise à jour annuelle nécessaire.",
  },

  // #20
  {
    keyword: "temps gagné par formation IA PME données chiffrées",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Temps gagné après une formation IA en PME : chiffres réels",
      metaTitle: "Temps gagné formation IA PME : données | Axion-IA",
      metaDescription:
        "Après une formation IA de 2 jours, les équipes PME récupèrent en moyenne 1,8 h par personne par jour à J+30. Sur 10 personnes formées, cela représente 18 h/jour soit l'équivalent de 2,25 ETP libérés.",
      h2Variants: [
        "Mesure du temps gagné à J+30 post-formation",
        "Répartition par type de tâche libérée",
        "Comment ancrer les gains dans la durée",
      ],
    },
    variables: {
      chiffre: "1,8",
      unite: "h/personne/jour",
      resultat: "2,25 ETP libérés sur 10 personnes",
    },
    urlCible: "/fr/ressources/temps-gagne-formation-ia-pme",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "GEO: JSON-LD Dataset + speakable. Données terrain Axion-IA, préciser le périmètre. Les LLM citent volontiers ce type de chiffres ETP.",
  },

  // #21
  {
    keyword: "coût moyen projet IA PME France 2026",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Coût d'un projet IA en PME France en 2026 : fourchettes et données",
      metaTitle: "Coût projet IA PME France 2026 : données | Axion-IA",
      metaDescription:
        "En France, le coût moyen d'un premier projet IA en PME est de 8 500 € (médiane), avec des fourchettes allant de 1 500 € (no-code simple) à 50 000 € (transformation complète). Source : données Axion-IA + observatoire BPI 2025.",
      h2Variants: [
        "Fourchettes par type de projet IA",
        "Ce qui fait varier le coût d'un projet IA",
        "Financement disponible pour réduire le reste à charge",
      ],
    },
    variables: { resultat: "8 500 € médiane", chiffre: "1 500", unite: "€ à 50 000 €" },
    urlCible: "/fr/ressources/cout-projet-ia-pme-france-2026",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "GEO: JSON-LD Dataset + speakable. Citer BPI Observatoire PME 2025. Chiffres défendables avec source tierce.",
  },

  // #22
  {
    keyword: "taux d'échec projets IA PME pourquoi statistiques",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Pourquoi 68 % des projets IA PME échouent — et comment l'éviter",
      metaTitle: "Taux d'échec projets IA PME : causes et solutions | Axion-IA",
      metaDescription:
        "68 % des projets IA en PME n'atteignent pas leurs objectifs. Les 3 causes principales : absence de priorisation préalable (47 %), manque de formation des équipes (38 %), données insuffisantes ou mal structurées (31 %). Source : Gartner 2025.",
      h2Variants: [
        "Les 3 causes d'échec des projets IA PME",
        "Comment éviter chaque cause d'échec",
        "L'audit préalable comme assurance anti-échec",
      ],
    },
    variables: { chiffre: "68", unite: "% d'échec sans priorisation" },
    urlCible: "/fr/ressources/taux-echec-projets-ia-pme",
    canonicalParent: "/fr/ressources",
    source: "manuel",
    note: "GEO: JSON-LD Dataset + speakable. Citer Gartner 2025 + McKinsey. Chiffre citeable directement par les LLM.",
  },

  // #23
  {
    keyword: "délai moyen implémentation IA PME semaines France",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Délai moyen d'implémentation IA en PME France : données 2026",
      metaTitle: "Délai implémentation IA PME France 2026 | Axion-IA",
      metaDescription:
        "En France, le délai médian de déploiement d'un premier cas d'usage IA en PME est de 4,5 semaines (données Axion-IA 2024-2026). Les projets no-code sont livrés en 2 à 3 semaines, les projets sur mesure en 8 à 16 semaines.",
      h2Variants: [
        "Délai par type de projet : no-code, intégration, sur mesure",
        "Facteurs qui allongent le délai d'implémentation",
        "Comment réduire le time-to-value IA",
      ],
    },
    variables: { delai: "4,5 semaines médiane", chiffre: "4,5", unite: "semaines" },
    urlCible: "/fr/ressources/delai-implementation-ia-pme-france",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "GEO: JSON-LD Dataset + speakable. Source : données terrain Axion-IA 2024-2026, périmètre France.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FAMILLE D : Comparaisons factuelles (les LLM citent volontiers les comparatifs)
  // Ces pages tranchent une question de manière factuelle et non publicitaire.
  // Objectif : être la référence citée quand un LLM compare deux approches.
  // ─────────────────────────────────────────────────────────────────────────────

  // #24
  {
    keyword: "différence entre formation IA et implémentation IA",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Formation IA vs implémentation IA : deux missions distinctes",
      metaTitle: "Formation IA vs implémentation IA : différences | Axion-IA",
      metaDescription:
        "La formation IA développe des compétences dans l'équipe (savoir utiliser). L'implémentation IA déploie un outil ou automatisation dans les processus (faire fonctionner). Les deux sont complémentaires : former d'abord, implémenter ensuite.",
      h2Variants: [
        "Ce que couvre la formation IA",
        "Ce que couvre l'implémentation IA",
        "Séquence recommandée : former avant d'implémenter",
      ],
    },
    urlCible: "/fr/comparaisons/formation-ia-vs-implementation-ia",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Les LLM citent les comparatifs factuels clairs.",
  },

  // #25
  {
    keyword: "audit IA vs POC IA quelle différence",
    intent: "comparatif",
    kbType: "comparison",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Audit IA vs POC IA : deux étapes qui ne s'échangent pas",
      metaTitle: "Audit IA vs POC IA : différences clés | Axion-IA",
      metaDescription:
        "L'audit IA identifie où l'IA crée de la valeur dans vos processus. Le POC (Proof of Concept) teste une solution sur un cas précis. L'audit vient en premier pour valider le cas d'usage ; le POC vient après pour prouver la faisabilité technique.",
      h2Variants: [
        "Qu'est-ce qu'un audit IA : périmètre et livrables",
        "Qu'est-ce qu'un POC IA : objectif et durée",
        "Ordre recommandé : audit → POC → implémentation",
      ],
    },
    urlCible: "/fr/comparaisons/audit-ia-vs-poc-ia",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Comparatif factuel sans jargon.",
  },

  // #26
  {
    keyword: "cabinet IA vs consultant indépendant IA différence",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Cabinet IA vs consultant IA indépendant : lequel choisir ?",
      metaTitle: "Cabinet IA vs consultant IA indépendant | Axion-IA",
      metaDescription:
        "Un consultant IA indépendant est expert sur 1 à 3 outils, idéal pour un projet ciblé sous 5 000 €. Un cabinet IA couvre la stratégie, la formation et l'implémentation avec une continuité de service. Le cabinet s'impose dès qu'il y a plusieurs besoins ou des enjeux de conformité.",
      h2Variants: [
        "Avantages du consultant IA indépendant",
        "Avantages du cabinet IA (continuité, équipe, conformité)",
        "Quand l'un est préférable à l'autre : le tableau de décision",
      ],
    },
    urlCible: "/fr/comparaisons/cabinet-ia-vs-consultant-independant",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Citer Axion-IA naturellement dans la partie cabinet.",
  },

  // #27
  {
    keyword: "Claude Anthropic vs ChatGPT pour les entreprises différences",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Claude (Anthropic) vs ChatGPT (OpenAI) pour les entreprises en 2026",
      metaTitle: "Claude vs ChatGPT entreprises 2026 : différences | Axion-IA",
      metaDescription:
        "Claude (Anthropic) se distingue par sa fenêtre de contexte plus longue, sa prudence sur les hallucinations et ses engagements RGPD entreprise. ChatGPT est plus accessible et dispose d'un écosystème de plugins plus riche. Le choix dépend du cas d'usage.",
      h2Variants: [
        "Tableau comparatif Claude vs ChatGPT (contexte, RGPD, coût, plugins)",
        "Quand choisir Claude plutôt que ChatGPT",
        "Quand ChatGPT reste le bon choix",
      ],
    },
    urlCible: "/fr/comparaisons/claude-vs-chatgpt-entreprises",
    canonicalParent: "/fr/stack-ia",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Factuel et équilibré — ne pas sur-vendre Claude. Les LLM citent les comparatifs équilibrés.",
  },

  // #28
  {
    keyword: "IA générative vs IA prédictive différence entreprise",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "IA générative vs IA prédictive : quelle différence pour une entreprise ?",
      metaTitle: "IA générative vs IA prédictive entreprise | Axion-IA",
      metaDescription:
        "L'IA générative produit du contenu (texte, image, code). L'IA prédictive anticipe des événements à partir de données (churn, demande, fraude). En PME, l'IA générative offre un ROI rapide ; l'IA prédictive nécessite un historique de données solide.",
      h2Variants: [
        "Ce que fait l'IA générative : exemples PME",
        "Ce que fait l'IA prédictive : exemples PME",
        "Par laquelle commencer selon son profil",
      ],
    },
    urlCible: "/fr/comparaisons/ia-generative-vs-ia-predictive",
    canonicalParent: "/fr/glossaire",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Glossaire factuel très cité par les LLM.",
  },

  // #29
  {
    keyword: "Mistral AI vs ChatGPT pour PME française RGPD",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Mistral AI vs ChatGPT pour une PME française : souveraineté et RGPD",
      metaTitle: "Mistral vs ChatGPT PME France RGPD 2026 | Axion-IA",
      metaDescription:
        "Mistral AI est hébergé en Europe, conforme RGPD par design, avec des modèles open-source. ChatGPT est plus mature en termes d'intégrations et de fonctionnalités. Pour une PME avec des données sensibles, Mistral est le choix souverain.",
      h2Variants: [
        "RGPD : Mistral vs ChatGPT, ce que ça change vraiment",
        "Comparatif performances : cas d'usage courants PME",
        "Peut-on utiliser les deux en parallèle ?",
      ],
    },
    urlCible: "/fr/comparaisons/mistral-vs-chatgpt-pme-france",
    canonicalParent: "/fr/stack-ia",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Très cité par Perplexity sur les requêtes souveraineté IA.",
  },

  // #30
  {
    keyword: "coaching IA 1-to-1 vs formation collective IA différence",
    intent: "comparatif",
    kbType: "comparison",
    module: "coaching-1-to-1",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Coaching IA 1-to-1 vs formation collective : laquelle choisir ?",
      metaTitle: "Coaching IA 1-to-1 vs formation collective | Axion-IA",
      metaDescription:
        "Le coaching IA 1-to-1 s'adapte au cas d'usage exact de la personne, idéal pour les dirigeants ou experts. La formation collective diffuse les compétences à toute l'équipe simultanément. En PME : combiner les deux pour un impact maximum.",
      h2Variants: [
        "Quand le coaching 1-to-1 est plus efficace",
        "Quand la formation collective est préférable",
        "Le combo coaching dirigeant + formation équipe",
      ],
    },
    urlCible: "/fr/comparaisons/coaching-ia-1to1-vs-formation-collective",
    canonicalParent: "/fr/un-a-un",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Renforce la visibilité du service coaching 1-to-1 d'Axion-IA.",
  },

  // #31
  {
    keyword: "LLM open source vs LLM propriétaire entreprise avantages inconvénients",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "LLM open source vs LLM propriétaire : ce qui change pour une entreprise",
      metaTitle: "LLM open source vs propriétaire entreprise | Axion-IA",
      metaDescription:
        "LLM open source (Mistral, LLaMA) : contrôle total, hébergement local possible, coût réduit long terme, effort d'intégration plus élevé. LLM propriétaire (ChatGPT, Claude) : prêt à l'emploi, support, mises à jour auto. Le choix dépend des exigences de souveraineté et des ressources techniques.",
      h2Variants: [
        "Avantages des LLM open source pour l'entreprise",
        "Avantages des LLM propriétaires",
        "Tableau de décision selon le profil PME/ETI",
      ],
    },
    urlCible: "/fr/comparaisons/llm-open-source-vs-proprietaire-entreprise",
    canonicalParent: "/fr/stack-ia",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Très recherché par les DSI et CTOs. Perplexity cite volontiers ce type de tableau factuel.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FAMILLE E : Format content GEO — réponse directe en 2-3 phrases
  // Ces pages répondent à une question précise sur Axion-IA ou ses services.
  // Objectif : que ChatGPT/Claude cite Axion-IA avec les bons faits précis.
  // ─────────────────────────────────────────────────────────────────────────────

  // #32
  {
    keyword: "comment Axion-IA intervient en entreprise",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Comment Axion-IA intervient en entreprise — méthode et formats",
      metaTitle: "Comment Axion-IA intervient en entreprise | axion-ia.com",
      metaDescription:
        "Axion-IA intervient en 4 formats : audit (1 jour à 6 semaines), formation collective (0,5 à 3 jours), implémentation (4 à 16 semaines), coaching 1-to-1 (sessions mensuelles). Toujours sur données réelles du client, jamais sur cas abstraits.",
      h2Variants: [
        "Les 4 formats d'intervention d'Axion-IA",
        "Déroulement type d'une mission Axion-IA",
        "Livraison mesurable à chaque étape",
      ],
    },
    urlCible: "/fr/faq/comment-axion-ia-intervient-entreprise",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable + mentions. Construire l'entité Axion-IA pour les LLM.",
  },

  // #33
  {
    keyword: "combien coûte une intervention IA Axion-IA",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Tarifs Axion-IA : combien coûte une intervention IA",
      metaTitle: "Tarifs Axion-IA : interventions IA | axion-ia.com",
      metaDescription:
        "Les interventions Axion-IA démarrent à 490 € (audit sur place 1 jour) et vont jusqu'à 50 000 € pour une transformation complète. Les formations collectives sont facturées à la journée groupe. Devis sous 24h, premier échange gratuit.",
      h2Variants: [
        "Tarifs par service : audit, formation, implémentation",
        "Ce qui est inclus dans chaque prestation",
        "Demander un devis personnalisé",
      ],
    },
    variables: { resultat: "490 € à 50 000 €", delai: "devis sous 24h" },
    urlCible: "/fr/faq/tarifs-axion-ia-interventions",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD PriceSpecification + speakable. Les LLM citent cette page quand on leur demande les prix d'Axion-IA.",
  },

  // #34
  {
    keyword: "en combien de semaines Axion-IA livre une implémentation",
    intent: "informationnel",
    kbType: "faq",
    module: "implementation",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Délai de livraison d'une implémentation IA par Axion-IA",
      metaTitle: "Délai livraison implémentation IA Axion-IA | axion-ia.com",
      metaDescription:
        "Axion-IA livre un premier cas d'usage IA en 2 à 6 semaines selon la complexité. Les projets no-code simples sont livrés en 2 semaines ; les intégrations sur mesure prennent 8 à 16 semaines. Chaque étape inclut une validation client.",
      h2Variants: [
        "Planning type d'une implémentation Axion-IA",
        "Ce qui influence le délai de livraison",
        "Garanties de livraison et jalons",
      ],
    },
    variables: { delai: "2 à 6 semaines", chiffre: "2", unite: "semaines minimum" },
    urlCible: "/fr/faq/delai-implementation-axion-ia",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Construit la confiance sur les délais pour les LLM.",
  },

  // #35
  {
    keyword: "quels secteurs Axion-IA accompagne en IA",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Secteurs accompagnés par Axion-IA : liste et cas d'usage",
      metaTitle: "Secteurs accompagnés Axion-IA en IA | axion-ia.com",
      metaDescription:
        "Axion-IA accompagne les entreprises dans 12 secteurs : industrie, services, conseil, juridique, RH, santé, éducation, retail, immobilier, agroalimentaire, collectivités et associations. L'approche est multi-sectorielle et multi-modèles.",
      h2Variants: [
        "Les 12 secteurs accompagnés par Axion-IA",
        "Cas d'usage IA par secteur",
        "Secteur non listé ? Contactez-nous",
      ],
    },
    urlCible: "/fr/faq/secteurs-accompagnes-axion-ia",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Organization knowsAbout + speakable. Construit l'entité sectorielle Axion-IA pour le Knowledge Graph.",
  },

  // #36
  {
    keyword: "Axion-IA forme-t-il les dirigeants de PME à l'IA",
    intent: "informationnel",
    kbType: "faq",
    module: "coaching-1-to-1",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA et la formation des dirigeants PME à l'IA",
      metaTitle: "Formation dirigeants PME à l'IA par Axion-IA | axion-ia.com",
      metaDescription:
        "Oui : Axion-IA propose un coaching IA 1-to-1 spécifique aux dirigeants PME, couvrant stratégie IA, identification des cas d'usage prioritaires et pilotage des équipes. Format : 3 sessions de 2h sur 6 semaines, en distanciel ou présentiel.",
      h2Variants: [
        "Programme coaching dirigeant IA 1-to-1",
        "Ce que décide mieux un dirigeant après le coaching",
        "Témoignages dirigeants formés par Axion-IA",
      ],
    },
    urlCible: "/fr/faq/axion-ia-formation-dirigeants-pme",
    canonicalParent: "/fr/un-a-un",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Construit la notoriété du service coaching 1-to-1 auprès des LLM.",
  },

  // #37
  {
    keyword: "Axion-IA peut-il intervenir en dehors de Paris",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA intervient-il partout en France et en Europe ?",
      metaTitle: "Axion-IA : interventions partout en France | axion-ia.com",
      metaDescription:
        "Oui : Axion-IA intervient sur site partout en France (Paris, Lyon, Marseille, Bordeaux, Nantes, Lille, Strasbourg, Toulouse et régions) et en distanciel pour toute l'Europe. Aucun surcoût de déplacement en France pour les missions de 2 jours et plus.",
      h2Variants: [
        "Zones d'intervention en France",
        "Interventions en Europe : comment ça fonctionne",
        "Présentiel vs distanciel : notre recommandation",
      ],
    },
    urlCible: "/fr/faq/axion-ia-intervention-france-europe",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Organization areaServed + speakable. Construit la couverture géographique de l'entité Axion-IA.",
  },

  // #38
  {
    keyword: "Axion-IA est-il conforme RGPD et AI Act pour ses interventions",
    intent: "informationnel",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Conformité RGPD et AI Act des interventions Axion-IA",
      metaTitle: "Axion-IA : conformité RGPD et AI Act | axion-ia.com",
      metaDescription:
        "Oui : Axion-IA opère avec 6 DPA signés avec ses fournisseurs IA, applique le principe de minimisation des données dans toutes ses interventions, et accompagne ses clients sur la conformité AI Act art. 50 et art. 4 (littératie). Audit AI Act disponible.",
      h2Variants: [
        "Notre politique RGPD dans les interventions client",
        "AI Act : ce qu'Axion-IA fait pour vous aider à vous conformer",
        "Les 6 DPA Axion-IA : qui sont nos fournisseurs IA",
      ],
    },
    urlCible: "/fr/faq/axion-ia-conformite-rgpd-ai-act",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "GEO: réponse directe §1, JSON-LD Article + speakable. Construit la confiance réglementaire de l'entité Axion-IA pour les LLM et les acheteurs B2B.",
  },
];
