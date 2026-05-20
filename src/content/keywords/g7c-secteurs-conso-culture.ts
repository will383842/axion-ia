/**
 * Keyword Seeds — Mode G Phase 7C : Secteurs Conso & Culture (9 secteurs × 8 seeds = 72 seeds)
 *
 * Généré 2026-05-20 · PROMPT-KEYWORD-STRATEGY-MASTER-V1 v1.2
 *
 * Secteurs couverts :
 *   1. viticulture-haut-de-gamme
 *   2. logistique-supply-chain
 *   3. distribution-grande-conso
 *   4. mode-luxe-maroquinerie
 *   5. cosmetique-beaute
 *   6. tourisme-affaires
 *   7. arts-creatif-design
 *   8. enseignement-recherche
 *   9. administration-publique
 *
 * Export : KW_SECTEURS_G7C (all seeds)
 * Règle niveau/priorité : niveau 1 + priorite 1 = INTERDIT.
 * Règle R5 : h1 ≠ keyword brut.
 * metaTitle ≤ 60 chars · metaDescription ≤ 155 chars.
 */

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 1 — VITICULTURE HAUT DE GAMME (8 seeds)
// URL cible : /fr/secteurs/viticulture-haut-de-gamme
// Slug secteur canonique : "viticulture-haut-de-gamme"
// ─────────────────────────────────────────────────────────────────────────────

const KW_VITICULTURE: KeywordSeed[] = [
  {
    keyword: "IA pour domaine viticole France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "viticulture-haut-de-gamme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA dans les domaines viticoles : traçabilité, export et marketing automatisés",
      metaTitle: "IA pour domaine viticole France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les domaines viticoles premium dans l'adoption de l'IA : notes de dégustation, export, CRM caves. ROI mesuré en 30 jours.",
      h2Variants: [
        "Quels processus automatiser dans un domaine viticole ?",
        "IA et traçabilité vitivinicole : conformité et storytelling",
        "Export vins premium : comment l'IA accélère la prospection",
      ],
    },
    variables: {
      process: "admin export, CRM et marketing vin",
      resultat: "-40 % temps tâches administratives",
      chiffre: "40",
      unite: "%",
      delai: "en 30 jours",
    },
    urlCible: "/fr/secteurs/viticulture-haut-de-gamme",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: FoodEstablishment + LocalBusiness ; mots secondaires : logiciel IA cave vins",
  },
  {
    keyword: "automatiser notes de dégustation IA vins",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "viticulture-haut-de-gamme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Générer des notes de dégustation avec l'IA : cohérence et gain de temps pour vos œnologues",
      metaTitle: "Automatiser notes dégustation IA vins — Axion-IA",
      metaDescription:
        "Pipeline IA pour rédiger des notes de dégustation précises, cohérentes et multilingues. Déployé par Axion-IA pour domaines et négociants.",
      h2Variants: [
        "Comment l'IA rédige des notes de dégustation professionnelles",
        "Multilingue : traduire et adapter vos notes pour l'export",
        "Validation œnologue : l'IA assiste, l'expert signe",
      ],
    },
    variables: {
      process: "rédaction notes de dégustation",
      resultat: "100 notes rédigées en 1 heure",
      chiffre: "100",
      unite: "notes / heure",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/viticulture-haut-de-gamme",
    canonicalParent: "/fr/secteurs/viticulture-haut-de-gamme",
    source: "manuel",
  },
  {
    keyword: "formation IA négociant vins fins",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    secteur: "viticulture-haut-de-gamme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour négociants en vins fins : CRM, prospection et storytelling augmentés",
      metaTitle: "Formation IA négociant vins fins — Axion-IA",
      metaDescription:
        "Formation IA sur mesure pour les équipes de négoce viticole : CRM IA, génération d'offres, suivi acheteurs internationaux. 1 jour sur site.",
      h2Variants: [
        "Programme formation IA négoce vins — contenu et durée",
        "IA et relation acheteur international : meilleures pratiques",
        "Outils IA recommandés pour les négociants en vins premium",
      ],
    },
    variables: {
      process: "CRM et prospection négoce viticole",
      resultat: "+30 % contacts acheteurs qualifiés",
      chiffre: "30",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/interventions-formations/viticulture",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "IA marketing vins premium export",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "viticulture-haut-de-gamme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Marketing vins premium à l'export avec l'IA : contenus, ciblage et conversion accélérés",
      metaTitle: "IA marketing vins premium export — Axion-IA",
      metaDescription:
        "Fiches produits multilingues, campagnes email et ciblage marchés export : comment l'IA booste le marketing des vins haut de gamme.",
      h2Variants: [
        "IA et fiches produits vins premium multilingues",
        "Cibler les marchés export avec l'IA : USA, Asie, Europe",
        "Mesurer le ROI des campagnes marketing IA vins",
      ],
    },
    urlCible: "/fr/secteurs/viticulture-haut-de-gamme",
    canonicalParent: "/fr/secteurs/viticulture-haut-de-gamme",
    source: "manuel",
  },
  {
    keyword: "audit IA cave viticole haut de gamme",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "viticulture-haut-de-gamme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA cave et domaine viticole : identifier 3 gains rapides en 48 h",
      metaTitle: "Audit IA cave viticole — Axion-IA France",
      metaDescription:
        "Axion-IA audite les processus de votre cave ou domaine viticole et identifie les automatisations à ROI rapide. Rapport livré en 48 h.",
      h2Variants: [
        "Déroulé d'un audit IA domaine viticole en 48 h",
        "Processus viticoles les plus automatisables",
        "Ce que contient votre rapport d'audit IA cave",
      ],
    },
    variables: {
      process: "audit processus cave viticole",
      resultat: "3 quick wins identifiés",
      chiffre: "3",
      unite: "quick wins",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/viticulture",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "quelle IA pour un domaine viticole ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "viticulture-haut-de-gamme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quelle IA adopter dans un domaine viticole haut de gamme ? Guide 2026",
      metaTitle: "Quelle IA pour un domaine viticole ? — Axion-IA",
      metaDescription:
        "LLM, automatisation CRM, notes de dégustation, marketing export : le guide complet de l'IA pour les domaines viticoles et caves premium.",
      h2Variants: [
        "Les 5 usages IA prioritaires dans un domaine viticole",
        "Coût et délai d'implémentation d'une solution IA en cave",
        "Quels outils IA pour les équipes commerciales et marketing vin ?",
      ],
    },
    urlCible: "/fr/secteurs/viticulture-haut-de-gamme",
    canonicalParent: "/fr/secteurs/viticulture-haut-de-gamme",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA viticulture secteur vins",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "pme",
    secteur: "viticulture-haut-de-gamme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA dédié au secteur vitivinicole français",
      metaTitle: "Agence IA viticulture vins France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne domaines, caves et négociants en vins dans leur transformation IA : audit, formation, implémentation sur mesure.",
      h2Variants: [
        "Pourquoi choisir un cabinet IA spécialisé viticulture ?",
        "Nos déploiements IA dans le secteur des vins et spiritueux",
        "Services IA pour domaines de 2 à 50 salariés",
      ],
    },
    urlCible: "/fr/secteurs/viticulture-haut-de-gamme",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "ROI IA domaine viticole",
    intent: "sectoriel",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    secteur: "viticulture-haut-de-gamme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "ROI de l'IA dans un domaine viticole : chiffres réels 2026",
      metaTitle: "ROI IA domaine viticole — Axion-IA France",
      metaDescription:
        "Calculez le retour sur investissement de l'IA pour votre domaine viticole : marketing, export, admin. Benchmarks issus de déploiements réels.",
      h2Variants: [
        "Modèle de calcul ROI IA pour domaines viticoles",
        "Délai de retour sur investissement IA en viticulture",
        "Comparaison ROI par taille de domaine et typologie",
      ],
    },
    variables: {
      process: "ensemble processus domaine viticole",
      resultat: "ROI positif en 4 mois",
      chiffre: "4",
      unite: "mois",
      delai: "dès le 4e mois",
    },
    urlCible: "/fr/secteurs/viticulture-haut-de-gamme",
    canonicalParent: "/fr/secteurs/viticulture-haut-de-gamme",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 2 — LOGISTIQUE & SUPPLY CHAIN (8 seeds)
