// src/content/keywords/g7b-secteurs-industrie.ts
// Mode G Phase 7B — Secteurs industrie manquants — 2026-05-20
// 6 secteurs × 8 seeds = 48 seeds
//
// Intentions couvertes par secteur :
//   2 × transactionnel (niveau 2 ou 3)
//   2 × sectoriel      (niveau 2)
//   2 × benefice       (niveau 3)
//   2 × aeo            (niveau 3, kbType: "faq", urlCible: /fr/faq/[slug])
//
// Règles strictes :
//   - metaTitle ≤ 60 chars
//   - metaDescription ≤ 155 chars
//   - h1 ≠ keyword brut (bénéfice + résultat chiffré)
//   - niveau 1 + priorite 1 = INTERDIT

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 1 — INDUSTRIE MANUFACTURIÈRE (8 seeds)
// URL cible : /fr/secteurs/industrie-manufacturiere
// Slug secteur : "industrie-manufacturiere"
// ─────────────────────────────────────────────────────────────────────────────

const KW_INDUSTRIE_MANUFACTURIERE: KeywordSeed[] = [
  // ── transactionnel ──
  {
    keyword: "cabinet IA industrie manufacturière France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "industrie-manufacturiere",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Axion-IA : le cabinet IA pour l'industrie manufacturière PME",
      metaTitle: "Cabinet IA industrie manufacturière — Axion-IA",
      metaDescription:
        "Axion-IA déploie l'IA dans les usines et PME industrielles françaises : contrôle qualité, maintenance, traçabilité. Opérationnel en 4 semaines.",
      h2Variants: [
        "Pourquoi un cabinet IA spécialisé industrie ?",
        "Nos déploiements IA en production industrielle France",
        "Services IA pour PME manufacturières de 10 à 500 salariés",
      ],
    },
    variables: {
      process: "opérations industrielles PME",
      resultat: "-30 % non-conformités dès le 1er mois",
      chiffre: "30",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/industrie-manufacturiere",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: ManufacturingBusiness + FAQPage ; slug secteur exact",
  },
  {
    keyword: "IA pour PME industrie manufacturière",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "industrie-manufacturiere",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA pour PME industrielles : audit, formation et déploiement en 4 semaines",
      metaTitle: "IA PME industrie manufacturière — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les PME manufacturières dans l'adoption de l'IA : audit process, formation équipes, implémentation pilote. Prix ×2 sous le marché.",
      h2Variants: [
        "Quel est le ROI de l'IA pour une PME industrielle ?",
        "Audit IA usine : cartographier vos gains en 48 h",
        "De l'audit au déploiement IA en usine : notre méthode",
      ],
    },
    variables: {
      process: "processus industriels PME",
      resultat: "ROI positif dès le 3e mois",
      chiffre: "3",
      unite: "mois",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/industrie-manufacturiere",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // ── sectoriel ──
  {
    keyword: "IA pour contrôle qualité usine",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "industrie-manufacturiere",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Contrôle qualité usine avec l'IA : -40 % de défauts en production",
      metaTitle: "IA contrôle qualité usine — Axion-IA France",
      metaDescription:
        "Vision par ordinateur et IA pour le contrôle qualité en ligne de production : détection défauts, traçabilité pièces, alertes automatiques. Axion-IA.",
      h2Variants: [
        "Vision IA et contrôle qualité : comment ça marche en usine",
        "Intégration IA dans votre ligne de production existante",
        "Traçabilité et conformité ISO : l'IA comme assistant qualité",
      ],
    },
    variables: {
      process: "contrôle qualité production",
      resultat: "-40 % taux de défauts",
      chiffre: "40",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/industrie-manufacturiere",
    canonicalParent: "/fr/secteurs/industrie-manufacturiere",
    source: "manuel",
  },
  {
    keyword: "automatiser maintenance préventive IA industrie",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    secteur: "industrie-manufacturiere",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Maintenance préventive industrielle avec l'IA : 0 panne surprise, +15 % disponibilité",
      metaTitle: "Maintenance préventive IA industrie — Axion-IA",
      metaDescription:
        "IA prédictive pour la maintenance industrielle : analyse capteurs IoT, détection anomalies, planification interventions. Déployé par Axion-IA.",
      h2Variants: [
        "IA et maintenance prédictive : du capteur à l'alerte automatique",
        "Intégration IA maintenance avec vos GMAO existantes",
        "ROI maintenance IA : pannes évitées et coûts réduits",
      ],
    },
    variables: {
      process: "maintenance industrielle préventive",
      resultat: "+15 % disponibilité machines",
      chiffre: "15",
      unite: "%",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/industrie-manufacturiere",
    canonicalParent: "/fr/secteurs/industrie-manufacturiere",
    source: "manuel",
  },
  // ── benefice ──
  {
    keyword: "réduire défauts production IA fabrication série",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    secteur: "industrie-manufacturiere",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire vos défauts de production de 40 % grâce à l'IA : méthode et chiffres",
      metaTitle: "Réduire défauts production IA — Axion-IA France",
      metaDescription:
        "De 8 % à 4,8 % de taux de défaut grâce à l'IA : cas réels de PME industrielles françaises accompagnées par Axion-IA. Calculateur ROI inclus.",
      h2Variants: [
        "Benchmark taux de défaut avec et sans IA en fabrication série",
        "Calculateur ROI IA contrôle qualité industriel",
        "Comment démarrer un pilote IA qualité en 4 semaines",
      ],
    },
    variables: {
      process: "contrôle qualité fabrication",
      resultat: "-40 % taux de défauts",
      chiffre: "40",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/industrie-manufacturiere",
    canonicalParent: "/fr/secteurs/industrie-manufacturiere",
    source: "manuel",
  },
  {
    keyword: "gain productivité IA usine fabrication",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "eti",
    secteur: "industrie-manufacturiere",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Gagner 25 % de productivité en usine grâce à l'IA : cas réels 2026",
      metaTitle: "Gain productivité IA usine — Axion-IA France",
      metaDescription:
        "+20 à +30 % de productivité industrielle grâce à l'IA : optimisation ordonnancement, réduction temps réglage, automatisation rapports. Axion-IA.",
      h2Variants: [
        "Comment mesurer le gain de productivité IA en production",
        "Postes de travail industriels les plus impactés par l'IA",
        "Calculateur ROI IA productivité usine",
      ],
    },
    variables: {
      process: "production industrielle globale",
      resultat: "+25 % productivité usine",
      chiffre: "25",
      unite: "%",
      delai: "dès le 1er trimestre",
    },
    urlCible: "/fr/secteurs/industrie-manufacturiere",
    canonicalParent: "/fr/secteurs/industrie-manufacturiere",
    source: "manuel",
  },
  // ── aeo ──
  {
    keyword: "comment l'IA améliore le rendement industriel ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "industrie-manufacturiere",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Comment l'IA améliore le rendement industriel ? 5 leviers concrets",
      metaTitle: "IA et rendement industriel : comment ça marche ?",
      metaDescription:
        "L'IA améliore le rendement industriel via 5 leviers : contrôle qualité, maintenance prédictive, ordonnancement, traçabilité et reporting auto.",
      h2Variants: [
        "1. Contrôle qualité automatisé en ligne",
        "2. Maintenance prédictive IA : zéro panne surprise",
        "5. Reporting de production automatique pour les chefs d'atelier",
      ],
    },
    urlCible: "/fr/faq/ia-rendement-industriel",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; schema.org FAQPage ; PAA Google Industrie",
  },
  {
    keyword: "quel ROI pour l'IA dans une usine PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    secteur: "industrie-manufacturiere",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Quel ROI pour l'IA dans une usine PME ? Chiffres réels 2026",
      metaTitle: "ROI IA usine PME : combien espérer ? — Axion-IA",
      metaDescription:
        "ROI de l'IA en usine PME : entre 150 % et 400 % sur 18 mois selon le secteur. Données issues de déploiements réels Axion-IA en France.",
      h2Variants: [
        "Fourchette de ROI IA par type d'usine PME",
        "Coût d'un projet IA industriel et délai de retour",
        "Comment calculer le ROI IA avant de commencer ?",
      ],
    },
    variables: {
      process: "investissement IA industriel",
      resultat: "ROI 150–400 % sur 18 mois",
      chiffre: "150-400",
      unite: "%",
      delai: "sur 18 mois",
    },
    urlCible: "/fr/faq/roi-ia-usine-pme",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; schema.org FAQPage + HowTo",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 2 — MÉCANIQUE DE PRÉCISION (8 seeds)
