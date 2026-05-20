// src/content/keywords/g7a-secteurs-tertiaire.ts
// Mode G Phase 7A — Secteurs tertiaire manquants — 2026-05-20
// 7 secteurs × 8 seeds = 56 seeds
//
// Règle : niveau 1 + priorite 1 = interdit
// Règle R5 : h1 ≠ keyword brut
// metaTitle ≤ 60 chars | metaDescription ≤ 155 chars

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 1 — BANQUE & FINANCE (8 seeds)
// URL cible : /fr/secteurs/banque-finance
// ─────────────────────────────────────────────────────────────────────────────

const KW_BANQUE_FINANCE: KeywordSeed[] = [
  // --- TRANSACTIONNEL 1 ---
  {
    keyword: "cabinet IA pour banque France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA, le cabinet IA B2B de référence pour les banques françaises",
      metaTitle: "Cabinet IA pour banque France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les banques dans l'adoption de l'IA : conformité, relation client, back-office. Audit, formation et implémentation clé en main.",
      h2Variants: [
        "Pourquoi confier votre projet IA bancaire à un cabinet spécialisé ?",
        "Nos services IA pour banques : du diagnostic à la production",
        "Références secteur bancaire France",
      ],
    },
    urlCible: "/fr/secteurs/banque-finance",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: FinancialService + Organization",
  },
  // --- TRANSACTIONNEL 2 ---
  {
    keyword: "prestataire IA banque conformité RGPD",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Déployer l'IA en banque sans compromis sur la conformité RGPD et ACPR",
      metaTitle: "Prestataire IA banque conformité — Axion-IA",
      metaDescription:
        "Axion-IA déploie des solutions IA conformes RGPD, ACPR et DORA pour les établissements bancaires. Gouvernance des données intégrée by design.",
      h2Variants: [
        "Conformité réglementaire et IA bancaire : RGPD, ACPR, DORA",
        "Architecture IA bancaire souveraine : données restent en Europe",
        "Audit de conformité IA préalable au déploiement",
      ],
    },
    variables: {
      process: "déploiement IA conforme secteur bancaire",
      resultat: "0 risque réglementaire ACPR",
      chiffre: "0",
      unite: "non-conformité",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/banque-finance",
    canonicalParent: "/fr/secteurs/banque-finance",
    source: "manuel",
    note: "ACPR + DORA + RGPD mentions clés ; mots secondaires : IA bancaire souveraine",
  },
  // --- SECTORIEL 1 ---
  {
    keyword: "IA pour banque de détail France",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "audit",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Comment les banques de détail économisent 12 h/semaine/conseiller avec l'IA",
      metaTitle: "IA banque de détail France | Axion-IA",
      metaDescription:
        "Axion-IA déploie l'IA en banque : conformité, relation client, back-office. ROI mesurable sous 6 semaines. Devis gratuit.",
      h2Variants: [
        "Quels cas d'usage IA pour une banque de détail ?",
        "ROI de l'IA en banque : benchmarks 2026",
        "Roadmap IA banque en 4 étapes — sans risque réglementaire",
      ],
    },
    variables: {
      process: "relation client et conformité",
      resultat: "-12 h/semaine/conseiller",
      chiffre: "12",
      unite: "heures/semaine",
      delai: "dès 6 semaines",
    },
    urlCible: "/fr/secteurs/banque-finance",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org FinancialService + FAQPage ; keyword secondaire : IA fintech PME",
  },
  // --- SECTORIEL 2 ---
  {
    keyword: "automatisation KYC IA banque",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser le KYC bancaire avec l'IA : vérification 10× plus rapide",
      metaTitle: "Automatisation KYC IA banque — Axion-IA",
      metaDescription:
        "Pipeline IA KYC pour banques et fintech : vérification d'identité, scoring risque, détection fraude documentaire. Conformité LCB-FT intégrée.",
      h2Variants: [
        "Quelles étapes du KYC automatiser avec l'IA ?",
        "LCB-FT et IA : rester conforme avec les LLM",
        "ROI KYC IA : coût par dossier divisé par 5",
      ],
    },
    variables: {
      process: "vérification KYC et LCB-FT",
      resultat: "vérification KYC 10× plus rapide",
      chiffre: "10",
      unite: "× plus rapide",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/banque-finance",
    canonicalParent: "/fr/secteurs/banque-finance",
    source: "manuel",
  },
  // --- BENEFICE 1 ---
  {
    keyword: "réduire coûts back-office bancaire IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire les coûts du back-office bancaire de 35 % grâce à l'IA : méthode et résultats",
      metaTitle: "Réduire coûts back-office bancaire IA — Axion-IA",
      metaDescription:
        "Saisie, réconciliation, reporting réglementaire : l'IA réduit les coûts back-office bancaire de 30 à 40 %. Calculateur ROI et benchmarks 2026.",
      h2Variants: [
        "Quels postes back-office bancaire s'automatisent le mieux ?",
        "Calculateur ROI IA back-office bancaire",
        "Benchmarks de réduction de coûts back-office avec l'IA",
      ],
    },
    variables: {
      process: "back-office et reporting réglementaire",
      resultat: "-35 % coûts back-office",
      chiffre: "35",
      unite: "%",
      delai: "en 6 mois",
    },
    urlCible: "/fr/secteurs/banque-finance",
    canonicalParent: "/fr/secteurs/banque-finance",
    source: "manuel",
  },
  // --- BENEFICE 2 ---
  {
    keyword: "gain productivité conseiller bancaire IA",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "interventions-formations",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Conseillers bancaires : +25 % de productivité grâce à l'IA en 8 semaines",
      metaTitle: "Productivité conseiller bancaire IA — Axion-IA",
      metaDescription:
        "Formation et outils IA pour conseillers bancaires : préparation entretiens, synthèse dossiers, relances automatiques. +25 % de productivité mesurée.",
      h2Variants: [
        "Comment l'IA prépare les entretiens client en 2 minutes",
        "Synthèse automatique de dossiers crédit avec l'IA",
        "Mesurer le gain de productivité conseiller bancaire",
      ],
    },
    variables: {
      process: "gestion portefeuille clients",
      resultat: "+25 % productivité conseiller",
      chiffre: "25",
      unite: "%",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/banque-finance",
    canonicalParent: "/fr/secteurs/banque-finance",
    source: "manuel",
  },
  // --- AEO 1 ---
  {
    keyword: "comment l'IA améliore la relation client en banque ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA améliore-t-elle la relation client en banque ? 6 usages prouvés",
      metaTitle: "IA relation client banque : comment ça marche ? — Axion-IA",
      metaDescription:
        "Personnalisation, chatbot, préparation entretiens, détection churns : 6 façons prouvées dont l'IA améliore la relation client bancaire en 2026.",
      h2Variants: [
        "1. Personnalisation des offres grâce à l'IA",
        "4. Détection précoce du risque de churn client",
        "6. Synthèse automatique des historiques client",
      ],
    },
    urlCible: "/fr/faq/ia-relation-client-banque",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
  // --- AEO 2 ---
  {
    keyword: "quels risques de l'IA pour une banque ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "eti",
    secteur: "banque-finance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quels risques l'IA fait-elle peser sur une banque ? Analyse et garde-fous",
      metaTitle: "Risques IA pour une banque — réponse Axion-IA",
      metaDescription:
        "Risques réglementaires ACPR/DORA, biais algorithmiques, cybersécurité, explicabilité : tour complet des risques IA bancaires et comment les maîtriser.",
      h2Variants: [
        "Risque réglementaire : ACPR, DORA et AI Act",
        "Biais et discrimination : l'IA en crédit sous surveillance",
        "Cybersécurité et IA bancaire : nouvelles surfaces d'attaque",
      ],
    },
    urlCible: "/fr/faq/risques-ia-banque",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage + Article",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 2 — ASSURANCE & MUTUELLES (8 seeds)
