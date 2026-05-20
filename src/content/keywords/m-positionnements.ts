/**
 * Keyword Seeds — MODE M : Positionnements de communication Axion-IA
 * 6 positionnements × ~6 seeds = 37 seeds
 * Généré le 2026-05-20 depuis PROMPT-KEYWORD-STRATEGY-MASTER-V1.md v1.2
 *
 * Règles mémoire (décisions Will 2026-05-19) :
 *   - Positionnement "cabinet IA" ET "agence IA" (les deux valides)
 *   - PAS "Made in France" → "franco-européen", "expertise française", "données en Europe"
 *   - PAS "OÜ" visible dans aucun champ
 *   - PAS Qualiopi / OPCO / CPF
 *   - "N°1 France" = objectif → formuler "référence", "reconnu", "opérationnel"
 *   - niveau 1 → priorite ≥ 2 (règle anti-cannibalisation HEAD)
 *   - H1 : bénéfice, jamais keyword brut (règle R5)
 *   - metaTitle ≤ 60 chars · metaDescription ≤ 155 chars
 *
 * Distribution :
 *   P1 — Référence France         (5 seeds — transactionnel/benefice)
 *   P2 — Opérationnel rapide      (6 seeds — transactionnel/benefice)
 *   P3 — Accessible petit budget  (5 seeds — transactionnel/informationnel)
 *   P4 — Grands programmes        (6 seeds — transactionnel/benefice)
 *   P5 — Franco-européen / Local  (6 seeds — transactionnel/benefice/informationnel)
 *   P6 — Spécialiste Claude/Anthropic (9 seeds — transactionnel/informationnel)
 */

import type { KeywordSeed } from "./types";