// URL cible : /fr/secteurs/logistique-supply-chain
// Slug secteur canonique : "logistique-supply-chain"
// ─────────────────────────────────────────────────────────────────────────────

const KW_LOGISTIQUE: KeywordSeed[] = [
  {
    keyword: "IA pour prestataire logistique France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "eti",
    secteur: "logistique-supply-chain",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA chez les prestataires logistiques : optimisation entrepôts, transport et prévision",
      metaTitle: "IA prestataire logistique France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les 3PL et transporteurs dans l'adoption de l'IA : prévision demande, routage, gestion entrepôt. ROI en 6 semaines.",
      h2Variants: [
        "Quels processus logistiques automatiser avec l'IA en priorité ?",
        "IA et gestion des flux entrepôt : WMS augmenté",
        "Supply chain prédictive : anticiper les ruptures avec l'IA",
      ],
    },
    variables: {
      process: "pilotage opérations logistiques",
      resultat: "-25 % coûts de transport et stockage",
      chiffre: "25",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/logistique-supply-chain",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: MovingCompany + FAQPage",
  },
  {
    keyword: "automatiser prévision de la demande IA logistique",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "logistique-supply-chain",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Prévision de la demande avec l'IA : ruptures évitées, stocks optimisés",
      metaTitle: "Prévision demande IA logistique — Axion-IA France",
      metaDescription:
        "Pipeline IA pour anticiper la demande et optimiser les stocks : -30 % de ruptures, -20 % de surstocks. Déployé par Axion-IA en 6 semaines.",
      h2Variants: [
        "Comment l'IA prédit la demande logistique",
        "Intégration avec votre ERP et WMS existants",
        "Mesurer la précision de prévision IA vs méthode classique",
      ],
    },
    variables: {
      process: "prévision demande et gestion stocks",
      resultat: "-30 % ruptures de stock",
      chiffre: "30",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/logistique-supply-chain",
    canonicalParent: "/fr/secteurs/logistique-supply-chain",
    source: "manuel",
  },
  {
    keyword: "formation IA supply chain managers",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "eti",
    secteur: "logistique-supply-chain",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour supply chain managers : piloter la chaîne logistique intelligente",
      metaTitle: "Formation IA supply chain managers — Axion-IA",
      metaDescription:
        "Formation IA sur mesure pour responsables logistique et supply chain : prévision, optimisation routes, gestion fournisseurs. Cas concrets secteur.",
      h2Variants: [
        "Programme formation IA supply chain — contenu et durée",
        "IA et gestion des risques fournisseurs",
        "Exercices pratiques : votre propre flux logistique en cas d'usage",
      ],
    },
    variables: {
      process: "pilotage supply chain",
      resultat: "équipe opérationnelle IA en 2 jours",
      chiffre: "2",
      unite: "jours",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/logistique",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "optimiser tournées transport IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "logistique-supply-chain",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Optimiser vos tournées transport avec l'IA : -15 % de kilomètres, mêmes délais",
      metaTitle: "Optimiser tournées transport IA — Axion-IA France",
      metaDescription:
        "Routage IA dynamique pour transporteurs et 3PL : -15 % kilomètres, livraisons à l'heure, adaptation trafic en temps réel. Déployé par Axion-IA.",
      h2Variants: [
        "Comment l'IA calcule les tournées de livraison optimales",
        "Adaptation dynamique aux aléas : trafic, annulations, météo",
        "Intégration routage IA avec votre TMS existant",
      ],
    },
    variables: {
      process: "planification et optimisation tournées",
      resultat: "-15 % kilométrage, +10 % ponctualité",
      chiffre: "15",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/logistique-supply-chain",
    canonicalParent: "/fr/secteurs/logistique-supply-chain",
    source: "manuel",
  },
  {
    keyword: "audit IA entrepôt logistique 3PL",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "eti",
    secteur: "logistique-supply-chain",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA entrepôt et logistique 3PL : vos 5 gains prioritaires en 48 h",
      metaTitle: "Audit IA entrepôt logistique 3PL — Axion-IA",
      metaDescription:
        "Axion-IA audite vos flux logistiques et identifie les automatisations IA à ROI rapide : picking, prévision, transport. Rapport en 48 h.",
      h2Variants: [
        "Déroulé de l'audit IA logistique en 48 h",
        "Processus entrepôt les plus automatisables avec l'IA",
        "Feuille de route post-audit : par où commencer ?",
      ],
    },
    variables: {
      process: "audit opérations logistiques",
      resultat: "5 automations prioritaires identifiées",
      chiffre: "5",
      unite: "automations",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/logistique",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "comment l'IA réduit les coûts logistiques ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "logistique-supply-chain",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA réduit les coûts logistiques ? Benchmarks réels 2026",
      metaTitle: "Comment l'IA réduit les coûts logistiques ? — Axion-IA",
      metaDescription:
        "Prévision, routage, gestion entrepôt : les 5 leviers IA qui réduisent les coûts logistiques de 15 à 30 % selon notre benchmark.",
      h2Variants: [
        "Prévision IA : réduire surstocks et ruptures",
        "Routage IA : économies de carburant et de temps conducteur",
        "ROI moyen IA logistique : notre benchmark 2026",
      ],
    },
    urlCible: "/fr/secteurs/logistique-supply-chain",
    canonicalParent: "/fr/secteurs/logistique-supply-chain",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA transport logistique France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "eti",
    secteur: "logistique-supply-chain",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA expert transport et logistique",
      metaTitle: "Agence IA transport logistique France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les acteurs de la logistique et du transport dans leur transformation IA : audit, formation, implémentation sur mesure.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé logistique ?",
        "Références secteur transport et supply chain",
        "Services IA pour 3PL, transporteurs et prestataires logistiques",
      ],
    },
    urlCible: "/fr/secteurs/logistique-supply-chain",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "IA supply chain résiliente France",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "transversal",
    cible: "grand-compte",
    secteur: "logistique-supply-chain",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Supply chain résiliente grâce à l'IA : anticiper les chocs et adapter les flux en temps réel",
      metaTitle: "IA supply chain résiliente France — Axion-IA",
      metaDescription:
        "Comment les grands comptes français utilisent l'IA pour rendre leur supply chain résiliente : anticipation chocs, scénarios alternatifs, agilité.",
      h2Variants: [
        "IA et résilience supply chain : use cases France 2026",
        "Modélisation de scénarios IA pour supply chain",
        "Gouvernance et données supply chain IA conforme RGPD",
      ],
    },
    urlCible: "/fr/secteurs/logistique-supply-chain",
    canonicalParent: "/fr/secteurs/logistique-supply-chain",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 3 — DISTRIBUTION GRANDE CONSO (8 seeds)
// URL cible : /fr/secteurs/distribution-grande-conso
// Slug secteur canonique : "distribution-grande-conso"
// ─────────────────────────────────────────────────────────────────────────────

