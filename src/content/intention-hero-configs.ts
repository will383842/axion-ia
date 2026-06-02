// aria-labels des graphiques de hero par intention (IntentionHeroSchema).
// Le SVG est décoratif ; ce texte décrit le schéma pour les lecteurs d'écran.

import type { IntentionVariant } from "@/components/sections/IntentionHeroSchema";

export const INTENTION_HERO_ARIA: Record<IntentionVariant, string> = {
  chatbot:
    "Schéma : une question client (site, Slack, Teams) passe par une recherche IA sourcée (RAG) qui produit une réponse fiable, avec relais humain si la demande sort du périmètre.",
  agents:
    "Schéma : un agent IA enchaîne quatre étapes — recherche, synthèse, action sur vos systèmes, puis contrôle journalisé et auditable.",
  "crm-erp":
    "Schéma : une fiche CRM passe par un enrichissement IA (scoring, complétion) et ressort en fiche enrichie, sans changer d'outil.",
  documents:
    "Schéma : un document entrant (PDF, contrat, facture) est lu et extrait par l'IA, puis transformé en JSON exploitable prêt pour vos outils.",
  processus:
    "Schéma : un déclencheur métier (par exemple un devis accepté) active une règle qui route automatiquement vers la relance ou la facturation.",
  structuration:
    "Schéma : des données non structurées (emails, PDF, tableurs) sont transformées en arbre JSON propre et normalisé.",
  integrations:
    "Schéma : des connecteurs IA relient vos outils (Slack, Teams, Notion, mail, API) à un hub central branché sur votre système d'information.",
  "ia-custom":
    "Schéma : une IA sur-mesure en couches — modèle de base, RAG et vector DB, fine-tuning ciblé, garde-fous et monitoring — souveraine et à vous.",
  "no-code":
    "Schéma : un workflow no-code en trois blocs — déclencheur, étape IA, action — greffé sur vos outils existants, sur demande.",
};
