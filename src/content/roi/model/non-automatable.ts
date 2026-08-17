// Simulateur de gains v2 — CE QUI NE S'AUTOMATISE PAS.
//
// Ce bloc n'est pas une précaution juridique, c'est un outil de vente.
//
// La première objection d'un dirigeant devant un simulateur de gains IA est
// toujours la même : « l'IA ne peut pas faire mon métier ». Lui donner raison
// avant qu'il ait formulé l'objection retourne la situation : le rapport cesse
// d'être un argumentaire et devient un avis. Un simulateur qui sait dire
// « non, pas ça » est le seul qu'on croit quand il dit « oui, ça ».
//
// Règle de rédaction : la raison doit être VRAIE et tenir en une phrase. Pas de
// fausse modestie sur des tâches qui s'automatisent parfaitement, et pas de
// « pour l'instant » — si c'est faisable, la tâche appartient à `tasks.ts`.
//
// Le rapport en affiche trois : celles rattachées aux fonctions déclarées
// présentes, secteur d'abord. Voir `selectNonAutomatable()` dans `diagnose.ts`.

import type { NonAutomatableTask } from "./types";

export const NON_AUTOMATABLE_TASKS: readonly NonAutomatableTask[] = [
  {
    id: "na_negociation",
    fn: "commercial",
    labelFr: "Négocier un prix ou une échéance",
    reasonFr:
      "Une négociation se joue sur ce que l'autre ne dit pas. Aucune machine ne lit un silence au téléphone.",
  },
  {
    id: "na_relation_difficile",
    fn: "relation_client",
    labelFr: "Récupérer un client mécontent",
    reasonFr:
      "Ce qui répare une relation abîmée, c'est qu'un responsable prenne le temps d'appeler. Automatiser ce geste, c'est le vider de ce qui le rend efficace.",
  },
  {
    id: "na_arbitrage",
    fn: "direction",
    labelFr: "Arbitrer entre deux priorités contradictoires",
    reasonFr:
      "Un arbitrage engage votre responsabilité et suppose de connaître des contraintes qui ne sont écrites nulle part.",
  },
  {
    id: "na_recrutement_decision",
    fn: "rh",
    labelFr: "Décider d'embaucher quelqu'un",
    reasonFr:
      "Au-delà du bon sens, une décision d'embauche automatisée exposerait votre entreprise à un risque de discrimination difficile à défendre.",
  },
  {
    id: "na_geste_technique",
    fn: "production",
    labelFr: "Le geste technique lui-même",
    reasonFr:
      "L'IA prépare le dossier, elle ne pose pas le carrelage, n'ausculte pas un patient et ne plaide pas à la barre.",
  },
  {
    id: "na_responsabilite_signature",
    fn: "production",
    labelFr: "Engager votre signature",
    reasonFr:
      "Ce que vous signez, vous en répondez. Une relecture humaine avant signature n'est pas une perte de temps, c'est le métier.",
  },
  {
    id: "na_diagnostic_clinique",
    fn: "production",
    labelFr: "Poser un diagnostic",
    reasonFr:
      "Le diagnostic relève de votre responsabilité professionnelle et de la réglementation. L'IA prépare le dossier, elle ne conclut pas à votre place.",
    sectors: ["sante_medecine"],
  },
  {
    id: "na_conseil_juridique",
    fn: "production",
    labelFr: "Donner un conseil juridique",
    reasonFr:
      "Le conseil engage votre responsabilité professionnelle et suppose d'apprécier un risque dans un contexte que seul le client connaît entièrement.",
    sectors: ["juridique"],
  },
  {
    id: "na_visite_chantier",
    fn: "production",
    labelFr: "Voir le chantier de ses yeux",
    reasonFr:
      "Ce qui fait rater un chiffrage se voit sur place : un accès impossible, un support douteux, un voisin difficile.",
    sectors: ["btp_immobilier"],
  },
  {
    id: "na_accueil_client",
    fn: "relation_client",
    labelFr: "Accueillir vos clients",
    reasonFr:
      "Vos clients viennent aussi pour l'accueil. C'est le dernier endroit où chercher des économies de temps.",
    sectors: ["restauration_hotellerie", "commerce_retail"],
  },
  {
    id: "na_controle_final",
    fn: "finance",
    labelFr: "Valider les comptes",
    reasonFr:
      "La validation engage votre responsabilité et, le cas échéant, celle de votre commissaire aux comptes. Elle reste une décision humaine, tracée.",
    sectors: ["comptabilite_finance"],
  },
  {
    id: "na_decision_publique",
    fn: "direction",
    labelFr: "Motiver une décision administrative",
    reasonFr:
      "Une décision qui fait grief doit être motivée par une personne identifiable et susceptible de recours. La déléguer à une machine serait juridiquement fragile.",
    sectors: ["collectivites_public"],
  },
] as const;
