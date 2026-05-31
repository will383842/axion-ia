/**
 * audit-capabilities — SSOT du « champ des possibles IA & automatisation » par
 * fonction d'entreprise, exposé dans la popup de la section bénéfices `/audit`.
 *
 * Refonte 2026-05-31 (Will) — version exhaustive : tout ce que l'IA et
 * l'automatisation peuvent apporter à une entreprise, de la TPE à la grande
 * entreprise, mono-site comme multi-sites / succursales / réseau / franchises.
 * Chaque domaine = titre + accroche (bénéfice 1 ligne) + liste d'usages IA
 * concrets. Couverture sémantique très large (AEO/SEO).
 *
 * Les `iconName` sont résolus côté composant (lucide). FR canonique — EN =
 * miroir (locale 301→FR).
 */

export type CapabilityIconName =
  | "Headset"
  | "TrendingUp"
  | "ShoppingCart"
  | "Megaphone"
  | "FileStack"
  | "Calculator"
  | "Users"
  | "Scale"
  | "PackageSearch"
  | "Truck"
  | "Factory"
  | "Code2"
  | "LayoutDashboard"
  | "Network"
  | "BrainCircuit"
  | "Lightbulb";

export interface CapabilityDomain {
  readonly icon: CapabilityIconName;
  readonly title: string;
  /** Accroche bénéfice (1 ligne). */
  readonly intro: string;
  readonly items: ReadonlyArray<string>;
}