const KW_DISTRIBUTION: KeywordSeed[] = [
  {
    keyword: "IA pour distributeur grande distribution France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "eti",
    secteur: "distribution-grande-conso",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA dans la grande distribution : assortiment, pricing et prévision automatisés",
      metaTitle: "IA grande distribution France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les distributeurs et GMS dans l'adoption de l'IA : assortiment, prévision, pricing dynamique. ROI en 6 semaines.",
      h2Variants: [
        "Quels processus de distribution automatiser avec l'IA ?",
        "IA et pricing dynamique GMS : conformité DGCCRF",
        "Prévision des ventes GMS avec l'IA : précision et gains",
      ],
    },
    variables: {
      process: "assortiment, prévision et pricing GMS",
      resultat: "+15 % CA à périmètre constant",
      chiffre: "15",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/distribution-grande-conso",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "automatiser négociation centrales achat IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "distribution-grande-conso",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Préparer et optimiser les négociations centrales d'achat avec l'IA",
      metaTitle: "IA négociation centrales achat — Axion-IA France",
      metaDescription:
        "Analyse concurrence, argumentation chiffrée, simulation scenarios : comment l'IA prépare vos négociations avec les centrales d'achat GMS.",
      h2Variants: [
        "Données IA pour renforcer votre position en négociation centrale",
        "Simulation de scénarios de remise avec l'IA",
        "Conformité et documentation des accords avec l'aide de l'IA",
      ],
    },
    urlCible: "/fr/secteurs/distribution-grande-conso",
    canonicalParent: "/fr/secteurs/distribution-grande-conso",
    source: "manuel",
  },
  {
    keyword: "formation IA catégorie managers GMS",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "eti",
    secteur: "distribution-grande-conso",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour category managers et acheteurs GMS : analyser, décider plus vite",
      metaTitle: "Formation IA category managers GMS — Axion-IA",
      metaDescription:
        "Formation IA dédiée aux category managers et acheteurs de la grande distribution : analyse données, optimisation assortiment, pricing. 1 jour.",
      h2Variants: [
        "Programme formation IA category management — contenu",
        "IA et analyse données sell-out : pratique sur vos propres données",
        "Outils IA recommandés pour les catégories GMS",
      ],
    },
    variables: {
      process: "category management et pricing",
      resultat: "décisions assortiment 3× plus rapides",
      chiffre: "3",
      unite: "×",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/distribution",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "IA prévision ventes grandes surfaces",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "distribution-grande-conso",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Prévision des ventes en grandes surfaces avec l'IA : -20 % de ruptures",
      metaTitle: "IA prévision ventes grandes surfaces — Axion-IA",
      metaDescription:
        "Modèles IA de prévision des ventes GMS : données historiques, saisonnalité, promotions, météo intégrés. Déployé par Axion-IA pour distributeurs.",
      h2Variants: [
        "Comment l'IA prédit les ventes en GMS avec précision",
        "Réduire les ruptures et surstocks avec la prévision IA",
        "Intégration prévision IA avec votre ERP distribution",
      ],
    },
    variables: {
      process: "prévision ventes et gestion commandes",
      resultat: "-20 % ruptures en rayon",
      chiffre: "20",
      unite: "%",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/distribution-grande-conso",
    canonicalParent: "/fr/secteurs/distribution-grande-conso",
    source: "manuel",
  },
  {
    keyword: "audit IA processus distribution grossiste",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "eti",
    secteur: "distribution-grande-conso",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA distribution et négoce : cartographier vos 4 gains en 48 h",
      metaTitle: "Audit IA distribution grossiste — Axion-IA France",
      metaDescription:
        "Axion-IA audite vos processus de distribution et de négoce et identifie les automatisations à ROI rapide. Rapport livré en 48 h.",
      h2Variants: [
        "Déroulé de l'audit IA distribution en 48 h",
        "Processus de distribution les plus automatisables",
        "Feuille de route IA distribution post-audit",
      ],
    },
    variables: {
      process: "audit processus distribution",
      resultat: "4 automations prioritaires",
      chiffre: "4",
      unite: "automations",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/distribution",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "quelle IA pour la grande consommation ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "distribution-grande-conso",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quelle IA adopter dans la grande distribution et la grande conso ? Guide 2026",
      metaTitle: "Quelle IA pour la grande consommation ? — Axion-IA",
      metaDescription:
        "Prévision ventes, pricing, catégories, supply chain : les 6 usages IA prioritaires pour les acteurs de la grande distribution.",
      h2Variants: [
        "Les 6 usages IA prioritaires en grande distribution",
        "Coût et délai d'implémentation d'une solution IA GMS",
        "Quels critères pour choisir son partenaire IA distribution ?",
      ],
    },
    urlCible: "/fr/secteurs/distribution-grande-conso",
    canonicalParent: "/fr/secteurs/distribution-grande-conso",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA grande distribution France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "eti",
    secteur: "distribution-grande-conso",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA expert grande distribution et négoce",
      metaTitle: "Agence IA grande distribution France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne GMS, grossistes et centrales d'achat dans leur transformation IA : audit, formation, implémentation sur mesure.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé grande distribution ?",
        "Nos déploiements IA dans le négoce et la distribution",
        "Services IA pour acteurs de la grande conso",
      ],
    },
    urlCible: "/fr/secteurs/distribution-grande-conso",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "IA et merchandising intelligent grande surface",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "grand-compte",
    secteur: "distribution-grande-conso",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Merchandising intelligent avec l'IA en grande surface : optimiser linéaires et CA au m²",
      metaTitle: "IA merchandising grande surface — Axion-IA",
      metaDescription:
        "Allocation de linéaires, planogrammes et rotations produits optimisés par IA : comment les grandes surfaces améliorent leur CA au m².",
      h2Variants: [
        "Comment l'IA optimise les planogrammes GMS",
        "IA et analyse comportement acheteur en magasin",
        "ROI du merchandising IA : résultats mesurés en GMS",
      ],
    },
    urlCible: "/fr/secteurs/distribution-grande-conso",
    canonicalParent: "/fr/secteurs/distribution-grande-conso",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 4 — MODE, LUXE & MAROQUINERIE (8 seeds)
// URL cible : /fr/secteurs/mode-luxe-maroquinerie
// Slug secteur canonique : "mode-luxe-maroquinerie"
// ─────────────────────────────────────────────────────────────────────────────