// URL cible : /fr/secteurs/assurance
// ─────────────────────────────────────────────────────────────────────────────

const KW_ASSURANCE: KeywordSeed[] = [
  // --- TRANSACTIONNEL 1 ---
  {
    keyword: "cabinet IA assurance mutuelle France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "eti",
    secteur: "assurance",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA, le cabinet IA spécialisé assurance et mutuelles en France",
      metaTitle: "Cabinet IA assurance mutuelle France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les compagnies d'assurance et mutuelles dans l'IA : sinistres, souscription, conformité Solvabilité II. Devis gratuit.",
      h2Variants: [
        "Pourquoi les assureurs font confiance à Axion-IA ?",
        "Nos services IA pour assureurs et mutuelles",
        "Conformité Solvabilité II et IA : notre approche",
      ],
    },
    urlCible: "/fr/secteurs/assurance",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: InsuranceAgency + Organization",
  },
  // --- TRANSACTIONNEL 2 ---
  {
    keyword: "intégrateur IA insurtech France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "startup-scaleup",
    secteur: "assurance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Intégrateur IA pour insurtech : de l'API LLM au produit en production en 4 semaines",
      metaTitle: "Intégrateur IA insurtech France — Axion-IA",
      metaDescription:
        "Axion-IA intègre les LLM dans les produits insurtech : scoring, chatbot assurance, génération de polices. Architecture souveraine RGPD by design.",
      h2Variants: [
        "Stack IA recommandée pour les insurtech françaises",
        "Sécurité et données assurance : architecture souveraine",
        "Time-to-market IA insurtech : de l'idée au prod en 4 semaines",
      ],
    },
    variables: {
      process: "développement produit insurtech IA",
      resultat: "time-to-market / 3",
      chiffre: "3",
      unite: "× plus rapide",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/assurance",
    canonicalParent: "/fr/secteurs/assurance",
    source: "manuel",
  },
  // --- SECTORIEL 1 ---
  {
    keyword: "IA traitement sinistres assurance",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "assurance",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Traitement des sinistres 5× plus rapide grâce à l'IA : pipeline complet",
      metaTitle: "IA traitement sinistres assurance — Axion-IA",
      metaDescription:
        "Pipeline IA pour le traitement des sinistres : lecture documents, scoring, proposition d'indemnisation, détection fraude. ROI en 8 semaines.",
      h2Variants: [
        "De la déclaration à l'indemnisation : l'IA accélère chaque étape",
        "Détection fraude sinistres avec les LLM : précision +40 %",
        "Intégration IA avec vos systèmes de gestion sinistres (SGS)",
      ],
    },
    variables: {
      process: "traitement et instruction sinistres",
      resultat: "délai sinistres / 5",
      chiffre: "5",
      unite: "× plus rapide",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/assurance",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: InsuranceAgency + HowTo",
  },
  // --- SECTORIEL 2 ---
  {
    keyword: "automatisation souscription assurance IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "assurance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser la souscription assurance avec l'IA : devis en 90 secondes",
      metaTitle: "Automatisation souscription assurance IA — Axion-IA",
      metaDescription:
        "L'IA génère un devis d'assurance personnalisé en 90 s : collecte données, scoring risque, tarification, édition police. Déployé par Axion-IA.",
      h2Variants: [
        "Comment l'IA automatise l'analyse du risque à la souscription",
        "Personnalisation tarifaire avec les LLM : au-delà des grilles fixes",
        "Conformité Solvabilité II dans le scoring IA",
      ],
    },
    variables: {
      process: "souscription et tarification",
      resultat: "devis généré en 90 secondes",
      chiffre: "90",
      unite: "secondes",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/assurance",
    canonicalParent: "/fr/secteurs/assurance",
    source: "manuel",
  },
  // --- BENEFICE 1 ---
  {
    keyword: "réduire délai indemnisation sinistres IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "eti",
    secteur: "assurance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire le délai d'indemnisation de 60 % avec l'IA : chiffres réels assurance",
      metaTitle: "Réduire délai indemnisation IA assurance — Axion-IA",
      metaDescription:
        "De 15 jours à 6 jours de délai moyen d'indemnisation grâce à l'IA. Benchmarks réels et calculateur ROI pour compagnies d'assurance et mutuelles.",
      h2Variants: [
        "Benchmark délai indemnisation avec et sans IA",
        "Impact satisfaction client : NPS sinistres et délai IA",
        "Calculateur ROI IA traitement sinistres",
      ],
    },
    variables: {
      process: "instruction et indemnisation sinistres",
      resultat: "délai indemnisation - 60 %",
      chiffre: "60",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/assurance",
    canonicalParent: "/fr/secteurs/assurance",
    source: "manuel",
  },
  // --- BENEFICE 2 ---
  {
    keyword: "détection fraude assurance IA résultats",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "eti",
    secteur: "assurance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Détection fraude assurance : +40 % de cas détectés grâce à l'IA",
      metaTitle: "Détection fraude assurance IA résultats — Axion-IA",
      metaDescription:
        "L'IA augmente le taux de détection fraude assurance de 40 % tout en réduisant les faux positifs. Cas d'usage réels et benchmarks 2026 par Axion-IA.",
      h2Variants: [
        "Comment l'IA repère les patterns de fraude invisibles aux humains",
        "Faux positifs et IA anti-fraude : comment préserver l'expérience client",
        "ROI de la détection fraude IA : économies vs investissement",
      ],
    },
    variables: {
      process: "détection et instruction fraude",
      resultat: "+40 % fraudes détectées",
      chiffre: "40",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/assurance",
    canonicalParent: "/fr/secteurs/assurance",
    source: "manuel",
  },
  // --- AEO 1 ---
  {
    keyword: "comment l'IA détecte la fraude en assurance ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "assurance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA détecte-t-elle la fraude en assurance ? Mécanismes et résultats",
      metaTitle: "Comment l'IA détecte la fraude assurance ? — Axion-IA",
      metaDescription:
        "Analyse documentaire, détection d'anomalies, NLP sur déclarations : 5 mécanismes IA pour détecter la fraude assurance. Guide Axion-IA 2026.",
      h2Variants: [
        "Analyse documentaire IA pour repérer les faux sinistres",
        "NLP sur déclarations : détecter les incohérences narratives",
        "Score de risque fraude IA : comment il est calculé",
      ],
    },
    urlCible: "/fr/faq/ia-detection-fraude-assurance",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
  // --- AEO 2 ---
  {
    keyword: "l'IA peut-elle remplacer un gestionnaire sinistres ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "assurance",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA peut-elle remplacer un gestionnaire sinistres ? La vraie réponse",
      metaTitle: "IA remplace gestionnaire sinistres ? — Axion-IA",
      metaDescription:
        "Non : l'IA augmente le gestionnaire sinistres, elle ne le remplace pas. Découvrez ce que l'IA automatise vs ce qui reste humain en assurance.",
      h2Variants: [
        "Ce que l'IA automatise dans la gestion sinistres",
        "Ce qui reste humain : empathie, litige, négociation complexe",
        "Le gestionnaire sinistres augmenté : nouveaux rôles et compétences",
      ],
    },
    urlCible: "/fr/faq/ia-remplace-gestionnaire-sinistres",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 3 — IMMOBILIER PROFESSIONNEL (8 seeds)
