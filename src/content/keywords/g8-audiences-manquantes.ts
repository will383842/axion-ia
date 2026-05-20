/**
 * Keyword Seeds — Mode G Phase 8 : Audiences manquantes
 *
 * Généré 2026-05-20 · PROMPT-KEYWORD-STRATEGY-MASTER-V1 v1.2
 *
 * Audiences couvertes :
 *   - universite-grande-ecole : 10 seeds
 *   - collectivite-mairie      : 10 seeds
 *
 * Export : KW_AUDIENCES_G8 (20 seeds)
 * Règle niveau/priorité : niveau 1 + priorite 1 = INTERDIT.
 * Règle R5 : h1 ≠ keyword brut.
 * metaTitle ≤ 60 chars · metaDescription ≤ 155 chars.
 */

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// AUDIENCE 1 — UNIVERSITÉ / GRANDE ÉCOLE (10 seeds)
// Profil : directeurs pédagogie et DRH de grandes écoles (HEC, ESSEC, Centrale,
//          Arts et Métiers, Sciences Po, ESCP…)
// Services : interventions-formations, coaching-1-to-1, implementation (LMS IA)
// URLs cible : /fr/interventions-formations/universite-grande-ecole
//              /fr/partenaires/academique
// ─────────────────────────────────────────────────────────────────────────────