const KW_MODE_LUXE: KeywordSeed[] = [
  {
    keyword: "IA pour marque de luxe France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "eti",
    secteur: "mode-luxe-maroquinerie",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA dans les maisons de luxe françaises : création, service client et traçabilité augmentés",
      metaTitle: "IA pour marque de luxe France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les maisons de luxe et les marques premium dans l'adoption de l'IA : storytelling, personnalisation VIC, traçabilité artisanale.",
      h2Variants: [
        "IA et expérience client luxe : personnalisation sans compromis",
        "Traçabilité IA pour les pièces haut de gamme et maroquinerie",
        "Comment le luxe français intègre l'IA sans trahir son ADN",
      ],
    },
    variables: {
      process: "service client VIC et storytelling produit",
      resultat: "+25 % engagement client VIC",
      chiffre: "25",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/mode-luxe-maroquinerie",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: ClothingStore + Article ; angle : IA au service de l'artisanat d'exception",
  },
  {
    keyword: "automatiser fiches produit luxe maroquinerie IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "mode-luxe-maroquinerie",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Générer des fiches produit luxe avec l'IA : précision artisanale, volume industriel",
      metaTitle: "Fiches produit luxe IA maroquinerie — Axion-IA",
      metaDescription:
        "Descriptions produits premium multilingues générées par IA : ton luxe, spécifications matières, histoire artisanale. Déployé par Axion-IA.",
      h2Variants: [
        "Comment l'IA préserve le ton et l'ADN de la marque luxe",
        "Fiches produit multilingues : cohérence internationale garantie",
        "Validation équipe créative : workflow IA + directeur artistique",
      ],
    },
    variables: {
      process: "rédaction fiches produits et catalogues",
      resultat: "500 fiches produits en 1 journée",
      chiffre: "500",
      unite: "fiches / jour",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/mode-luxe-maroquinerie",
    canonicalParent: "/fr/secteurs/mode-luxe-maroquinerie",
    source: "manuel",
  },
  {
    keyword: "formation IA équipe retail luxe",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "eti",
    secteur: "mode-luxe-maroquinerie",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour équipes retail luxe : personnalisation VIC et service d'exception",
      metaTitle: "Formation IA équipe retail luxe — Axion-IA",
      metaDescription:
        "Formation IA sur mesure pour conseillers de vente luxe : recommandation produit IA, gestion VIC, communication haut de gamme. Présentiel boutique.",
      h2Variants: [
        "Programme formation IA retail luxe — contenu détaillé",
        "IA et clienteling : personnaliser sans déshumaniser",
        "Outils IA pour conseillers de vente haut de gamme",
      ],
    },
    variables: {
      process: "clienteling et recommandation produit VIC",
      resultat: "+20 % panier moyen VIC",
      chiffre: "20",
      unite: "%",
      delai: "en 30 jours",
    },
    urlCible: "/fr/interventions-formations/luxe",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "IA traçabilité mode durable luxe",
    intent: "sectoriel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    secteur: "mode-luxe-maroquinerie",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Traçabilité mode et luxe avec l'IA : passeport numérique produit et durabilité",
      metaTitle: "IA traçabilité mode luxe durable — Axion-IA France",
      metaDescription:
        "Passeport produit numérique, traçabilité matières, conformité textile durabilité : comment l'IA renforce l'authenticité et la conformité réglementaire.",
      h2Variants: [
        "Passeport numérique produit luxe : comment le déployer avec l'IA",
        "Conformité réglementaire textile durable : ce qu'exige la loi 2026",
        "IA et lutte contre la contrefaçon : vérification authenticité",
      ],
    },
    urlCible: "/fr/secteurs/mode-luxe-maroquinerie",
    canonicalParent: "/fr/secteurs/mode-luxe-maroquinerie",
    source: "manuel",
  },
  {
    keyword: "audit IA maison mode luxe",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "eti",
    secteur: "mode-luxe-maroquinerie",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA maison de mode et luxe : vos 4 leviers prioritaires en 48 h",
      metaTitle: "Audit IA maison mode luxe — Axion-IA France",
      metaDescription:
        "Axion-IA audite les processus des maisons de mode et de luxe et identifie les automatisations à ROI rapide. Rapport livré en 48 h.",
      h2Variants: [
        "Déroulé de l'audit IA maison de luxe en 48 h",
        "Processus mode et luxe les plus automatisables",
        "Ce que contient votre rapport d'audit IA luxe",
      ],
    },
    variables: {
      process: "audit opérations mode et luxe",
      resultat: "4 leviers IA prioritaires",
      chiffre: "4",
      unite: "leviers",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/luxe",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "comment utiliser l'IA dans le secteur du luxe ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "mode-luxe-maroquinerie",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment utiliser l'IA dans le secteur du luxe sans perdre son âme ? Guide 2026",
      metaTitle: "Comment utiliser l'IA dans le luxe ? — Axion-IA",
      metaDescription:
        "Personnalisation, storytelling, traçabilité, service VIC : les 5 usages IA qui renforcent l'excellence des maisons de luxe sans la trahir.",
      h2Variants: [
        "IA et ADN de marque luxe : la compatibilité est possible",
        "5 cas d'usage IA dans les maisons de luxe en 2026",
        "Quels risques IA pour le luxe et comment les éviter ?",
      ],
    },
    urlCible: "/fr/secteurs/mode-luxe-maroquinerie",
    canonicalParent: "/fr/secteurs/mode-luxe-maroquinerie",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA mode luxe maroquinerie",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "eti",
    secteur: "mode-luxe-maroquinerie",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA expert mode, luxe et maroquinerie",
      metaTitle: "Agence IA mode luxe maroquinerie — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les maisons de luxe, marques de mode et ateliers maroquinerie dans leur transformation IA sur mesure.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé luxe et mode ?",
        "Nos références secteur luxe et maroquinerie",
        "Services IA pour maisons de 10 à 500 collaborateurs",
      ],
    },
    urlCible: "/fr/secteurs/mode-luxe-maroquinerie",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "IA personnalisation clienteling haute couture",
    intent: "sectoriel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "grand-compte",
    secteur: "mode-luxe-maroquinerie",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Personnalisation clienteling haute couture avec l'IA : connaître chaque VIC parfaitement",
      metaTitle: "IA clienteling haute couture — Axion-IA France",
      metaDescription:
        "Historique achat, préférences stylistiques, événements personnels : l'IA enrichit le profil VIC pour un service haute couture incomparable.",
      h2Variants: [
        "Construire le profil VIC enrichi avec l'IA",
        "Recommandation produit IA pour la haute couture",
        "RGPD et données VIC luxe : conformité et confiance",
      ],
    },
    urlCible: "/fr/secteurs/mode-luxe-maroquinerie",
    canonicalParent: "/fr/secteurs/mode-luxe-maroquinerie",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 5 — COSMÉTIQUE & BEAUTÉ (8 seeds)
// URL cible : /fr/secteurs/cosmetique-beaute
// Slug secteur canonique : "cosmetique-beaute"
// ─────────────────────────────────────────────────────────────────────────────