// URL cible : /fr/secteurs/immobilier-pro
// ─────────────────────────────────────────────────────────────────────────────

const KW_IMMOBILIER_PRO: KeywordSeed[] = [
  // --- TRANSACTIONNEL 1 ---
  {
    keyword: "cabinet IA promotion immobilière France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "pme",
    secteur: "immobilier-pro",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA, le cabinet IA expert de l'immobilier professionnel en France",
      metaTitle: "Cabinet IA immobilier pro France — Axion-IA",
      metaDescription:
        "Axion-IA déploie l'IA dans la promotion immobilière, les foncières et le property management. Audit, formation et implémentation clé en main.",
      h2Variants: [
        "Quels services IA pour les acteurs de l'immobilier professionnel ?",
        "Nos déploiements IA en immobilier d'entreprise",
        "Références promoteurs, foncières et property managers",
      ],
    },
    urlCible: "/fr/secteurs/immobilier-pro",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: RealEstateAgent + Organization",
  },
  // --- TRANSACTIONNEL 2 ---
  {
    keyword: "prestataire IA proptech France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "startup-scaleup",
    secteur: "immobilier-pro",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Intégrer l'IA dans votre proptech : de l'API au produit en 4 semaines",
      metaTitle: "Prestataire IA proptech France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les proptech françaises dans l'intégration des LLM : valuation, matching, documentation automatique. RGPD by design.",
      h2Variants: [
        "Stack IA recommandée pour les proptech françaises",
        "Cas d'usage IA proptech : valorisation, search, génération de docs",
        "Coût et délai d'intégration IA proptech",
      ],
    },
    variables: {
      process: "développement produit proptech IA",
      resultat: "time-to-market / 3",
      chiffre: "3",
      unite: "× plus rapide",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/immobilier-pro",
    canonicalParent: "/fr/secteurs/immobilier-pro",
    source: "manuel",
  },
  // --- SECTORIEL 1 ---
  {
    keyword: "IA property management automatisation",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "immobilier-pro",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser le property management avec l'IA : -40 % de tâches répétitives",
      metaTitle: "IA property management automatisation — Axion-IA",
      metaDescription:
        "Appels locataires, quittances, états des lieux, relances charges : l'IA prend en charge 40 % des tâches répétitives en property management.",
      h2Variants: [
        "Quelles tâches property management automatiser avec l'IA ?",
        "Chatbot locataire IA : répondre aux demandes 24h/24",
        "Intégration IA avec vos logiciels de gestion immobilière",
      ],
    },
    variables: {
      process: "gestion locative et administrative",
      resultat: "-40 % tâches répétitives",
      chiffre: "40",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/immobilier-pro",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // --- SECTORIEL 2 ---
  {
    keyword: "intelligence artificielle promotion immobilière",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "transversal",
    cible: "pme",
    secteur: "immobilier-pro",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "IA et promotion immobilière : accélérer les ventes et réduire les coûts en 2026",
      metaTitle: "IA promotion immobilière France 2026 — Axion-IA",
      metaDescription:
        "Comment les promoteurs immobiliers utilisent l'IA : génération de contenus marketing, qualification leads, analyse faisabilité. Guide Axion-IA.",
      h2Variants: [
        "Génération automatique de fiches et brochures commerciales IA",
        "Qualification des leads acquéreurs avec l'IA",
        "IA et analyse de faisabilité de projet immobilier",
      ],
    },
    urlCible: "/fr/secteurs/immobilier-pro",
    canonicalParent: "/fr/secteurs/immobilier-pro",
    source: "manuel",
  },
  // --- BENEFICE 1 ---
  {
    keyword: "gain de temps gestion locative IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    secteur: "immobilier-pro",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Gestion locative : économisez 10 h/semaine grâce à l'IA dès le 1er mois",
      metaTitle: "Gain de temps gestion locative IA — Axion-IA",
      metaDescription:
        "Quittances, relances, états des lieux, questions locataires : l'IA libère 10 h/semaine en gestion locative. Calculateur ROI et benchmarks 2026.",
      h2Variants: [
        "Les 5 tâches gestion locative les plus chronophages à automatiser",
        "Calculateur ROI IA gestion locative",
        "Résultats mesurés : gestionnaires immobiliers et IA",
      ],
    },
    variables: {
      process: "gestion locative quotidienne",
      resultat: "-10 h/semaine/gestionnaire",
      chiffre: "10",
      unite: "heures/semaine",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/secteurs/immobilier-pro",
    canonicalParent: "/fr/secteurs/immobilier-pro",
    source: "manuel",
  },
  // --- BENEFICE 2 ---
  {
    keyword: "augmenter leads acquéreurs avec IA immobilier",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "immobilier-pro",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Multiplier par 2 vos leads acquéreurs qualifiés grâce à l'IA immobilière",
      metaTitle: "Augmenter leads acquéreurs IA immobilier — Axion-IA",
      metaDescription:
        "Chatbot de qualification, scoring propension achat, relances personnalisées : l'IA double les leads acquéreurs qualifiés pour les promoteurs immobiliers.",
      h2Variants: [
        "Chatbot IA acquéreurs : qualification et prise de RDV automatiques",
        "Scoring propension achat IA : identifier les vrais acheteurs",
        "Relances IA personnalisées : le bon message au bon moment",
      ],
    },
    variables: {
      process: "génération et qualification leads acquéreurs",
      resultat: "× 2 leads qualifiés",
      chiffre: "2",
      unite: "× plus de leads qualifiés",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/immobilier-pro",
    canonicalParent: "/fr/secteurs/immobilier-pro",
    source: "manuel",
  },
  // --- AEO 1 ---
  {
    keyword: "quels usages de l'IA en immobilier professionnel ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "immobilier-pro",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quels sont les usages de l'IA en immobilier professionnel ? 8 cas concrets",
      metaTitle: "Usages IA immobilier professionnel — Axion-IA",
      metaDescription:
        "Valorisation, gestion locative, leads, documents, compliance : 8 cas d'usage IA prouvés en immobilier professionnel. Guide Axion-IA 2026.",
      h2Variants: [
        "1. Automatiser la génération de documents immobiliers",
        "5. IA et valorisation d'actifs immobiliers",
        "8. Chatbot locataire et service après-vente IA",
      ],
    },
    urlCible: "/fr/faq/usages-ia-immobilier-professionnel",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
  // --- AEO 2 ---
  {
    keyword: "l'IA est-elle utile pour un promoteur immobilier ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    secteur: "immobilier-pro",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA est-elle vraiment utile pour un promoteur immobilier ? Réponse honnête",
      metaTitle: "IA utile pour promoteur immobilier ? — Axion-IA",
      metaDescription:
        "Oui, à condition de cibler les bons usages. Découvrez quels processus d'un promoteur immobilier bénéficient réellement de l'IA en 2026.",
      h2Variants: [
        "Où l'IA crée le plus de valeur pour un promoteur immobilier",
        "Où l'IA n'est pas (encore) utile en promotion immobilière",
        "Comment démarrer un projet IA en promotion immobilière",
      ],
    },
    urlCible: "/fr/faq/ia-utile-promoteur-immobilier",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 4 — CYBERSÉCURITÉ (8 seeds)
