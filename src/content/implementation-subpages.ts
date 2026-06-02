// Config centralisée des 9 sous-pages /implementation/* (Module 3).
// Sépare les données de maillage (pages suggérées) et le label géo de chaque
// sous-service du pack de contenu principal (implementation.ts) pour garder
// celui-ci focalisé sur la copy. Consommé par ImplementationSubPageExtras.

import type { ImplementationSlug } from "./implementation";

/**
 * Pages suggérées (maillage interne « Voir aussi »). 3 sous-services frères
 * pertinents par page — chaque page expose une combinaison DISTINCTE pour
 * éviter le maillage uniforme (signal anti-doorway + parcours 1 page = 1
 * intention). Le 4ᵉ lien (cross-module « commencer par un audit ») est ajouté
 * par le composant.
 */
export const IMPLEMENTATION_RELATED: Record<ImplementationSlug, ImplementationSlug[]> = {
  "ia-custom": ["agents", "crm-erp", "integrations"],
  chatbot: ["agents", "documents", "integrations"],
  processus: ["integrations", "crm-erp", "documents"],
  structuration: ["documents", "crm-erp", "processus"],
  "crm-erp": ["processus", "integrations", "agents"],
  documents: ["structuration", "chatbot", "processus"],
  agents: ["chatbot", "processus", "integrations"],
  integrations: ["crm-erp", "processus", "agents"],
  "no-code": ["processus", "integrations", "agents"],
};

/**
 * Label du sous-service pour la section couverture nationale
 * (« {label} disponible partout en France »). Sujet réel de la page → signal
 * géo spécifique au sous-service plutôt que générique « implémentation IA ».
 */
export const IMPLEMENTATION_GEO_LABEL: Record<ImplementationSlug, { fr: string; en: string }> = {
  "ia-custom": { fr: "L'IA sur-mesure", en: "Custom AI" },
  chatbot: { fr: "Les chatbots IA", en: "AI chatbots" },
  processus: { fr: "L'automatisation IA des processus", en: "AI process automation" },
  structuration: { fr: "La structuration de données IA", en: "AI data structuring" },
  "crm-erp": { fr: "L'IA pour CRM & ERP", en: "AI for CRM & ERP" },
  documents: { fr: "L'IA documentaire", en: "AI document processing" },
  agents: { fr: "Les agents IA", en: "AI agents" },
  integrations: { fr: "Les intégrations IA", en: "AI integrations" },
  "no-code": { fr: "L'IA dans vos outils no-code", en: "AI in your no-code tools" },
};