const KW_UNIVERSITE: KeywordSeed[] = [
  // ── TRANSACTIONNEL (3 seeds) ─────────────────────────────────────────────
  {
    keyword: "conférencier IA grande école France",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Conférencier IA reconnu pour vos grandes écoles : cours magistraux et masterclasses",
      metaTitle: "Conférencier IA grande école France — Axion-IA",
      metaDescription:
        "Axion-IA intervient en grandes écoles (HEC, ESSEC, Centrale…) : conférences IA, cours magistraux, ateliers pratiques étudiants M1/M2.",
      h2Variants: [
        "Thématiques de conférence IA pour grandes écoles",
        "Format d'intervention : cours magistral, masterclass, workshop",
        "Références : écoles et universités où Axion-IA intervient",
      ],
    },
    variables: {
      process: "cours magistraux et conférences IA",
      resultat: "étudiants opérationnels dès la conférence",
      chiffre: "1",
      unite: "session",
      delai: "dès la première intervention",
    },
    urlCible: "/fr/interventions-formations/universite-grande-ecole",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
    note: "schema.org: EducationEvent + Person (speaker) ; cible directeurs pédagogie",
  },
  {
    keyword: "intervenant IA master management France",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Intervenant IA pour masters management et stratégie : cas concrets B2B",
      metaTitle: "Intervenant IA master management France — Axion-IA",
      metaDescription:
        "Axion-IA intervient dans les masters management, stratégie et transformation digitale : IA appliquée au business, cas réels, étudiants engagés.",
      h2Variants: [
        "Contenu d'une intervention IA en master management",
        "Adapter le niveau de l'intervention au programme de master",
        "Évaluation et travaux pratiques IA intégrés au cursus",
      ],
    },
    variables: {
      process: "modules IA en master management",
      resultat: "NPS étudiants > 8/10",
      chiffre: "8",
      unite: "/10 NPS",
      delai: "dès la session",
    },
    urlCible: "/fr/interventions-formations/universite-grande-ecole",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "expert IA HEC Sciences Po conférence",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Expert IA pour conférences HEC, Sciences Po, Centrale et autres grandes écoles",
      metaTitle: "Expert IA HEC Sciences Po conférence — Axion-IA",
      metaDescription:
        "Axion-IA propose des experts IA reconnus pour conférences et cours dans les grandes écoles françaises. Créneaux disponibles, formats adaptables.",
      h2Variants: [
        "Profil de l'expert IA Axion-IA pour les grandes écoles",
        "Disponibilités et tarifs conférencier IA grande école",
        "Retours des grandes écoles ayant accueilli Axion-IA",
      ],
    },
    urlCible: "/fr/interventions-formations/universite-grande-ecole",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
    note: "transactionnel forte intention ; cible DRH et directeurs pédagogie",
  },
  // ── SECTORIEL (3 seeds) ───────────────────────────────────────────────────
  {
    keyword: "module IA programme ingénieur grande école",
    intent: "sectoriel",
    kbType: "implementation_playbook",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Intégrer un module IA dans votre programme ingénieur : contenu, pédagogie et certification",
      metaTitle: "Module IA programme ingénieur grande école — Axion-IA",
      metaDescription:
        "Playbook complet pour intégrer l'IA dans les programmes ingénieur : contenu, ateliers pratiques, évaluation, accréditation. Par Axion-IA.",
      h2Variants: [
        "Architecture d'un module IA pour élèves ingénieurs",
        "Cas pratiques IA adaptés aux spécialités ingénieur",
        "Certification IA étudiants : valeur et reconnaissance employeurs",
      ],
    },
    urlCible: "/fr/interventions-formations/universite-grande-ecole",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "atelier pratique IA étudiants grande école",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Ateliers pratiques IA pour étudiants de grandes écoles : de la théorie à l'opérationnel",
      metaTitle: "Atelier pratique IA étudiants grande école — Axion-IA",
      metaDescription:
        "Ateliers hands-on IA pour étudiants M1/M2 et ingénieurs : prompting, agents IA, automatisation. Cas réels, 100 % pratique. Par Axion-IA.",
      h2Variants: [
        "Déroulé d'un atelier IA pratique pour étudiants",
        "Prérequis et niveaux adaptés : débutant à avancé",
        "Ce que les étudiants repartent avec en tête après l'atelier",
      ],
    },
    urlCible: "/fr/interventions-formations/universite-grande-ecole",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "partenariat académique cabinet IA France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Partenariat académique avec un cabinet IA B2B : co-construction de modules et recherche appliquée",
      metaTitle: "Partenariat académique cabinet IA France — Axion-IA",
      metaDescription:
        "Axion-IA noue des partenariats académiques avec les grandes écoles : co-design de modules IA, chaires, projets de recherche appliquée.",
      h2Variants: [
        "Formes de partenariat académique avec Axion-IA",
        "Chaire IA : co-animation et visibilité pour votre école",
        "Projets de recherche appliquée IA en partenariat école-cabinet",
      ],
    },
    urlCible: "/fr/partenaires/academique",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
  },
  // ── AEO (2 seeds) ─────────────────────────────────────────────────────────
  {
    keyword: "comment intégrer l'IA dans un programme MBA ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment intégrer l'IA dans un programme MBA ou grande école ? Guide pratique",
      metaTitle: "Comment intégrer l'IA dans un programme MBA ? — Axion-IA",
      metaDescription:
        "Contenu, format, certification, partenaires : le guide complet pour intégrer l'IA dans un programme MBA ou grande école en France.",
      h2Variants: [
        "Quel contenu IA pour un programme MBA en 2026 ?",
        "Partenaires IA recommandés pour les grandes écoles",
        "Comment évaluer les compétences IA des étudiants ?",
      ],
    },
    urlCible: "/fr/interventions-formations/universite-grande-ecole",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "quelle certification IA pour les étudiants grandes écoles ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quelle certification IA proposer aux étudiants de grandes écoles en 2026 ?",
      metaTitle: "Certification IA étudiants grandes écoles — Axion-IA",
      metaDescription:
        "Certifications IA reconnues par les employeurs, formats blended, reconnaissance RNCP : le guide des directeurs pédagogie par Axion-IA.",
      h2Variants: [
        "Les certifications IA les plus reconnues par les recruteurs",
        "Format et durée des certifications IA pour étudiants",
        "Intégrer une certification IA dans votre accréditation AACSB/EQUIS",
      ],
    },
    urlCible: "/fr/interventions-formations/universite-grande-ecole",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  // ── BÉNÉFICE (2 seeds) ────────────────────────────────────────────────────
  {
    keyword: "différenciateur IA programme grande école attractivité",
    intent: "benefice",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA comme différenciateur de votre programme grande école : attirer les meilleurs profils",
      metaTitle: "Différenciateur IA programme grande école — Axion-IA",
      metaDescription:
        "Un module IA certifiant accroît l'attractivité de votre programme et sa reconnaissance employeurs. Retours d'expérience et benchmark Axion-IA.",
      h2Variants: [
        "IA et classements des grandes écoles : l'impact sur le ranking",
        "Ce qu'attendent les étudiants et les recruteurs d'un programme IA",
        "ROI d'un partenariat IA pour une grande école",
      ],
    },
    urlCible: "/fr/interventions-formations/universite-grande-ecole",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  {
    keyword: "coaching IA directeur pédagogie grande école",
    intent: "benefice",
    kbType: "competence_boost",
    module: "coaching-1-to-1",
    cible: "universite-grande-ecole",
    secteur: "enseignement-recherche",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Coaching IA pour directeurs pédagogie de grandes écoles : définir sa stratégie IA en 4 séances",
      metaTitle: "Coaching IA directeur pédagogie grande école — Axion-IA",
      metaDescription:
        "Coaching 1-to-1 pour directeurs pédagogie et DRH de grandes écoles : stratégie IA, sélection partenaires, plan de déploiement. 990 € / 4 séances.",
      h2Variants: [
        "Programme de coaching IA directeurs pédagogie",
        "Résultats attendus après 4 séances de coaching IA",
        "Différence coaching IA vs formation collective pour dirigeants",
      ],
    },
    variables: {
      process: "stratégie IA programme pédagogique",
      resultat: "plan IA programme finalisé en 4 séances",
      chiffre: "4",
      unite: "séances",
      delai: "en 1 mois",
    },
    urlCible: "/fr/coaching-1-to-1",
    canonicalParent: "/fr/coaching-1-to-1",
    source: "manuel",
    note: "prix explicite 990€ / 4 séances ; différenciateur fort",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AUDIENCE 2 — COLLECTIVITÉ / MAIRIE (10 seeds)
