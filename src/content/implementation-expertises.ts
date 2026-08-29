/**
 * implementation-expertises — SSOT des domaines d'expertise d'implémentation IA
 * exposés dans la popup « Voir tout ce qu'on peut construire pour vous » de
 * `/implementation`.
 *
 * Version exhaustive : tout ce qu'Axion-IA conçoit, développe et livre — du
 * socle technique (agents, RAG, automatisations…) aux fonctions métier
 * (relation client, vente, finance, RH, logistique…), pour toutes les tailles
 * (PME → grande entreprise, mono-site comme multi-sites / réseau / franchises).
 * Et si ce n'est pas dans la liste, on le construit quand même : on part de
 * votre besoin. Aucun prix.
 *
 * Les `icon` sont résolus côté composant (lucide). FR canonique — EN = miroir
 * (locale 301→FR, règle Will 2026-05-16).
 *
 * 2026-08-15 — chaque domaine se termine désormais par une ligne qui dit ce qui
 * RESTE au client à la fin : ce qui tourne, ce qui est documenté, ce que ses
 * équipes reprennent en main. L'implémentation est une prestation de CONSEIL :
 * on valorise les livrables, jamais un résultat promis.
 */

export type ExpertiseIconName =
  | "Bot"
  | "MessagesSquare"
  | "Workflow"
  | "Plug"
  | "FileText"
  | "Search"
  | "PenTool"
  | "ScanEye"
  | "BarChart3"
  | "Headset"
  | "TrendingUp"
  | "ShoppingCart"
  | "Calculator"
  | "Users"
  | "Truck"
  | "Network";

export interface ExpertiseDomain {
  readonly icon: ExpertiseIconName;
  readonly title: string;
  /** Accroche bénéfice (1 ligne). */
  readonly intro: string;
  readonly items: ReadonlyArray<string>;
}