// URL cible : /fr/secteurs/cybersecurite
// ─────────────────────────────────────────────────────────────────────────────

const KW_CYBERSECURITE: KeywordSeed[] = [
  // --- TRANSACTIONNEL 1 ---
  {
    keyword: "cabinet IA cybersécurité France MSSP",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "pme",
    secteur: "cybersecurite",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA, le cabinet IA partenaire des MSSP et intégrateurs cybersécurité",
      metaTitle: "Cabinet IA cybersécurité France MSSP — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les MSSP et intégrateurs sécu dans l'IA : SOC augmenté, tri alertes, réponse incidents. Audit et déploiement clé en main.",
      h2Variants: [
        "Pourquoi les MSSP choisissent Axion-IA pour leur projet IA ?",
        "Nos services IA pour les acteurs de la cybersécurité",
        "SOC augmenté IA : cas d'usage et résultats",
      ],
    },
    urlCible: "/fr/secteurs/cybersecurite",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: ITService + Organization",
  },
  // --- TRANSACTIONNEL 2 ---
  {
    keyword: "prestataire IA SOC automatisation alertes",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    secteur: "cybersecurite",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser le tri des alertes SOC avec l'IA : zéro alerte critique manquée",
      metaTitle: "Prestataire IA SOC automatisation — Axion-IA",
      metaDescription:
        "Axion-IA déploie l'IA dans vos opérations SOC : tri alertes, contexte incident, playbook automatique. Analystes focalisés sur les vraies menaces.",
      h2Variants: [
        "Comment l'IA réduit la fatigue alertes SOC",
        "Playbook IA automatique : réponse aux incidents de niveau 1",
        "Intégration IA avec votre SIEM et SOAR existants",
      ],
    },
    variables: {
      process: "triage et traitement alertes SOC",
      resultat: "-70 % faux positifs traités par humains",
      chiffre: "70",
      unite: "%",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/cybersecurite",
    canonicalParent: "/fr/secteurs/cybersecurite",
    source: "manuel",
  },
  // --- SECTORIEL 1 ---
  {
    keyword: "IA pour SOC analyste sécurité",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "eti",
    secteur: "cybersecurite",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA au service des analystes SOC : traiter 3× plus d'incidents sans burnout",
      metaTitle: "IA pour SOC analyste sécurité — Axion-IA",
      metaDescription:
        "Contexte automatique, playbook IA, corrélation SIEM : comment l'IA permet aux analystes SOC de traiter 3× plus d'incidents en gardant la maîtrise.",
      h2Variants: [
        "Cas d'usage IA pour l'analyste SOC niveau 1, 2 et 3",
        "Fatigue alertes et IA : comment réduire le bruit sans risque",
        "Playbook IA niveau 1 : quels incidents l'IA traite en autonomie ?",
      ],
    },
    variables: {
      process: "opérations SOC quotidiennes",
      resultat: "3× plus d'incidents traités",
      chiffre: "3",
      unite: "×",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/cybersecurite",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // --- SECTORIEL 2 ---
  {
    keyword: "formation IA équipe cybersécurité",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    secteur: "cybersecurite",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour équipes cybersécurité : de la théorie aux usages opérationnels en 1 jour",
      metaTitle: "Formation IA équipe cybersécurité — Axion-IA",
      metaDescription:
        "Axion-IA forme vos équipes cyber à l'IA : analyse de logs, threat intel, reporting, playbooks. 1 jour sur site avec cas pratiques réels.",
      h2Variants: [
        "Programme formation IA pour analystes et RSSI",
        "IA et threat intelligence : usages concrets en formation",
        "Certification et suivi post-formation cybersécurité IA",
      ],
    },
    variables: {
      process: "montée en compétence IA cyber",
      resultat: "équipe opérationnelle dès J+1",
      chiffre: "1",
      unite: "jour",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/cybersecurite",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  // --- BENEFICE 1 ---
  {
    keyword: "réduire faux positifs alertes sécurité IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "eti",
    secteur: "cybersecurite",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire les faux positifs de 70 % dans votre SOC grâce à l'IA",
      metaTitle: "Réduire faux positifs alertes SOC IA — Axion-IA",
      metaDescription:
        "L'IA contextualise et filtre les alertes SIEM : -70 % faux positifs, analystes focalisés sur les vraies menaces. Calculateur ROI et benchmarks.",
      h2Variants: [
        "Coût réel des faux positifs en cybersécurité",
        "Comment l'IA contextualise les alertes SIEM",
        "ROI IA SOC : heures économisées et menaces mieux traitées",
      ],
    },
    variables: {
      process: "tri et contextualisation alertes SIEM",
      resultat: "-70 % faux positifs",
      chiffre: "70",
      unite: "%",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/cybersecurite",
    canonicalParent: "/fr/secteurs/cybersecurite",
    source: "manuel",
  },
  // --- BENEFICE 2 ---
  {
    keyword: "MTTD MTTR amélioration IA cybersécurité",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "eti",
    secteur: "cybersecurite",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "MTTD et MTTR divisés par 2 avec l'IA : résultats mesurés en cybersécurité",
      metaTitle: "MTTD MTTR amélioration IA cybersécurité — Axion-IA",
      metaDescription:
        "L'IA divise par 2 les temps de détection (MTTD) et de réponse (MTTR) aux incidents cyber. Benchmarks sectoriels et cas d'usage réels 2026.",
      h2Variants: [
        "Comment l'IA réduit le MTTD : détection plus rapide des menaces",
        "Accélération MTTR : playbooks automatiques et context enrichment",
        "Mesurer l'impact IA sur le MTTD et MTTR de votre SOC",
      ],
    },
    variables: {
      process: "détection et réponse incidents cyber",
      resultat: "MTTD et MTTR / 2",
      chiffre: "2",
      unite: "× plus rapide",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/cybersecurite",
    canonicalParent: "/fr/secteurs/cybersecurite",
    source: "manuel",
  },
  // --- AEO 1 ---
  {
    keyword: "comment l'IA aide les équipes cybersécurité ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "cybersecurite",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA aide-t-elle les équipes cybersécurité au quotidien ? 7 usages",
      metaTitle: "Comment l'IA aide la cybersécurité ? — Axion-IA",
      metaDescription:
        "Tri alertes, threat intel, réponse incidents, rapports RSSI, détection vulnérabilités : 7 façons dont l'IA aide les équipes cyber en 2026.",
      h2Variants: [
        "1. Tri et contextualisation des alertes SIEM",
        "4. Génération automatique de rapports RSSI",
        "7. Détection de vulnérabilités par analyse de code",
      ],
    },
    urlCible: "/fr/faq/ia-aide-equipes-cybersecurite",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
  // --- AEO 2 ---
  {
    keyword: "l'IA peut-elle être utilisée contre des cyberattaques ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "cybersecurite",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA peut-elle défendre contre les cyberattaques ? Ce que dit la pratique",
      metaTitle: "IA contre cyberattaques : est-ce efficace ? — Axion-IA",
      metaDescription:
        "Oui, l'IA détecte les menaces plus vite et automatise la réponse. Mais elle crée aussi de nouvelles menaces. Tour d'horizon honnête par Axion-IA.",
      h2Variants: [
        "L'IA défensive : détection, containment, réponse automatique",
        "L'IA offensive : nouvelles menaces que l'IA crée pour les attaquants",
        "Bilan : l'IA avantage défenseur ou attaquant ?",
      ],
    },
    urlCible: "/fr/faq/ia-contre-cyberattaques",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 5 — COMMUNICATION & MÉDIAS (8 seeds)
// URL cible : /fr/secteurs/communication-medias
// ─────────────────────────────────────────────────────────────────────────────

const KW_COMMUNICATION_MEDIAS: KeywordSeed[] = [
  // --- TRANSACTIONNEL 1 ---
  {
    keyword: "cabinet IA agence communication France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "pme",
    secteur: "communication-medias",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA, le cabinet IA pour agences de communication et médias numériques",
      metaTitle: "Cabinet IA agence communication France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les agences de communication dans l'IA : création de contenus, RP automatisées, veille médias. Audit et déploiement clé en main.",
      h2Variants: [
        "Pourquoi les agences de communication adoptent l'IA avec Axion-IA ?",
        "Services IA pour agences comm, presse et RP",
        "L'IA change-t-elle les métiers de la communication ?",
      ],
    },
    urlCible: "/fr/secteurs/communication-medias",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: ProfessionalService + Organization",
  },
  // --- TRANSACTIONNEL 2 ---
  {
    keyword: "prestataire IA production de contenus agence",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    secteur: "communication-medias",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Pipeline IA de production de contenus pour agences : 5× plus de livrables",
      metaTitle: "Prestataire IA production contenus agence — Axion-IA",
      metaDescription:
        "Axion-IA déploie un pipeline IA de création de contenus pour agences : articles, posts, visuels, newsletters. +5× de productivité éditoriale.",
      h2Variants: [
        "Architecture IA éditoriale pour agences de communication",
        "Contrôle qualité et voix de marque dans un pipeline IA",
        "ROI IA production de contenus : livrables et coûts",
      ],
    },
    variables: {
      process: "production et édition de contenus",
      resultat: "5× plus de livrables éditoriaux",
      chiffre: "5",
      unite: "× plus de livrables",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/communication-medias",
    canonicalParent: "/fr/secteurs/communication-medias",
    source: "manuel",
  },
  // --- SECTORIEL 1 ---
  {
    keyword: "IA rédaction contenu marketing agence",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "communication-medias",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Rédiger 10× plus de contenus marketing grâce à l'IA sans perdre la voix de marque",
      metaTitle: "IA rédaction contenu marketing agence — Axion-IA",
      metaDescription:
        "Pipeline IA de rédaction pour agences : articles de blog, posts réseaux, newsletters, scripts vidéo. Voix de marque préservée, livrables x10.",
      h2Variants: [
        "Comment l'IA préserve la voix de marque dans la rédaction",
        "Pipeline IA éditorial pour agences : de la brief à la publication",
        "Quels contenus confier à l'IA, quels contenus garder humains ?",
      ],
    },
    variables: {
      process: "rédaction et production contenus marketing",
      resultat: "10× plus de contenus produits",
      chiffre: "10",
      unite: "× plus de contenus",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/communication-medias",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // --- SECTORIEL 2 ---
  {
    keyword: "veille médias automatisée IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "communication-medias",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser la veille médias avec l'IA : synthèse quotidienne en 5 minutes",
      metaTitle: "Veille médias automatisée IA — Axion-IA France",
      metaDescription:
        "Pipeline IA de veille médias : agrégation sources, résumé automatique, alertes mentions marque, rapport quotidien. Déployé par Axion-IA en 3 semaines.",
      h2Variants: [
        "De la veille manuelle à la veille IA : ce qui change",
        "Alertes et sentiments marque automatisés avec l'IA",
        "Intégration veille IA avec vos outils RP existants",
      ],
    },
    variables: {
      process: "veille médias et mentions marque",
      resultat: "synthèse quotidienne en 5 min",
      chiffre: "5",
      unite: "minutes",
      delai: "en 3 semaines",
    },
    urlCible: "/fr/secteurs/communication-medias",
    canonicalParent: "/fr/secteurs/communication-medias",
    source: "manuel",
  },
  // --- BENEFICE 1 ---
  {
    keyword: "augmenter productivité équipe rédaction IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    secteur: "communication-medias",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Multiplier par 5 la productivité de votre équipe rédaction grâce à l'IA",
      metaTitle: "Productivité équipe rédaction IA — Axion-IA",
      metaDescription:
        "De 2 à 10 articles par rédacteur et par semaine grâce à l'IA. Calculateur ROI et benchmarks sectoriels pour agences de communication en 2026.",
      h2Variants: [
        "Benchmark productivité rédaction avec et sans IA",
        "Quelles tâches rédactionnelles l'IA accélère le plus ?",
        "Calculateur ROI IA équipe éditoriale",
      ],
    },
    variables: {
      process: "production éditoriale équipe",
      resultat: "5× productivité rédactionnelle",
      chiffre: "5",
      unite: "×",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/communication-medias",
    canonicalParent: "/fr/secteurs/communication-medias",
    source: "manuel",
  },
  // --- BENEFICE 2 ---
  {
    keyword: "réduire coûts production contenus IA agence",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "communication-medias",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire de 50 % les coûts de production de contenus avec l'IA : guide agence",
      metaTitle: "Réduire coûts production contenus IA agence — Axion-IA",
      metaDescription:
        "Moins de freelances, plus de livrables : l'IA réduit de 50 % les coûts de production contenus pour les agences de communication. Chiffres réels 2026.",
      h2Variants: [
        "Modèle économique agence IA : les nouvelles marges possibles",
        "Ce que l'IA remplace et ce qu'elle ne peut pas faire",
        "Étude de cas : agence communication et IA, résultats après 6 mois",
      ],
    },
    variables: {
      process: "production et achat de contenus",
      resultat: "-50 % coûts production contenus",
      chiffre: "50",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/communication-medias",
    canonicalParent: "/fr/secteurs/communication-medias",
    source: "manuel",
  },
  // --- AEO 1 ---
  {
    keyword: "comment utiliser l'IA dans une agence de communication ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "communication-medias",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment utiliser l'IA dans une agence de communication ? Guide pratique 2026",
      metaTitle: "IA dans agence communication : comment ? — Axion-IA",
      metaDescription:
        "Rédaction, veille, RP, reportings, idéation : guide pratique 2026 pour intégrer l'IA dans une agence de communication sans perdre la créativité.",
      h2Variants: [
        "Les 5 usages IA incontournables en agence de communication",
        "Ce que l'IA ne doit pas faire dans une agence créative",
        "Par où commencer : premier projet IA pour une agence comm",
      ],
    },
    urlCible: "/fr/faq/utiliser-ia-agence-communication",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage + HowTo",
  },
  // --- AEO 2 ---
  {
    keyword: "l'IA va-t-elle remplacer les journalistes ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    secteur: "communication-medias",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA va-t-elle remplacer les journalistes ? Réponse honnête en 2026",
      metaTitle: "IA va-t-elle remplacer les journalistes ? — Axion-IA",
      metaDescription:
        "Non, mais elle transforme profondément le métier. Ce que l'IA fait déjà en journalisme, ce qui reste irrémédiablement humain. Analyse Axion-IA.",
      h2Variants: [
        "Ce que l'IA fait déjà dans les rédactions en 2026",
        "Le journalisme d'enquête : le dernier bastion non automatisable ?",
        "Journaliste augmenté par l'IA : nouveaux rôles et compétences",
      ],
    },
    urlCible: "/fr/faq/ia-remplace-journalistes",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage ; fort volume potentiel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 6 — ÉNERGIE & CLEANTECH (8 seeds)
// URL cible : /fr/secteurs/energie-cleantech
// ─────────────────────────────────────────────────────────────────────────────

const KW_ENERGIE_CLEANTECH: KeywordSeed[] = [
  // --- TRANSACTIONNEL 1 ---
  {
    keyword: "cabinet IA énergie transition énergétique France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "eti",
    secteur: "energie-cleantech",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA, le cabinet IA expert de l'énergie et de la transition énergétique",
      metaTitle: "Cabinet IA énergie transition France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les acteurs de l'énergie dans l'IA : optimisation réseau, maintenance prédictive, reporting RSE. Déploiement en 4 semaines.",
      h2Variants: [
        "Nos services IA pour utilities, ENR et cleantech",
        "Pourquoi l'énergie a besoin d'une IA spécialisée",
        "Références secteur énergie et cleantech",
      ],
    },
    urlCible: "/fr/secteurs/energie-cleantech",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: Organization + ITService ; mots secondaires : IA utilities France",
  },
  // --- TRANSACTIONNEL 2 ---
  {
    keyword: "prestataire IA smart grid optimisation réseau",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    secteur: "energie-cleantech",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Optimiser votre smart grid avec l'IA : prédiction charge et réduction pertes",
      metaTitle: "Prestataire IA smart grid optimisation — Axion-IA",
      metaDescription:
        "Axion-IA déploie des solutions IA pour l'optimisation des smart grids : prédiction de charge, détection anomalies, réduction des pertes réseau.",
      h2Variants: [
        "Comment l'IA prédit la charge et anticipe les pics réseau",
        "Détection d'anomalies réseau en temps réel avec l'IA",
        "ROI IA smart grid : pertes réseau réduites et coûts opex",
      ],
    },
    variables: {
      process: "optimisation charge et gestion réseau",
      resultat: "-15 % pertes réseau",
      chiffre: "15",
      unite: "%",
      delai: "en 6 mois",
    },
    urlCible: "/fr/secteurs/energie-cleantech",
    canonicalParent: "/fr/secteurs/energie-cleantech",
    source: "manuel",
  },
  // --- SECTORIEL 1 ---
  {
    keyword: "IA maintenance prédictive éolienne solaire",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "energie-cleantech",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Maintenance prédictive IA pour éoliennes et panneaux solaires : -30 % pannes",
      metaTitle: "IA maintenance prédictive ENR — Axion-IA France",
      metaDescription:
        "L'IA analyse les données capteurs de vos ENR pour anticiper les pannes : -30 % d'arrêts non planifiés, +15 % de production annuelle. Axion-IA.",
      h2Variants: [
        "Comment l'IA analyse les données capteurs d'une éolienne",
        "Maintenance prédictive IA vs maintenance préventive : comparaison ROI",
        "Intégration SCADA et IA pour les parcs ENR",
      ],
    },
    variables: {
      process: "maintenance actifs énergétiques ENR",
      resultat: "-30 % arrêts non planifiés",
      chiffre: "30",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/energie-cleantech",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: TechArticle ; mots secondaires : IA parc éolien, IA panneaux solaires",
  },
  // --- SECTORIEL 2 ---
  {
    keyword: "automatiser reporting RSE énergie IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "energie-cleantech",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser le reporting RSE et CSRD dans l'énergie avec l'IA : -80 % de temps",
      metaTitle: "Automatiser reporting RSE énergie IA — Axion-IA",
      metaDescription:
        "L'IA collecte, structure et rédige votre reporting RSE et CSRD : émissions, consommations, indicateurs extra-financiers. -80 % de temps de production.",
      h2Variants: [
        "CSRD et énergie : quelles données l'IA collecte automatiquement",
        "Structurer les indicateurs ESG énergie avec l'IA",
        "Audit de conformité RSE IA pour utilities et ENR",
      ],
    },
    variables: {
      process: "production reporting RSE et CSRD",
      resultat: "-80 % temps de reporting RSE",
      chiffre: "80",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/energie-cleantech",
    canonicalParent: "/fr/secteurs/energie-cleantech",
    source: "manuel",
  },
  // --- BENEFICE 1 ---
  {
    keyword: "économies opérationnelles IA utilities réseau",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "eti",
    secteur: "energie-cleantech",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et utilities : réduire les coûts opex de 20 % en 12 mois, chiffres réels",
      metaTitle: "Économies IA utilities réseau énergie — Axion-IA",
      metaDescription:
        "Maintenance, optimisation réseau, reporting : l'IA réduit de 20 % les coûts opex des utilities en 12 mois. Calculateur ROI et benchmarks 2026.",
      h2Variants: [
        "Postes opex énergie les plus automatisables avec l'IA",
        "Calculateur ROI IA pour utilities et opérateurs réseau",
        "Benchmarks de réduction opex IA secteur énergie",
      ],
    },
    variables: {
      process: "opérations et maintenance réseau",
      resultat: "-20 % opex en 12 mois",
      chiffre: "20",
      unite: "%",
      delai: "en 12 mois",
    },
    urlCible: "/fr/secteurs/energie-cleantech",
    canonicalParent: "/fr/secteurs/energie-cleantech",
    source: "manuel",
  },
  // --- BENEFICE 2 ---
  {
    keyword: "améliorer prévision production ENR IA",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "eti",
    secteur: "energie-cleantech",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Prévision de production ENR : +40 % de précision grâce à l'IA météo-énergétique",
      metaTitle: "Améliorer prévision production ENR IA — Axion-IA",
      metaDescription:
        "L'IA combine données météo, historiques et capteurs pour prévoir la production ENR avec +40 % de précision. Meilleure valorisation sur les marchés.",
      h2Variants: [
        "Comment l'IA améliore la prévision de production éolienne et solaire",
        "Valorisation marché : l'impact d'une meilleure prévision ENR",
        "Intégration IA prévision avec vos outils de trading énergie",
      ],
    },
    variables: {
      process: "prévision de production ENR",
      resultat: "+40 % précision prévision production",
      chiffre: "40",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/energie-cleantech",
    canonicalParent: "/fr/secteurs/energie-cleantech",
    source: "manuel",
  },
  // --- AEO 1 ---
  {
    keyword: "comment l'IA optimise la consommation énergétique ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "energie-cleantech",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA optimise-t-elle la consommation énergétique ? 5 mécanismes",
      metaTitle: "Comment l'IA optimise la consommation énergie ? Axion-IA",
      metaDescription:
        "Analyse en temps réel, prédiction de charge, effacement, bâtiments intelligents : 5 mécanismes par lesquels l'IA réduit la consommation énergétique.",
      h2Variants: [
        "1. Prédiction et lissage de la courbe de charge",
        "3. IA et bâtiments à énergie positive : gestion HVAC",
        "5. Effacement intelligent avec l'IA",
      ],
    },
    urlCible: "/fr/faq/ia-optimise-consommation-energetique",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
  // --- AEO 2 ---
  {
    keyword: "quels usages de l'IA dans la transition énergétique ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "eti",
    secteur: "energie-cleantech",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quels usages de l'IA dans la transition énergétique ? Tour d'horizon 2026",
      metaTitle: "Usages IA transition énergétique 2026 — Axion-IA",
      metaDescription:
        "ENR, smart grids, efficacité énergétique, mobilité électrique, CSRD : panorama complet des usages de l'IA dans la transition énergétique en France.",
      h2Variants: [
        "IA et ENR : optimisation production et maintenance",
        "IA et smart grids : équilibrage offre et demande en temps réel",
        "IA et efficacité énergétique des bâtiments",
      ],
    },
    urlCible: "/fr/faq/usages-ia-transition-energetique",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage + Article",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 7 — MARITIME & PORTUAIRE (8 seeds)