// Profil : DRH, DSI et directeurs généraux des services de communes
//          (2 000–500 000 habitants) et intercommunalités
// Services : interventions-formations, audit, implementation
// URLs cible : /fr/interventions-formations/collectivites
//              /fr/audit/collectivite
// ─────────────────────────────────────────────────────────────────────────────

const KW_COLLECTIVITE: KeywordSeed[] = [
  // ── TRANSACTIONNEL (3 seeds) ─────────────────────────────────────────────
  {
    keyword: "formation IA agents publics mairie",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Former les agents municipaux à l'IA : programme sur mesure conforme RGPD et AI Act",
      metaTitle: "Formation IA agents publics mairie — Axion-IA France",
      metaDescription:
        "Axion-IA forme les agents de mairie et collectivités à l'IA : usages pratiques, conformité RGPD/AI Act, non-discrimination. Présentiel 1 journée.",
      h2Variants: [
        "Programme de formation IA agents municipaux — contenu détaillé",
        "IA et fonctionnaires : ce qui est autorisé, ce qui est interdit",
        "Financement formation IA agents publics : CNFPT et FIF-PL",
      ],
    },
    variables: {
      process: "montée en compétence IA agents publics",
      resultat: "agents opérationnels dès J+1",
      chiffre: "1",
      unite: "jour",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/collectivites",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
    note: "schema.org: EducationEvent ; CNFPT financement possible",
  },
  {
    keyword: "audit IA collectivité territoriale France",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "audit",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Audit IA collectivité territoriale : cartographier vos usages et vos obligations légales",
      metaTitle: "Audit IA collectivité territoriale France — Axion-IA",
      metaDescription:
        "Axion-IA audite les processus IA de votre collectivité : conformité AI Act/RGPD, potentiel d'automatisation, feuille de route. Rapport en 48 h.",
      h2Variants: [
        "Déroulé de l'audit IA collectivité en 48 h",
        "Ce que l'audit IA identifie dans une mairie ou un EPCI",
        "Rapport d'audit IA collectivité : ce que vous recevez",
      ],
    },
    variables: {
      process: "audit IA et conformité collectivité",
      resultat: "feuille de route IA conforme en 48 h",
      chiffre: "48",
      unite: "heures",
      delai: "en 48 h",
    },
    urlCible: "/fr/audit/collectivite",
    canonicalParent: "/fr/audit",
    source: "manuel",
  },
  {
    keyword: "déployer IA conforme AI Act mairie EPCI",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Déployer l'IA dans votre mairie ou EPCI en conformité avec l'AI Act : guide pratique",
      metaTitle: "Déployer IA conforme AI Act mairie EPCI — Axion-IA",
      metaDescription:
        "Axion-IA accompagne les mairies et EPCI dans le déploiement d'une IA conforme AI Act : registre, évaluation impact, droits citoyens, formation agents.",
      h2Variants: [
        "Étapes du déploiement IA conforme dans une collectivité",
        "Registre des systèmes IA obligatoire pour les collectivités",
        "Droits des citoyens et IA municipale : transparence obligatoire",
      ],
    },
    urlCible: "/fr/interventions-formations/collectivites",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
    note: "prioritaire AI Act art. 22 deadline 2026 ; cible DGS/DSI/DRH collectivité",
  },
  // ── SECTORIEL (3 seeds) ───────────────────────────────────────────────────
  {
    keyword: "IA pour administration communale France",
    intent: "sectoriel",
    kbType: "secteur_brief",
    module: "transversal",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA dans l'administration communale française : état des lieux et cas d'usage 2026",
      metaTitle: "IA administration communale France 2026 — Axion-IA",
      metaDescription:
        "Panorama de l'IA dans les communes françaises : chatbot citoyen, back-office automatisé, conformité réglementaire. Guide complet par Axion-IA.",
      h2Variants: [
        "Quelles collectivités françaises utilisent déjà l'IA ?",
        "IA et relations citoyen : ce qui fonctionne vraiment",
        "Budget IA mairie : combien investir selon la taille de la commune",
      ],
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs/administration-publique",
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
      h1: "Automatiser le back-office municipal avec l'IA : zéro saisie redondante, plus de service",
      metaTitle: "Automatiser back-office mairie IA — Axion-IA France",
      metaDescription:
        "Demandes citoyens, courriers administratifs, gestion documents : l'IA réduit de 40 % les saisies manuelles en mairie. Déployé par Axion-IA.",
      h2Variants: [
        "Processus back-office municipaux automatisables avec l'IA",
        "Chatbot citoyen : répondre aux demandes 24h/24 sans ressource",
        "RGPD et AI Act dans l'automatisation back-office mairie",
      ],
    },
    variables: {
      process: "back-office administratif municipal",
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
    keyword: "formation agents municipaux intelligence artificielle",
    intent: "sectoriel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation agents municipaux à l'intelligence artificielle : programme adapté au secteur public",
      metaTitle: "Formation agents municipaux IA — Axion-IA France",
      metaDescription:
        "Programme de formation IA adapté aux agents municipaux et territoriaux : usages concrets, conformité légale, accompagnement. 1 à 2 jours.",
      h2Variants: [
        "Contenu de la formation IA agents municipaux",
        "IA et service public : ce qui est permis, ce qui est interdit",
        "Suivi post-formation et mesure des acquis agents",
      ],
    },
    variables: {
      process: "formation IA agents territoriaux",
      resultat: "100 % des agents formés opérationnels",
      chiffre: "100",
      unite: "% opérationnels",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/collectivites",
    canonicalParent: "/fr/interventions-formations",
    source: "manuel",
  },
  // ── AEO (2 seeds) ─────────────────────────────────────────────────────────
  {
    keyword: "comment les mairies peuvent-elles utiliser l'IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Comment les mairies peuvent-elles utiliser l'IA en conformité avec la loi ? Guide 2026",
      metaTitle: "Comment les mairies peuvent utiliser l'IA ? — Axion-IA",
      metaDescription:
        "Services citoyens, back-office, RH, conformité : les 6 usages IA autorisés pour les mairies et collectivités en 2026. Guide complet Axion-IA.",
      h2Variants: [
        "Usages IA autorisés pour une mairie en 2026",
        "Quelles obligations légales AI Act pour les collectivités ?",
        "Budget IA mairie : de 5 000 € à 50 000 € selon taille",
      ],
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs/administration-publique",
    source: "manuel",
    note: "AEO — question directe ; schema.org FAQPage",
  },
  {
    keyword: "conformité AI Act collectivités 2026 obligations ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Quelles sont les obligations AI Act 2026 pour les collectivités territoriales ?",
      metaTitle: "Obligations AI Act collectivités 2026 — Axion-IA",
      metaDescription:
        "Registre IA, évaluation impact, droits citoyens, formation agents : les obligations AI Act 2026 pour les collectivités décryptées par Axion-IA.",
      h2Variants: [
        "Calendrier des obligations AI Act pour les collectivités",
        "Registre des systèmes IA : ce que les collectivités doivent documenter",
        "Sanctions AI Act pour les organismes publics : ce qu'il faut savoir",
      ],
    },
    urlCible: "/fr/audit/collectivite",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "AEO — question directe ; deadline AI Act art. 22 août 2026 ; schema.org FAQPage",
  },
  // ── BÉNÉFICE (2 seeds) ────────────────────────────────────────────────────
  {
    keyword: "réduire délais traitement administratif collectivité IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire les délais de traitement administratif en collectivité grâce à l'IA",
      metaTitle: "Réduire délais traitement collectivité IA — Axion-IA",
      metaDescription:
        "Comment l'IA réduit de 30 % les délais de traitement des demandes citoyens dans les collectivités. Benchmarks et calculateur ROI Axion-IA.",
      h2Variants: [
        "Délais de traitement administratif avant et après IA",
        "Calculateur ROI IA collectivité : estimez vos gains en 2 min",
        "Qualité de service citoyen et IA : NPS mesuré",
      ],
    },
    variables: {
      process: "traitement demandes citoyens et back-office",
      resultat: "-30 % délais de traitement",
      chiffre: "30",
      unite: "%",
      delai: "en 3 mois",
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs/administration-publique",
    source: "manuel",
  },
  {
    keyword: "améliorer service citoyen mairie IA sans embaucher",
    intent: "benefice",
    kbType: "secteur_brief",
    module: "implementation",
    cible: "collectivite-mairie",
    secteur: "administration-publique",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Améliorer le service citoyen de votre mairie avec l'IA sans recruter",
      metaTitle: "Améliorer service citoyen mairie IA — Axion-IA France",
      metaDescription:
        "Chatbot citoyen, traitement automatique des demandes, réponses 24h/24 : comment l'IA améliore la relation citoyen sans coût de recrutement.",
      h2Variants: [
        "Chatbot citoyen mairie : ce qu'il répond en automatique",
        "Satisfaction citoyen et IA : mesurer l'impact",
        "Budget et délai pour déployer un chatbot citoyen IA",
      ],
    },
    variables: {
      process: "service relation citoyen",
      resultat: "+40 % satisfaction citoyen sans recrutement",
      chiffre: "40",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/secteurs/administration-publique",
    canonicalParent: "/fr/secteurs/administration-publique",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT CONSOLIDÉ — 2 audiences × 10 seeds = 20 seeds
// ─────────────────────────────────────────────────────────────────────────────

export const KW_AUDIENCES_G8: KeywordSeed[] = [...KW_UNIVERSITE, ...KW_COLLECTIVITE];