const KW_COSMETIQUE: KeywordSeed[] = [
  {
    keyword: "IA pour marque cosmétique France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "cosmetique-beaute",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA dans les marques cosmétiques : formulation, marketing et réglementation accélérés",
      metaTitle: "IA pour marque cosmétique France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les marques cosmétiques dans l'IA : claim generation, conformité INCI, marketing personnalisé beauté. ROI en 30 jours.",
      h2Variants: [
        "Quels processus cosmétiques automatiser avec l'IA ?",
        "IA et conformité réglementaire cosmétique : INCI et allégations",
        "Marketing beauté personnalisé avec l'IA : cas concrets",
      ],
    },
    variables: {
      process: "marketing, conformité et claims beauté",
      resultat: "-50 % temps rédaction claims produits",
      chiffre: "50",
      unite: "%",
      delai: "en 30 jours",
    },
    urlCible: "/fr/secteurs/cosmetique-beaute",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: LocalBusiness + Article ; mots secondaires : logiciel IA cosmétique, IA beauté",
  },
  {
    keyword: "automatiser claims cosmétiques IA conformité",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "cosmetique-beaute",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Générer et vérifier vos claims cosmétiques avec l'IA : conformité garantie en secondes",
      metaTitle: "Automatiser claims cosmétiques IA — Axion-IA France",
      metaDescription:
        "Pipeline IA pour générer, vérifier et adapter les allégations cosmétiques selon la réglementation UE. Déployé par Axion-IA pour marques beauté.",
      h2Variants: [
        "Comment l'IA génère des claims cosmétiques conformes au règlement EU",
        "Vérification automatique des allégations INCI avec l'IA",
        "Adaptation des claims par marché : internationalisation beauté IA",
      ],
    },
    variables: {
      process: "rédaction et contrôle claims cosmétiques",
      resultat: "claims conformes en 30 secondes",
      chiffre: "30",
      unite: "secondes",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/cosmetique-beaute",
    canonicalParent: "/fr/secteurs/cosmetique-beaute",
    source: "manuel",
  },
  {
    keyword: "formation IA équipe marketing beauté",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    secteur: "cosmetique-beaute",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour équipes marketing beauté : contenus, personnalisation et ROI augmentés",
      metaTitle: "Formation IA marketing beauté cosmétique — Axion-IA",
      metaDescription:
        "Formation IA dédiée aux équipes marketing cosmétique et beauté : génération contenus, personnalisation, analyse data beauté. 1 jour sur site.",
      h2Variants: [
        "Programme formation IA marketing beauté — contenu",
        "IA et réseaux sociaux beauté : créer plus avec moins",
        "Mesurer le ROI des contenus IA dans le marketing beauté",
      ],
    },
    variables: {
      process: "création contenus et personnalisation marketing",
      resultat: "×3 volume de contenus produits",
      chiffre: "3",
      unite: "×",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/cosmetique",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "IA personnalisation beauté recommandation produit",
    intent: "sectoriel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    secteur: "cosmetique-beaute",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Personnalisation beauté avec l'IA : recommander le bon produit à chaque cliente",
      metaTitle: "IA personnalisation beauté recommandation — Axion-IA",
      metaDescription:
        "Moteur de recommandation beauté IA : type de peau, préférences, historique achat. +30 % conversion et panier moyen. Déployé par Axion-IA.",
      h2Variants: [
        "Comment le moteur de recommandation IA beauté fonctionne",
        "Intégration recommandation IA avec votre site e-commerce beauté",
        "RGPD et données beauté : consentement et protection",
      ],
    },
    variables: {
      process: "recommandation produit beauté",
      resultat: "+30 % taux de conversion",
      chiffre: "30",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/cosmetique-beaute",
    canonicalParent: "/fr/secteurs/cosmetique-beaute",
    source: "manuel",
  },
  {
    keyword: "audit IA marque cosmétique distribution beauté",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "cosmetique-beaute",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA marque cosmétique et réseau beauté : 4 leviers de croissance en 48 h",
      metaTitle: "Audit IA marque cosmétique beauté — Axion-IA",
      metaDescription:
        "Axion-IA audite les processus de votre marque cosmétique et réseau de distribution beauté pour identifier les automations à ROI rapide.",
      h2Variants: [
        "Déroulé audit IA cosmétique en 48 h",
        "Processus beauté les plus automatisables avec l'IA",
        "Rapport d'audit IA beauté : ce que vous recevez",
      ],
    },
    variables: {
      process: "audit opérations marque cosmétique",
      resultat: "4 leviers IA identifiés",
      chiffre: "4",
      unite: "leviers",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/cosmetique",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "comment l'IA transforme le secteur cosmétique ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "cosmetique-beaute",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA transforme le secteur cosmétique et beauté en France ? Guide 2026",
      metaTitle: "Comment l'IA transforme le cosmétique ? — Axion-IA",
      metaDescription:
        "Claims, personnalisation, formulation, marketing : les 6 usages IA qui changent la donne dans le secteur cosmétique et beauté français.",
      h2Variants: [
        "6 usages IA concrets dans les marques cosmétiques",
        "IA et réglementation cosmétique : alliée ou risque ?",
        "ROI moyen IA pour une marque cosmétique PME",
      ],
    },
    urlCible: "/fr/secteurs/cosmetique-beaute",
    canonicalParent: "/fr/secteurs/cosmetique-beaute",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA cosmétique beauté France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "pme",
    secteur: "cosmetique-beaute",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA expert secteur cosmétique et beauté",
      metaTitle: "Agence IA cosmétique beauté France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les marques cosmétiques et réseaux de distribution beauté dans leur transformation IA. Audit, formation, implémentation.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé cosmétique ?",
        "Nos déploiements IA dans le secteur beauté",
        "Services IA pour marques cosmétiques et instituts",
      ],
    },
    urlCible: "/fr/secteurs/cosmetique-beaute",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "IA génération contenu beauté réseaux sociaux",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "cosmetique-beaute",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Générer vos contenus beauté pour les réseaux sociaux avec l'IA : ×5 en volume",
      metaTitle: "IA contenus beauté réseaux sociaux — Axion-IA France",
      metaDescription:
        "Captions Instagram, scripts TikTok, newsletters : pipeline IA pour produire vos contenus beauté en masse sans perdre l'authenticité de marque.",
      h2Variants: [
        "Pipeline IA contenu beauté Instagram et TikTok",
        "Garder l'authenticité de marque dans les contenus IA",
        "Mesurer l'engagement des contenus IA vs contenus manuels",
      ],
    },
    variables: {
      process: "création contenus social media beauté",
      resultat: "×5 volume contenus publiés",
      chiffre: "5",
      unite: "×",
      delai: "en 2 semaines",
    },
    urlCible: "/fr/secteurs/cosmetique-beaute",
    canonicalParent: "/fr/secteurs/cosmetique-beaute",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 6 — TOURISME D'AFFAIRES (8 seeds)
// URL cible : /fr/secteurs/tourisme-affaires
// Slug secteur canonique : "tourisme-affaires"
// ─────────────────────────────────────────────────────────────────────────────

