/**
 * audit-capabilities — SSOT du « champ des possibles IA » par fonction
 * d'entreprise, exposé dans la popup de la section bénéfices `/audit`.
 *
 * Refonte 2026-05-31 (Will) — extrait + étoffé depuis l'ancien
 * `AuditCapabilitiesMap`. Chaque domaine = titre + accroche (bénéfice 1 ligne)
 * + liste d'usages IA concrets. Couverture sémantique large (AEO/SEO).
 *
 * Les `iconName` sont résolus côté composant (lucide). FR canonique — EN =
 * miroir (locale 301→FR).
 */

export type CapabilityIconName =
  | "Headset"
  | "TrendingUp"
  | "Megaphone"
  | "FileStack"
  | "Calculator"
  | "Users"
  | "Scale"
  | "Truck"
  | "Factory"
  | "LayoutDashboard"
  | "BrainCircuit";

export interface CapabilityDomain {
  readonly icon: CapabilityIconName;
  readonly title: string;
  /** Accroche bénéfice (1 ligne) — ajoutée pour étoffer (Will 2026-05-31). */
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
      "Tri et priorisation des tickets et demandes",
      "Self-service et FAQ dynamique",
      "Analyse de satisfaction (verbatims, NPS)",
      "Personnalisation et recommandations",
    ],
  },
  {
    icon: "TrendingUp",
    title: "Commercial, vente & prospection",
    intro: "Plus de leads qualifiés, moins d'administratif commercial.",
    items: [
      "Détection et génération de leads",
      "Qualification et scoring des prospects",
      "Enrichissement CRM et relances automatiques",
      "Rédaction de devis et propositions commerciales",
      "Prévision des ventes",
      "Préparation de RDV et comptes-rendus",
    ],
  },
  {
    icon: "Megaphone",
    title: "Marketing & contenu",
    intro: "Produire et diffuser plus, avec moins de ressources.",
    items: [
      "Production de contenu (articles, posts, newsletters)",
      "SEO / AEO et visibilité dans les IA",
      "Gestion et planification des réseaux sociaux",
      "Emailing et campagnes automatisées",
      "Génération de visuels et de vidéos",
      "Analyse de performance des campagnes",
    ],
  },
  {
    icon: "FileStack",
    title: "Administratif & back-office",
    intro: "Faire disparaître la saisie et les tâches répétitives.",
    items: [
      "Saisie automatique et OCR de factures/documents",
      "Rapprochements (bancaire, factures, commandes)",
      "Génération de contrats, devis et courriers",
      "Classement et extraction documentaire",
    ],
  },
  {
    icon: "Calculator",
    title: "Comptabilité & finance",
    intro: "Sécuriser la trésorerie et fiabiliser les chiffres.",
    items: [
      "Relances d'impayés",
      "Prévision de trésorerie",
      "Reporting financier automatisé",
      "Détection d'anomalies et de fraude",
    ],
  },
  {
    icon: "Users",
    title: "RH & recrutement",
    intro: "Recruter plus vite, mieux onboarder, former en continu.",
    items: [
      "Tri et présélection de CV",
      "Réponses automatiques aux candidats",
      "Onboarding automatisé",
      "Gestion des plannings",
      "Formation interne et montée en compétences",
    ],
  },
  {
    icon: "Scale",
    title: "Juridique & conformité",
    intro: "Gagner du temps sur les contrats, rester conforme.",
    items: ["Analyse et synthèse de contrats", "Veille réglementaire", "Conformité RGPD"],
  },
  {
    icon: "Truck",
    title: "Logistique, achats & opérations",
    intro: "Anticiper la demande, optimiser stocks et tournées.",
    items: [
      "Prévision de la demande",
      "Optimisation des stocks et plannings",
      "Optimisation des tournées / routage",
      "Comparaison et négociation fournisseurs",
      "Maintenance prédictive et contrôle qualité",
    ],
  },
  {
    icon: "Factory",
    title: "Production & métier",
    intro: "Automatiser le répétitif, aider la décision sur le terrain.",
    items: ["Automatisation des tâches métier répétitives", "Aide à la décision sur le terrain"],
  },
  {
    icon: "LayoutDashboard",
    title: "Données & pilotage / direction",
    intro: "Décider sur des données, pas sur des intuitions.",
    items: [
      "Tableaux de bord automatisés",
      "Prévisions et aide à la décision",
      "Détection d'anomalies et d'opportunités",
      "Synthèses exécutives et comptes-rendus de réunion",
    ],
  },
  {
    icon: "BrainCircuit",
    title: "Productivité & connaissance interne",
    intro: "Toute la connaissance de l'entreprise à portée de main.",
    items: [
      "Base de connaissance / assistant interne",
      "Recherche documentaire instantanée",
      "Traduction et international",
      "Synthèse de réunions et de documents",
    ],
  },
];