// URL cible : /fr/secteurs/mecanique-precision
// Slug secteur : "mecanique-precision"
// ─────────────────────────────────────────────────────────────────────────────

const KW_MECANIQUE_PRECISION: KeywordSeed[] = [
  // ── transactionnel ──
  {
    keyword: "cabinet IA atelier mécanique précision",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "mecanique-precision",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Axion-IA : le cabinet IA pour les ateliers de mécanique de précision",
      metaTitle: "Cabinet IA mécanique précision — Axion-IA France",
      metaDescription:
        "Axion-IA accompagne les ateliers usinage et sous-traitants de précision dans l'IA : planification charge, qualité, traçabilité. Dès 4 semaines.",
      h2Variants: [
        "Quels gains IA pour un atelier de mécanique de précision ?",
        "Nos déploiements IA en ateliers usinage et outillage",
        "Services IA pour sous-traitants industriels de précision",
      ],
    },
    variables: {
      process: "opérations atelier usinage",
      resultat: "-25 % rebuts dès le 1er mois",
      chiffre: "25",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/mecanique-precision",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: ManufacturingBusiness spécialité mécanique",
  },
  {
    keyword: "IA sous-traitant mécanique précision France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "mecanique-precision",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA pour sous-traitants en mécanique de précision : audit et déploiement",
      metaTitle: "IA sous-traitant mécanique précision — Axion-IA",
      metaDescription:
        "Axion-IA audite et déploie l'IA dans les ateliers de mécanique de précision : planification, qualité, documentation. Prix compétitifs.",
      h2Variants: [
        "Audit IA atelier usinage : vos 3 gains prioritaires en 48 h",
        "IA et sous-traitance industrielle : cas d'usage prioritaires",
        "Comment financer un projet IA en PME de précision ?",
      ],
    },
    urlCible: "/fr/secteurs/mecanique-precision",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // ── sectoriel ──
  {
    keyword: "optimiser planification charge atelier usinage IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "mecanique-precision",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Optimiser la planification de charge atelier avec l'IA : +20 % de capacité",
      metaTitle: "Planification charge atelier usinage IA — Axion-IA",
      metaDescription:
        "L'IA optimise votre charge atelier en temps réel : affectation machines, délais, priorités clients. +20 % de capacité sans investissement machine.",
      h2Variants: [
        "Comment l'IA planifie la charge atelier mieux qu'un tableau Excel",
        "Intégration IA ERP/MES atelier de précision",
        "Alertes délais et gestion des urgences client par l'IA",
      ],
    },
    variables: {
      process: "planification charge et ordonnancement",
      resultat: "+20 % capacité atelier",
      chiffre: "20",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/mecanique-precision",
    canonicalParent: "/fr/secteurs/mecanique-precision",
    source: "manuel",
  },
  {
    keyword: "IA traçabilité pièces usinées",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "mecanique-precision",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Traçabilité complète de vos pièces usinées grâce à l'IA : zéro dossier manquant",
      metaTitle: "IA traçabilité pièces usinées — Axion-IA France",
      metaDescription:
        "Traçabilité IA pour ateliers de précision : identification pièces, historique opérations, certificats matière, conformité AS9100/IATF 16949.",
      h2Variants: [
        "Comment l'IA assure la traçabilité pièce par pièce",
        "Conformité AS9100 et IATF : la traçabilité IA comme avantage client",
        "Intégration traçabilité IA avec votre logiciel atelier",
      ],
    },
    urlCible: "/fr/secteurs/mecanique-precision",
    canonicalParent: "/fr/secteurs/mecanique-precision",
    source: "manuel",
    note: "schema.org: TechArticle ; mots secondaires : ERP usinage traçabilité IA",
  },
  // ── benefice ──
  {
    keyword: "réduire rebuts usinage avec IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    secteur: "mecanique-precision",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire vos rebuts d'usinage de 35 % avec l'IA : méthode et résultats chiffrés",
      metaTitle: "Réduire rebuts usinage IA — Axion-IA France",
      metaDescription:
        "De 6 % à 3,9 % de rebuts en atelier usinage grâce à l'IA : détection anomalies CN, ajustement paramètres, alertes opérateur. Cas réels Axion-IA.",
      h2Variants: [
        "Les causes de rebuts les plus automatisables avec l'IA",
        "Calculateur économies rebuts IA pour atelier de précision",
        "Pilote IA réduction rebuts : démarrer en 4 semaines",
      ],
    },
    variables: {
      process: "contrôle qualité usinage",
      resultat: "-35 % taux de rebuts",
      chiffre: "35",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/mecanique-precision",
    canonicalParent: "/fr/secteurs/mecanique-precision",
    source: "manuel",
  },
  {
    keyword: "gain temps devis atelier mécanique IA",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "mecanique-precision",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire le temps de devis atelier mécanique de 70 % grâce à l'IA",
      metaTitle: "IA devis atelier mécanique — gain de temps — Axion-IA",
      metaDescription:
        "Générez vos devis d'usinage en 15 min au lieu de 2 h : l'IA lit les plans, estime les temps, calcule les prix. Déployé par Axion-IA.",
      h2Variants: [
        "Comment l'IA lit un plan 2D/3D et génère un devis usinage",
        "Intégration IA avec vos outils de chiffrage existants",
        "Temps de réponse client divisé par 5 : impact commercial",
      ],
    },
    variables: {
      process: "établissement devis usinage",
      resultat: "2 h → 15 min par devis",
      chiffre: "15",
      unite: "minutes",
      delai: "dès le déploiement",
    },
    urlCible: "/fr/secteurs/mecanique-precision",
    canonicalParent: "/fr/secteurs/mecanique-precision",
    source: "manuel",
  },
  // ── aeo ──
  {
    keyword: "quel ROI IA pour un atelier de précision ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    secteur: "mecanique-precision",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Quel ROI pour l'IA dans un atelier de précision ? Chiffres 2026",
      metaTitle: "ROI IA atelier précision : combien ? — Axion-IA",
      metaDescription:
        "ROI IA pour atelier de mécanique de précision : 180 à 350 % sur 18 mois via rebuts, devis et planification. Données réelles Axion-IA.",
      h2Variants: [
        "Gains IA mesurables dans un atelier de précision",
        "Coût d'un projet IA pour PME sous-traitante",
        "Calculateur ROI IA atelier usinage",
      ],
    },
    variables: {
      process: "investissement IA atelier",
      resultat: "ROI 180–350 % sur 18 mois",
      chiffre: "180-350",
      unite: "%",
      delai: "sur 18 mois",
    },
    urlCible: "/fr/faq/roi-ia-atelier-precision",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; PAA Google ; schema.org FAQPage",
  },
  {
    keyword: "comment l'IA aide un sous-traitant industriel ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "mecanique-precision",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Comment l'IA aide un sous-traitant industriel ? 6 cas concrets",
      metaTitle: "IA sous-traitant industriel : comment ça aide ?",
      metaDescription:
        "Devis rapides, traçabilité, planification, qualité, documentation : 6 façons dont l'IA transforme les sous-traitants industriels en France.",
      h2Variants: [
        "1. Automatiser les devis et réponses appels d'offres",
        "3. Traçabilité pièce par pièce sans saisie manuelle",
        "6. Reporting client automatique en fin de série",
      ],
    },
    urlCible: "/fr/faq/ia-sous-traitant-industriel",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; intent question directe ; schema.org FAQPage",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 3 — CHIMIE & PHARMA (8 seeds)