const KW_TOURISME: KeywordSeed[] = [
  {
    keyword: "IA pour hôtel affaires France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "tourisme-affaires",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA dans les hôtels d'affaires : revenue management, service client et ops automatisés",
      metaTitle: "IA pour hôtel affaires France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les hôtels d'affaires dans l'adoption de l'IA : revenue management, chatbot concierge, check-in automatique. ROI en 30 jours.",
      h2Variants: [
        "Quels processus hôteliers automatiser avec l'IA en priorité ?",
        "IA et revenue management hôtel affaires",
        "Expérience client hôtel affaires améliorée par l'IA",
      ],
    },
    variables: {
      process: "revenue management et service hôtel",
      resultat: "+12 % RevPAR avec IA",
      chiffre: "12",
      unite: "% RevPAR",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/tourisme-affaires",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: Hotel + FAQPage",
  },
  {
    keyword: "automatiser organisation événement MICE IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "tourisme-affaires",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Organiser vos événements MICE avec l'IA : de la conception à la logistique automatisée",
      metaTitle: "Automatiser organisation événement MICE IA — Axion-IA",
      metaDescription:
        "Pipeline IA pour la gestion d'événements d'affaires : propositions commerciales, logistique, invitations, suivi participants. Déployé par Axion-IA.",
      h2Variants: [
        "Comment l'IA génère des propositions commerciales MICE complètes",
        "Logistique événementielle automatisée avec l'IA",
        "Suivi et relance participants par IA : satisfaction maximisée",
      ],
    },
    variables: {
      process: "organisation logistique événements MICE",
      resultat: "-60 % temps préparation événementiel",
      chiffre: "60",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/tourisme-affaires",
    canonicalParent: "/fr/secteurs/tourisme-affaires",
    source: "manuel",
  },
  {
    keyword: "formation IA travel manager entreprise",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "eti",
    secteur: "tourisme-affaires",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour travel managers : optimiser les déplacements pro et réduire les coûts",
      metaTitle: "Formation IA travel manager entreprise — Axion-IA",
      metaDescription:
        "Formation IA pour travel managers et responsables voyages d'affaires : négociation automatisée, suivi budget, reporting. 1 jour sur site.",
      h2Variants: [
        "Programme formation IA travel management — contenu",
        "IA et gestion politique voyages d'entreprise",
        "Outils IA pour travel managers en 2026",
      ],
    },
    variables: {
      process: "gestion voyages d'affaires",
      resultat: "-20 % budget voyages d'affaires",
      chiffre: "20",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/interventions-formations/tourisme-affaires",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "chatbot concierge hôtel IA",
    intent: "sectoriel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    secteur: "tourisme-affaires",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Chatbot concierge IA pour hôtels d'affaires : répondre 24h/24 sans personnel supplémentaire",
      metaTitle: "Chatbot concierge hôtel IA — Axion-IA France",
      metaDescription:
        "Chatbot IA concierge pour hôtels : réservations, recommandations, demandes spéciales, check-in. 80 % des demandes traitées en automatique.",
      h2Variants: [
        "Ce qu'un chatbot concierge IA hôtel peut faire automatiquement",
        "Intégration chatbot hôtel avec votre PMS",
        "Satisfaction client et chatbot IA : mesurer l'impact",
      ],
    },
    variables: {
      process: "service concierge et demandes clients hôtel",
      resultat: "80 % demandes traitées en automatique",
      chiffre: "80",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/tourisme-affaires",
    canonicalParent: "/fr/secteurs/tourisme-affaires",
    source: "manuel",
  },
  {
    keyword: "audit IA agence événementielle MICE",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "tourisme-affaires",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA agence événementielle et MICE : vos 4 leviers de productivité en 48 h",
      metaTitle: "Audit IA agence événementielle MICE — Axion-IA",
      metaDescription:
        "Axion-IA audite les processus de votre agence événementielle et identifie les automatisations à ROI rapide. Rapport livré en 48 h.",
      h2Variants: [
        "Déroulé de l'audit IA agence événementielle en 48 h",
        "Processus MICE les plus automatisables",
        "Feuille de route post-audit agence événementielle IA",
      ],
    },
    variables: {
      process: "audit opérations agence MICE",
      resultat: "4 leviers IA identifiés",
      chiffre: "4",
      unite: "leviers",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/tourisme-affaires",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "comment l'IA optimise les voyages d'affaires ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "tourisme-affaires",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA optimise les voyages d'affaires et les événements MICE ? Guide 2026",
      metaTitle: "Comment l'IA optimise les voyages d'affaires ? — Axion-IA",
      metaDescription:
        "Réservations, gestion budgets, organisation MICE, reporting : les 5 usages IA qui transforment le tourisme d'affaires en France.",
      h2Variants: [
        "5 usages IA pour les voyages d'affaires et le MICE",
        "ROI de l'IA dans la gestion des déplacements professionnels",
        "Quels outils IA pour travel managers et event planners ?",
      ],
    },
    urlCible: "/fr/secteurs/tourisme-affaires",
    canonicalParent: "/fr/secteurs/tourisme-affaires",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA tourisme affaires hôtellerie",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "pme",
    secteur: "tourisme-affaires",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA expert tourisme d'affaires et hôtellerie",
      metaTitle: "Agence IA tourisme affaires hôtellerie — Axion-IA",
      metaDescription:
        "Axion-IA accompagne hôtels d'affaires, agences événementielles et travel managers dans leur transformation IA. Audit, formation, implémentation.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé tourisme d'affaires ?",
        "Références secteur hôtellerie affaires et MICE",
        "Services IA pour hôtels et agences événementielles",
      ],
    },
    urlCible: "/fr/secteurs/tourisme-affaires",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "IA revenue management hôtel PME",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "tourisme-affaires",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Revenue management hôtel avec l'IA : maximiser le RevPAR sans recrutement",
      metaTitle: "IA revenue management hôtel PME — Axion-IA France",
      metaDescription:
        "Tarification dynamique IA pour hôtels PME : prévision demande, pricing automatique, gestion disponibilités. +12 % RevPAR mesuré.",
      h2Variants: [
        "Comment l'IA détermine le meilleur prix pour chaque nuit",
        "Intégration revenue management IA avec votre PMS",
        "Résultats mesurés : RevPAR avant et après IA",
      ],
    },
    variables: {
      process: "tarification et revenue management",
      resultat: "+12 % RevPAR",
      chiffre: "12",
      unite: "% RevPAR",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/tourisme-affaires",
    canonicalParent: "/fr/secteurs/tourisme-affaires",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 7 — ARTS, CRÉATIF & DESIGN (8 seeds)
// URL cible : /fr/secteurs/arts-creatif-design
// Slug secteur canonique : "arts-creatif-design"
// ─────────────────────────────────────────────────────────────────────────────

const KW_ARTS_CREATIF: KeywordSeed[] = [
  {
    keyword: "IA pour agence créative France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "arts-creatif-design",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA dans les agences créatives : briefs, idéation et production accélérés sans brader la créativité",
      metaTitle: "IA pour agence créative France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les agences créatives et studios graphiques dans l'adoption de l'IA : briefs automatisés, idéation, production contenus.",
      h2Variants: [
        "L'IA augmente-t-elle ou remplace-t-elle la créativité ?",
        "Quels processus d'agence créative automatiser avec l'IA ?",
        "ROI de l'IA dans une agence créative : temps et CA libérés",
      ],
    },
    variables: {
      process: "briefs, idéation et production créative",
      resultat: "×3 vitesse d'idéation et production",
      chiffre: "3",
      unite: "×",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/arts-creatif-design",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "angle : IA comme collaborateur créatif, pas substitut",
  },
  {
    keyword: "automatiser briefs créatifs IA agence",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "arts-creatif-design",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Transformer vos briefs clients en livrables créatifs avec l'IA : de l'idée au concept",
      metaTitle: "Automatiser briefs créatifs IA agence — Axion-IA",
      metaDescription:
        "Pipeline IA pour agences : analyse brief client, génération concepts, moodboard, copy de base. Créatifs libérés pour la valeur ajoutée.",
      h2Variants: [
        "Comment l'IA analyse un brief client et génère des pistes créatives",
        "IA et moodboard : inspiration augmentée pour les directeurs artistiques",
        "Workflow agence IA : ce qui s'automatise, ce qui reste humain",
      ],
    },
    variables: {
      process: "traitement briefs et production créative",
      resultat: "brief→concept en 20 min vs 4 h",
      chiffre: "20",
      unite: "minutes",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/arts-creatif-design",
    canonicalParent: "/fr/secteurs/arts-creatif-design",
    source: "manuel",
  },
  {
    keyword: "formation IA designers studio graphique",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    secteur: "arts-creatif-design",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour designers et studios graphiques : maîtriser l'IA créative en 1 jour",
      metaTitle: "Formation IA designers studio graphique — Axion-IA",
      metaDescription:
        "Formation IA pour designers : prompting créatif, outils IA image et texte, workflow production. 1 jour pratique, cas réels de votre agence.",
      h2Variants: [
        "Programme formation IA designers — contenu et outils",
        "Workflow designer + IA : les meilleures pratiques 2026",
        "Propriété intellectuelle et IA créative : ce qu'il faut savoir",
      ],
    },
    variables: {
      process: "production créative quotidienne",
      resultat: "production ×3 sans recruter",
      chiffre: "3",
      unite: "×",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/creatif-design",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "IA copy créatif rédaction publicitaire",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "arts-creatif-design",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Rédiger vos copies publicitaires avec l'IA : 10 variantes en 5 minutes",
      metaTitle: "IA copy créatif rédaction publicitaire — Axion-IA",
      metaDescription:
        "Pipeline IA pour copywriters et créatifs : variantes de copy publicitaire, adaptation ton et cible, A/B test automatique. Par Axion-IA.",
      h2Variants: [
        "Comment l'IA génère des variantes de copy publicitaire",
        "Ton de marque et IA : préserver la voix tout en accélérant",
        "A/B testing automatisé : choisir la meilleure copy avec l'IA",
      ],
    },
    variables: {
      process: "rédaction copy et variantes publicitaires",
      resultat: "10 variantes copy en 5 minutes",
      chiffre: "10",
      unite: "variantes / 5 min",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/arts-creatif-design",
    canonicalParent: "/fr/secteurs/arts-creatif-design",
    source: "manuel",
  },
  {
    keyword: "audit IA agence de communication créative",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "arts-creatif-design",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA agence de communication : identifier vos 4 gains de productivité créative",
      metaTitle: "Audit IA agence communication créative — Axion-IA",
      metaDescription:
        "Axion-IA audite les processus de votre agence créative et identifie les automations à ROI rapide. Rapport de recommandations en 48 h.",
      h2Variants: [
        "Déroulé audit IA agence créative en 48 h",
        "Processus créatifs les plus automatisables",
        "Ce que contient votre rapport d'audit IA agence",
      ],
    },
    variables: {
      process: "audit opérations agence créative",
      resultat: "4 leviers IA identifiés",
      chiffre: "4",
      unite: "leviers",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/creatif-design",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "comment l'IA augmente la productivité créative ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "arts-creatif-design",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA augmente la productivité créative sans étouffer l'inspiration ? Guide 2026",
      metaTitle: "Comment l'IA augmente la productivité créative ? — Axion-IA",
      metaDescription:
        "Briefs, idéation, copy, production : les 5 usages IA qui multiplient la productivité des agences créatives et studios graphiques.",
      h2Variants: [
        "5 usages IA dans les agences créatives et de design",
        "IA et créativité : antagonisme ou alliance ?",
        "ROI moyen IA pour une agence créative de 5 à 20 personnes",
      ],
    },
    urlCible: "/fr/secteurs/arts-creatif-design",
    canonicalParent: "/fr/secteurs/arts-creatif-design",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA créativité design France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "pme",
    secteur: "arts-creatif-design",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA expert secteur créatif et design",
      metaTitle: "Agence IA créativité design France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne agences créatives, studios graphiques et designers dans leur transformation IA. Audit, formation, implémentation.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé secteur créatif ?",
        "Nos déploiements IA dans les agences créatives",
        "Services IA pour agences de 3 à 50 personnes",
      ],
    },
    urlCible: "/fr/secteurs/arts-creatif-design",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "ROI IA agence créative studio design",
    intent: "sectoriel",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    secteur: "arts-creatif-design",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "ROI de l'IA dans une agence créative : chiffres réels et calculateur",
      metaTitle: "ROI IA agence créative studio design — Axion-IA",
      metaDescription:
        "De 15 000 € à 80 000 €/an libérés selon la taille de l'agence. Calculateur ROI IA et benchmarks pour studios créatifs par Axion-IA.",
      h2Variants: [
        "Gains IA par poste en agence créative",
        "Calculateur ROI IA agence créative",
        "Délai de retour sur investissement IA en agence",
      ],
    },
    variables: {
      process: "ensemble opérations agence créative",
      resultat: "ROI positif en 2 mois",
      chiffre: "2",
      unite: "mois",
      delai: "dès le 2e mois",
    },
    urlCible: "/fr/secteurs/arts-creatif-design",
    canonicalParent: "/fr/secteurs/arts-creatif-design",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 8 — ENSEIGNEMENT & RECHERCHE (8 seeds)