// Carte exhaustive des solutions qu'on construit. FR canonique (rendu à
// l'identique en EN — locale EN désactivée / 301→FR).
export const IMPLEMENTATION_EXPERTISES: ReadonlyArray<ExpertiseDomain> = [
  {
    icon: "Bot",
    title: "Agents IA autonomes",
    intro: "Des collaborateurs numériques qui exécutent des tâches de bout en bout.",
    items: [
      "Agents métier connectés à vos outils (CRM, ERP, e-mail, agenda)",
      "Agents de support, de vente et de qualification de leads",
      "Agents de recherche, de veille et de synthèse",
      "Orchestration multi-agents et enchaînement de tâches",
      "Garde-fous, validation humaine et journalisation des actions",
      "Code, prompts et journal des actions livrés et documentés",
    ],
  },
  {
    icon: "MessagesSquare",
    title: "Chatbots & assistants conversationnels",
    intro: "Répondre vite et juste, 24/7, sur tous vos canaux.",
    items: [
      "Chatbot de site web, support et FAQ dynamique",
      "Assistant interne pour vos équipes (procédures, outils)",
      "Réponses fondées sur vos documents (RAG, anti-hallucination)",
      "Multilingue, multicanal (web, e-mail, WhatsApp, messageries)",
      "Escalade vers un humain et passation de contexte",
      "Base de connaissances éditable par vos équipes, sans dépendre de nous",
    ],
  },
  {
    icon: "Workflow",
    title: "Automatisation de processus",
    intro: "Faire disparaître les tâches répétitives et la double saisie.",
    items: [
      "Workflows métier de bout en bout (RPA + IA)",
      "Génération de devis, contrats, courriers et comptes-rendus",
      "Relances, notifications et approbations automatiques",
      "Tri, routage et priorisation des demandes",
      "Déclencheurs sur événements (formulaire, e-mail, webhook)",
      "Workflows documentés, seuils modifiables, exécutions tracées",
    ],
  },
  {
    icon: "Plug",
    title: "Intégrations CRM / ERP & outils",
    intro: "On se branche sur votre existant, sans tout réinventer.",
    items: [
      "Connexion à vos CRM, ERP, comptabilité, GMAO, e-commerce",
      "API, webhooks et synchronisation bidirectionnelle",
      "Intégration d'API LLM dans vos applications maison",
      "Migration et fiabilisation des données",
      "Single sign-on, gestion des droits, hébergement UE",
      "Connecteurs documentés, suivi des coûts d'API et alertes sur erreur",
    ],
  },
  {
    icon: "FileText",
    title: "Traitement de documents",
    intro: "Lire, extraire et structurer vos documents automatiquement.",
    items: [
      "OCR et extraction de factures, devis, contrats, bons de commande",
      "Classement, indexation et archivage intelligents",
      "Rapprochements (bancaire, factures, commandes)",
      "Synthèse et résumé de documents longs",
      "Génération de documents à partir de modèles",
      "Schéma validé, règles d'extraction et relecture des cas douteux",
    ],
  },
  {
    icon: "Search",
    title: "Recherche & connaissance interne (RAG)",
    intro: "Toute la connaissance de l'entreprise à portée de main.",
    items: [
      "Base de connaissance interrogeable en langage naturel",
      "Recherche sémantique unifiée sur tous vos documents",
      "Réponses sourcées et citables (anti-hallucination)",
      "Assistant qui connaît vos procédures et votre métier",
      "Mise à jour continue à mesure que vos données évoluent",
      "Index livré avec sa procédure de mise à jour, tenue par vos équipes",
    ],
  },
  {
    icon: "Headset",
    title: "Relation & service client",
    intro: "Répondre plus vite et mieux, sans gonfler l'équipe.",
    items: [
      "Première réponse automatique 24/7, jour et nuit",
      "Tri, qualification et priorisation des tickets",
      "Assistance des conseillers en temps réel (suggestions de réponse)",
      "Analyse de satisfaction (verbatims, NPS, avis)",
      "Personnalisation, recommandations et rétention",
      "Règles d'escalade écrites et historique des échanges qui reste chez vous",
    ],
  },
  {
    icon: "TrendingUp",
    title: "Commercial, vente & prospection",
    intro: "Plus de leads qualifiés, moins d'administratif commercial.",
    items: [
      "Détection, génération et scoring de leads",
      "Enrichissement CRM et relances automatiques",
      "Rédaction de devis, offres et propositions commerciales",
      "Prévision des ventes et pilotage du pipeline",
      "Préparation de RDV, comptes-rendus et next steps",
      "Scores et comptes-rendus écrits dans vos propres champs, sans doublon",
    ],
  },
  {
    icon: "ShoppingCart",
    title: "E-commerce & vente en ligne",
    intro: "Vendre plus, mieux, à chaque visiteur.",
    items: [
      "Recommandations produits personnalisées",
      "Recherche sémantique et merchandising intelligent",
      "Génération de fiches produits à l'échelle",
      "Tarification dynamique et gestion des promotions",
      "Détection de fraude au paiement",
      "Règles de recommandation et de tarification pilotables par votre équipe",
    ],
  },
  {
    icon: "PenTool",
    title: "Marketing & génération de contenu",
    intro: "Produire et diffuser plus, avec moins de ressources.",
    items: [
      "Rédaction d'articles, fiches produits, e-mails et posts",
      "SEO / AEO et visibilité dans les IA (ChatGPT, Claude…)",
      "Emailing, campagnes et personnalisation 1:1",
      "Génération et retouche de visuels et vidéos",
      "Veille concurrentielle et analyse de performance",
      "Modèles de production et validation humaine avant publication",
    ],
  },
  {
    icon: "Calculator",
    title: "Comptabilité, finance & back-office",
    intro: "Sécuriser la trésorerie, fiabiliser les chiffres, supprimer la saisie.",
    items: [
      "Saisie automatique et OCR de factures",
      "Relances d'impayés et suivi du recouvrement",
      "Prévision de trésorerie et reporting financier",
      "Notes de frais, rapprochements et clôture assistés",
      "Détection d'anomalies et de fraude",
      "Contrôles de cohérence, seuils d'alerte et piste d'audit des traitements",
    ],
  },
  {
    icon: "Users",
    title: "RH & recrutement",
    intro: "Recruter plus vite, mieux onboarder, libérer les RH.",
    items: [
      "Tri, présélection et matching de CV",
      "Réponses automatiques et suivi des candidats",
      "Onboarding et offboarding automatisés",
      "Assistant RH interne (questions, procédures, congés)",
      "Formation interne et montée en compétences",
      "Critères de tri explicites, traçables et révisables par vos RH",
    ],
  },
  {
    icon: "Truck",
    title: "Logistique, supply chain & production",
    intro: "Anticiper la demande, optimiser stocks, flux et qualité.",
    items: [
      "Prévision de la demande et réassort automatique",
      "Optimisation des stocks, plannings et tournées",
      "Maintenance prédictive des équipements",
      "Contrôle qualité automatisé par vision",
      "Suivi temps réel et alertes proactives",
      "Prévisions et alertes branchées sur vos outils, seuils réglables",
    ],
  },
  {
    icon: "ScanEye",
    title: "Vision & analyse d'images",
    intro: "Donner des yeux à vos process.",
    items: [
      "Contrôle qualité et détection de défauts par vision",
      "Lecture de plaques, étiquettes, compteurs et codes",
      "Classement, modération et indexation d'images",
      "Détection d'anomalies et d'incidents",
      "Comptage, mesure et inventaire visuel",
      "Modèle de détection, images de contrôle et procédure de recalibrage",
    ],
  },
  {
    icon: "BarChart3",
    title: "Données, tableaux de bord & prévision",
    intro: "Décider sur des données, pas sur des intuitions.",
    items: [
      "Tableaux de bord et reporting automatisés",
      "Analytics en self-service (questions en langage naturel)",
      "Prévisions, scoring et aide à la décision",
      "Détection d'anomalies et d'opportunités",
      "Qualité, gouvernance et fiabilisation des données",
      "Tableaux de bord actualisés seuls, définition documentée des indicateurs",
    ],
  },
  {
    icon: "Network",
    title: "Multi-sites, réseau & franchises",
    intro: "Déployer et piloter à l'échelle de tout le réseau.",
    items: [
      "Déploiement standardisé sur tous les sites / points de vente",
      "Consolidation du reporting multi-sites / succursales",
      "Pilotage centralisé + assistant autonome par site",
      "Harmonisation des process et des bonnes pratiques",
      "Gouvernance, droits et conformité à l'échelle",
      "Déploiement reproductible site par site, avec sa documentation",
    ],
  },
];
