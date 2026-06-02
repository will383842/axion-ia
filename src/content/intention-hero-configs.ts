// aria-labels des graphiques de hero par intention (IntentionHeroSchema).
// Le SVG est décoratif ; ce texte décrit le schéma pour les lecteurs d'écran.
// Langage simple orienté bénéfice (pas de jargon technique : on parle outil
// fonctionnel, pas de RAG / JSON / vector DB / fine-tuning).

import type { IntentionVariant } from "@/components/sections/IntentionHeroSchema";

export const INTENTION_HERO_ARIA: Record<IntentionVariant, string> = {
  chatbot:
    "Schéma : une question client (site, Slack, Teams) arrive à l'assistant qui cherche la bonne réponse dans vos documents et répond de façon fiable, avec relais humain si la demande sort du périmètre.",
  agents:
    "Schéma : l'IA cherche l'information utile, analyse la demande, fait le travail à votre place, et vous validez — vous gardez la main.",
  "crm-erp":
    "Schéma : une fiche client est complétée et vérifiée par l'IA, et ressort à jour, sans changer d'outil.",
  documents:
    "Schéma : un document (PDF, contrat, facture) est lu par l'IA, les informations utiles en sont extraites et arrivent prêtes à l'emploi directement dans vos outils.",
  processus:
    "Schéma : un événement (par exemple un devis accepté) déclenche vos règles, qui lancent automatiquement la relance ou la facturation.",
  structuration:
    "Schéma : des fichiers en vrac (emails, PDF, tableurs) sont transformés en données claires et exploitables.",
  integrations:
    "Schéma : tous vos outils (Slack, Teams, Notion, mail) sont reliés à l'IA depuis un point central.",
  "ia-custom":
    "Schéma : une IA à vous, construite en couches — intelligence sur-mesure, branchée sur vos données, adaptée à votre métier, avec sécurité et contrôle.",
  "no-code":
    "Schéma : un automatisme en trois étapes — déclencheur, étape IA, action — greffé sur vos outils existants, sur demande.",
};