// URL cible : /fr/secteurs/enseignement-recherche
// Slug secteur canonique : "enseignement-recherche"
// ─────────────────────────────────────────────────────────────────────────────

const KW_ENSEIGNEMENT: KeywordSeed[] = [
  {
    keyword: "IA pour grande école de commerce France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA dans les grandes écoles de commerce : formation, recherche et administration augmentées",
      metaTitle: "IA grande école de commerce France — Axion-IA",
      metaDescription:
        "Axion-IA intervient dans les grandes écoles (HEC, ESSEC, ESCP…) : modules IA certifiants, conférences, workshops étudiants et formation corps professoral.",
      h2Variants: [
        "Quels modules IA intégrer dans un programme grande école ?",
        "IA et accréditation AACSB/EQUIS : conformité et valorisation",
        "Formation corps professoral à l'IA : une étape clé",
      ],
    },
    variables: {
      process: "modules IA programmes grande école",
      resultat: "étudiants opérationnels IA dès M1",
      chiffre: "1",
      unite: "semestre",
      delai: "dès la rentrée",
    },
    urlCible: "/fr/secteurs/enseignement-recherche",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: EducationalOrganization + Course",
  },
  {
    keyword: "former équipe R&D laboratoire IA France",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Former votre équipe R&D à l'IA : accélérer la recherche et la valorisation",
      metaTitle: "Former équipe R&D laboratoire IA France — Axion-IA",
      metaDescription:
        "Formation IA pour équipes R&D et laboratoires : veille automatisée, rédaction scientifique assistée, revue littérature IA. 1 à 2 jours sur site.",
      h2Variants: [
        "IA et revue de littérature scientifique : gain de temps R&D",
        "Rédaction d'articles scientifiques assistée par IA : règles éthiques",
        "Formation IA laboratoire : programme et retours terrain",
      ],
    },
    variables: {
      process: "veille et rédaction scientifique R&D",
      resultat: "-40 % temps revue de littérature",
      chiffre: "40",
      unite: "%",
      delai: "en 30 jours",
    },
    urlCible: "/fr/interventions-formations/enseignement-recherche",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "IA administration université automatisation",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser l'administration universitaire avec l'IA : inscriptions, FAQ, planning simplifiés",
      metaTitle: "IA administration université automatisation — Axion-IA",
      metaDescription:
        "Chatbot FAQ étudiants, gestion inscriptions automatisée, reporting pédagogique IA : comment l'IA simplifie l'administration universitaire.",
      h2Variants: [
        "Chatbot FAQ étudiants : répondre à 80 % des questions en automatique",
        "Automatiser la gestion des inscriptions et dossiers étudiants",
        "RGPD et données étudiants : conformité IA en université",
      ],
    },
    variables: {
      process: "gestion administrative étudiants et personnel",
      resultat: "-50 % charge administrative",
      chiffre: "50",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/enseignement-recherche",
    canonicalParent: "/fr/secteurs/enseignement-recherche",
    source: "manuel",
  },
  {
    keyword: "audit IA institution enseignement supérieur",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA institution d'enseignement supérieur : vos 4 leviers prioritaires en 48 h",
      metaTitle: "Audit IA enseignement supérieur — Axion-IA France",
      metaDescription:
        "Axion-IA audite les processus de votre école ou université et identifie les automations à ROI rapide. Rapport livré en 48 h.",
      h2Variants: [
        "Déroulé de l'audit IA enseignement supérieur en 48 h",
        "Processus académiques les plus automatisables",
        "Feuille de route IA université post-audit",
      ],
    },
    variables: {
      process: "audit processus enseignement supérieur",
      resultat: "4 leviers IA prioritaires",
      chiffre: "4",
      unite: "leviers",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/enseignement-recherche",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "comment l'IA transforme l'enseignement supérieur ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA transforme l'enseignement supérieur et la recherche en France ? Guide 2026",
      metaTitle: "Comment l'IA transforme l'enseignement sup. ? — Axion-IA",
      metaDescription:
        "Pédagogie, recherche, administration, orientation : les 6 usages IA qui transforment les universités et grandes écoles françaises.",
      h2Variants: [
        "6 usages IA dans l'enseignement supérieur français",
        "IA et éthique académique : ce que disent les institutions",
        "ROI moyen IA pour une institution d'enseignement supérieur",
      ],
    },
    urlCible: "/fr/secteurs/enseignement-recherche",
    canonicalParent: "/fr/secteurs/enseignement-recherche",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA enseignement supérieur recherche",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA expert enseignement supérieur et recherche",
      metaTitle: "Agence IA enseignement supérieur recherche — Axion-IA",
      metaDescription:
        "Axion-IA accompagne grandes écoles, universités et laboratoires R&D dans leur transformation IA. Audit, formation, implémentation sur mesure.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé enseignement supérieur ?",
        "Nos interventions dans les grandes écoles et universités",
        "Services IA pour institutions académiques et centres R&D",
      ],
    },
    urlCible: "/fr/secteurs/enseignement-recherche",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "intégrer l'IA dans un programme ingénieur",
    intent: "sectoriel",
    kbType: "implementation_playbook",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Intégrer l'IA dans un programme ingénieur : modules, cas pratiques et certification",
      metaTitle: "Intégrer l'IA programme ingénieur — Axion-IA France",
      metaDescription:
        "Playbook complet pour intégrer l'IA dans les formations ingénieur : contenu pédagogique, ateliers pratiques, évaluation, certification. Par Axion-IA.",
      h2Variants: [
        "Structure d'un module IA pour élèves ingénieurs",
        "Cas pratiques IA adaptés aux spécialités ingénieur",
        "Certification IA étudiants : valeur et reconnaissance marché",
      ],
    },
    urlCible: "/fr/secteurs/enseignement-recherche",
    canonicalParent: "/fr/secteurs/enseignement-recherche",
    source: "manuel",
  },
  {
    keyword: "IA pour accélérer publications scientifiques",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Accélérer vos publications scientifiques avec l'IA : revue littérature et rédaction assistées",
      metaTitle: "IA publications scientifiques accélérées — Axion-IA",
      metaDescription:
        "L'IA réduit de 40 % le temps de revue de littérature et accélère la rédaction d'articles. Guide Axion-IA pour laboratoires et chercheurs.",
      h2Variants: [
        "IA et revue systématique de littérature : méthode et outils",
        "Rédaction assistée IA pour articles scientifiques : éthique et limites",
        "Valorisation recherche avec l'IA : résumés, briefs, vulgarisation",
      ],
    },
    variables: {
      process: "revue littérature et rédaction scientifique",
      resultat: "-40 % temps revue littérature",
      chiffre: "40",
      unite: "%",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/enseignement-recherche",
    canonicalParent: "/fr/secteurs/enseignement-recherche",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 9 — ADMINISTRATION PUBLIQUE (8 seeds)
// URL cible : /fr/secteurs/administration-publique
// Slug secteur canonique : "administration-publique"
// ─────────────────────────────────────────────────────────────────────────────

const KW_ADMINISTRATION: KeywordSeed[] = [
  {
    keyword: "IA pour collectivité territoriale France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA dans les collectivités territoriales : services aux citoyens et back-office modernisés",
      metaTitle: "IA collectivité territoriale France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les collectivités territoriales dans l'adoption de l'IA : agents augmentés, services citoyens, conformité AI Act. ROI mesuré.",
      h2Variants: [
        "Quels processus administratifs automatiser avec l'IA en priorité ?",
        "IA et collectivités : conformité AI Act et RGPD obligatoire",
        "Cas d'usage IA dans les mairies et intercommunalités",
      ],
    },
    variables: {
      process: "services aux citoyens et back-office collectivité",
      resultat: "-30 % délais de traitement administratif",
      chiffre: "30",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: GovernmentOrganization ; angle : conformité AI Act art. 22 + RGPD public",
  },
  {
    keyword: "formation agents publics intelligence artificielle",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Former les agents publics à l'intelligence artificielle : montée en compétence rapide",
      metaTitle: "Formation agents publics IA — Axion-IA France",
      metaDescription:
        "Formation IA sur mesure pour agents de la fonction publique : usages pratiques, conformité RGPD/AI Act, non-discrimination. 1 journée en présentiel.",
      h2Variants: [
        "Programme formation IA agents publics — contenu et pédagogie",
        "IA et service public : usages autorisés et interdits",
        "Accompagnement post-formation : ancrage dans les pratiques quotidiennes",
      ],
    },
    variables: {
      process: "montée en compétence IA agents publics",
      resultat: "agents opérationnels dès J+1",
      chiffre: "1",
      unite: "jour",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/administration-publique",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "automatiser back-office mairie IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser le back-office de votre mairie avec l'IA : moins de saisie, plus de service",
      metaTitle: "Automatiser back-office mairie IA — Axion-IA France",
      metaDescription:
        "Traitement demandes citoyen, rédaction courriers administratifs, gestion documents : l'IA simplifie le back-office des collectivités.",
      h2Variants: [
        "Quels processus back-office municipaux automatiser avec l'IA ?",
        "Chatbot citoyen : répondre aux demandes 24h/24",
        "Conformité RGPD et AI Act dans l'automatisation mairie",
      ],
    },
    variables: {
      process: "back-office administratif mairie",
      resultat: "-40 % saisies manuelles agents",
      chiffre: "40",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs/administration-publique",
    source: "manuel",
  },
  {
    keyword: "audit IA service public collectivité",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA service public et collectivité : 4 leviers d'efficacité en 48 h",
      metaTitle: "Audit IA service public collectivité — Axion-IA",
      metaDescription:
        "Axion-IA audite les processus de votre collectivité et identifie les automations conformes RGPD/AI Act à ROI rapide. Rapport en 48 h.",
      h2Variants: [
        "Déroulé de l'audit IA collectivité en 48 h",
        "Processus administratifs publics les plus automatisables",
        "Feuille de route IA collectivité post-audit",
      ],
    },
    variables: {
      process: "audit processus administration publique",
      resultat: "4 leviers IA conformes identifiés",
      chiffre: "4",
      unite: "leviers",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/administration-publique",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "conformité AI Act collectivités publiques 2026",
    intent: "sectoriel",
    kbType: "implementation_playbook",
    module: "audit",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "AI Act et collectivités publiques : obligations de conformité et plan d'action 2026",
      metaTitle: "Conformité AI Act collectivités 2026 — Axion-IA",
      metaDescription:
        "Obligations AI Act pour les collectivités en 2026 : systèmes à haut risque, registre, évaluation impact, droits citoyens. Guide complet Axion-IA.",
      h2Variants: [
        "Quels systèmes IA des collectivités sont soumis à l'AI Act ?",
        "Registre IA obligatoire pour les collectivités : comment le constituer",
        "Plan de mise en conformité AI Act mairie et EPCI en 6 étapes",
      ],
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs/administration-publique",
    source: "manuel",
    note: "P0 deadline AI Act art. 22 août 2026 ; schema.org Article + GovernmentOrganization",
  },
  {
    keyword: "comment l'IA améliore le service public ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA améliore le service public sans sacrifier l'humain ? Guide 2026",
      metaTitle: "Comment l'IA améliore le service public ? — Axion-IA",
      metaDescription:
        "Services citoyens, back-office, conformité : les 6 usages IA qui améliorent le service public en France, conformes RGPD et AI Act.",
      h2Variants: [
        "6 usages IA dans les collectivités et mairies en 2026",
        "IA et service public : quelles limites légales et éthiques ?",
        "ROI moyen IA pour une collectivité de 5 000 à 200 000 habitants",
      ],
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs/administration-publique",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "agence IA administration publique France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA, le cabinet IA expert du secteur public et des collectivités",
      metaTitle: "Agence IA administration publique France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne collectivités, EPCI et services d'État dans leur transformation IA conforme RGPD et AI Act. Audit, formation, implémentation.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé secteur public ?",
        "Nos déploiements IA dans les collectivités françaises",
        "Services IA pour collectivités de 2 000 à 500 000 habitants",
      ],
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  {
    keyword: "IA DSI collectivité territoire numérique",
    intent: "sectoriel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et DSI de collectivité : déployer des solutions conformes et scalables",
      metaTitle: "IA DSI collectivité territoire numérique — Axion-IA",
      metaDescription:
        "Playbook IA pour les DSI de collectivités : architecture souveraine, intégration SI existant, conformité RGPD et AI Act, gouvernance données publiques.",
      h2Variants: [
        "Architecture IA recommandée pour une collectivité souveraine",
        "Intégration IA avec les SI collectivités (SEDIT, BERGER-LEVRAULT…)",
        "Gouvernance données publiques et IA : le cadre à mettre en place",
      ],
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs/administration-publique",
    source: "manuel",
    note: "cible DSI collectivité ; mots secondaires : SI collectivité IA, souveraineté numérique",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT CONSOLIDÉ — 9 secteurs × 8 seeds = 72 seeds
// ─────────────────────────────────────────────────────────────────────────────

export const KW_SECTEURS_G7C: KeywordSeed[] = [
  ...KW_VITICULTURE,
  ...KW_LOGISTIQUE,
  ...KW_DISTRIBUTION,
  ...KW_MODE_LUXE,
  ...KW_COSMETIQUE,
  ...KW_TOURISME,
  ...KW_ARTS_CREATIF,
  ...KW_ENSEIGNEMENT,
  ...KW_ADMINISTRATION,
];