// Carte exhaustive par fonction. FR canonique (rendu à l'identique en EN —
// locale EN désactivée / 301→FR).
export const AUDIT_CAPABILITIES: ReadonlyArray<CapabilityDomain> = [
  {
    icon: "Headset",
    title: "Relation & service client",
    intro: "Répondre plus vite et mieux, 24/7, sans gonfler l'équipe.",
    items: [
      "Chatbot / agent conversationnel 24/7 multilingue",
      "Réponses automatiques aux emails et messages",
      "Tri, qualification et priorisation des tickets",
      "Assistance des conseillers en temps réel (suggestions de réponse)",
      "Self-service, FAQ dynamique et base d'aide",
      "Analyse de satisfaction (verbatims, NPS, avis)",
      "Personnalisation, recommandations et rétention",
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
      "Recommandation cross-sell / up-sell",
      "Préparation de RDV, comptes-rendus et next steps",
    ],
  },
  {
    icon: "ShoppingCart",
    title: "E-commerce & vente en ligne",
    intro: "Vendre plus, mieux, à chaque visiteur.",
    items: [
      "Recommandations produits personnalisées",
      "Recherche sémantique et merchandising intelligent",
      "Génération de fiches produits et descriptions à l'échelle",
      "Tarification dynamique et gestion des promotions",
      "Détection de fraude au paiement",
      "Prévision des retours et des ruptures",
    ],
  },
  {
    icon: "Megaphone",
    title: "Marketing & contenu",
    intro: "Produire et diffuser plus, avec moins de ressources.",
    items: [
      "Production de contenu (articles, posts, newsletters)",
      "SEO / AEO et visibilité dans les IA (ChatGPT, Claude…)",
      "Gestion et planification des réseaux sociaux",
      "Emailing, campagnes et personnalisation 1:1",
      "Génération de visuels, vidéos et déclinaisons",
      "Veille concurrentielle et analyse de performance",
    ],
  },
  {
    icon: "FileStack",
    title: "Administratif & back-office",
    intro: "Faire disparaître la saisie et les tâches répétitives.",
    items: [
      "Saisie automatique et OCR de factures / documents",
      "Rapprochements (bancaire, factures, commandes)",
      "Génération de contrats, devis et courriers",
      "Workflows d'approbation et automatisation (RPA)",
      "Classement, extraction et archivage documentaire",
    ],
  },
  {
    icon: "Calculator",
    title: "Comptabilité & finance",
    intro: "Sécuriser la trésorerie et fiabiliser les chiffres.",
    items: [
      "Relances d'impayés et suivi du recouvrement",
      "Prévision de trésorerie et scénarios",
      "Reporting financier et clôture automatisés",
      "Analyse des dépenses et contrôle de gestion",
      "Détection d'anomalies et de fraude",
    ],
  },
  {
    icon: "Users",
    title: "RH & recrutement",
    intro: "Recruter plus vite, mieux onboarder, former en continu.",
    items: [
      "Tri, présélection et matching de CV",
      "Réponses automatiques et suivi des candidats",
      "Onboarding et offboarding automatisés",
      "Gestion des plannings, congés et paie",
      "Assistant RH interne (questions, procédures)",
      "Formation interne et montée en compétences",
    ],
  },
  {
    icon: "Scale",
    title: "Juridique, risques & conformité",
    intro: "Gagner du temps sur les contrats, rester conforme.",
    items: [
      "Analyse, synthèse et génération de contrats / clauses",
      "Veille réglementaire et juridique",
      "Conformité RGPD et AI Act",
      "Gestion des risques et due diligence",
      "Suivi des obligations et échéances",
    ],
  },
  {
    icon: "PackageSearch",
    title: "Achats & fournisseurs",
    intro: "Acheter mieux, négocier plus juste, sécuriser vos fournisseurs.",
    items: [
      "Sourcing et comparaison de fournisseurs",
      "Analyse de contrats et conditions d'achat",
      "Aide à la négociation et au e-procurement",
      "Évaluation du risque et de la dépendance fournisseur",
      "Suivi des commandes et des litiges",
    ],
  },
  {
    icon: "Truck",
    title: "Logistique, supply chain & opérations",
    intro: "Anticiper la demande, optimiser stocks, tournées et flux.",
    items: [
      "Prévision de la demande et S&OP",
      "Optimisation des stocks, plannings et entrepôts",
      "Optimisation des tournées et du routage",
      "Suivi temps réel et alertes proactives",
      "Maintenance prédictive et contrôle qualité",
      "Jumeau numérique et simulation de flux",
    ],
  },
  {
    icon: "Factory",
    title: "Production, industrie & terrain",
    intro: "Automatiser le répétitif, fiabiliser, aider la décision terrain.",
    items: [
      "Automatisation des tâches métier répétitives",
      "Contrôle qualité automatisé par vision",
      "Maintenance prédictive des équipements",
      "Optimisation des cadences et des rendements",
      "Aide à la décision et assistant terrain (mobile)",
      "Sécurité au travail et détection d'incidents",
    ],
  },
  {
    icon: "Code2",
    title: "IT, développement & cybersécurité",
    intro: "Livrer plus vite, superviser, sécuriser.",
    items: [
      "Copilotes de code et accélération du développement",
      "Helpdesk IT et résolution d'incidents",
      "Supervision, observabilité et détection d'anomalies",
      "Détection des menaces et réponse aux incidents (SOC)",
      "Tests automatisés et qualité logicielle",
      "Modernisation et documentation du legacy",
    ],
  },
  {
    icon: "LayoutDashboard",
    title: "Données, BI & pilotage",
    intro: "Décider sur des données, pas sur des intuitions.",
    items: [
      "Tableaux de bord et reporting automatisés",
      "Analytics en self-service (questions en langage naturel)",
      "Prévisions et aide à la décision",
      "Détection d'anomalies et d'opportunités",
      "Synthèses exécutives et comptes-rendus de réunion",
      "Qualité, gouvernance et fiabilisation des données",
    ],
  },
  {
    icon: "Network",
    title: "Multi-sites, réseau & franchises",
    intro: "Piloter, harmoniser et déployer à l'échelle de tout le réseau.",
    items: [
      "Consolidation du reporting multi-sites / succursales",
      "Harmonisation et standardisation des process",
      "Benchmark et comparaison inter-sites / agences",
      "Déploiement standardisé des solutions (franchises, points de vente)",
      "Pilotage centralisé + autonomie locale (assistant par site)",
      "Détection des bonnes pratiques à généraliser",
    ],
  },
  {
    icon: "BrainCircuit",
    title: "Productivité & connaissance interne",
    intro: "Toute la connaissance de l'entreprise à portée de main.",
    items: [
      "Base de connaissance et assistant interne (RAG)",
      "Recherche documentaire unifiée et instantanée",
      "Synthèse de réunions, d'emails et de documents",
      "Traduction et collaboration à l'international",
      "Rédaction, relecture et mise en forme assistées",
    ],
  },
  {
    icon: "Lightbulb",
    title: "Direction, stratégie & innovation",
    intro: "Voir plus loin, arbitrer plus vite, préparer la suite.",
    items: [
      "Veille stratégique, sectorielle et concurrentielle",
      "Aide à la décision et scénarisation (what-if)",
      "Pilotage des objectifs (OKR/KPI) et alertes",
      "Préparation de fusions-acquisitions / due diligence",
      "Exploration de nouveaux produits, services et marchés",
    ],
  },
];