// URL cible : /fr/secteurs/chimie-pharma
// Slug secteur : "chimie-pharma"
// ─────────────────────────────────────────────────────────────────────────────

const KW_CHIMIE_PHARMA: KeywordSeed[] = [
  // ── transactionnel ──
  {
    keyword: "cabinet IA laboratoire pharmaceutique PME",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "chimie-pharma",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Axion-IA : le cabinet IA pour les laboratoires et PME pharmaceutiques",
      metaTitle: "Cabinet IA laboratoire pharmaceutique — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les PME pharma et chimie dans l'IA : conformité réglementaire, R&D, documentation BPF. Déployé en 4 semaines.",
      h2Variants: [
        "Quels processus pharma automatiser avec l'IA ?",
        "IA et compliance GMP/BPF : ce que l'on peut automatiser",
        "Nos déploiements IA en laboratoires pharmaceutiques",
      ],
    },
    variables: {
      process: "opérations laboratoire pharma",
      resultat: "-40 % temps documentation réglementaire",
      chiffre: "40",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/chimie-pharma",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: MedicalOrganization + FAQPage ; compliance BPF/GMP",
  },
  {
    keyword: "IA conformité réglementaire industrie chimique",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "chimie-pharma",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et conformité réglementaire chimie : auditer et corriger plus vite",
      metaTitle: "IA conformité réglementaire chimie — Axion-IA",
      metaDescription:
        "Axion-IA audite vos processus chimie et pharma pour identifier les automatisations conformes REACH, GMP, ICH. Rapport livré en 48 h.",
      h2Variants: [
        "REACH, GMP, ICH : quels documents automatiser avec l'IA ?",
        "Audit IA conformité chimie : déroulé et livrables",
        "IA et souveraineté des données dans l'industrie chimique",
      ],
    },
    urlCible: "/fr/secteurs/chimie-pharma",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // ── sectoriel ──
  {
    keyword: "accélérer R&D chimie IA labo",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "chimie-pharma",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Accélérer votre R&D chimie avec l'IA : de l'idée au prototype 3× plus vite",
      metaTitle: "IA R&D chimie labo — accélérer l'innovation — Axion-IA",
      metaDescription:
        "L'IA accélère la R&D en chimie : revue littérature automatique, prédiction propriétés moléculaires, analyse données expérimentales. Axion-IA.",
      h2Variants: [
        "IA et revue de littérature scientifique : gain de temps réel",
        "Analyse données expérimentales avec les LLM : méthode",
        "IA et propriété intellectuelle R&D chimie : précautions",
      ],
    },
    variables: {
      process: "cycle R&D chimie/pharma",
      resultat: "3× plus rapide en phase exploratoire",
      chiffre: "3",
      unite: "×",
      delai: "dès le 1er projet",
    },
    urlCible: "/fr/secteurs/chimie-pharma",
    canonicalParent: "/fr/secteurs/chimie-pharma",
    source: "manuel",
  },
  {
    keyword: "automatiser documentation BPF pharma IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "chimie-pharma",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Automatiser la documentation BPF avec l'IA : conformité garantie, 0 oubli",
      metaTitle: "Documentation BPF pharma IA — Axion-IA France",
      metaDescription:
        "Pipeline IA pour la documentation Bonnes Pratiques de Fabrication : SOPs, rapports de lot, déviations. Conformité ANSM/EMA accélérée.",
      h2Variants: [
        "Quels documents BPF automatiser avec l'IA en sécurité ?",
        "IA et gestion des déviations pharma : traçabilité automatique",
        "Validation IA dans un environnement 21 CFR Part 11",
      ],
    },
    variables: {
      process: "documentation réglementaire BPF",
      resultat: "-50 % temps rédaction SOPs et rapports",
      chiffre: "50",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/chimie-pharma",
    canonicalParent: "/fr/secteurs/chimie-pharma",
    source: "manuel",
    note: "21 CFR Part 11 ; ANSM ; EMA ; conformité mention obligatoire",
  },
  // ── benefice ──
  {
    keyword: "réduire délai dossier AMM avec IA pharma",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    secteur: "chimie-pharma",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Réduire le délai de constitution d'un dossier AMM de 30 % avec l'IA",
      metaTitle: "IA dossier AMM pharma : gagner du temps — Axion-IA",
      metaDescription:
        "L'IA réduit de 30 % le temps de constitution des dossiers réglementaires pharma (AMM, CTD, variations). Cas réels PME France. Axion-IA.",
      h2Variants: [
        "Quelles sections du CTD automatiser avec l'IA ?",
        "IA et rédaction réglementaire pharma : limites et garde-fous",
        "ROI IA sur un projet dossier AMM : chiffres défendables",
      ],
    },
    variables: {
      process: "constitution dossier AMM",
      resultat: "-30 % délai dossier réglementaire",
      chiffre: "30",
      unite: "%",
      delai: "dès le 1er dossier",
    },
    urlCible: "/fr/secteurs/chimie-pharma",
    canonicalParent: "/fr/secteurs/chimie-pharma",
    source: "manuel",
  },
  {
    keyword: "économies IA compliance pharma PME",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    secteur: "chimie-pharma",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Combien l'IA fait économiser sur la compliance pharma ? Chiffres 2026",
      metaTitle: "Économies IA compliance pharma PME — Axion-IA",
      metaDescription:
        "30 000 à 120 000 €/an économisés sur la compliance pharma grâce à l'IA : documentation, audits internes, gestion déviations. Axion-IA.",
      h2Variants: [
        "Coût de la non-conformité pharma vs investissement IA",
        "Postes de compliance pharma les plus rentables à automatiser",
        "Calculateur ROI IA compliance pharma",
      ],
    },
    variables: {
      process: "compliance et qualité pharma",
      resultat: "30 000–120 000 €/an économisés",
      chiffre: "30000-120000",
      unite: "€/an",
      delai: "sur 12 mois",
    },
    urlCible: "/fr/secteurs/chimie-pharma",
    canonicalParent: "/fr/secteurs/chimie-pharma",
    source: "manuel",
  },
  // ── aeo ──
  {
    keyword: "comment l'IA sécurise la conformité pharma ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "chimie-pharma",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Comment l'IA sécurise la conformité pharmaceutique ? 5 mécanismes",
      metaTitle: "IA conformité pharma : comment ça sécurise ?",
      metaDescription:
        "L'IA sécurise la conformité pharma en 5 points : documentation automatique, détection anomalies, alertes déviations, traçabilité, audits IA.",
      h2Variants: [
        "1. Génération et contrôle des SOPs avec l'IA",
        "3. Détection automatique des déviations de process",
        "5. Audit interne assisté par IA : exhaustivité garantie",
      ],
    },
    urlCible: "/fr/faq/ia-conformite-pharma",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; PAA Google Pharma ; schema.org FAQPage",
  },
  {
    keyword: "peut-on utiliser l'IA en laboratoire BPF ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "chimie-pharma",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Peut-on utiliser l'IA en laboratoire BPF ? Cadre légal et usages validés",
      metaTitle: "IA en labo BPF : est-ce possible ? — Axion-IA",
      metaDescription:
        "Oui, l'IA est utilisable en labo BPF sous conditions : validation 21 CFR Part 11, qualification, traçabilité. Guide complet Axion-IA 2026.",
      h2Variants: [
        "Cadre réglementaire IA en laboratoire BPF : ce que dit l'ANSM",
        "Validation d'un système IA en environnement pharmaceutique",
        "Exemples d'usages IA validés en labo pharma",
      ],
    },
    urlCible: "/fr/faq/ia-laboratoire-bpf-possible",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; schema.org FAQPage ; audience compliance pharma",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 4 — AÉROSPATIAL & DÉFENSE (8 seeds)