export const KW_POSITIONNEMENTS_M: KeywordSeed[] = [
  // ══════════════════════════════════════════════════════════════════════
  // POSITIONNEMENT 1 — RÉFÉRENCE FRANCE
  // Intent : transactionnel / benefice — Module : transversal
  // ══════════════════════════════════════════════════════════════════════

  {
    keyword: "référence IA B2B France",
    intent: "benefice",
    kbType: "intervention_module",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Le cabinet IA de référence pour les entreprises françaises — B2B, opérationnel, sans jargon",
      metaTitle: "Cabinet IA de référence B2B France | Axion-IA",
      metaDescription:
        "Axion-IA est reconnu comme cabinet IA B2B de référence en France : audit, formation, implémentation et codage IA pour PME, ETI et grands comptes.",
      h2Variants: [
        "Ce que « cabinet de référence » veut dire concrètement pour vos équipes",
        "Nos clients B2B en France : secteurs, résultats, durées d'engagement",
        "Comment choisir son cabinet IA en France — critères objectifs 2026",
      ],
    },
    variables: {
      resultat: "IA en production sur vos process réels",
      delai: "dès le 1er trimestre",
    },
    urlCible: "/fr/cabinet-ia-reference-france",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P1 — Référence France. Jamais « N°1 » comme fait établi. schema.org Organization + LocalBusiness FR.",
  },

  {
    keyword: "cabinet IA reconnu France entreprise",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Un cabinet IA reconnu pour accompagner votre entreprise — pas une SSII, pas un consultant généraliste",
      metaTitle: "Cabinet IA reconnu en France | Axion-IA",
      metaDescription:
        "Axion-IA est reconnu pour ses implémentations IA concrètes : zéro projet pilote sans fin, résultats mesurables dès les 6 premières semaines.",
      h2Variants: [
        "Pourquoi « reconnu » plutôt que « certifié » : ce qui compte vraiment en IA",
        "Nos engagements contractuels de résultat — et comment on les mesure",
        "Témoignages et cas d'usage de nos clients PME en France",
      ],
    },
    variables: {
      resultat: "premier cas d'usage IA déployé en production",
      delai: "en 4 à 8 semaines",
    },
    urlCible: "/fr/cabinet-ia-reference-france",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P1. Lier vers /fr/interventions-formations/ et /fr/implementation/. schema.org ProfessionalService.",
  },

  {
    keyword: "agence IA de référence France PME",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "L'agence IA pensée pour les PME françaises — opérationnelle, pas expérimentale",
      metaTitle: "Agence IA de référence PME France | Axion-IA",
      metaDescription:
        "Agence IA spécialisée PME : formation, audit, implémentation et codage IA adaptés à votre taille et votre budget. Résultats en 4 à 8 semaines.",
      h2Variants: [
        "PME et IA : pourquoi les approches grands groupes ne fonctionnent pas à votre échelle",
        "Ce que fait une agence IA de référence vs un consultant généraliste",
        "Nos formules PME — du premier atelier à l'IA en production",
      ],
    },
    variables: {
      process: "process métier PME (devis, relance, qualification leads)",
      resultat: "gains mesurables dès J+30",
      delai: "4 à 8 semaines",
    },
    urlCible: "/fr/agence-ia/pme",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P1. Les deux termes 'cabinet' et 'agence' sont valides — seed miroir de cabinet-ia-reconnu.",
  },

  {
    keyword: "expert IA entreprise France reconnu",
    intent: "benefice",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Des experts IA reconnus pour votre entreprise — pas des généralistes, des praticiens",
      metaTitle: "Expert IA entreprise reconnu en France | Axion-IA",
      metaDescription:
        "Les experts Axion-IA interviennent en entreprise sur vos cas réels : audit IA, formation équipes, déploiement Claude API, codage sur mesure.",
      h2Variants: [
        "Qui sont les experts Axion-IA — profils, spécialités, expérience terrain",
        "Comment on sélectionne et valide un expert IA pour votre projet",
        "Questions à poser à n'importe quel « expert IA » avant de signer",
      ],
    },
    variables: {
      resultat: "expertise IA concrète appliquée à vos process",
    },
    urlCible: "/fr/blog/choisir-expert-ia-entreprise-france",
    canonicalParent: "/fr/blog/",
    source: "manuel",
    note: "P1. Contenu TOFU / crédibilité. Longe traîne (niveau 3). schema.org Article + Person.",
  },

  {
    keyword: "cabinet IA opérationnel France référence B2B",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Un cabinet IA opérationnel — pas de POC sans fin, des résultats B2B mesurables",
      metaTitle: "Cabinet IA opérationnel B2B France | Axion-IA",
      metaDescription:
        "Axion-IA déploie l'IA en entreprise en mode opérationnel : méthode cadrage-prototype-prod en 4 à 8 semaines. Cabinet IA de référence B2B en France.",
      h2Variants: [
        "Opérationnel vs expérimental : pourquoi la distinction est capitale pour votre ROI",
        "Notre méthode en 3 phases : cadrage 1 sem · prototype 3 sem · production",
        "Références B2B Axion-IA — secteurs et résultats",
      ],
    },
    variables: {
      resultat: "IA en production sur vos process B2B",
      delai: "4 à 8 semaines",
    },
    urlCible: "/fr/cabinet-ia-reference-france",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P1. Longue traîne pilier (niveau 3, priorite 2). Consolider la sémantique 'opérationnel' dès le H1.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // POSITIONNEMENT 2 — OPÉRATIONNEL RAPIDE (4-8 semaines)
  // Intent : transactionnel / benefice — Module : implementation
  // ══════════════════════════════════════════════════════════════════════

  {
    keyword: "IA opérationnelle en 4 semaines PME",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "IA opérationnelle en 4 à 8 semaines — sans mois de préparation",
      metaTitle: "IA opérationnelle en 4 semaines PME | Axion-IA",
      metaDescription:
        "Déployez votre premier cas d'usage IA en 4 à 8 semaines : cadrage 1 semaine, prototype 3 semaines, mise en prod. Pas de projet pilote interminable.",
      h2Variants: [
        "Pourquoi la plupart des projets IA durent trop longtemps",
        "Le programme Axion-IA en 4 étapes opérationnelles",
        "Résultats concrets à J+30 : ce que vous aurez en main",
      ],
    },
    variables: {
      delai: "4 à 8 semaines",
      resultat: "IA en production sur vos process réels",
    },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P2 — opérationnel rapide. Priorite 1 autorisé car niveau 3 (longue traîne). Lier vers /fr/faq/combien-de-temps-implementer-ia.",
  },

  {
    keyword: "déploiement IA rapide entreprise France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Déploiement IA rapide pour votre entreprise — de l'idée à la prod en moins de 2 mois",
      metaTitle: "Déploiement IA rapide entreprise France | Axion-IA",
      metaDescription:
        "Cabinet IA spécialisé déploiement rapide : méthode éprouvée cadrage-prototype-production. Premier résultat en 4 semaines, IA live en 8 semaines.",
      h2Variants: [
        "Les 4 étapes d'un déploiement IA rapide sans risque technique",
        "Ce qui ralentit vraiment les projets IA en entreprise — et comment l'éviter",
        "Exemples de déploiements Axion-IA réalisés en moins de 2 mois",
      ],
    },
    variables: {
      delai: "moins de 2 mois",
      resultat: "IA en production, mesurable",
    },
    urlCible: "/fr/implementation/",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P2. BODY (niveau 2). Lier vers /fr/implementation/pme et /fr/implementation/eti.",
  },

  {
    keyword: "IA résultats en 1 mois PME",
    intent: "benefice",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Premiers résultats IA en 30 jours — engagement contractuel, pas une promesse marketing",
      metaTitle: "IA : résultats concrets en 1 mois pour votre PME | Axion-IA",
      metaDescription:
        "Axion-IA livre un premier résultat IA mesurable en 30 jours : prototype fonctionnel ou cas d'usage en production. Méthode cadrage-sprint-livraison.",
      h2Variants: [
        "Qu'est-ce qu'un « résultat IA » à 30 jours — et comment le mesurer",
        "Notre garantie de livraison en 4 semaines : ce que ça implique de votre côté",
        "Études de cas PME : résultats obtenus à J+30",
      ],
    },
    variables: {
      chiffre: "30",
      unite: "jours",
      delai: "dès J+30",
      resultat: "prototype ou cas d'usage IA en production",
    },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P2. Longue traîne bénéfice fort. Priorite 1 autorisé (niveau 3). schema.org Service + Offer.",
  },

  {
    keyword: "implémentation IA express PME 6 semaines",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Implémentation IA express pour PME — 6 semaines chrono, de la spec à la production",
      metaTitle: "Implémentation IA express PME 6 semaines | Axion-IA",
      metaDescription:
        "Programme Axion-IA Sprint Express : spec semaine 1, prototype semaines 2-4, recette semaine 5, mise en prod semaine 6. PME 10-250 salariés.",
      h2Variants: [
        "Le programme Sprint Express 6 semaines — planning détaillé semaine par semaine",
        "Prérequis côté PME : ce qu'il faut avoir en place avant de démarrer",
        "Coût et ROI d'une implémentation IA express vs projet classique",
      ],
    },
    variables: {
      delai: "6 semaines",
      resultat: "IA en production sur votre process prioritaire",
    },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P2. Longue traîne forte intention. Lier vers /fr/implementation/ page hub.",
  },

  {
    keyword: "cabinet IA réactif résultats rapides France",
    intent: "benefice",
    kbType: "intervention_module",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Un cabinet IA réactif — première session en moins d'une semaine, résultats en moins de 2 mois",
      metaTitle: "Cabinet IA réactif résultats rapides | Axion-IA",
      metaDescription:
        "Axion-IA démarre en moins de 7 jours : pas de cycle de vente de 3 mois. Premier atelier sous 5 jours, IA opérationnelle sous 8 semaines.",
      h2Variants: [
        "Pourquoi la réactivité est un critère critique pour choisir son cabinet IA",
        "Notre promesse de démarrage : premier atelier sous 5 jours ouvrés",
        "Ce que « résultats rapides » signifie — et ce que ça ne signifie pas",
      ],
    },
    variables: {
      delai: "démarrage sous 5 jours, résultats sous 8 semaines",
      resultat: "IA opérationnelle sur vos process",
    },
    urlCible: "/fr/cabinet-ia-reference-france",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P2. Longue traîne différenciateur réactivité. Lier vers page contact/devis.",
  },

  {
    keyword: "agence IA déploiement rapide France PME",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "L'agence IA qui déploie vite — pas de roadmap 12 mois avant le premier résultat",
      metaTitle: "Agence IA déploiement rapide France PME | Axion-IA",
      metaDescription:
        "Axion-IA est l'agence IA spécialisée déploiement rapide PME en France : méthode sprint, premier cas d'usage en 4 semaines, prod en 8 semaines.",
      h2Variants: [
        "Déploiement rapide IA : ce que ça change pour votre PME en 2026",
        "Sprint IA vs projet classique — comparatif durée, coût, risque",
        "Agence IA ou ESN : pourquoi la vitesse de déploiement est cruciale",
      ],
    },
    variables: {
      delai: "4 à 8 semaines",
      resultat: "IA déployée en production",
    },
    urlCible: "/fr/implementation/",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P2. BODY. Terme 'agence' — mirror du terme 'cabinet' pour couvrir les deux lexiques.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // POSITIONNEMENT 3 — ACCESSIBLE PETIT BUDGET
  // Intent : transactionnel / informationnel — Module : divers
  // Note : PAS de prix exacts ("490€") dans le keyword brut
  // ══════════════════════════════════════════════════════════════════════

  {
    keyword: "débuter avec l'IA pas cher PME",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Débuter avec l'IA sans exploser votre budget — le guide PME 2026",
      metaTitle: "Débuter avec l'IA sans se ruiner — guide PME | Axion-IA",
      metaDescription:
        "Comment démarrer un projet IA en PME avec un budget maîtrisé : premier atelier, cas d'usage pilote, outils gratuits et payants — sans jargon tech.",
      h2Variants: [
        "Les 3 erreurs qui font exploser le budget IA d'une PME",
        "Par où commencer : les cas d'usage IA à faible coût et fort ROI",
        "Formules accessibles Axion-IA pour les premières semaines",
      ],
    },
    variables: {
      process: "premier cas d'usage IA (rédaction, qualification leads, support)",
      resultat: "ROI positif dès le 1er mois",
      delai: "dès les premières semaines",
    },
    urlCible: "/fr/blog/debuter-ia-pme-budget-maitrise",
    canonicalParent: "/fr/blog/",
    source: "manuel",
    note: "P3. Guide TOFU. Ne jamais mentionner de prix dans le H1/meta. Lier vers /fr/interventions-formations/pme.",
  },

  {
    keyword: "premier projet IA PME budget maîtrisé",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Votre premier projet IA PME — budget maîtrisé, résultat garanti, zéro surprise",
      metaTitle: "Premier projet IA PME budget maîtrisé | Axion-IA",
      metaDescription:
        "Axion-IA structure votre premier projet IA PME pour maîtriser votre investissement : scope fixe, délai fixe, résultat mesurable. Devis en 48h.",
      h2Variants: [
        "Comment calibrer le périmètre de votre premier projet IA pour rester dans les clous",
        "Nos formules entrée de gamme — ce qu'elles incluent exactement",
        "ROI attendu sur un premier projet IA PME : ordres de grandeur réalistes",
      ],
    },
    variables: {
      process: "cas d'usage pilote défini ensemble",
      resultat: "ROI mesurable à J+30 à J+60",
      delai: "4 à 6 semaines",
    },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P3. Lier vers /fr/audit/pme (étape amont naturelle) + page devis.",
  },

  {
    keyword: "tester l'IA en entreprise petite taille",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Tester l'IA dans votre petite entreprise — sans engagement, sans risque, sans budget colossal",
      metaTitle: "Tester l'IA en petite entreprise | Guide Axion-IA",
      metaDescription:
        "Comment tester l'IA dans une TPE ou petite PME : atelier découverte, outils IA gratuits, premier cas d'usage à coût maîtrisé. Guide pratique 2026.",
      h2Variants: [
        "Les outils IA que vous pouvez tester gratuitement dès aujourd'hui",
        "L'atelier découverte Axion-IA : 2h pour identifier votre premier cas d'usage",
        "De l'expérimentation à la production : comment passer à l'étape suivante",
      ],
    },
    variables: {
      process: "identification cas d'usage IA prioritaire",
      resultat: "clarté sur votre feuille de route IA",
      delai: "en 1 atelier de 2h",
    },
    urlCible: "/fr/blog/tester-ia-petite-entreprise",
    canonicalParent: "/fr/blog/",
    source: "manuel",
    note: "P3. TOFU TPE. Ne pas mentionner de prix. schema.org HowTo.",
  },

  {
    keyword: "formation IA accessible TPE artisan",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour artisans et TPE — accessible, concrète, adaptée à votre réalité",
      metaTitle: "Formation IA accessible TPE artisan | Axion-IA",
      metaDescription:
        "Formation IA pensée pour les artisans et TPE : demi-journée ou journée, cas métier réels, outils accessibles. Sans jargon, sans prérequis technique.",
      h2Variants: [
        "Artisan et IA : les 5 tâches que vous pouvez automatiser dès cette semaine",
        "Format de formation adapté aux TPE — sur site, en demi-journée",
        "Ce que vos pairs artisans ont mis en place avec l'IA — exemples concrets",
      ],
    },
    variables: {
      process: "devis, planning, relances clients, rédaction",
      resultat: "2h économisées par jour",
      delai: "dès la 1re semaine post-formation",
    },
    urlCible: "/fr/interventions-formations/tpe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "P3. Cible artisans/TPE souvent oubliée. schema.org Course.",
  },

  {
    keyword: "cabinet IA tarif accessible PME France",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Un cabinet IA au tarif accessible pour les PME — sans frais cachés, sans engagement minimum",
      metaTitle: "Cabinet IA tarif accessible PME | Axion-IA",
      metaDescription:
        "Axion-IA propose des formules IA adaptées aux budgets PME : démarrez sans engagement long terme, payez uniquement les modules qui vous correspondent.",
      h2Variants: [
        "Comment Axion-IA structure ses tarifs pour les PME — transparence totale",
        "Les 3 formules PME d'entrée : de la formation au déploiement",
        "Comparer les cabinets IA sur le tarif : les vraies questions à poser",
      ],
    },
    variables: {
      resultat: "ROI positif avant la fin du premier engagement",
      delai: "dès J+30",
    },
    urlCible: "/fr/agence-ia/pme",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P3. Ne jamais mettre de prix exacts dans keyword/H1/meta. Page peut linker vers /fr/tarifs si elle existe.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // POSITIONNEMENT 4 — GRANDS PROGRAMMES COMPLEXES
  // Intent : transactionnel / benefice — Module : implementation / transversal
  // ══════════════════════════════════════════════════════════════════════

  {
    keyword: "programme IA transformation ETI France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Programme de transformation IA pour ETI — de la stratégie à la production, sans chaos organisationnel",
      metaTitle: "Programme IA transformation ETI France | Axion-IA",
      metaDescription:
        "Axion-IA accompagne les ETI dans leur transformation IA : gouvernance, pilotes métier, déploiement multi-équipes, formation des référents. Programme sur mesure.",
      h2Variants: [
        "Transformation IA ETI : les 4 étapes d'un programme structuré",
        "Gouvernance IA en ETI — comment embarquer le COMEX et les managers",
        "Résultats attendus à 6 mois et 12 mois d'un programme IA ETI",
      ],
    },
    variables: {
      process: "transformation IA multi-directions (RH, ops, commercial, finance)",
      resultat: "3 à 5 cas d'usage en production à J+120",
      delai: "programme 3 à 6 mois",
    },
    urlCible: "/fr/implementation/eti",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P4. BODY ETI. schema.org Service avec audience ETI. Lier vers /fr/audit/eti.",
  },

  {
    keyword: "déploiement IA complexe multi-sites entreprise",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Déploiement IA complexe et multi-sites — méthodologie éprouvée, zéro effet silo",
      metaTitle: "Déploiement IA complexe multi-sites | Axion-IA",
      metaDescription:
        "Axion-IA déploie l'IA dans des organisations multi-sites : harmonisation des pratiques, formation des relais locaux, gouvernance centralisée.",
      h2Variants: [
        "Les défis spécifiques d'un déploiement IA multi-sites — et comment les anticiper",
        "Modèle hub-and-spoke : comment former les référents IA sur chaque site",
        "Tableau de bord IA unifié pour piloter plusieurs sites depuis un même endroit",
      ],
    },
    variables: {
      process: "déploiement IA sur 3 à 15 sites / entités",
      resultat: "cohérence des pratiques IA et ROI consolidé",
      delai: "programme 6 à 12 mois",
    },
    urlCible: "/fr/implementation/eti",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P4. Longue traîne forte intention ETI/grande entreprise. Lier vers /fr/audit/eti.",
  },

  {
    keyword: "cabinet IA grands comptes France programme",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "transversal",
    cible: "grand-compte",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Cabinet IA pour grands comptes — programmes IA sur mesure, engagement résultat, interlocuteur dédié",
      metaTitle: "Cabinet IA grands comptes France | Axion-IA",
      metaDescription:
        "Axion-IA intervient en grands comptes : programme IA pluriannuel, gouvernance IA, formation des directions, déploiement multi-équipes sur mesure.",
      h2Variants: [
        "Ce qu'un grand compte attend d'un cabinet IA — et ce qu'Axion-IA apporte de différent",
        "Nos engagements contractuels de résultat pour grands comptes",
        "Exemples de programmes IA Axion-IA en grande entreprise",
      ],
    },
    variables: {
      process: "transformation IA à l'échelle de l'organisation",
      resultat: "ROI consolidé sur 12 à 18 mois",
    },
    urlCible: "/fr/implementation/eti",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P4. BODY. Cible grand-compte. Ne pas mentionner de noms de clients sans accord. schema.org ProfessionalService.",
  },

  {
    keyword: "stratégie IA industrielle grande entreprise France",
    intent: "informationnel",
    kbType: "guide",
    module: "audit",
    cible: "grand-compte",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Stratégie IA industrielle pour les grandes entreprises — construire une feuille de route qui tient sur 3 ans",
      metaTitle: "Stratégie IA industrielle grande entreprise | Axion-IA",
      metaDescription:
        "Guide Axion-IA pour bâtir une stratégie IA industrielle en grande entreprise : audit maturité, roadmap par direction, gouvernance, KPIs.",
      h2Variants: [
        "Les 5 piliers d'une stratégie IA industrielle solide",
        "Comment auditer la maturité IA d'une grande entreprise avant de planifier",
        "Feuille de route IA 24-36 mois — ce qu'elle doit obligatoirement contenir",
      ],
    },
    variables: {
      process: "stratégie IA à l'échelle industrielle",
      resultat: "roadmap IA validée par le COMEX",
      delai: "audit + feuille de route en 4 à 6 semaines",
    },
    urlCible: "/fr/blog/strategie-ia-industrielle-grande-entreprise",
    canonicalParent: "/fr/blog/",
    source: "manuel",
    note: "P4. Guide MOFU grande entreprise. schema.org Article. Lier vers /fr/audit/eti.",
  },

  {
    keyword: "implémentation IA grande envergure ETI France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Implémentation IA grande envergure en ETI — méthode, gouvernance et résultats sur 6 à 12 mois",
      metaTitle: "Implémentation IA grande envergure ETI | Axion-IA",
      metaDescription:
        "Axion-IA pilote les implémentations IA d'envergure en ETI : 5 à 15 cas d'usage, formation des référents, gouvernance IA, reporting COMEX.",
      h2Variants: [
        "Définir le périmètre d'une implémentation IA grande envergure — méthode cadrage",
        "Pilotage programme IA ETI : rôles, réunions, jalons, reporting",
        "Retours d'expérience Axion-IA sur des programmes IA ETI de grande envergure",
      ],
    },
    variables: {
      process: "5 à 15 cas d'usage IA déployés en production",
      resultat: "ROI consolidé > 3× l'investissement à 12 mois",
      delai: "programme 6 à 12 mois",
    },
    urlCible: "/fr/implementation/eti",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P4. Longue traîne ETI. Lier vers /fr/audit/eti et page contact dédié grands comptes.",
  },

  {
    keyword: "agence IA programme multi-sites France ETI",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'agence IA pour vos programmes multi-sites — cohérence, pilotage centralisé, résultats locaux",
      metaTitle: "Agence IA programme multi-sites ETI France | Axion-IA",
      metaDescription:
        "Axion-IA déploie vos programmes IA sur plusieurs sites : formation des référents locaux, gouvernance centralisée, reporting unifié.",
      h2Variants: [
        "Multi-sites et IA : pourquoi c'est plus complexe que sur un site unique",
        "Le modèle d'intervention Axion-IA pour les ETI multi-sites",
        "Indicateurs de succès d'un déploiement IA multi-sites à 6 mois",
      ],
    },
    variables: {
      process: "déploiement IA sur plusieurs entités géographiques",
      resultat: "pratiques IA homogènes et ROI consolidé",
      delai: "programme 6 à 12 mois",
    },
    urlCible: "/fr/implementation/eti",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P4. Term 'agence' mirror de 'cabinet'. Longue traîne ETI multi-sites.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // POSITIONNEMENT 5 — FRANCO-EUROPÉEN / LOCAL
  // PAS "Made in France" → "franco-européen", "expertise française",
  // "données en Europe", "hébergement européen"
  // Intent : transactionnel / benefice / informationnel
  // ══════════════════════════════════════════════════════════════════════

  {
    keyword: "cabinet IA franco-européen PME",
    intent: "benefice",
    kbType: "intervention_module",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Un cabinet IA franco-européen — expertise française, conformité RGPD, données hébergées en Europe",
      metaTitle: "Cabinet IA franco-européen PME | Axion-IA",
      metaDescription:
        "Axion-IA est un cabinet IA franco-européen : fondé en France, équipe d'experts français, données hébergées en Europe, conformité RGPD native.",
      h2Variants: [
        "Pourquoi choisir un cabinet IA franco-européen en 2026",
        "Données IA hébergées en Europe : ce que ça change pour votre conformité RGPD",
        "Expertise française en IA — ce que ça signifie concrètement pour votre projet",
      ],
    },
    variables: {
      resultat: "IA conforme RGPD, hébergée en Europe, pilotée par des experts français",
    },
    urlCible: "/fr/cabinet-ia-reference-france",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P5. Jamais 'Made in France' (siège Estonie). Jamais 'OÜ'. Lier vers /fr/blog/ia-souveraine-rgpd-europe.",
  },

  {
    keyword: "expertise IA française entreprise B2B",
    intent: "benefice",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'expertise IA à la française — rigueur technique, pragmatisme terrain, interlocuteurs en France",
      metaTitle: "Expertise IA française entreprise B2B | Axion-IA",
      metaDescription:
        "Axion-IA apporte une expertise IA fondée en France : équipe francophone, références B2B françaises, processus alignés sur les pratiques du marché local.",
      h2Variants: [
        "Ce que « expertise IA à la française » recouvre vraiment",
        "Interlocuteur français vs cabinet offshore : ce que ça change au quotidien",
        "Nos expertises spécifiques au marché français : secteurs, réglementation, usages",
      ],
    },
    variables: {
      resultat: "interlocuteur expert francophone, disponible, ancré dans le marché FR",
    },
    urlCible: "/fr/blog/expertise-ia-française-entreprise",
    canonicalParent: "/fr/blog/",
    source: "manuel",
    note: "P5. Contenu TOFU crédibilité. Jamais 'Made in France'. Jamais 'OÜ'. schema.org Article.",
  },

  {
    keyword: "conseil IA données hébergées Europe RGPD",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Déployez l'IA avec vos données hébergées en Europe — conformité RGPD sans compromis sur la performance",
      metaTitle: "IA données hébergées Europe RGPD | Axion-IA",
      metaDescription:
        "Comment déployer l'IA en entreprise en gardant vos données en Europe : choix des providers, contrats DPA, alternatives souveraines. Guide RGPD 2026.",
      h2Variants: [
        "RGPD et IA : les obligations légales que votre cabinet IA doit respecter",
        "Hébergement IA en Europe : quels providers, quels garde-fous",
        "Axion-IA et la souveraineté des données : notre architecture par défaut",
      ],
    },
    variables: {
      resultat: "IA conforme RGPD, données en Europe, sans pénalité légale",
    },
    urlCible: "/fr/blog/ia-souveraine-rgpd-europe",
    canonicalParent: "/fr/blog/",
    source: "manuel",
    note: "P5. Guide MOFU conformité. schema.org Article + FAQ. Lier vers /fr/cabinet-ia-reference-france.",
  },

  {
    keyword: "formation IA par experts français entreprise",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formez vos équipes à l'IA avec des experts français — en présentiel ou en distanciel",
      metaTitle: "Formation IA par experts français | Axion-IA",
      metaDescription:
        "Axion-IA forme vos équipes à l'IA avec des formateurs experts francophones : programmes sur mesure, cas métier réels, résultats mesurables.",
      h2Variants: [
        "Pourquoi la langue et la culture métier comptent dans une formation IA",
        "Nos formateurs IA : profils, spécialités, expérience terrain en France",
        "Formats disponibles : atelier sur site, distanciel, blended",
      ],
    },
    variables: {
      process: "formation équipes à l'IA (outils, prompting, cas métier)",
      resultat: "équipes autonomes sur leurs cas d'usage IA prioritaires",
      delai: "dès la semaine suivant la formation",
    },
    urlCible: "/fr/interventions-formations/",
    canonicalParent: "/fr/",
    source: "manuel",
    note: "P5. Différenciateur 'experts français' = francophone + terrain FR. schema.org Course.",
  },

  {
    keyword: "IA souveraine hébergement européen PME France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA souveraine pour votre PME — données en Europe, conformité RGPD, sans dépendance Big Tech US",
      metaTitle: "IA souveraine hébergement européen PME | Axion-IA",
      metaDescription:
        "Comment déployer une IA souveraine en PME : providers européens, alternatives locales à ChatGPT/OpenAI, conformité RGPD, hébergement en Europe.",
      h2Variants: [
        "IA souveraine vs IA Big Tech : ce que ça change pour votre PME en pratique",
        "Alternatives européennes à OpenAI et ChatGPT pour les entreprises françaises",
        "Comment Axion-IA intègre Claude (Anthropic) tout en protégeant vos données",
      ],
    },
    variables: {
      resultat: "IA performante, conforme RGPD, hébergée en Europe",
    },
    urlCible: "/fr/blog/ia-souveraine-alternatives-europeennes",
    canonicalParent: "/fr/blog/",
    source: "manuel",
    note: "P5. TOFU/MOFU fort intérêt 2026 post-AI Act. schema.org Article. Mention Claude/Anthropic possible.",
  },

  {
    keyword: "alternative européenne formation IA entreprise",
    intent: "comparatif",
    kbType: "comparison",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'alternative européenne pour former votre entreprise à l'IA — sans dépendre des géants américains",
      metaTitle: "Alternative européenne formation IA entreprise | Axion-IA",
      metaDescription:
        "Axion-IA est l'alternative franco-européenne aux formations IA américaines : formateurs en France, données en Europe, approche terrain.",
      h2Variants: [
        "Pourquoi les grandes formations IA américaines ne sont pas toujours adaptées aux PME françaises",
        "Ce que propose un cabinet IA européen vs une plateforme de formation en ligne",
        "Axion-IA comme alternative : ce que vous gagnez concrètement",
      ],
    },
    variables: {
      resultat: "formation IA adaptée au marché et à la culture d'entreprise française",
    },
    urlCible: "/fr/blog/alternative-europeenne-formation-ia",
    canonicalParent: "/fr/blog/",
    source: "manuel",
    note: "P5. Comparatif MOFU. schema.org Article. Ne pas dénigrer nommément les concurrents — rester factuel.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // POSITIONNEMENT 6 — SPÉCIALISTE ANTHROPIC / CLAUDE
  // Intent : transactionnel / informationnel
  // Module : implementation / codage-developpement
  // ══════════════════════════════════════════════════════════════════════

  {
    keyword: "intégrateur Claude Anthropic France entreprise",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Intégrez Claude d'Anthropic dans votre entreprise — avec un cabinet spécialiste en France",
      metaTitle: "Intégrateur Claude Anthropic France | Axion-IA",
      metaDescription:
        "Axion-IA intègre Claude (Anthropic) dans vos process métier : API Claude, agents IA, automatisation. Cabinet spécialiste Claude en France depuis 2024.",
      h2Variants: [
        "Pourquoi Claude d'Anthropic plutôt que ChatGPT pour votre entreprise",
        "Notre méthode d'intégration Claude API — de l'audit au déploiement en production",
        "Cas d'usage Claude en entreprise : ce que vous pouvez automatiser dès maintenant",
      ],
    },
    variables: {
      process: "intégration Claude API dans vos process métier",
      resultat: "IA Claude opérationnelle sur vos cas d'usage prioritaires",
      delai: "4 à 8 semaines",
    },
    urlCible: "/fr/implementation/claude-anthropic",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P6. Longue traîne forte intention. Priorite 1 autorisé (niveau 3). schema.org Service. Lier vers /fr/stack-ia/claude.",
  },

  {
    keyword: "cabinet spécialiste Claude API France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Le cabinet spécialiste Claude API en France — intégration, agents, automatisation sur mesure",
      metaTitle: "Cabinet spécialiste Claude API France | Axion-IA",
      metaDescription:
        "Axion-IA est le cabinet IA français spécialisé Claude API : intégration API, développement d'agents IA, automatisation sur mesure pour PME et ETI.",
      h2Variants: [
        "Claude API vs ChatGPT API : pourquoi Axion-IA a choisi Anthropic",
        "Ce qu'on peut construire avec Claude API — exemples techniques et métier",
        "Notre stack Claude API : de la simple intégration à l'agent IA multi-étapes",
      ],
    },
    variables: {
      process: "développement sur mesure avec Claude API (agents, automatisation, outils)",
      resultat: "solution IA Claude en production, scalable",
      delai: "4 à 8 semaines",
    },
    urlCible: "/fr/codage-developpement/claude-api",
    canonicalParent: "/fr/codage-developpement/",
    source: "manuel",
    note: "P6. Différenciateur technique fort. Lier vers /fr/stack-ia/claude et /fr/implementation/claude-anthropic.",
  },

  {
    keyword: "formation Claude Anthropic entreprise France",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formez vos équipes à Claude d'Anthropic — atelier ou programme sur mesure en France",
      metaTitle: "Formation Claude Anthropic entreprise France | Axion-IA",
      metaDescription:
        "Axion-IA forme vos équipes à Claude (Anthropic) : prompting avancé, agents IA, cas d'usage métier. Formation sur site ou distanciel, en France.",
      h2Variants: [
        "Pourquoi former vos équipes à Claude spécifiquement — et pas seulement à l'IA en général",
        "Programme de formation Claude Anthropic : niveaux débutant, intermédiaire, avancé",
        "Ce que vos équipes maîtrisent à l'issue de la formation Claude Axion-IA",
      ],
    },
    variables: {
      process: "maîtrise de Claude pour les cas d'usage métier de votre équipe",
      resultat: "équipes autonomes sur Claude dans leur contexte métier",
      delai: "dès la semaine suivant la formation",
    },
    urlCible: "/fr/interventions-formations/claude-anthropic",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "P6. schema.org Course. Lier vers /fr/stack-ia/claude.",
  },

  {
    keyword: "déploiement Claude API PME France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Déployez Claude API dans votre PME — de la configuration à la production, en moins de 8 semaines",
      metaTitle: "Déploiement Claude API PME France | Axion-IA",
      metaDescription:
        "Axion-IA déploie Claude API dans votre PME : intégration SI, configuration models, agents IA, tests et mise en production. Spécialiste Anthropic France.",
      h2Variants: [
        "Les étapes d'un déploiement Claude API réussi en PME",
        "Intégrations courantes Claude API en PME : CRM, ERP, support, rédaction",
        "Coût et délai d'un déploiement Claude API — ce que vous devez savoir avant de commencer",
      ],
    },
    variables: {
      process: "déploiement Claude API (intégration SI, configuration, tests, prod)",
      resultat: "Claude API opérationnel sur vos process prioritaires",
      delai: "4 à 8 semaines",
    },
    urlCible: "/fr/implementation/claude-anthropic",
    canonicalParent: "/fr/implementation/",
    source: "manuel",
    note: "P6. Longue traîne forte intention. Lier vers /fr/codage-developpement/claude-api.",
  },

  {
    keyword: "expert Anthropic Claude API France cabinet",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Faites appel à un expert Anthropic & Claude API en France — cabinet spécialisé, résultats prouvés",
      metaTitle: "Expert Anthropic Claude API France | Axion-IA",
      metaDescription:
        "Axion-IA est le cabinet expert Anthropic et Claude API en France : intégration, développement d'agents, formation, audit de vos usages Claude existants.",
      h2Variants: [
        "Qu'est-ce qu'un « expert Anthropic » — compétences, certifications, expériences",
        "Les domaines où l'expertise Claude API d'Axion-IA fait la différence",
        "Audit de vos usages Claude existants — diagnostic et recommandations",
      ],
    },
    variables: {
      resultat: "expertise Claude API actionnable sur votre contexte technique",
    },
    urlCible: "/fr/stack-ia/claude",
    canonicalParent: "/fr/stack-ia/",
    source: "manuel",
    note: "P6. Seed crédibilité expertise. Lier vers /fr/implementation/claude-anthropic.",
  },

  {
    keyword: "expert Claude API entreprise France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Un expert Claude API à votre service — conseil technique, développement, déploiement en entreprise",
      metaTitle: "Expert Claude API entreprise France | Axion-IA",
      metaDescription:
        "Axion-IA met à disposition des experts Claude API pour votre entreprise : architecture agents IA, optimisation prompts, intégration API, mise en production.",
      h2Variants: [
        "Ce qu'un expert Claude API fait concrètement pour votre projet",
        "Architecture agents Claude — les patterns éprouvés par Axion-IA",
        "Comment choisir un expert Claude API : questions à poser, références à vérifier",
      ],
    },
    variables: {
      process: "développement et déploiement sur Claude API",
      resultat: "solution Claude API robuste, scalable, documentée",
      delai: "de 2 à 8 semaines selon périmètre",
    },
    urlCible: "/fr/codage-developpement/claude-api",
    canonicalParent: "/fr/codage-developpement/",
    source: "manuel",
    note: "P6. Mirror de 'expert Anthropic' — couvre les deux lexiques de recherche.",
  },

  {
    keyword: "agence IA spécialiste Claude Anthropic France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "L'agence IA spécialiste Claude & Anthropic en France — intégration, formation, développement sur mesure",
      metaTitle: "Agence IA spécialiste Claude Anthropic France | Axion-IA",
      metaDescription:
        "Axion-IA est l'agence IA française spécialisée sur Claude (Anthropic) : formation équipes, intégration API, agents IA, audit usages — PME et grands comptes.",
      h2Variants: [
        "Pourquoi Axion-IA a fait de Claude son LLM de référence",
        "Nos services Claude Anthropic — de la formation à l'intégration avancée",
        "Comparatif Claude vs GPT-4 vs Gemini — ce qui guide nos recommandations",
      ],
    },
    variables: {
      resultat: "stack Claude Anthropic opérationnel dans votre entreprise",
      delai: "premier résultat en 4 semaines",
    },
    urlCible: "/fr/stack-ia/claude",
    canonicalParent: "/fr/stack-ia/",
    source: "manuel",
    note: "P6. BODY (niveau 2). Hub Anthropic/Claude. Seed pilier pour la sémantique spécialiste Claude.",
  },

  {
    keyword: "implémentation agents IA Claude Anthropic PME",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Implémentez vos premiers agents IA avec Claude d'Anthropic — en production en moins de 8 semaines",
      metaTitle: "Agents IA Claude Anthropic PME | Axion-IA",
      metaDescription:
        "Axion-IA développe et déploie vos agents IA sur Claude (Anthropic) : de la spec à la production, avec test, monitoring et documentation.",
      h2Variants: [
        "Qu'est-ce qu'un agent IA Claude — et ce qu'il peut faire pour votre PME",
        "Les 3 types d'agents IA les plus utiles en PME en 2026",
        "Notre méthode de développement agents Claude — spec, prototype, prod, monitoring",
      ],
    },
    variables: {
      process: "développement agents IA Claude (orchestration, tools, mémoire)",
      resultat: "agent IA Claude opérationnel sur votre process prioritaire",
      delai: "4 à 8 semaines",
    },
    urlCible: "/fr/codage-developpement/claude-api",
    canonicalParent: "/fr/codage-developpement/",
    source: "manuel",
    note: "P6. Longue traîne technique forte intention. Lier vers /fr/stack-ia/claude et /fr/implementation/claude-anthropic.",
  },

  {
    keyword: "audit usages Claude Anthropic entreprise",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "audit",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Auditez vos usages Claude & Anthropic — optimisez vos prompts, vos coûts et votre conformité",
      metaTitle: "Audit usages Claude Anthropic entreprise | Axion-IA",
      metaDescription:
        "Axion-IA audite vos usages Claude (Anthropic) existants : qualité des prompts, coût API, sécurité, conformité RGPD, opportunités d'automatisation.",
      h2Variants: [
        "Pourquoi auditer ses usages Claude après 3 à 6 mois de déploiement",
        "Ce que l'audit Axion-IA analyse sur vos usages Claude existants",
        "Résultats types d'un audit usages Claude : optimisations identifiées et gains",
      ],
    },
    variables: {
      process: "audit complet de vos prompts, workflows et intégrations Claude",
      resultat: "plan d'optimisation Claude avec gains chiffrés",
      delai: "rapport en 5 à 10 jours ouvrés",
    },
    urlCible: "/fr/audit/claude-anthropic",
    canonicalParent: "/fr/audit/",
    source: "manuel",
    note: "P6. Seed audit spécifique Claude — complète le hub /fr/stack-ia/claude. schema.org Service.",
  },
];
