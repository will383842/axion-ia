/**
 * Keyword Strategy — Verticale FORMATIONS V2 (offre AXION : 14 formations
 * intra-entreprise + page sur-mesure). Regenere depuis catalog-v2.ts (refonte
 * 2026-07). 1 requete HEAD (niveau 1, priorite 2) par urlCible, injection
 * h1/metaTitle/metaDescription alignee sur le catalogue (SSOT).
 * Aucun prix en dur. Contenu 100 % FR. Non enregistre master.ts (seeds SEO).
 */

import type { KeywordSeed } from "./types";

const M = "interventions-formations" as const;

export const KEYWORDS_FORMATIONS_V2: KeywordSeed[] = [
  {
    keyword: "formation bien démarrer avec l'ia",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/bien-demarrer-avec-l-ia-4h",
    injection: {
      h1: "Formation IA pour bien démarrer en entreprise (4 heures)",
      metaTitle: "Formation IA débutant en entreprise — 4h | Axion-IA",
      metaDescription:
        "Formation IA d'initiation, 4 h, sans prérequis : démystifier l'IA, maîtriser un prompt efficace avec la méthode AXION, créer son premier assistant.",
    },
  },
  {
    keyword: "formation bien démarrer avec l'ia — journée complète",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/bien-demarrer-avec-l-ia-journee-7h",
    injection: {
      h1: "Formation IA pour bien démarrer en entreprise (journée complète, 7 heures)",
      metaTitle: "Formation IA débutant en entreprise — 1 jour | Axion-IA",
      metaDescription:
        "Formation IA d'initiation sur une journée, sans prérequis : démystifier l'IA, rédiger un prompt efficace avec la méthode AXION, créer son assistant IA.",
    },
  },
  {
    keyword: "formation prompts avancés & assistants ia",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/prompts-avances-et-assistants-ia-4h",
    injection: {
      h1: "Formation prompts avancés & assistants IA en entreprise (4 heures)",
      metaTitle: "Formation prompts avancés & assistants IA — 4h | Axion-IA",
      metaDescription:
        "Formation IA de 4 h pour structurer sa pratique du prompt avec la méthode AXION, créer un master prompt et déployer ses assistants IA. Présentiel ou distanciel.",
    },
  },
  {
    keyword: "formation gagner du temps au quotidien avec l'ia",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/gagner-du-temps-au-quotidien-avec-l-ia-7h",
    injection: {
      h1: "Formation IA pour gagner du temps au quotidien (1 jour)",
      metaTitle: "Formation IA productivité en entreprise — 1 jour | Axion-IA",
      metaDescription:
        "Formation IA d'une journée pour passer d'un usage basique à avancé : prompts experts avec la méthode AXION, assistants IA avec base de connaissances, agent.",
    },
  },
  {
    keyword: "formation claude — prise en main complète",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-prise-en-main-complete-7h",
    injection: {
      h1: "Formation Claude en entreprise : prise en main complète (1 jour)",
      metaTitle: "Formation Claude en entreprise — 1 jour | Axion-IA",
      metaDescription:
        "Formation Claude d'une journée pour utilisateurs réguliers : prompt avancé, Artifacts, paramétrage, création de Skills, connecteurs et production de.",
    },
  },
  {
    keyword: "formation claude — maîtrise avancée & autonomie",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-maitrise-avancee-et-autonomie-2j",
    injection: {
      h1: "Formation Claude avancée : maîtrise et autonomie en entreprise (2 jours)",
      metaTitle: "Formation Claude avancée & autonomie — 2j | Axion-IA",
      metaDescription:
        "Formation Claude avancée, 2 jours : Projects, Skills, connecteurs et Cowork. Déployez plusieurs assistants, un prototype et des tâches automatisées.",
    },
  },
  {
    keyword: "formation claude code — créer un projet de bout en bout",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-code-creer-un-projet-3j",
    injection: {
      h1: "Formation Claude Code : créer un projet de bout en bout, sans coder (3 jours)",
      metaTitle: "Formation Claude Code sans coder — 3 jours | Axion-IA",
      metaDescription:
        "Formation Claude Code, 3 jours, pour profils non techniques : concevoir, construire et publier un vrai projet de bout en bout sans écrire de code. Présentiel.",
    },
  },
  {
    keyword: "formation ia act — conformité & sécurité de vos usages",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-act-conformite-et-securite-7h",
    injection: {
      h1: "Formation IA Act : conformité et sécurité des usages IA en entreprise (1 jour)",
      metaTitle: "Formation IA Act : conformité & sécurité — 1 jour | Axion-IA",
      metaDescription:
        "Formation IA Act d'1 jour : comprendre le calendrier et les obligations, cartographier vos usages par niveau de risque, sécuriser vos données et bâtir votre.",
    },
  },
  {
    keyword: "formation référent ia — piloter la gouvernance de l'ia",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/referent-ia-piloter-gouvernance-ia-7h",
    injection: {
      h1: "Formation Référent IA : piloter la gouvernance de l'IA en entreprise (1 jour)",
      metaTitle: "Formation Référent IA — gouvernance de l'IA, 1 jour | Axion-IA",
      metaDescription:
        "Formation référent IA (1 jour) : cartographier les usages, construire charte et procédures, piloter la conformité et animer l'IA en interne. Présentiel ou.",
    },
  },
  {
    keyword: "formation ia rh — recrutement & gestion des talents",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-rh-recrutement-talents-7h",
    injection: {
      h1: "Formation IA pour les ressources humaines et le recrutement (1 jour)",
      metaTitle: "Formation IA pour les RH et le recrutement — 1 jour | Axion-IA",
      metaDescription:
        "Formation IA RH, 1 jour : maîtriser le prompt RH avec la méthode AXION, respecter le cadre légal, créer un assistant RH et outiller sourcing, annonces et.",
    },
  },
  {
    keyword: "formation ia pour l'assistanat — mails, comptes-rendus & documents",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-assistanat-mails-comptes-rendus-documents-7h",
    injection: {
      h1: "Formation IA pour l'assistanat en entreprise (1 jour)",
      metaTitle: "Formation IA assistanat — mails & CR, 1j | Axion-IA",
      metaDescription:
        "Formation IA d'1 jour pour assistants et office managers : reprendre la main sur sa boîte mail, produire ses comptes-rendus et documents plus vite avec la.",
    },
  },
  {
    keyword: "formation ia marketing — contenus, seo & image de marque",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-marketing-contenus-seo-image-de-marque-7h",
    injection: {
      h1: "Formation IA marketing : contenus, SEO et image de marque (1 jour)",
      metaTitle: "Formation IA marketing, contenus & SEO — 1 jour | Axion-IA",
      metaDescription:
        "Formation IA marketing, 1 jour : prompts avec la méthode AXION, assistant calibré sur votre marque, contenus sans « style IA », SEO et visuels. Présentiel ou.",
    },
  },
  {
    keyword: "formation ia pour la vente : prospection & développement commercial",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-vente-prospection-developpement-commercial-7h",
    injection: {
      h1: "Formation IA pour la vente et la prospection commerciale (1 jour)",
      metaTitle: "Formation IA vente & prospection — 1 jour | Axion-IA",
      metaDescription:
        "Formation IA pour commerciaux, 1 jour : prospecter, préparer ses rendez-vous et relancer avec la méthode AXION, créer ses assistants IA commerciaux.",
    },
  },
  {
    keyword: "formation ia finance — reporting, analyses & pilotage",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-finance-reporting-analyses-pilotage-7h",
    injection: {
      h1: "Formation IA pour la finance et le contrôle de gestion (1 jour)",
      metaTitle: "Formation IA Finance & contrôle de gestion — 1j | Axion-IA",
      metaDescription:
        "Formation IA finance, 1 jour : produire commentaires de gestion, analyses d'écarts et synthèses en une fraction du temps avec la méthode AXION. Présentiel ou.",
    },
  },
  {
    keyword: "formation ia sur mesure entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/sur-mesure",
    injection: {
      h1: "Formation IA sur mesure pour votre entreprise",
      metaTitle: "Formation IA sur mesure en entreprise | Axion-IA",
      metaDescription:
        "Formation IA construite avec vous : theme, public et cas pratiques definis ensemble, en presentiel ou distanciel. Sur devis.",
    },
  },
  {
    keyword: "séminaire ia toute l'entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/seminaire-ia-toute-l-entreprise-1j",
    injection: {
      h1: "Séminaire IA en entreprise — fédérer toutes vos équipes en une journée",
      metaTitle: "Séminaire IA en entreprise — toute l'équipe | Axion-IA",
      metaDescription:
        "Séminaire IA d'une journée en présentiel, jusqu'à 50 personnes : cadrer les usages, partager la méthode AXION, fédérer les équipes et repartir avec des engagements concrets.",
    },
  },
];