// URL cible : /fr/secteurs/aerospatial-defense
// Slug secteur : "aerospatial-defense"
// ─────────────────────────────────────────────────────────────────────────────

const KW_AEROSPATIAL_DEFENSE: KeywordSeed[] = [
  // ── transactionnel ──
  {
    keyword: "cabinet IA sous-traitant aéronautique France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "aerospatial-defense",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Axion-IA : le cabinet IA pour les sous-traitants aéronautiques français",
      metaTitle: "Cabinet IA sous-traitant aéronautique — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les PME sous-traitantes Airbus, Safran et Thales dans l'IA : traçabilité, qualité EN9100, documentation. Dès 4 semaines.",
      h2Variants: [
        "Quels gains IA pour un sous-traitant aéronautique ?",
        "IA et EN9100 / AS9100 : ce que l'on peut automatiser",
        "Nos déploiements IA en PME sous-traitantes aéro",
      ],
    },
    variables: {
      process: "opérations PME sous-traitante aéro",
      resultat: "-35 % non-conformités fournisseur",
      chiffre: "35",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/aerospatial-defense",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: ManufacturingBusiness aéro ; EN9100 ; NADCAP mention",
  },
  {
    keyword: "IA fournisseur Airbus Safran Thales PME",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "aerospatial-defense",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA pour fournisseurs Airbus, Safran et Thales : améliorer votre score qualité",
      metaTitle: "IA fournisseur Airbus Safran Thales — Axion-IA",
      metaDescription:
        "Axion-IA aide les PME fournisseurs de grands donneurs d'ordre aéro à améliorer leur score qualité et à réduire leurs non-conformités grâce à l'IA.",
      h2Variants: [
        "Critères qualité donneurs d'ordre aéro : où l'IA aide le plus",
        "Audit IA PME aéronautique : vos gains prioritaires en 48 h",
        "IA et SQCDP fournisseur : piloter avec les données",
      ],
    },
    urlCible: "/fr/secteurs/aerospatial-defense",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // ── sectoriel ──
  {
    keyword: "traçabilité qualité aérospatiale IA",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "aerospatial-defense",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Traçabilité qualité aérospatiale avec l'IA : zéro dossier incomplet",
      metaTitle: "Traçabilité qualité aérospatiale IA — Axion-IA",
      metaDescription:
        "Traçabilité pièce par pièce, certificats matière, FI/FAI, APQP automatisés avec l'IA. Conformité EN9100/AS9100 garantie. Axion-IA.",
      h2Variants: [
        "IA et FAI (First Article Inspection) : automatiser la documentation",
        "Traçabilité aérospatiale IA : de la matière au certificat de conformité",
        "Intégration IA avec votre ERP qualité aéronautique",
      ],
    },
    variables: {
      process: "traçabilité et documentation qualité aéro",
      resultat: "0 dossier incomplet lors des audits clients",
      chiffre: "100",
      unite: "% conformité dossiers",
      delai: "en 8 semaines",
    },
    urlCible: "/fr/secteurs/aerospatial-defense",
    canonicalParent: "/fr/secteurs/aerospatial-defense",
    source: "manuel",
  },
  {
    keyword: "réduire non-conformités fournisseur aéronautique IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "aerospatial-defense",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Réduire vos non-conformités fournisseur aéro de 40 % grâce à l'IA",
      metaTitle: "Réduire non-conformités fournisseur aéro IA — Axion-IA",
      metaDescription:
        "Détection précoce des dérives, alertes automatiques, analyse 8D assistée par IA : -40 % de non-conformités en 3 mois. PME aéronautique France.",
      h2Variants: [
        "Causes racines des non-conformités aéro et rôle de l'IA",
        "Analyse 8D assistée par IA : plus rapide, plus exhaustive",
        "Tableau de bord qualité fournisseur aéro avec l'IA",
      ],
    },
    variables: {
      process: "gestion non-conformités fournisseur",
      resultat: "-40 % non-conformités sur 3 mois",
      chiffre: "40",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/aerospatial-defense",
    canonicalParent: "/fr/secteurs/aerospatial-defense",
    source: "manuel",
  },
  // ── benefice ──
  {
    keyword: "améliorer score SQCDP fournisseur aéro IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    secteur: "aerospatial-defense",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Améliorer votre score SQCDP fournisseur aéro de 25 points grâce à l'IA",
      metaTitle: "Score SQCDP fournisseur aéro IA — Axion-IA France",
      metaDescription:
        "De Amber à Green en 3 mois : comment les PME aéronautiques améliorent leur score SQCDP grâce à l'IA. Données réelles Axion-IA 2026.",
      h2Variants: [
        "SQCDP décrypté : quels axes l'IA améliore le plus vite",
        "Plan d'action IA pour passer de Yellow à Green fournisseur",
        "ROI IA SQCDP : valoriser l'amélioration qualité en euros",
      ],
    },
    variables: {
      process: "pilotage performance SQCDP",
      resultat: "+25 points score SQCDP en 3 mois",
      chiffre: "25",
      unite: "points SQCDP",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/aerospatial-defense",
    canonicalParent: "/fr/secteurs/aerospatial-defense",
    source: "manuel",
  },
  {
    keyword: "gain productivité documentation aéronautique IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    secteur: "aerospatial-defense",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Diviser par 3 le temps de documentation aéronautique grâce à l'IA",
      metaTitle: "IA documentation aéronautique : gain ×3 — Axion-IA",
      metaDescription:
        "Plans de contrôle, AMDEC, APQP, FAI : l'IA divise par 3 le temps de production des dossiers qualité aéronautiques. Axion-IA.",
      h2Variants: [
        "Quels documents aéronautiques automatiser avec l'IA ?",
        "IA et AMDEC automatisée : précision et traçabilité",
        "Calculateur gain temps documentation qualité aéro",
      ],
    },
    variables: {
      process: "documentation qualité aéronautique",
      resultat: "temps documentation / 3",
      chiffre: "3",
      unite: "× plus rapide",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/aerospatial-defense",
    canonicalParent: "/fr/secteurs/aerospatial-defense",
    source: "manuel",
  },
  // ── aeo ──
  {
    keyword: "comment certifier un système IA chez un fournisseur Airbus ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "aerospatial-defense",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Comment certifier un système IA chez un fournisseur Airbus ? Guide 2026",
      metaTitle: "Certifier IA fournisseur Airbus : le guide — Axion-IA",
      metaDescription:
        "Validation IA chez un fournisseur Airbus : étapes, normes EN9100, qualification logiciel DO-178, plan de validation. Guide Axion-IA 2026.",
      h2Variants: [
        "Normes applicables à l'IA chez un fournisseur aéro",
        "Plan de validation d'un système IA aéronautique",
        "Rôle du donneur d'ordre dans la validation IA fournisseur",
      ],
    },
    urlCible: "/fr/faq/certifier-ia-fournisseur-airbus",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; PAA Google Aéro ; schema.org FAQPage + TechArticle",
  },
  {
    keyword: "l'IA peut-elle aider à décrocher un contrat Safran ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "aerospatial-defense",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "L'IA peut-elle aider une PME à décrocher un contrat Safran ou Thales ?",
      metaTitle: "IA pour décrocher contrat Safran Thales — Axion-IA",
      metaDescription:
        "Oui : appels d'offres, dossiers qualité, score fournisseur — l'IA aide les PME aéro à se qualifier et à répondre plus vite aux AO Tier 1.",
      h2Variants: [
        "Qualification fournisseur Safran : où l'IA accélère le processus",
        "Réponse aux appels d'offres aéro avec l'IA : méthode",
        "Score fournisseur Tier 1 : les critères IA peut améliorer",
      ],
    },
    urlCible: "/fr/faq/ia-decrocher-contrat-safran-thales",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; intent question directe ; audience PME aéro sous-traitant",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 5 — AUTOMOBILE & MOBILITÉ (8 seeds)