// URL cible : /fr/secteurs/maritime-portuaire
// ─────────────────────────────────────────────────────────────────────────────

const KW_MARITIME_PORTUAIRE: KeywordSeed[] = [
  // --- TRANSACTIONNEL 1 ---
  {
    keyword: "cabinet IA maritime ship management France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "pme",
    secteur: "maritime-portuaire",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Axion-IA, le cabinet IA expert du maritime, de la logistique et des ports",
      metaTitle: "Cabinet IA maritime ship management France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les armateurs, ship managers et opérateurs portuaires dans l'IA. Audit, formation et déploiement opérationnel en 4 semaines.",
      h2Variants: [
        "Pourquoi le secteur maritime choisit Axion-IA ?",
        "Nos services IA pour armateurs, ports et ship managers",
        "Conformité OMI et IA maritime : notre approche",
      ],
    },
    urlCible: "/fr/secteurs/maritime-portuaire",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: Organization + ITService ; mots secondaires : IA logistique maritime",
  },
  // --- TRANSACTIONNEL 2 ---
  {
    keyword: "prestataire IA logistique portuaire optimisation",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    secteur: "maritime-portuaire",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Optimiser les opérations portuaires avec l'IA : -20 % de temps d'escale",
      metaTitle: "Prestataire IA logistique portuaire — Axion-IA",
      metaDescription:
        "Axion-IA déploie des solutions IA pour les ports : prédiction escales, optimisation quais, documentation automatique. ROI mesuré dès 3 mois.",
      h2Variants: [
        "IA et gestion des escales : prédiction et optimisation quais",
        "Documentation portuaire automatisée avec les LLM",
        "Intégration IA avec votre TOS et systèmes portuaires",
      ],
    },
    variables: {
      process: "opérations portuaires et gestion escales",
      resultat: "-20 % temps d'escale",
      chiffre: "20",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/maritime-portuaire",
    canonicalParent: "/fr/secteurs/maritime-portuaire",
    source: "manuel",
  },
  // --- SECTORIEL 1 ---
  {
    keyword: "IA maintenance navire prédictive armateur",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "maritime-portuaire",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Maintenance prédictive navire avec l'IA : -25 % d'arrêts techniques imprévus",
      metaTitle: "IA maintenance navire prédictive armateur — Axion-IA",
      metaDescription:
        "L'IA analyse les données moteur, coque et équipements pour anticiper les pannes navire. -25 % d'immobilisations, ROI positif dès 6 mois.",
      h2Variants: [
        "Quelles données navire l'IA analyse pour la maintenance prédictive ?",
        "ROI maintenance prédictive IA pour un armateur PME",
        "Intégration IA avec les systèmes de monitoring navire existants",
      ],
    },
    variables: {
      process: "maintenance et suivi technique navires",
      resultat: "-25 % arrêts techniques imprévus",
      chiffre: "25",
      unite: "%",
      delai: "en 6 mois",
    },
    urlCible: "/fr/secteurs/maritime-portuaire",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // --- SECTORIEL 2 ---
  {
    keyword: "automatisation documentation maritime IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "maritime-portuaire",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser la documentation maritime avec l'IA : connaissements, manifestes et rapports",
      metaTitle: "Automatisation documentation maritime IA — Axion-IA",
      metaDescription:
        "Pipeline IA pour la documentation maritime : connaissements, manifestes, certificats, rapports capitaine. -70 % de saisie manuelle, conformité OMI.",
      h2Variants: [
        "De la saisie manuelle à l'automatisation documentaire maritime",
        "Conformité OMI et documents maritimes : l'IA garde la norme",
        "Intégration IA documentation avec votre système de gestion navire",
      ],
    },
    variables: {
      process: "production documentation maritime",
      resultat: "-70 % saisie manuelle documentation",
      chiffre: "70",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/maritime-portuaire",
    canonicalParent: "/fr/secteurs/maritime-portuaire",
    source: "manuel",
  },
  // --- BENEFICE 1 ---
  {
    keyword: "réduire coûts exploitation navire IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    secteur: "maritime-portuaire",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire les coûts d'exploitation navire de 15 % grâce à l'IA : méthode et résultats",
      metaTitle: "Réduire coûts exploitation navire IA — Axion-IA",
      metaDescription:
        "Carburant, maintenance, équipage, documentation : l'IA réduit les coûts d'exploitation navire de 10 à 20 %. Calculateur ROI maritime par Axion-IA.",
      h2Variants: [
        "Les postes de coût navire les plus réductibles avec l'IA",
        "Optimisation de la consommation carburant avec l'IA",
        "Calculateur ROI IA pour armateurs PME",
      ],
    },
    variables: {
      process: "exploitation et opérations navires",
      resultat: "-15 % coûts exploitation navire",
      chiffre: "15",
      unite: "%",
      delai: "en 6 mois",
    },
    urlCible: "/fr/secteurs/maritime-portuaire",
    canonicalParent: "/fr/secteurs/maritime-portuaire",
    source: "manuel",
  },
  // --- BENEFICE 2 ---
  {
    keyword: "optimiser consommation carburant navire IA",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "maritime-portuaire",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire la consommation carburant navire de 10 % avec l'IA : résultats prouvés",
      metaTitle: "Optimiser carburant navire IA — Axion-IA France",
      metaDescription:
        "L'IA optimise la vitesse, le trim et la route des navires pour réduire la conso carburant de 10 %. Économies et réduction CO₂ simultanées.",
      h2Variants: [
        "Comment l'IA calcule la route optimale économie carburant",
        "Trim et vitesse optimaux : l'IA en temps réel vs le commandant",
        "ROI IA carburant navire : économies vs coût déploiement",
      ],
    },
    variables: {
      process: "optimisation route et consommation carburant",
      resultat: "-10 % conso carburant navire",
      chiffre: "10",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/maritime-portuaire",
    canonicalParent: "/fr/secteurs/maritime-portuaire",
    source: "manuel",
    note: "aligné CII et OMI MARPOL Annexe VI ; mots secondaires : IA décarbonation maritime",
  },
  // --- AEO 1 ---
  {
    keyword: "comment l'IA est-elle utilisée dans le transport maritime ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "maritime-portuaire",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment l'IA est-elle utilisée dans le transport maritime ? 6 usages 2026",
      metaTitle: "IA dans le transport maritime : usages 2026 — Axion-IA",
      metaDescription:
        "Maintenance prédictive, optimisation route, documentation, ports intelligents : 6 usages prouvés de l'IA dans le transport maritime en 2026.",
      h2Variants: [
        "1. Maintenance prédictive des navires avec l'IA",
        "3. Optimisation de route et réduction carburant",
        "6. Ports intelligents et IA : gestion des escales",
      ],
    },
    urlCible: "/fr/faq/ia-transport-maritime-usages",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
  // --- AEO 2 ---
  {
    keyword: "l'IA peut-elle améliorer la sécurité maritime ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "maritime-portuaire",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA peut-elle améliorer la sécurité maritime ? Ce que dit la pratique en 2026",
      metaTitle: "IA améliore sécurité maritime ? — Axion-IA",
      metaDescription:
        "Détection anomalies, alertes équipage, analyse météo, veille COLREG : comment l'IA renforce la sécurité maritime. Limites et bonnes pratiques.",
      h2Variants: [
        "Détection des comportements à risque à bord avec l'IA",
        "IA et analyse météo-océanographique pour la sécurité navigation",
        "Limites de l'IA en sécurité maritime : le commandant garde la main",
      ],
    },
    urlCible: "/fr/faq/ia-securite-maritime",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO PAA fort ; schema.org FAQPage",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT AGRÉGÉ
// ─────────────────────────────────────────────────────────────────────────────

export const KW_SECTEURS_G7A: KeywordSeed[] = [
  ...KW_BANQUE_FINANCE,
  ...KW_ASSURANCE,
  ...KW_IMMOBILIER_PRO,
  ...KW_CYBERSECURITE,
  ...KW_COMMUNICATION_MEDIAS,
  ...KW_ENERGIE_CLEANTECH,
  ...KW_MARITIME_PORTUAIRE,
];
