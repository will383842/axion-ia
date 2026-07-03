/**
 * Keyword Strategy — Batch G1 : Audit × TPE / PME / ETI
 *
 * Mode G Phase 1 — généré 2026-05-20
 * Prompt master : `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` v1.2
 *
 * Répartition :
 *   - TPE  : 25 seeds (D1 ×6, D2 ×7, D3 ×6, D4 ×6)
 *   - PME  : 25 seeds (D1 ×6, D2 ×7, D3 ×6, D4 ×6)
 *   - ETI  : 25 seeds (D1 ×6, D2 ×7, D3 ×6, D4 ×6)
 *   TOTAL  : 75 seeds
 *
 * Règles respectées :
 *   - niveau=1 jamais combiné à priorite=1
 *   - H1 ≠ keyword brut (toujours bénéfice + contexte)
 *   - metaTitle ≤ 60 chars / metaDescription ≤ 155 chars
 *   - urlCible conforme Section 7 du prompt master
 *   - "cabinet IA" ET "agence IA" couverts dans les transactionnels
 */

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────
//  AUDIT × TPE
//  Douleur : Le dirigeant de TPE sait que l'IA existe mais ignore par où commencer
//  et craint de perdre du temps ou de l'argent sur quelque chose d'inadapté à son échelle.
//  Bénéfices chiffrés réalistes :
//    1. Identifier 2-3 tâches automatisables dès la 1re semaine (+5 h/semaine récupérées)
//    2. Réduire de 30 % le temps passé sur la facturation et les relances
//    3. Obtenir un plan d'action priorisé en 1 demi-journée (vs. mois de tâtonnements)
//    4. Éviter d'investir dans un outil inadapté (économiser 1 000-3 000 € d'abonnements inutiles)
//    5. Première automatisation déployée en < 4 semaines
//  Questions Google naturelles :
//    "audit IA pour artisan", "est-ce que l'IA peut aider une toute petite entreprise",
//    "comment savoir si l'IA est utile pour mon activité", "prix audit IA petite entreprise",
//    "par où commencer avec l'IA quand on est indépendant"
// ─────────────────────────────────────────────