// URL cible : /fr/secteurs/automobile-mobilite
// Slug secteur : "automobile-mobilite"
// ─────────────────────────────────────────────────────────────────────────────

const KW_AUTOMOBILE_MOBILITE: KeywordSeed[] = [
  // ── transactionnel ──
  {
    keyword: "cabinet IA équipementier automobile France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "automobile-mobilite",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Axion-IA : le cabinet IA pour les équipementiers et PME automobile",
      metaTitle: "Cabinet IA équipementier automobile — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les équipementiers et PME automobile dans l'IA : qualité IATF, SAV, relation client, mobilité électrique. Dès 4 semaines.",
      h2Variants: [
        "Quels processus automobile automatiser avec l'IA ?",
        "IA et IATF 16949 : documentation et traçabilité automatisées",
        "Nos déploiements IA en PME équipementières automobiles",
      ],
    },
    variables: {
      process: "opérations PME équipementier auto",
      resultat: "-30 % délais de traitement qualité",
      chiffre: "30",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/automobile-mobilite",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: AutoPartsStore + ManufacturingBusiness ; IATF 16949",
  },
  {
    keyword: "IA pour concession automobile France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "automobile-mobilite",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA pour concession automobile : +25 % de satisfaction client en 30 jours",
      metaTitle: "IA pour concession automobile France — Axion-IA",
      metaDescription:
        "Axion-IA déploie l'IA dans les concessions automobiles : SAV automatisé, relances clients, prise de RDV, reporting. Résultats dès 30 jours.",
      h2Variants: [
        "Quels processus concession automatiser avec l'IA ?",
        "IA et DMS concession : intégration sans refonte IT",
        "ROI IA concession automobile : chiffres réels",
      ],
    },
    urlCible: "/fr/secteurs/automobile-mobilite",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
  },
  // ── sectoriel ──
  {
    keyword: "automatiser service après-vente automobile IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "automobile-mobilite",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Automatiser le SAV automobile avec l'IA : -40 % de temps de traitement",
      metaTitle: "Automatiser SAV automobile IA — Axion-IA France",
      metaDescription:
        "Prise en charge véhicule, devis réparation, suivi interventions, relances : l'IA automatise votre SAV auto. Déployé par Axion-IA en 4 semaines.",
      h2Variants: [
        "De la prise de RDV à la restitution véhicule : l'IA en SAV auto",
        "Intégration IA SAV avec votre DMS (CDK, Reynolds, SAP)",
        "Satisfaction client SAV : indicateurs et résultats IA",
      ],
    },
    variables: {
      process: "service après-vente automobile",
      resultat: "-40 % temps de traitement SAV",
      chiffre: "40",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/automobile-mobilite",
    canonicalParent: "/fr/secteurs/automobile-mobilite",
    source: "manuel",
  },
  {
    keyword: "IA mobilité électrique transition véhicule",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "interventions-formations",
    cible: "pme",
    secteur: "automobile-mobilite",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "IA et transition vers la mobilité électrique : accompagner vos équipes en 2026",
      metaTitle: "IA mobilité électrique transition — Axion-IA France",
      metaDescription:
        "L'IA accompagne la transition VE pour les concessions et équipementiers : formation équipes, diagnostic électrique, gestion stock pièces EV.",
      h2Variants: [
        "Comment l'IA aide les équipes à monter en compétence VE",
        "IA et diagnostic véhicule électrique : outils et méthodes",
        "Gestion des stocks pièces EV avec l'IA",
      ],
    },
    urlCible: "/fr/secteurs/automobile-mobilite",
    canonicalParent: "/fr/secteurs/automobile-mobilite",
    source: "manuel",
  },
  // ── benefice ──
  {
    keyword: "gain productivité atelier mécanique automobile IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    secteur: "automobile-mobilite",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Gagner 30 % de productivité en atelier mécanique automobile grâce à l'IA",
      metaTitle: "Productivité atelier mécanique auto IA — Axion-IA",
      metaDescription:
        "+30 % de véhicules traités sans embauche supplémentaire : l'IA optimise la planification et les diagnostics en atelier auto. Axion-IA.",
      h2Variants: [
        "Comment l'IA accélère le diagnostic et l'OR en atelier auto",
        "Planification atelier IA : plus de créneaux, moins d'attente",
        "Calculateur ROI IA atelier mécanique automobile",
      ],
    },
    variables: {
      process: "production atelier mécanique auto",
      resultat: "+30 % véhicules traités",
      chiffre: "30",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/automobile-mobilite",
    canonicalParent: "/fr/secteurs/automobile-mobilite",
    source: "manuel",
  },
  {
    keyword: "améliorer NPS client concession IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    secteur: "automobile-mobilite",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Améliorer le NPS client de votre concession de +20 points grâce à l'IA",
      metaTitle: "Améliorer NPS concession IA — Axion-IA France",
      metaDescription:
        "+20 points de NPS en 3 mois : relances personnalisées, suivi proactif, chatbot SAV. L'IA transforme la relation client concession. Axion-IA.",
      h2Variants: [
        "NPS concession et IA : les leviers qui font la différence",
        "Chatbot SAV concession : disponible 7j/7, réponse en 30 s",
        "Mesurer l'impact IA sur la satisfaction client concession",
      ],
    },
    variables: {
      process: "relation client et SAV concession",
      resultat: "+20 points NPS en 3 mois",
      chiffre: "20",
      unite: "points NPS",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/automobile-mobilite",
    canonicalParent: "/fr/secteurs/automobile-mobilite",
    source: "manuel",
  },
  // ── aeo ──
  {
    keyword: "comment l'IA améliore la relation client en concession ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "automobile-mobilite",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Comment l'IA améliore la relation client en concession automobile ?",
      metaTitle: "IA relation client concession auto : comment ? — Axion-IA",
      metaDescription:
        "Chatbot SAV, relances personnalisées, prise de RDV automatique, suivi réparation : 5 façons dont l'IA améliore la relation client concession.",
      h2Variants: [
        "1. Chatbot SAV concession : répondre 24h/24",
        "3. Relances personnalisées post-entretien par IA",
        "5. Suivi réparation temps réel : zéro appel client entrant",
      ],
    },
    urlCible: "/fr/faq/ia-relation-client-concession-auto",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; PAA Google Automobile ; schema.org FAQPage",
  },
  {
    keyword: "l'IA peut-elle remplacer le conseiller SAV auto ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "automobile-mobilite",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "L'IA peut-elle remplacer le conseiller SAV automobile ? La vraie réponse",
      metaTitle: "IA remplace conseiller SAV auto ? — Axion-IA",
      metaDescription:
        "Non, l'IA assiste et libère le conseiller SAV des tâches répétitives (devis, RDV, suivi). Le conseil client complexe reste humain. Guide Axion-IA.",
      h2Variants: [
        "Ce que l'IA prend en charge à la place du conseiller SAV",
        "Ce que l'IA ne peut pas remplacer en concession",
        "Conseiller SAV augmenté par l'IA : le nouveau modèle 2026",
      ],
    },
    urlCible: "/fr/faq/ia-remplace-conseiller-sav-auto",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; intent question directe ; schema.org FAQPage",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR 6 — DISPOSITIFS MÉDICAUX (8 seeds)