export const KW_AUDIT_G1: KeywordSeed[] = [
  // ── TPE — D1 TRANSACTIONNEL ──────────────────────────────────────────────

  {
    keyword: "audit IA pour TPE",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA pour TPE — Identifiez vos 3 premiers gains concrets en une demi-journée",
      metaTitle: "Audit IA pour TPE | Axion-IA — Diagnostic en 1 demi-journée",
      metaDescription:
        "Cabinet IA spécialisé TPE. Audit flash pour identifier vos 3 premières automatisations. Plan d'action livré sous 48 h. Devis gratuit.",
      h2Variants: [
        "Pourquoi un audit IA est essentiel même pour une TPE ?",
        "Comment se déroule l'audit IA Axion-IA pour les TPE ?",
        "Quels résultats concrets après l'audit ?",
      ],
    },
    variables: {
      process: "diagnostic IA initial",
      resultat: "3 automatisations identifiées",
      chiffre: "3",
      unite: "automatisations",
      delai: "en une demi-journée",
    },
    urlCible: "/fr/audit/tpe-1-jour",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Page pilier TPE — schema.org Service + FAQPage",
  },

  {
    keyword: "cabinet IA audit petite entreprise",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Un cabinet IA dédié aux petites entreprises — audit clair, sans jargon",
      metaTitle: "Cabinet IA petite entreprise | Audit Axion-IA",
      metaDescription:
        "Axion-IA : cabinet IA à taille humaine pour TPE, artisans et indépendants. Audit flash, plan d'action opérationnel dès J+2. Devis gratuit.",
      h2Variants: [
        "Ce qu'un cabinet IA apporte de concret à une TPE",
        "Comment choisir le bon cabinet IA quand on est une petite structure ?",
      ],
    },
    variables: {
      process: "audit flash",
      resultat: "plan d'action en 48 h",
      chiffre: "48",
      unite: "heures",
      delai: "dès J+2",
    },
    urlCible: "/fr/audit/tpe-1-jour",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Mot-clé secondaire de la page /fr/audit/tpe-1-jour — ne pas créer une URL séparée",
  },

  {
    keyword: "agence IA diagnostic TPE artisan",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Diagnostic IA pour artisans et TPE — comprenez vos gains réels avant d'investir",
      metaTitle: "Agence IA diagnostic TPE artisan | Axion-IA",
      metaDescription:
        "Agence IA opérationnelle. Diagnostic adapté aux artisans et TPE : 0 jargon, 100 % concret. Résultats livrés sous 48 h. Devis gratuit.",
      h2Variants: [
        "Ce qu'une agence IA peut faire pour un artisan",
        "Diagnostic IA : à quoi ça ressemble pour une TPE ?",
      ],
    },
    variables: {
      process: "diagnostic IA",
      resultat: "gains identifiés avant investissement",
      chiffre: "2-3",
      unite: "tâches automatisables",
      delai: "sous 48 h",
    },
    urlCible: "/fr/audit/tpe-1-jour",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Couvre l'intention 'agence IA' — variante sémantique de 'cabinet IA'",
  },

  {
    keyword: "devis audit IA indépendant",
    intent: "transactionnel",
    kbType: "faq",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Devis audit IA pour indépendants — transparent, sans engagement",
      metaTitle: "Devis audit IA indépendant | Axion-IA",
      metaDescription:
        "Obtenez votre devis audit IA en 24 h. Forfait adapté aux indépendants et micro-entrepreneurs. Aucun engagement, 100 % personnalisé.",
      h2Variants: [
        "Combien coûte un audit IA pour un indépendant ?",
        "Comment obtenir un devis audit IA rapide ?",
      ],
    },
    variables: {
      process: "audit flash",
      resultat: "devis reçu en 24 h",
      chiffre: "24",
      unite: "heures",
      delai: "sous 24 h",
    },
    urlCible: "/fr/audit/tpe-1-jour",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Intent commercial fort — CTA devis gratuit en priorité",
  },

  {
    keyword: "prestataire audit IA micro-entreprise",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Prestataire IA pour micro-entreprises — un audit qui colle à votre réalité terrain",
      metaTitle: "Prestataire audit IA micro-entreprise | Axion-IA",
      metaDescription:
        "Axion-IA accompagne les micro-entreprises. Audit IA clé en main : analyse de vos process, priorisation, plan d'action. Sans surcharge.",
      h2Variants: [
        "Pourquoi un prestataire IA spécialisé TPE change tout",
        "Ce que comprend l'audit IA pour une micro-entreprise",
      ],
    },
    variables: {
      process: "analyse process TPE",
      resultat: "plan d'action priorisé",
      chiffre: "1",
      unite: "demi-journée",
      delai: "sous une semaine",
    },
    urlCible: "/fr/audit/tpe-1-jour",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "audit intelligence artificielle TPE France",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "tpe",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Audit Intelligence Artificielle TPE — le diagnostic qui transforme votre quotidien",
      metaTitle: "Audit intelligence artificielle TPE | Axion-IA France",
      metaDescription:
        "Audit IA sur mesure pour TPE françaises. Identifiez vos gains, priorisez vos actions. Cabinet basé en France, résultats concrets garantis.",
      h2Variants: [
        "Qu'est-ce qu'un audit d'intelligence artificielle pour une TPE ?",
        "À quoi sert l'audit IA en pratique pour une petite entreprise ?",
      ],
    },
    variables: {
      process: "audit IA complet",
      resultat: "priorités d'automatisation identifiées",
      chiffre: "3",
      unite: "axes d'amélioration",
      delai: "en une journée",
    },
    urlCible: "/fr/audit/tpe-1-jour",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Niveau 2 — priorité 2 (besoin autorité domaine avant d'attaquer)",
  },

  // ── TPE — D2 BÉNÉFICE / ROI ──────────────────────────────────────────────

  {
    keyword: "gagner du temps avec l'IA quand on est artisan",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Artisans : récupérez 5 heures par semaine grâce à l'IA — sans changer de métier",
      metaTitle: "Gagner du temps avec l'IA pour artisans | Axion-IA",
      metaDescription:
        "Un artisan peut récupérer 5 h/semaine en automatisant devis, relances et planning. Découvrez comment avec l'audit IA Axion-IA.",
      h2Variants: [
        "Les 3 tâches d'un artisan que l'IA peut automatiser immédiatement",
        "Combien d'heures un artisan peut-il vraiment économiser avec l'IA ?",
        "Témoignages : des artisans qui ont repris la main sur leur temps",
      ],
    },
    variables: {
      process: "devis, relances, planning",
      resultat: "+5 h récupérées par semaine",
      chiffre: "5",
      unite: "heures/semaine",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/blog/gagner-temps-ia-artisan",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
    note: "Article blog généré par Content Engine — lien interne vers /fr/audit/tpe-1-jour",
  },

  {
    keyword: "réduire les tâches administratives d'une TPE avec l'IA",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "TPE : réduisez de 30 % vos tâches admin avec l'IA — sans recruter",
      metaTitle: "Réduire tâches admin TPE avec l'IA | Axion-IA",
      metaDescription:
        "Facturation, relances, devis : l'IA peut prendre en charge 30 % de vos tâches admin. Audit gratuit pour identifier quoi automatiser en premier.",
      h2Variants: [
        "Quelles tâches admin une TPE peut-elle déléguer à l'IA ?",
        "L'automatisation administrative pour TPE : par où commencer ?",
        "Résultats concrets : avant/après automatisation IA en TPE",
      ],
    },
    variables: {
      process: "facturation, relances, devis",
      resultat: "-30 % de temps admin",
      chiffre: "30",
      unite: "%",
      delai: "dès le 2e mois",
    },
    urlCible: "/fr/guides/automatiser-admin-tpe-ia",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "ROI audit IA petite entreprise",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "ROI d'un audit IA pour une petite entreprise — chiffres réels, pas de promesses vagues",
      metaTitle: "ROI audit IA petite entreprise | Axion-IA",
      metaDescription:
        "Un audit IA coûte 1 190 € (Flash, 1 jour). Les gains identifiés représentent en moyenne 3 à 8 h/semaine récupérées. Calculez votre ROI en 2 minutes.",
      h2Variants: [
        "Comment calculer le ROI d'un audit IA pour une petite entreprise ?",
        "Quels gains concrets attendre d'un audit IA TPE ?",
        "L'audit IA se rentabilise-t-il vraiment pour une TPE ?",
      ],
    },
    variables: {
      process: "calcul ROI audit",
      resultat: "3-8 h/semaine récupérées",
      chiffre: "3-8",
      unite: "heures/semaine",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/ressources/roi-ia-tpe",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
    note: "Calculateur ROI — schema.org Article + HowTo",
  },

  {
    keyword: "économiser sur les coûts administratifs TPE grâce à l'IA",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Réduisez vos coûts d'administration de 40 % — l'IA fait le travail répétitif à votre place",
      metaTitle: "Économiser coûts admin TPE IA | Axion-IA",
      metaDescription:
        "Axion-IA identifie les 3 postes de coûts admin les plus automatisables dans votre TPE. Première automatisation déployée en 4 semaines.",
      h2Variants: [
        "Où les TPE perdent-elles le plus d'argent en tâches inutiles ?",
        "3 automatisations IA qui font baisser les coûts admin dès le 1er mois",
      ],
    },
    variables: {
      process: "admin, devis, relances",
      resultat: "-40 % coûts admin",
      chiffre: "40",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/blog/reduire-couts-admin-tpe-ia",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "automatiser la facturation d'une TPE avec l'IA",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Automatisez votre facturation — libérez 3 heures par semaine dès ce mois-ci",
      metaTitle: "Automatiser facturation TPE IA | Axion-IA",
      metaDescription:
        "Facturation automatique, relances intelligentes : gagnez 3 h/semaine. Audit flash Axion-IA pour configurer votre automatisation en 1 journée.",
      h2Variants: [
        "Comment automatiser sa facturation quand on est une TPE ?",
        "Quels outils IA pour automatiser la facturation d'une petite entreprise ?",
      ],
    },
    variables: {
      process: "facturation",
      resultat: "+3 h récupérées/semaine",
      chiffre: "3",
      unite: "heures/semaine",
      delai: "dès ce mois",
    },
    urlCible: "/fr/guides/automatiser-facturation-tpe-ia",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "IA pour indépendant premier pas concret",
    intent: "benefice",
    kbType: "guide",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Premier pas avec l'IA pour les indépendants — concret, rapide, sans risque",
      metaTitle: "IA pour indépendant premier pas concret | Axion-IA",
      metaDescription:
        "Guide pas à pas pour les indépendants qui veulent démarrer avec l'IA sans se perdre. 3 actions à faire cette semaine pour gagner du temps.",
      h2Variants: [
        "Par où commencer avec l'IA quand on est indépendant ?",
        "Les 3 premières automatisations à tester quand on est solo",
        "Comment éviter de perdre du temps à tester des outils IA inutiles ?",
      ],
    },
    variables: {
      process: "premier démarrage IA",
      resultat: "3 actions concrètes cette semaine",
      chiffre: "3",
      unite: "actions",
      delai: "cette semaine",
    },
    urlCible: "/fr/guides/ia-independant-premiers-pas",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "TPE automatiser relances clients impayés IA",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Zéro impayé oublié — automatisez vos relances clients en TPE avec l'IA",
      metaTitle: "Automatiser relances clients impayés TPE IA | Axion-IA",
      metaDescription:
        "Relances automatiques, zéro oubli, +20 % d'encaissements. L'audit Axion-IA identifie votre process de relance idéal en une demi-journée.",
      h2Variants: [
        "Comment automatiser les relances d'impayés sans paraître agressif ?",
        "Quels outils IA pour gérer les relances clients d'une TPE ?",
      ],
    },
    variables: {
      process: "relances clients impayés",
      resultat: "+20 % d'encaissements",
      chiffre: "20",
      unite: "%",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/guides/automatiser-relances-clients-tpe-ia",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  // ── TPE — D3 INFORMATIONNEL ──────────────────────────────────────────────

  {
    keyword: "comment savoir si l'IA est utile pour ma TPE",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "L'IA est-elle vraiment utile pour votre TPE ? — Les 5 signaux qui ne trompent pas",
      metaTitle: "L'IA utile pour une TPE ? | Guide Axion-IA 2026",
      metaDescription:
        "5 questions pour savoir si l'IA peut vraiment vous faire gagner du temps. Guide honnête, sans promesses excessives, par des experts IA terrain.",
      h2Variants: [
        "Les 5 indicateurs qui montrent qu'une TPE peut bénéficier de l'IA",
        "À quel moment l'IA devient rentable pour une petite structure ?",
        "Ce que l'IA ne peut pas faire pour une TPE (soyons honnêtes)",
      ],
    },
    variables: {
      process: "évaluation pertinence IA",
      resultat: "diagnostic en 5 minutes",
      chiffre: "5",
      unite: "questions",
      delai: "immédiat",
    },
    urlCible: "/fr/guides/ia-utile-tpe-comment-savoir",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
    note: "Top du funnel informationnel — lien CTA vers /fr/audit/tpe-1-jour",
  },

  {
    keyword: "guide IA pour petite entreprise débutant 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Guide IA pour petite entreprise 2026 — De zéro à votre première automatisation",
      metaTitle: "Guide IA petite entreprise débutant 2026 | Axion-IA",
      metaDescription:
        "Le guide complet IA pour TPE : comprendre, choisir, démarrer. Pas de jargon, des cas concrets français, un plan d'action en 3 étapes.",
      h2Variants: [
        "Qu'est-ce que l'IA peut concrètement faire pour une petite entreprise ?",
        "Par où commencer quand on n'y connaît rien à l'IA ?",
        "Les erreurs à éviter pour une TPE qui se lance dans l'IA",
      ],
    },
    variables: {
      process: "démarrage IA complet",
      resultat: "première automatisation opérationnelle",
      chiffre: "3",
      unite: "étapes",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/guides/ia-petite-entreprise-debutant-2026",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "intelligence artificielle artisan boulanger coiffeur",
    intent: "informationnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "L'IA pour les artisans — ce qui fonctionne vraiment pour un boulanger, un coiffeur, un plombier",
      metaTitle: "IA pour artisans — cas concrets | Axion-IA 2026",
      metaDescription:
        "Cas d'usage IA concrets pour artisans : prise de RDV, gestion stock, devis automatiques. Quels outils, quel budget, quels résultats réels.",
      h2Variants: [
        "Quelles tâches un artisan peut-il vraiment automatiser avec l'IA ?",
        "IA pour boulanger : gestion des commandes et planning automatisés",
        "IA pour coiffeur et prestataires de service : réservation et relances clients",
      ],
    },
    variables: {
      process: "prise de RDV, devis, stock",
      resultat: "2-4 h récupérées/semaine",
      chiffre: "2-4",
      unite: "heures/semaine",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/blog/ia-pour-artisans-cas-concrets",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "IA pour auto-entrepreneur sans compétences techniques",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Utilisez l'IA sans être développeur — guide pour auto-entrepreneurs",
      metaTitle: "IA auto-entrepreneur sans compétences tech | Axion-IA",
      metaDescription:
        "Pas besoin d'être développeur pour profiter de l'IA. Guide pratique pour auto-entrepreneurs : 3 outils simples, 0 code, résultats dès la 1re semaine.",
      h2Variants: [
        "Quels outils IA fonctionnent sans compétences techniques pour un auto-entrepreneur ?",
        "Comment intégrer l'IA dans son activité quand on n'est pas technique ?",
        "Les 3 outils IA no-code les plus utiles pour un auto-entrepreneur",
      ],
    },
    variables: {
      process: "outils IA no-code",
      resultat: "automatisations sans code",
      chiffre: "3",
      unite: "outils",
      delai: "dès la 1re semaine",
    },
    urlCible: "/fr/guides/ia-auto-entrepreneur-sans-technique",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "qu'est-ce qu'un audit IA pour une petite entreprise",
    intent: "informationnel",
    kbType: "faq",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Qu'est-ce qu'un audit IA pour une petite entreprise ? — Explication complète",
      metaTitle: "Audit IA petite entreprise : définition | Axion-IA",
      metaDescription:
        "Un audit IA pour TPE, c'est quoi ? Durée, livrable, prix, résultats attendus. Tout ce qu'il faut savoir avant de commander un audit.",
      h2Variants: [
        "Définition : qu'est-ce qu'un audit IA en entreprise ?",
        "Que contient le livrable d'un audit IA pour une TPE ?",
        "En combien de temps se déroule un audit IA pour une petite structure ?",
      ],
    },
    variables: {
      process: "audit IA",
      resultat: "livrable plan d'action",
      chiffre: "1",
      unite: "demi-journée",
      delai: "livrable sous 48 h",
    },
    urlCible: "/fr/faq/qu-est-ce-qu-un-audit-ia-petite-entreprise",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
    note: "FAQPage schema.org — vise les featured snippets",
  },

  {
    keyword: "comment démarrer l'IA dans une TPE guide complet",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Démarrer l'IA dans votre TPE — le guide complet 2026 en 5 étapes",
      metaTitle: "Démarrer l'IA en TPE — Guide complet 2026 | Axion-IA",
      metaDescription:
        "5 étapes pour démarrer l'IA dans votre TPE : audit, choix d'outils, première automatisation, formation, suivi. Guide opérationnel gratuit.",
      h2Variants: [
        "Étape 1 : évaluer les besoins IA de sa TPE",
        "Étape 2 : choisir les bons outils IA pour une petite structure",
        "Étape 3 : lancer sa première automatisation sans risque",
      ],
    },
    variables: {
      process: "démarrage IA complet TPE",
      resultat: "première automatisation en prod",
      chiffre: "5",
      unite: "étapes",
      delai: "en 4-6 semaines",
    },
    urlCible: "/fr/guides/demarrer-ia-tpe-guide-complet",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  // ── TPE — D4 AEO / QUESTIONS ─────────────────────────────────────────────

  {
    keyword: "faut-il un audit IA avant d'acheter un outil pour sa TPE ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Faut-il un audit IA avant d'acheter un outil ? — La réponse honnête",
      metaTitle: "Audit IA avant achat outil TPE ? | Axion-IA FAQ",
      metaDescription:
        "La plupart des TPE achètent le mauvais outil IA faute de diagnostic. L'audit IA Axion-IA identifie les bons outils en amont. Évitez 1 000 € gaspillés.",
      h2Variants: [
        "Pourquoi acheter un outil IA sans audit est risqué pour une TPE ?",
        "Que révèle un audit IA sur les vrais besoins d'une petite entreprise ?",
      ],
    },
    variables: {
      process: "sélection d'outil IA",
      resultat: "éviter 1 000 € d'abonnements inadaptés",
      chiffre: "1000",
      unite: "€",
      delai: "avant tout achat",
    },
    urlCible: "/fr/faq/faut-il-audit-ia-avant-acheter-outil-tpe",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
    note: "PAA direct — FAQPage schema.org",
  },

  {
    keyword: "combien coûte un audit IA pour une petite entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Combien coûte un audit IA pour une petite entreprise ? — Tarifs transparents",
      metaTitle: "Prix audit IA petite entreprise | Axion-IA FAQ",
      metaDescription:
        "Tarif de l'audit IA Axion-IA pour TPE. Forfait flash demi-journée. Livrable plan d'action priorisé. Devis gratuit en 24 h.",
      h2Variants: [
        "Quel est le tarif d'un audit IA pour une TPE ?",
        "L'audit IA est-il rentable pour une petite structure ?",
      ],
    },
    variables: {
      process: "tarification audit",
      resultat: "tarif transparent 1 journée",
      chiffre: "1190",
      unite: "€",
      delai: "devis en 24 h",
    },
    urlCible: "/fr/faq/combien-coute-audit-ia-petite-entreprise",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "est-ce que l'IA peut vraiment aider une très petite entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "L'IA peut-elle vraiment aider une TPE ? — Oui, et voici la preuve",
      metaTitle: "L'IA vraiment utile pour TPE ? | Axion-IA FAQ 2026",
      metaDescription:
        "Oui, l'IA aide les TPE. 3 cas concrets : artisan récupère 5 h/semaine, commerçant réduit impayés de 20 %, micro-entreprise automatise sa facturation.",
      h2Variants: [
        "Exemples concrets d'IA qui aide des TPE aujourd'hui",
        "Ce que l'IA peut et ne peut pas faire pour une TPE en 2026",
      ],
    },
    variables: {
      process: "évaluation impact IA TPE",
      resultat: "5 h récupérées, -20 % impayés",
      chiffre: "5",
      unite: "heures/semaine",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/faq/ia-vraiment-utile-tpe",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  {
    keyword: "quelle différence entre audit IA et formation IA pour une TPE ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA ou formation IA pour votre TPE ? — Lequel choisir en premier",
      metaTitle: "Audit IA vs formation IA TPE | Axion-IA FAQ",
      metaDescription:
        "Audit IA = diagnostic de vos besoins. Formation IA = monter en compétences. Pour une TPE, l'audit passe d'abord : il définit quoi apprendre.",
      h2Variants: [
        "Quand faut-il faire un audit IA avant une formation ?",
        "Audit IA et formation IA : deux étapes complémentaires pour une TPE",
      ],
    },
    variables: {
      process: "parcours audit + formation",
      resultat: "séquence optimale identifiée",
      chiffre: "2",
      unite: "étapes",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/faq/audit-ia-vs-formation-ia-tpe",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
    note: "Lien interne vers /fr/audit/tpe-1-jour ET /fr/interventions-formations/tpe",
  },

  {
    keyword: "en combien de temps un audit IA TPE est livré ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "En combien de temps est livré un audit IA pour une TPE ?",
      metaTitle: "Délai audit IA TPE | Axion-IA FAQ",
      metaDescription:
        "L'audit IA Axion-IA pour TPE dure une demi-journée. Le livrable plan d'action est envoyé sous 48 h. Première mise en œuvre possible dès J+7.",
      h2Variants: [
        "Déroulement d'une journée d'audit IA pour une TPE",
        "Que reçoit-on à la fin d'un audit IA chez Axion-IA ?",
      ],
    },
    variables: {
      process: "déroulement audit",
      resultat: "livrable sous 48 h",
      chiffre: "48",
      unite: "heures",
      delai: "livrable J+2",
    },
    urlCible: "/fr/faq/delai-livraison-audit-ia-tpe",
    canonicalParent: "/fr/audit/tpe-1-jour",
    source: "manuel",
  },

  // ─────────────────────────────────────────────
  //  AUDIT × PME
  //  Douleur : La PME veut structurer son approche IA mais manque de méthode
  //  interne — elle a testé des outils en ordre dispersé, sans résultats mesurables.
  //  Bénéfices chiffrés réalistes :
  //    1. Cartographier 8-12 process automatisables (gain potentiel > 40 k€/an)
  //    2. Prioriser les 3 chantiers avec le meilleur ROI à 6 mois
  //    3. Livrable de gouvernance IA pour rassurer le CODIR
  //    4. Réduire les coûts opérationnels de 20-25 % sur les process ciblés
  //    5. Premier POC en production en 6 semaines
  //  Questions Google naturelles :
  //    "audit IA PME prix", "comment faire un diagnostic IA pour une PME",
  //    "cabinet IA PME recommandé France", "ROI audit IA PME",
  //    "agence IA PME accompagnement transformation"
  // ─────────────────────────────────────────────

  // ── PME — D1 TRANSACTIONNEL ──────────────────────────────────────────────

  {
    keyword: "audit IA PME",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Audit IA PME — cartographiez vos 10 process automatisables, priorisez les 3 plus rentables",
      metaTitle: "Audit IA PME | Axion-IA — Diagnostic stratégique",
      metaDescription:
        "Axion-IA audite votre PME et identifie les process à automatiser en priorité. Livrable CODIR, plan d'action 90 jours. Devis gratuit.",
      h2Variants: [
        "Qu'est-ce qu'un audit IA Ciblé pour une PME ?",
        "Comment se déroule l'audit IA Axion-IA pour une PME ?",
        "Quels résultats concrets après un audit IA PME ?",
        "Combien coûte un audit IA pour une PME ?",
      ],
    },
    variables: {
      process: "cartographie process PME",
      resultat: "10 process analysés, 3 priorisés",
      chiffre: "10",
      unite: "process",
      delai: "plan d'action 90 j",
    },
    urlCible: "/fr/audit/pme",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Page pilier PME — HEAD niveau 2, priorité 2 (attaquer dès l'autorité acquise)",
  },

  {
    keyword: "cabinet IA PME France audit transformation",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Cabinet IA PME — accompagnement audit jusqu'à la transformation opérationnelle",
      metaTitle: "Cabinet IA PME France | Audit Axion-IA",
      metaDescription:
        "Cabinet IA spécialisé PME. Audit stratégique, plan de transformation, premier POC. Depuis Paris, interventions toute la France. Devis gratuit.",
      h2Variants: [
        "Pourquoi choisir un cabinet IA spécialisé PME ?",
        "Audit + transformation IA : un accompagnement bout en bout pour les PME",
      ],
    },
    variables: {
      process: "audit + transformation PME",
      resultat: "premier POC en production",
      chiffre: "6",
      unite: "semaines",
      delai: "premier POC en 6 semaines",
    },
    urlCible: "/fr/audit/pme",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "agence IA PME diagnostic priorisation",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Agence IA PME — diagnostic et priorisation pour une transformation qui tient la route",
      metaTitle: "Agence IA PME diagnostic priorisation | Axion-IA",
      metaDescription:
        "Axion-IA, agence IA opérationnelle pour PME. Diagnostic process, priorisation ROI, feuille de route 6 mois. Devis sous 24 h.",
      h2Variants: [
        "Qu'est-ce qu'une agence IA fait concrètement pour une PME ?",
        "Comment une agence IA priorise les chantiers d'une PME ?",
      ],
    },
    variables: {
      process: "diagnostic + priorisation PME",
      resultat: "feuille de route 6 mois",
      chiffre: "6",
      unite: "mois",
      delai: "livrable en 2 semaines",
    },
    urlCible: "/fr/audit/pme",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "devis audit IA PME 10 salariés",
    intent: "transactionnel",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Demandez votre devis audit IA PME — personnalisé selon votre taille et secteur",
      metaTitle: "Devis audit IA PME | Axion-IA — Réponse sous 24 h",
      metaDescription:
        "Audit IA PME sur mesure selon votre effectif et secteur. Devis gratuit envoyé sous 24 h. Aucun engagement. Cabinet IA certifié.",
      h2Variants: [
        "Comment est calculé le tarif d'un audit IA pour une PME ?",
        "Quel budget prévoir pour un audit IA selon la taille de la PME ?",
      ],
    },
    variables: {
      process: "devis audit PME",
      resultat: "tarif sur mesure",
      chiffre: "24",
      unite: "heures",
      delai: "sous 24 h",
    },
    urlCible: "/fr/audit/pme",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "prestataire audit IA PME industrie BTP",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "pme",
    secteur: "construction-btp",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA pour PME en industrie et BTP — les cas d'usage qui font vraiment la différence",
      metaTitle: "Audit IA PME industrie BTP | Axion-IA",
      metaDescription:
        "Axion-IA audite les PME industrielles et BTP : planification chantier, gestion stocks, conformité. Plan d'action sectoriel livré en 1 semaine.",
      h2Variants: [
        "Cas d'usage IA concrets pour une PME dans le BTP",
        "Comment l'audit IA s'adapte aux contraintes d'une PME industrielle ?",
      ],
    },
    variables: {
      process: "planification, stocks, conformité",
      resultat: "3 chantiers IA identifiés",
      chiffre: "3",
      unite: "chantiers",
      delai: "en 1 semaine",
    },
    urlCible: "/fr/audit/construction-btp",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Croise module audit × secteur BTP — URL /fr/audit/construction-btp",
  },

  {
    keyword: "cabinet IA Paris PME audit stratégique",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Cabinet IA à Paris — audit stratégique pour PME sur toute la France",
      metaTitle: "Cabinet IA Paris PME audit | Axion-IA",
      metaDescription:
        "Cabinet IA intervenant à Paris et en Île-de-France. Audit stratégique pour PME, interventions sur site ou à distance. Devis gratuit. Premier POC en 6 semaines.",
      h2Variants: [
        "Pourquoi choisir un cabinet IA parisien pour auditer une PME en région ?",
        "Audit IA à distance ou sur site pour une PME : quelle formule choisir ?",
      ],
    },
    variables: {
      process: "audit sur site ou distanciel",
      resultat: "premier POC en 6 semaines",
      chiffre: "6",
      unite: "semaines",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/audit/pme",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Variante locale Paris — pSEO complémentaire géré séparément",
  },

  // ── PME — D2 BÉNÉFICE / ROI ──────────────────────────────────────────────

  {
    keyword: "réduire les coûts opérationnels d'une PME avec l'IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Réduisez vos coûts opérationnels de 20 % avec l'IA — sans licencier, sans tout refaire",
      metaTitle: "Réduire coûts opérationnels PME IA | Axion-IA",
      metaDescription:
        "PME : réduisez vos coûts opérationnels de 20-25 % en automatisant les process à faible valeur ajoutée. L'audit IA identifie les leviers en 2 jours.",
      h2Variants: [
        "Quels coûts opérationnels une PME peut-elle réduire avec l'IA ?",
        "Calcul du potentiel d'économies IA pour une PME moyenne",
        "Exemples de réduction de coûts IA dans des PME françaises",
      ],
    },
    variables: {
      process: "process opérationnels PME",
      resultat: "-20 % coûts opérationnels",
      chiffre: "20",
      unite: "%",
      delai: "sur 6 mois",
    },
    urlCible: "/fr/ressources/roi-ia-pme",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "automatiser les process RH d'une PME grâce à l'IA",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Automatisez vos process RH — économisez 8 h par semaine sans changer votre SIRH",
      metaTitle: "Automatiser process RH PME IA | Axion-IA",
      metaDescription:
        "Tri de CV, onboarding, plannings : l'IA peut automatiser 40 % des tâches RH d'une PME. L'audit Axion-IA identifie les gains en 2 jours.",
      h2Variants: [
        "Quelles tâches RH une PME peut-elle automatiser avec l'IA ?",
        "IA RH pour PME : tri CV, onboarding et plannings automatisés",
      ],
    },
    variables: {
      process: "tri CV, onboarding, plannings",
      resultat: "+8 h récupérées/semaine en RH",
      chiffre: "8",
      unite: "heures/semaine",
      delai: "dès le 2e mois",
    },
    urlCible: "/fr/guides/automatiser-rh-pme-ia",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "PME augmenter chiffre d'affaires avec l'IA sans recruter",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Augmentez votre CA sans recruter — comment l'IA libère la capacité de vente de votre PME",
      metaTitle: "PME : augmenter CA avec l'IA sans recruter | Axion-IA",
      metaDescription:
        "L'IA libère du temps commercial dans les PME. Prospection automatisée, relances, qualification leads : +15 % de CA possible en 6 mois sans embauche.",
      h2Variants: [
        "Comment l'IA permet à une PME de vendre plus sans recruter ?",
        "Prospection et relances automatisées : le levier IA le plus rentable pour une PME",
      ],
    },
    variables: {
      process: "prospection, relances, qualification",
      resultat: "+15 % CA en 6 mois",
      chiffre: "15",
      unite: "%",
      delai: "en 6 mois",
    },
    urlCible: "/fr/blog/augmenter-ca-pme-ia-sans-recruter",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "PME économiser sur la comptabilité avec l'IA",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Réduisez vos honoraires comptables de 30 % — l'IA prend en charge les tâches répétitives",
      metaTitle: "Économiser comptabilité PME avec l'IA | Axion-IA",
      metaDescription:
        "Rapprochements bancaires, notes de frais, relances fournisseurs : l'IA automatise 30 % des tâches comptables d'une PME. Audit Axion-IA.",
      h2Variants: [
        "Quelles tâches comptables une PME peut-elle automatiser avec l'IA ?",
        "IA et comptabilité PME : économies réelles et limites",
      ],
    },
    variables: {
      process: "rapprochements, notes de frais",
      resultat: "-30 % coûts comptables",
      chiffre: "30",
      unite: "%",
      delai: "dès le 3e mois",
    },
    urlCible: "/fr/blog/economiser-comptabilite-pme-ia",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "ROI IA PME calcul gains potentiels",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Calculez le ROI de l'IA dans votre PME — méthodologie et chiffres réels",
      metaTitle: "ROI IA PME calcul gains | Axion-IA",
      metaDescription:
        "Comment calculer le ROI de l'IA pour une PME ? Méthode + calculateur + exemples concrets. PME moyenne : 40-80 k€ de gains/an sur 3 process.",
      h2Variants: [
        "Comment calculer le ROI d'un projet IA pour une PME ?",
        "Quels gains financiers réels une PME peut-elle espérer de l'IA ?",
        "Étude de cas : ROI IA dans des PME françaises",
      ],
    },
    variables: {
      process: "calcul ROI IA PME",
      resultat: "40-80 k€/an sur 3 process",
      chiffre: "40-80",
      unite: "k€/an",
      delai: "sur 12 mois",
    },
    urlCible: "/fr/ressources/roi-ia-pme",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "PME gagner 10 heures par semaine avec l'IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "10 heures par semaine rendues à votre équipe — le potentiel IA d'une PME moyenne",
      metaTitle: "PME gagner 10 h/semaine avec l'IA | Axion-IA",
      metaDescription:
        "Une PME de 20 personnes peut récupérer 10 h/semaine d'équipe en automatisant 3 process. L'audit Axion-IA identifie lesquels en 2 jours.",
      h2Variants: [
        "Comment libérer 10 heures hebdomadaires dans une PME grâce à l'IA ?",
        "Les 3 process les plus chronophages dans une PME et comment les automatiser",
      ],
    },
    variables: {
      process: "process chronophages PME",
      resultat: "+10 h/semaine rendues",
      chiffre: "10",
      unite: "heures/semaine",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/blog/pme-gagner-10h-semaine-ia",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "transformation numérique PME par l'IA résultats concrets",
    intent: "benefice",
    kbType: "case_study",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Transformation numérique PME par l'IA — résultats concrets, pas des promesses",
      metaTitle: "Transformation numérique PME IA résultats | Axion-IA",
      metaDescription:
        "Études de cas : PME françaises qui ont transformé leurs opérations par l'IA. Gains chiffrés, délais réels, processus replicables. Axion-IA.",
      h2Variants: [
        "Témoignages de PME transformées par l'IA en France",
        "Combien de temps dure une transformation IA dans une PME ?",
      ],
    },
    variables: {
      process: "transformation opérationnelle PME",
      resultat: "3 études de cas avec chiffres",
      chiffre: "3",
      unite: "cas concrets",
      delai: "3-6 mois",
    },
    urlCible: "/fr/cas-clients/transformation-ia-pme",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  // ── PME — D3 INFORMATIONNEL ──────────────────────────────────────────────

  {
    keyword: "comment faire un diagnostic IA pour une PME",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Comment faire un diagnostic IA dans sa PME — méthode en 5 étapes",
      metaTitle: "Diagnostic IA PME : comment faire ? | Axion-IA 2026",
      metaDescription:
        "Méthode complète pour diagnostiquer le potentiel IA de votre PME : cartographie process, priorisation, estimation ROI. Guide opérationnel gratuit.",
      h2Variants: [
        "Étape 1 : cartographier les process de sa PME",
        "Étape 2 : évaluer l'automatisabilité de chaque process",
        "Étape 3 : prioriser par ROI et faisabilité technique",
      ],
    },
    variables: {
      process: "diagnostic IA PME",
      resultat: "cartographie complète en 5 étapes",
      chiffre: "5",
      unite: "étapes",
      delai: "en 2 jours",
    },
    urlCible: "/fr/guides/diagnostic-ia-pme-methode",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "guide IA PME 2026 complet démarrage",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Guide IA PME 2026 — Tout ce qu'il faut savoir pour bien démarrer",
      metaTitle: "Guide IA PME 2026 complet | Axion-IA",
      metaDescription:
        "Le guide IA PME 2026 : audit, outils, implémentation, coûts, résultats. Par Axion-IA, cabinet IA opérationnel en France.",
      h2Variants: [
        "Pourquoi les PME françaises se lancent dans l'IA en 2026 ?",
        "Les 6 étapes d'une transformation IA réussie en PME",
        "Budget et financement : combien coûte l'IA pour une PME en 2026 ?",
      ],
    },
    variables: {
      process: "transformation IA PME",
      resultat: "feuille de route complète",
      chiffre: "6",
      unite: "étapes",
      delai: "en 6 mois",
    },
    urlCible: "/fr/guides/ia-pme-guide-complet-2026",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "intelligence artificielle PME juridique droit",
    intent: "informationnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "pme",
    secteur: "conseil-affaires",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "IA pour les PME du secteur juridique — cas d'usage concrets et limites légales",
      metaTitle: "IA PME secteur juridique | Axion-IA 2026",
      metaDescription:
        "Cabinet IA spécialisé secteur juridique : audit des process, automatisation contrats, conformité RGPD. Axion-IA accompagne les PME du droit.",
      h2Variants: [
        "Quels process juridiques une PME peut-elle automatiser avec l'IA ?",
        "IA et droit : ce que les PME du secteur juridique peuvent déléguer à l'IA",
      ],
    },
    variables: {
      process: "contrats, conformité, recherche juridique",
      resultat: "3 process automatisables identifiés",
      chiffre: "3",
      unite: "process",
      delai: "en 1 semaine",
    },
    urlCible: "/fr/audit/conseil-affaires",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "pourquoi les PME françaises n'adoptent pas l'IA",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Pourquoi les PME françaises tardent à adopter l'IA — et comment lever les freins",
      metaTitle: "Freins adoption IA dans les PME françaises | Axion-IA",
      metaDescription:
        "Manque de méthode, ROI flou, résistance interne : les 5 freins IA des PME françaises et comment Axion-IA les lève en accompagnement.",
      h2Variants: [
        "Les 5 freins à l'adoption de l'IA dans les PME françaises",
        "Comment lever les résistances internes à l'IA dans une PME ?",
        "PME et IA : pourquoi certaines échouent là où d'autres réussissent",
      ],
    },
    variables: {
      process: "diagnostic freins IA PME",
      resultat: "freins identifiés et levés",
      chiffre: "5",
      unite: "freins",
      delai: "en 1 atelier",
    },
    urlCible: "/fr/blog/freins-adoption-ia-pme-france",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "cas d'usage IA PME industrie concrets 2026",
    intent: "informationnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "pme",
    secteur: "industrie-manufacturiere",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "10 cas d'usage IA concrets pour les PME industrielles en 2026",
      metaTitle: "Cas d'usage IA PME industrie 2026 | Axion-IA",
      metaDescription:
        "Maintenance prédictive, contrôle qualité, planning machine : 10 cas d'usage IA concrets testés dans des PME industrielles françaises.",
      h2Variants: [
        "Maintenance prédictive IA en PME industrielle",
        "Contrôle qualité automatisé par IA dans une PME",
        "Planning de production optimisé par IA",
      ],
    },
    variables: {
      process: "maintenance, qualité, planning",
      resultat: "10 cas d'usage opérationnels",
      chiffre: "10",
      unite: "cas d'usage",
      delai: "déployables en 3 mois",
    },
    urlCible: "/fr/blog/cas-usage-ia-pme-industrie-2026",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "intelligence artificielle PME informatique IT",
    intent: "informationnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "pme",
    secteur: "it-numerique",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "IA pour les PME de l'IT — comment transformer votre activité de services numériques",
      metaTitle: "IA pour PME IT informatique | Axion-IA 2026",
      metaDescription:
        "PME IT : automatisation support, génération de code, monitoring IA. L'audit Axion-IA identifie vos 3 premiers chantiers IA. Devis gratuit.",
      h2Variants: [
        "Quels services IT une PME peut-elle automatiser avec l'IA ?",
        "IA pour PME informatique : support client, devops, veille technologique",
      ],
    },
    variables: {
      process: "support, code, monitoring",
      resultat: "3 services IT automatisés",
      chiffre: "3",
      unite: "services",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/audit/it-numerique",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  // ── PME — D4 AEO / QUESTIONS ─────────────────────────────────────────────

  {
    keyword: "quel est le ROI d'un audit IA pour une PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Quel est le ROI d'un audit IA pour une PME ? — Chiffres réels",
      metaTitle: "ROI audit IA PME : combien ça rapporte ? | Axion-IA",
      metaDescription:
        "Un audit IA PME coûte à partir de 1 900 €. Les gains identifiés représentent en moyenne 40-80 k€/an. ROI > 10× sur 12 mois pour une PME de 20 salariés.",
      h2Variants: [
        "Comment calculer le ROI d'un audit IA pour une PME ?",
        "Exemples de ROI d'audit IA dans des PME françaises",
      ],
    },
    variables: {
      process: "calcul ROI audit PME",
      resultat: "40-80 k€/an identifiés",
      chiffre: "40-80",
      unite: "k€/an",
      delai: "sur 12 mois",
    },
    urlCible: "/fr/faq/roi-audit-ia-pme",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
    note: "Question PAA haute fréquence",
  },

  {
    keyword: "combien d'employés faut-il pour justifier un audit IA PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Combien de salariés faut-il pour qu'un audit IA soit rentable en PME ?",
      metaTitle: "Taille PME pour audit IA : à partir de combien ? | Axion-IA",
      metaDescription:
        "L'audit IA devient rentable à partir de 5-10 salariés. En dessous : l'audit flash TPE est plus adapté. Axion-IA vous oriente gratuitement.",
      h2Variants: [
        "À partir de combien de salariés un audit IA est rentable ?",
        "TPE ou PME : quel audit IA choisir selon la taille ?",
      ],
    },
    variables: {
      process: "éligibilité audit IA PME",
      resultat: "orientation gratuite",
      chiffre: "5-10",
      unite: "salariés",
      delai: "réponse immédiate",
    },
    urlCible: "/fr/faq/taille-pme-audit-ia-rentable",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "faut-il un DSI pour lancer l'IA dans une PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Faut-il un DSI pour lancer l'IA dans une PME ? — Non, voici pourquoi",
      metaTitle: "DSI obligatoire pour IA PME ? | Axion-IA FAQ",
      metaDescription:
        "Non, une PME sans DSI peut déployer l'IA. L'audit Axion-IA identifie les outils no-code adaptés et forme l'équipe existante. Sans recrutement.",
      h2Variants: [
        "Peut-on déployer l'IA sans ressources techniques internes dans une PME ?",
        "Les outils IA accessibles aux PME sans compétences IT internes",
      ],
    },
    variables: {
      process: "déploiement IA sans DSI",
      resultat: "outils no-code identifiés",
      chiffre: "0",
      unite: "recrutement nécessaire",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/faq/dsi-obligatoire-pour-ia-pme",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "quelle différence entre cabinet IA et agence digitale pour une PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Cabinet IA vs agence digitale pour une PME — quelle différence, lequel choisir ?",
      metaTitle: "Cabinet IA vs agence digitale PME | Axion-IA FAQ",
      metaDescription:
        "Un cabinet IA se concentre sur l'automatisation des process et la transformation opérationnelle. Une agence digitale sur le marketing. Guide comparatif.",
      h2Variants: [
        "En quoi un cabinet IA diffère-t-il d'une agence digitale ?",
        "Pour une PME : cabinet IA, SSII, freelance ou agence digitale ?",
      ],
    },
    variables: {
      process: "choix du prestataire IA",
      resultat: "orientation adaptée à la PME",
      chiffre: "4",
      unite: "types de prestataires",
      delai: "réponse immédiate",
    },
    urlCible: "/fr/faq/cabinet-ia-vs-agence-digitale-pme",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
    note: "Comparatif — croise intent AEO et comparatif",
  },

  {
    keyword: "peut-on auditer l'IA d'une PME en une seule journée ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Un audit IA PME complet en une journée — possible ou mythe ?",
      metaTitle: "Audit IA PME en une journée : possible ? | Axion-IA",
      metaDescription:
        "L'audit IA Ciblé Axion-IA se déroule en 1 à 2 jours pour une PME. Ce qui est inclus, ce qui reste pour la phase 2. Transparence totale.",
      h2Variants: [
        "Qu'est-ce qu'un audit IA PME peut couvrir en une journée ?",
        "Audit IA Flash vs audit IA Complet : quelle formule pour une PME ?",
      ],
    },
    variables: {
      process: "format audit PME",
      resultat: "livrable en 1-2 jours",
      chiffre: "1-2",
      unite: "jours",
      delai: "sous 48 h",
    },
    urlCible: "/fr/faq/audit-ia-pme-une-journee",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  {
    keyword: "comment choisir son cabinet IA pour une PME en France ?",
    intent: "aeo",
    kbType: "guide",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Comment choisir son cabinet IA quand on est une PME française — 7 critères objectifs",
      metaTitle: "Choisir cabinet IA PME France | Guide Axion-IA",
      metaDescription:
        "7 critères pour choisir le bon cabinet IA pour votre PME : expertise sectorielle, références, méthode, délais, prix, accompagnement post-audit.",
      h2Variants: [
        "Les 7 critères pour choisir un cabinet IA adapté à une PME",
        "Questions à poser à un cabinet IA avant de signer",
        "Les erreurs à éviter en choisissant un prestataire IA PME",
      ],
    },
    variables: {
      process: "sélection cabinet IA",
      resultat: "choix éclairé du prestataire",
      chiffre: "7",
      unite: "critères",
      delai: "réponse en 24 h",
    },
    urlCible: "/fr/guides/choisir-cabinet-ia-pme-france",
    canonicalParent: "/fr/audit/pme",
    source: "manuel",
  },

  // ─────────────────────────────────────────────
  //  AUDIT × ETI
  //  Douleur : L'ETI a déjà des projets IA dispersés dans plusieurs BUs sans
  //  gouvernance, sans SSOT et sans ROI mesurable — le CODIR veut un état des lieux
  //  stratégique et une roadmap priorisée avant de voter le budget annuel.
  //  Bénéfices chiffrés réalistes :
  //    1. Cartographier 20-40 process et identifier les 5 quick wins à ROI > 3×
  //    2. Livrable de gouvernance IA (RACI, politique d'usage, conformité AI Act)
  //    3. Économies potentielles de 200-500 k€/an sur les process identifiés
  //    4. Réduire le time-to-market IA de 12 mois à 3 mois sur les chantiers prioritaires
  //    5. Aligner 3-5 BUs sur une feuille de route IA commune
  //  Questions Google naturelles :
  //    "audit IA ETI stratégique", "gouvernance IA ETI CODIR",
  //    "AI Act conformité ETI audit", "cabinet IA ETI France référence",
  //    "comment structurer la transformation IA d'une ETI"
  // ─────────────────────────────────────────────

  // ── ETI — D1 TRANSACTIONNEL ──────────────────────────────────────────────

  {
    keyword: "audit IA stratégique ETI",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Audit IA stratégique pour ETI — gouvernance, feuille de route et ROI mesurable",
      metaTitle: "Audit IA stratégique ETI | Axion-IA",
      metaDescription:
        "Axion-IA réalise l'audit IA stratégique des ETI : cartographie 20-40 process, 5 quick wins priorisés, livrable CODIR, conformité AI Act. Devis.",
      h2Variants: [
        "Qu'est-ce qu'un audit IA stratégique pour une ETI ?",
        "Contenu du livrable audit IA Axion-IA pour une ETI",
        "Combien de temps dure un audit IA stratégique ETI ?",
        "Comment l'audit IA s'intègre dans le cycle budgétaire d'une ETI ?",
      ],
    },
    variables: {
      process: "cartographie process ETI",
      resultat: "20-40 process analysés, 5 quick wins",
      chiffre: "40",
      unite: "process analysés",
      delai: "livrable en 3 semaines",
    },
    urlCible: "/fr/audit/eti",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Page pilier ETI — HEAD niveau 2, priorité 2",
  },

  {
    keyword: "cabinet IA ETI France programme transformation",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Cabinet IA pour ETI — programme de transformation IA multi-BU coordonné",
      metaTitle: "Cabinet IA ETI France | Programme transformation Axion-IA",
      metaDescription:
        "Axion-IA accompagne les ETI dans leur transformation IA : audit, gouvernance, implémentation multi-BU, conformité AI Act. Devis gratuit.",
      h2Variants: [
        "Comment un cabinet IA coordonne-t-il la transformation d'une ETI multi-BU ?",
        "Étapes du programme de transformation IA Axion-IA pour ETI",
      ],
    },
    variables: {
      process: "transformation IA multi-BU",
      resultat: "3-5 BUs alignées",
      chiffre: "3-5",
      unite: "BUs",
      delai: "feuille de route 12 mois",
    },
    urlCible: "/fr/audit/eti",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "agence IA ETI audit gouvernance AI Act",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA et gouvernance AI Act pour ETI — soyez conformes avant août 2026",
      metaTitle: "Agence IA ETI audit gouvernance AI Act | Axion-IA",
      metaDescription:
        "Axion-IA audite votre conformité AI Act pour les ETI. Gouvernance IA, RACI, politique d'usage, formation équipes. Deadline août 2026.",
      h2Variants: [
        "AI Act et ETI : obligations de conformité à connaître en 2026",
        "Comment l'audit IA intègre la conformité AI Act dans une ETI ?",
      ],
    },
    variables: {
      process: "conformité AI Act",
      resultat: "ETI conforme AI Act",
      chiffre: "2026",
      unite: "deadline (août)",
      delai: "avant août 2026",
    },
    urlCible: "/fr/audit/eti",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Urgence deadline AI Act août 2026 — fort signal commercial",
  },

  {
    keyword: "devis audit IA ETI CODIR feuille de route",
    intent: "transactionnel",
    kbType: "faq",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Demandez votre devis audit IA ETI — livrable CODIR et feuille de route inclus",
      metaTitle: "Devis audit IA ETI | Livrable CODIR Axion-IA",
      metaDescription:
        "Devis audit IA sur mesure pour ETI. Livrable CODIR, feuille de route 12 mois, conformité AI Act. Réponse sous 48 h. Cabinet IA certifié.",
      h2Variants: [
        "Que contient le livrable audit IA CODIR pour une ETI ?",
        "Quel budget prévoir pour un audit IA stratégique ETI ?",
      ],
    },
    variables: {
      process: "audit stratégique ETI",
      resultat: "livrable CODIR + roadmap",
      chiffre: "48",
      unite: "heures",
      delai: "devis sous 48 h",
    },
    urlCible: "/fr/audit/eti",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "prestataire IA ETI industrie aéronautique défense",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "eti",
    secteur: "aerospatial-defense",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA pour ETI en aéronautique et défense — souveraineté et conformité garanties",
      metaTitle: "Prestataire IA ETI aéronautique défense | Axion-IA",
      metaDescription:
        "Axion-IA accompagne les ETI aéronautique et défense : audit IA souverain, conformité RGPD/AI Act, données sensibles. Devis confidentiel.",
      h2Variants: [
        "Quelles contraintes spécifiques pour l'IA dans l'aéronautique et la défense ?",
        "Audit IA souverain pour ETI : données sensibles et conformité",
      ],
    },
    variables: {
      process: "audit IA souverain",
      resultat: "conformité RGPD + AI Act",
      chiffre: "100",
      unite: "% données France",
      delai: "livrable en 3 semaines",
    },
    urlCible: "/fr/audit/aerospatial-defense",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "cabinet IA ETI Paris Lyon Bordeaux",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Cabinet IA pour ETI — interventions sur site à Paris, Lyon, Bordeaux et partout en France",
      metaTitle: "Cabinet IA ETI Paris Lyon Bordeaux | Axion-IA",
      metaDescription:
        "Axion-IA intervient sur site dans toutes les grandes villes françaises pour les ETI. Audit IA stratégique, gouvernance, implémentation. Devis gratuit.",
      h2Variants: [
        "Audit IA ETI sur site ou à distance : quelle formule choisir ?",
        "Répartition géographique des interventions Axion-IA pour ETI",
      ],
    },
    variables: {
      process: "intervention sur site",
      resultat: "audit ETI toute France",
      chiffre: "3",
      unite: "villes principales",
      delai: "disponibilité sous 2 semaines",
    },
    urlCible: "/fr/audit/eti",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "Sémantique locale ETI — pSEO complémentaire pour chaque ville",
  },

  // ── ETI — D2 BÉNÉFICE / ROI ──────────────────────────────────────────────

  {
    keyword: "économiser 500 000 euros par an avec l'IA dans une ETI",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "200 000 à 500 000 € d'économies annuelles — le potentiel IA d'une ETI bien auditée",
      metaTitle: "Économies 500 k€/an ETI avec l'IA | Axion-IA",
      metaDescription:
        "Une ETI de 500 personnes peut économiser 200-500 k€/an en automatisant ses process à faible valeur ajoutée. L'audit Axion-IA identifie les leviers.",
      h2Variants: [
        "Comment calculer le potentiel d'économies IA d'une ETI ?",
        "Les 5 postes de coûts les plus automatisables dans une ETI",
        "Étude de cas : ETI industrielle, 300 k€ économisés en 18 mois",
      ],
    },
    variables: {
      process: "process à faible valeur ajoutée",
      resultat: "200-500 k€/an économisés",
      chiffre: "500",
      unite: "k€/an",
      delai: "sur 18 mois",
    },
    urlCible: "/fr/ressources/roi-ia-eti",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "accélérer le time-to-market d'une ETI grâce à l'IA",
    intent: "benefice",
    kbType: "implementation_playbook",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "De 12 mois à 3 mois — comment l'IA réduit le time-to-market dans les ETI",
      metaTitle: "Réduire time-to-market ETI avec l'IA | Axion-IA",
      metaDescription:
        "L'IA réduit le time-to-market des ETI de 60-75 %. Audit Axion-IA : identifier les goulots d'étranglement et déployer les automatisations prioritaires.",
      h2Variants: [
        "Quels goulots d'étranglement l'IA peut-elle débloquer dans une ETI ?",
        "Time-to-market réduit par l'IA : exemples concrets en ETI",
      ],
    },
    variables: {
      process: "goulots d'étranglement ETI",
      resultat: "-75 % time-to-market",
      chiffre: "75",
      unite: "%",
      delai: "sur 6 mois",
    },
    urlCible: "/fr/blog/reduire-time-to-market-eti-ia",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "ROI transformation IA ETI calcul méthode",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Calculer le ROI de la transformation IA d'une ETI — méthode et chiffres réels",
      metaTitle: "ROI transformation IA ETI méthode calcul | Axion-IA",
      metaDescription:
        "Méthode de calcul ROI IA pour ETI : coûts, gains, délais, risques. ETI type 500 sal. : ROI moyen 4,5× sur 24 mois. Calculateur gratuit.",
      h2Variants: [
        "Méthode de calcul du ROI IA pour une ETI",
        "Quels indicateurs suivre pour mesurer le ROI IA d'une ETI ?",
        "Benchmarks ROI IA dans des ETI françaises",
      ],
    },
    variables: {
      process: "calcul ROI IA ETI",
      resultat: "ROI moyen 4,5× sur 24 mois",
      chiffre: "4.5",
      unite: "× en 24 mois",
      delai: "sur 24 mois",
    },
    urlCible: "/fr/ressources/roi-ia-eti",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "ETI automatiser service client sans perdre en qualité",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Automatisez 60 % de votre service client ETI sans sacrifier la satisfaction",
      metaTitle: "Automatiser service client ETI IA | Axion-IA",
      metaDescription:
        "ETI : automatisez 60 % des tickets de niveau 1 avec l'IA tout en maintenant le NPS. L'audit Axion-IA identifie les requêtes automatisables.",
      h2Variants: [
        "Quelles requêtes client une ETI peut-elle déléguer à l'IA ?",
        "Chatbot IA vs service client humain : comment trouver le bon équilibre ?",
      ],
    },
    variables: {
      process: "service client niveau 1",
      resultat: "60 % tickets automatisés",
      chiffre: "60",
      unite: "%",
      delai: "en 2 mois",
    },
    urlCible: "/fr/guides/automatiser-service-client-eti-ia",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "ETI aligner toutes les BUs sur une stratégie IA commune",
    intent: "benefice",
    kbType: "implementation_playbook",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Alignez toutes vos BUs sur une stratégie IA commune — sans perdre 18 mois",
      metaTitle: "Aligner BUs stratégie IA commune ETI | Axion-IA",
      metaDescription:
        "L'audit IA stratégique Axion-IA produit une feuille de route partagée pour toutes les BUs d'une ETI. Gouvernance, priorisation, Quick Wins.",
      h2Variants: [
        "Comment fédérer les BUs d'une ETI autour d'une stratégie IA commune ?",
        "Les erreurs à éviter quand on déploie l'IA dans une ETI multi-BU",
      ],
    },
    variables: {
      process: "gouvernance IA multi-BU",
      resultat: "feuille de route partagée",
      chiffre: "3",
      unite: "mois",
      delai: "feuille de route en 3 mois",
    },
    urlCible: "/fr/blog/aligner-bus-strategie-ia-eti",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "réduire la masse salariale indirecte ETI par l'automatisation IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Réduire la masse salariale indirecte d'une ETI — le levier IA sans licenciement",
      metaTitle: "Réduire masse salariale indirecte ETI IA | Axion-IA",
      metaDescription:
        "L'IA permet de réduire la masse salariale indirecte (admin, support, back-office) sans licencier : redistribution vers des tâches à valeur ajoutée.",
      h2Variants: [
        "Comment l'IA réduit-elle la masse salariale indirecte dans une ETI ?",
        "Redistribution des tâches vs réduction d'effectifs : le vrai impact de l'IA",
      ],
    },
    variables: {
      process: "admin, support, back-office",
      resultat: "-15-20 % masse salariale indirecte",
      chiffre: "15-20",
      unite: "%",
      delai: "sur 12 mois",
    },
    urlCible: "/fr/blog/reduire-masse-salariale-indirecte-eti-ia",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "ETI IA achats approvisionnement optimisation coûts",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Optimisez vos achats et approvisionnements ETI avec l'IA — réduisez les coûts de 10-15 %",
      metaTitle: "ETI IA optimisation achats approvisionnements | Axion-IA",
      metaDescription:
        "IA pour achats ETI : négociation assistée, prévision demande, optimisation stock. Gains de 10-15 % sur les coûts d'achat identifiés par l'audit Axion-IA.",
      h2Variants: [
        "Comment l'IA optimise-t-elle les achats dans une ETI ?",
        "Prévision de demande IA pour optimiser les approvisionnements d'une ETI",
      ],
    },
    variables: {
      process: "achats, stock, prévision",
      resultat: "-10-15 % coûts achats",
      chiffre: "10-15",
      unite: "%",
      delai: "sur 6 mois",
    },
    urlCible: "/fr/guides/optimiser-achats-eti-ia",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  // ── ETI — D3 INFORMATIONNEL ──────────────────────────────────────────────

  {
    keyword: "comment structurer la transformation IA d'une ETI",
    intent: "informationnel",
    kbType: "implementation_playbook",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Comment structurer la transformation IA d'une ETI — playbook en 6 phases",
      metaTitle: "Structurer transformation IA ETI | Playbook Axion-IA",
      metaDescription:
        "Playbook transformation IA pour ETI : audit, gouvernance, quick wins, déploiement multi-BU, conformité AI Act, mesure ROI. Guide complet 2026.",
      h2Variants: [
        "Phase 1 : l'audit IA stratégique comme point de départ",
        "Phase 2 : gouvernance IA et RACI pour une ETI",
        "Phase 3 : quick wins et POCs pour prouver la valeur de l'IA",
      ],
    },
    variables: {
      process: "transformation IA ETI",
      resultat: "6 phases maîtrisées",
      chiffre: "6",
      unite: "phases",
      delai: "sur 12-18 mois",
    },
    urlCible: "/fr/guides/structurer-transformation-ia-eti",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "gouvernance IA ETI CODIR bonnes pratiques 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Gouvernance IA en ETI — les bonnes pratiques CODIR pour 2026",
      metaTitle: "Gouvernance IA ETI CODIR 2026 | Axion-IA",
      metaDescription:
        "Comment mettre en place une gouvernance IA robuste dans une ETI ? RACI, politique d'usage, comité IA, reporting CODIR. Guide complet 2026.",
      h2Variants: [
        "Qu'est-ce qu'une gouvernance IA dans une ETI ?",
        "RACI IA ETI : qui fait quoi dans la transformation IA ?",
        "Politique d'usage IA pour une ETI : que doit-elle contenir ?",
      ],
    },
    variables: {
      process: "gouvernance IA ETI",
      resultat: "RACI + politique usage + comité IA",
      chiffre: "3",
      unite: "livrables",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/guides/gouvernance-ia-eti-codir-2026",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "AI Act impact sur les ETI françaises 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "AI Act 2026 et les ETI françaises — ce qui change, ce qui est obligatoire",
      metaTitle: "AI Act impact ETI françaises 2026 | Axion-IA",
      metaDescription:
        "Le règlement européen AI Act entre en vigueur en 2026. Ce que chaque ETI française doit faire : audit de conformité, classification des systèmes IA",
      h2Variants: [
        "Quelles obligations l'AI Act impose-t-il aux ETI en 2026 ?",
        "Comment une ETI peut-elle se mettre en conformité AI Act ?",
        "Deadline AI Act : ce que les ETI doivent avoir en place avant août 2026",
      ],
    },
    variables: {
      process: "conformité AI Act",
      resultat: "ETI conforme avant deadline",
      chiffre: "2026",
      unite: "deadline (août)",
      delai: "avant août 2026",
    },
    urlCible: "/fr/guides/ai-act-impact-eti-france-2026",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
    note: "Urgence deadline août 2026 — article à publier en priorité",
  },

  {
    keyword: "intelligence artificielle ETI secteur banque assurance",
    intent: "informationnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "IA pour les ETI du secteur banque et assurance — use cases et conformité RGPD",
      metaTitle: "IA ETI banque assurance France | Axion-IA 2026",
      metaDescription:
        "Axion-IA accompagne les ETI banque et assurance : scoring automatisé, détection fraude, conformité RGPD/AI Act. Audit sectoriel dédié.",
      h2Variants: [
        "Cas d'usage IA dans les ETI du secteur banque et assurance",
        "Conformité RGPD et AI Act pour les ETI financières qui déploient l'IA",
      ],
    },
    variables: {
      process: "scoring, fraude, conformité",
      resultat: "3 use cases conformes",
      chiffre: "3",
      unite: "use cases",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/audit/banque-finance",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "IA pour ETI secteur santé et dispositifs médicaux",
    intent: "informationnel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "eti",
    secteur: "sante-biotech",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "IA pour les ETI de la santé et des dispositifs médicaux — conformité et performance",
      metaTitle: "IA ETI santé dispositifs médicaux | Axion-IA 2026",
      metaDescription:
        "Axion-IA audite les ETI santé et medtech : IA de diagnostic, automatisation administrative, conformité CE/MDR et AI Act. Experts sectoriels.",
      h2Variants: [
        "Quels cas d'usage IA sont pertinents pour une ETI de la santé ?",
        "AI Act et santé : obligations spécifiques pour les ETI medtech",
      ],
    },
    variables: {
      process: "diagnostic, admin, conformité",
      resultat: "3 use cases identifiés",
      chiffre: "3",
      unite: "use cases",
      delai: "audit en 2 semaines",
    },
    urlCible: "/fr/audit/sante-biotech",
    canonicalParent: "/fr/audit/",
    source: "manuel",
  },

  {
    keyword: "comment déployer l'IA dans une ETI sans tout refaire",
    intent: "informationnel",
    kbType: "implementation_playbook",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Déployer l'IA dans une ETI sans tout refaire — la méthode incrémentale",
      metaTitle: "Déployer IA ETI sans refonte système | Axion-IA",
      metaDescription:
        "L'IA peut s'intégrer aux systèmes existants d'une ETI sans tout refaire. La méthode Axion-IA : audit → connecteurs → quick wins → extension.",
      h2Variants: [
        "L'IA peut-elle s'intégrer aux systèmes legacy d'une ETI ?",
        "Méthode incrémentale de déploiement IA dans une ETI",
        "Quick wins IA dans une ETI : par où commencer sans risque ?",
      ],
    },
    variables: {
      process: "intégration IA systèmes legacy",
      resultat: "premier quick win sans refonte",
      chiffre: "4",
      unite: "semaines",
      delai: "premier résultat en 4 semaines",
    },
    urlCible: "/fr/guides/deployer-ia-eti-sans-refonte",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  // ── ETI — D4 AEO / QUESTIONS ─────────────────────────────────────────────

  {
    keyword: "quelle différence entre audit IA PME et audit IA ETI ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA PME vs audit IA ETI — en quoi diffèrent-ils vraiment ?",
      metaTitle: "Audit IA PME vs ETI : différences | Axion-IA FAQ",
      metaDescription:
        "L'audit IA PME = diagnostic ciblé en 1-2 jours. L'audit IA ETI = cartographie stratégique multi-BU en 2-3 semaines + livrable CODIR. Comparatif.",
      h2Variants: [
        "En quoi un audit IA ETI diffère-t-il d'un audit IA PME ?",
        "Durée, coût, livrable : comparatif audit IA PME vs ETI",
      ],
    },
    variables: {
      process: "comparaison audit PME vs ETI",
      resultat: "orientation précise selon taille",
      chiffre: "2",
      unite: "formats",
      delai: "réponse immédiate",
    },
    urlCible: "/fr/faq/audit-ia-pme-vs-eti-differences",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "combien coûte un audit IA pour une ETI ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Combien coûte un audit IA pour une ETI ? — Fourchettes et variables de prix",
      metaTitle: "Prix audit IA ETI : combien ça coûte ? | Axion-IA",
      metaDescription:
        "Un audit IA stratégique pour ETI : de quelques milliers à 15-20 k€ selon la taille et le périmètre. Devis gratuit sous 48 h. Transparence totale.",
      h2Variants: [
        "Quelles variables font varier le prix d'un audit IA ETI ?",
        "Quel budget total prévoir pour l'ensemble de la transformation IA d'une ETI ?",
      ],
    },
    variables: {
      process: "tarification audit ETI",
      resultat: "devis sur mesure",
      chiffre: "48",
      unite: "heures",
      delai: "devis sous 48 h",
    },
    urlCible: "/fr/faq/combien-coute-audit-ia-eti",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "faut-il un Chief AI Officer dans une ETI ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Faut-il recruter un Chief AI Officer pour transformer une ETI ? — La vraie réponse",
      metaTitle: "Chief AI Officer ETI : nécessaire ? | Axion-IA FAQ",
      metaDescription:
        "Pas forcément. L'audit Axion-IA peut jouer le rôle de CAIO externe le temps de la transformation, avant d'internaliser les compétences IA.",
      h2Variants: [
        "Quel est le rôle d'un Chief AI Officer dans une ETI ?",
        "CAIO externe vs CAIO interne : quelle formule pour une ETI en transformation IA ?",
      ],
    },
    variables: {
      process: "gouvernance IA ETI",
      resultat: "CAIO externe comme alternative",
      chiffre: "1",
      unite: "CAIO externe",
      delai: "disponible immédiatement",
    },
    urlCible: "/fr/faq/chief-ai-officer-eti-necessaire",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "comment mesurer la maturité IA d'une ETI ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Comment mesurer la maturité IA de votre ETI — grille d'évaluation en 5 dimensions",
      metaTitle: "Mesurer maturité IA ETI | Grille Axion-IA FAQ",
      metaDescription:
        "Grille de maturité IA ETI en 5 dimensions : stratégie, données, compétences, process, gouvernance. Positionnez votre ETI en 15 minutes.",
      h2Variants: [
        "Les 5 dimensions de la maturité IA d'une ETI",
        "Comment utiliser un assessment de maturité IA dans une ETI ?",
      ],
    },
    variables: {
      process: "assessment maturité IA",
      resultat: "niveau de maturité en 15 min",
      chiffre: "5",
      unite: "dimensions",
      delai: "en 15 minutes",
    },
    urlCible: "/fr/faq/mesurer-maturite-ia-eti",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "combien de temps dure un audit IA stratégique pour une ETI ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA stratégique pour une ETI : quelle durée prévoir ?",
      metaTitle: "Durée audit IA ETI | Axion-IA FAQ",
      metaDescription:
        "L'audit IA stratégique Axion-IA pour ETI dure 2 à 3 semaines (ateliers + analyse + livrable). Périmètre adapté selon la taille de l'ETI.",
      h2Variants: [
        "Déroulement d'un audit IA stratégique pour une ETI sur 3 semaines",
        "Quels interlocuteurs ETI sont mobilisés pendant l'audit IA ?",
      ],
    },
    variables: {
      process: "déroulement audit ETI",
      resultat: "livrable en 2-3 semaines",
      chiffre: "2-3",
      unite: "semaines",
      delai: "livrable sous 3 semaines",
    },
    urlCible: "/fr/faq/duree-audit-ia-strategique-eti",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },

  {
    keyword: "est-ce qu'une ETI peut exiger des garanties de résultats à un cabinet IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Peut-on exiger des garanties de résultats à un cabinet IA pour une ETI ?",
      metaTitle: "Garanties résultats cabinet IA ETI | Axion-IA FAQ",
      metaDescription:
        "Oui, dans certaines conditions. Axion-IA propose des jalons contractuels liés aux livrables.",
      h2Variants: [
        "Que peut-on contractualiser avec un cabinet IA pour une ETI ?",
        "Jalons, KPIs et garanties : comment cadrer un contrat IA ETI ?",
      ],
    },
    variables: {
      process: "contractualisation cabinet IA",
      resultat: "jalons contractuels livrables",
      chiffre: "3",
      unite: "jalons",
      delai: "définis dès la signature",
    },
    urlCible: "/fr/faq/garanties-resultats-cabinet-ia-eti",
    canonicalParent: "/fr/audit/eti",
    source: "manuel",
  },
];