// URL cible : /fr/secteurs/dispositifs-medicaux
// Slug secteur : "dispositifs-medicaux"
// ─────────────────────────────────────────────────────────────────────────────

const KW_DISPOSITIFS_MEDICAUX: KeywordSeed[] = [
  // ── transactionnel ──
  {
    keyword: "cabinet IA fabricant dispositif médical France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "pme",
    secteur: "dispositifs-medicaux",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Axion-IA : le cabinet IA pour les fabricants de dispositifs médicaux",
      metaTitle: "Cabinet IA dispositif médical France — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les fabricants de DM dans l'IA : documentation MDR 2027, marquage CE, vigilance. Conformité garantie, déployé en 4 semaines.",
      h2Variants: [
        "Quels processus DM automatiser avec l'IA sans risque réglementaire ?",
        "IA et MDR 2017/745 : documentation et traçabilité conformes",
        "Nos déploiements IA en PME fabricantes de dispositifs médicaux",
      ],
    },
    variables: {
      process: "opérations fabricant DM",
      resultat: "-40 % temps documentation réglementaire",
      chiffre: "40",
      unite: "%",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/secteurs/dispositifs-medicaux",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "schema.org: MedicalOrganization ; MDR 2017/745 ; ANSM ; ISO 13485",
  },
  {
    keyword: "IA conformité MDR 2027 fabricant DM",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "pme",
    secteur: "dispositifs-medicaux",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et conformité MDR 2027 : préparer votre dossier technique DM à temps",
      metaTitle: "IA conformité MDR 2027 fabricant DM — Axion-IA",
      metaDescription:
        "L'IA accélère la mise en conformité MDR 2027 pour les fabricants DM : dossier technique, évaluation clinique, SSCP. Axion-IA.",
      h2Variants: [
        "MDR 2027 : quelles obligations pour les fabricants DM ?",
        "IA et dossier technique MDR : ce que l'on peut automatiser",
        "Audit IA préparation MDR 2027 : vos gaps en 48 h",
      ],
    },
    urlCible: "/fr/secteurs/dispositifs-medicaux",
    canonicalParent: "/fr/secteurs",
    source: "manuel",
    note: "deadline MDR 2027 : forte urgence business",
  },
  // ── sectoriel ──
  {
    keyword: "automatiser documentation réglementaire DM IA",
    intent: "sectoriel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    secteur: "dispositifs-medicaux",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Automatiser la documentation réglementaire DM avec l'IA : ×2 plus vite",
      metaTitle: "Documentation réglementaire DM IA — Axion-IA",
      metaDescription:
        "Dossier technique, IFU, SSCP, évaluation clinique : l'IA génère et contrôle vos documents réglementaires DM. ISO 13485 et MDR by design.",
      h2Variants: [
        "Quels documents DM automatiser avec l'IA en toute conformité ?",
        "IA et IFU (Instructions for Use) : rédaction automatisée",
        "Contrôle qualité documentaire DM avec l'IA",
      ],
    },
    variables: {
      process: "production documentation réglementaire DM",
      resultat: "2× plus rapide pour les dossiers techniques",
      chiffre: "2",
      unite: "× plus rapide",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/dispositifs-medicaux",
    canonicalParent: "/fr/secteurs/dispositifs-medicaux",
    source: "manuel",
  },
  {
    keyword: "IA gestion des risques dispositif médical",
    intent: "sectoriel",
    kbType: "industry_use_case",
    module: "implementation",
    cible: "pme",
    secteur: "dispositifs-medicaux",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Gestion des risques DM avec l'IA : analyse ISO 14971 accélérée",
      metaTitle: "IA gestion risques dispositif médical — Axion-IA",
      metaDescription:
        "L'IA assiste l'analyse des risques ISO 14971 pour les DM : AMDEC automatisée, FMEA, plan de maîtrise des risques. PME DM France. Axion-IA.",
      h2Variants: [
        "IA et ISO 14971 : ce que l'on peut automatiser en gestion des risques DM",
        "AMDEC IA pour dispositif médical : méthode et résultats",
        "Validation IA dans un système de management qualité DM",
      ],
    },
    urlCible: "/fr/secteurs/dispositifs-medicaux",
    canonicalParent: "/fr/secteurs/dispositifs-medicaux",
    source: "manuel",
    note: "ISO 14971 ; AMDEC ; schema.org: TechArticle MedicalDevice",
  },
  // ── benefice ──
  {
    keyword: "réduire délai marquage CE dispositif médical IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    secteur: "dispositifs-medicaux",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Réduire le délai d'obtention du marquage CE DM de 30 % avec l'IA",
      metaTitle: "Délai marquage CE dispositif médical IA — Axion-IA",
      metaDescription:
        "-30 % sur le délai de marquage CE grâce à l'IA : dossier technique complet plus vite, moins d'allers-retours avec l'organisme notifié.",
      h2Variants: [
        "Étapes du marquage CE DM où l'IA fait gagner le plus de temps",
        "Organismes notifiés et dossiers IA : ce qu'ils acceptent",
        "ROI IA sur un projet marquage CE DM",
      ],
    },
    variables: {
      process: "processus marquage CE dispositif médical",
      resultat: "-30 % délai obtention marquage CE",
      chiffre: "30",
      unite: "%",
      delai: "dès le 1er dossier",
    },
    urlCible: "/fr/secteurs/dispositifs-medicaux",
    canonicalParent: "/fr/secteurs/dispositifs-medicaux",
    source: "manuel",
  },
  {
    keyword: "économies IA qualité fabricant dispositif médical",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "audit",
    cible: "pme",
    secteur: "dispositifs-medicaux",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Combien l'IA fait économiser à un fabricant DM sur la qualité ? Chiffres 2026",
      metaTitle: "Économies IA qualité fabricant DM — Axion-IA",
      metaDescription:
        "40 000 à 150 000 €/an économisés sur la qualité réglementaire DM grâce à l'IA : documentation, CAPA, audits. Données réelles Axion-IA.",
      h2Variants: [
        "Postes de coût qualité DM les plus impactés par l'IA",
        "Coût de non-conformité DM vs investissement IA",
        "Calculateur ROI IA qualité pour fabricant de DM",
      ],
    },
    variables: {
      process: "qualité réglementaire fabricant DM",
      resultat: "40 000–150 000 €/an économisés",
      chiffre: "40000-150000",
      unite: "€/an",
      delai: "sur 12 mois",
    },
    urlCible: "/fr/secteurs/dispositifs-medicaux",
    canonicalParent: "/fr/secteurs/dispositifs-medicaux",
    source: "manuel",
  },
  // ── aeo ──
  {
    keyword: "comment l'IA aide à obtenir le marquage CE ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "dispositifs-medicaux",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Comment l'IA aide à obtenir le marquage CE d'un dispositif médical ?",
      metaTitle: "IA pour obtenir marquage CE DM : le guide — Axion-IA",
      metaDescription:
        "L'IA accélère le marquage CE DM en 5 étapes : dossier technique, évaluation clinique, gestion des risques, SSCP, vigilance. Guide Axion-IA.",
      h2Variants: [
        "1. Dossier technique MDR : l'IA réduit de 40 % le temps de production",
        "3. Évaluation clinique assistée par IA",
        "5. Vigilance post-marché automatisée avec l'IA",
      ],
    },
    urlCible: "/fr/faq/ia-obtenir-marquage-ce-dispositif-medical",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; PAA Google DM/MDR ; schema.org FAQPage ; MDR 2017/745",
  },
  {
    keyword: "l'IA est-elle autorisée dans un système QMS ISO 13485 ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    secteur: "dispositifs-medicaux",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "L'IA est-elle autorisée dans un système QMS ISO 13485 ? Guide pratique",
      metaTitle: "IA dans QMS ISO 13485 : autorisée ? — Axion-IA",
      metaDescription:
        "Oui, sous conditions de validation : l'IA est intégrable dans un QMS ISO 13485. Cadre, exigences de validation et exemples d'usage. Axion-IA.",
      h2Variants: [
        "Ce que dit ISO 13485 sur les logiciels et outils IA",
        "Validation d'un outil IA dans un QMS dispositif médical",
        "Exemples d'IA validés dans des QMS ISO 13485 en France",
      ],
    },
    urlCible: "/fr/faq/ia-autorisee-qms-iso-13485",
    canonicalParent: "/fr/faq",
    source: "manuel",
    note: "AEO fort ; schema.org FAQPage ; audience responsables qualité DM",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT CONSOLIDÉ
// ─────────────────────────────────────────────────────────────────────────────

export const KW_SECTEURS_G7B: KeywordSeed[] = [
  ...KW_INDUSTRIE_MANUFACTURIERE,
  ...KW_MECANIQUE_PRECISION,
  ...KW_CHIMIE_PHARMA,
  ...KW_AEROSPATIAL_DEFENSE,
  ...KW_AUTOMOBILE_MOBILITE,
  ...KW_DISPOSITIFS_MEDICAUX,
];
