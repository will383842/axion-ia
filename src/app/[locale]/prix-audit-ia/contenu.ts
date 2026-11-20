// Page « Combien coûte un audit IA pour une TPE ou une PME ? » (lot GEO V2-28).
//
// 🔑 Aucun montant n'est écrit ici : le seul chiffre en euros de la page est le prix de la Journée IA,
// lu dans `pricing.ts` (`JOURNEE_IA_TIER`) via le jeton `{{PRIX}}` que résout `remplacerJetons()`.
// L'audit de la Journée IA est compris dans son prix ; un audit plus approfondi, au-delà de la
// Journée IA, se chiffre sur devis (aucun autre montant). Formation et automatisation sont sur devis
// écrit, sans fourchette ni exemple chiffré.
// Les phrases déjà en ligne sont importées (`journee-ia-commun.ts`, landing de la Journée IA), jamais
// recopiées.

import { DATE_MISE_A_JOUR_PRIX_AUDIT_IA } from "@/content/prix-audit-ia-date";
import { RAPPORT_COMPLET } from "@/content/journee-ia-commun";
import { PHRASE_AUDIT_APPROFONDI, reponseReference } from "@/content/questions-reference";

export const PATH = "/prix-audit-ia";

export { DATE_MISE_A_JOUR_PRIX_AUDIT_IA };

export const TITRE = "Combien coûte un audit IA pour une TPE ou une PME ? · Axion-IA";

/** Réponse directe en deux phrases : première ligne de la page, de la meta description et de l'extrait. */
export const REPONSE_DIRECTE =
  "L’audit IA d’Axion-IA est compris dans la Journée IA, au prix unique de {{PRIX}}. L’audit du matin convient aux entreprises de 2 à 250 salariés ; seule la formation de l’après-midi est limitée à 15 personnes. La journée comprend l’audit le matin (2 à 4 h selon l’entreprise), la formation l’après-midi, puis le rapport complet sous 3 jours ouvrés.";

export const DESCRIPTION_META =
  "Un audit IA pour une TPE ou une PME : {{PRIX}}, prix unique, compris dans la Journée IA (audit pour 2 à 250 salariés, formation de l’après-midi jusqu’à 15 personnes). Formation et automatisation : sur devis écrit.";

export const OG_IMAGE_ALT =
  "Combien coûte un audit IA pour une TPE ou une PME : la Journée IA, prix unique";

export const TEXTES = {
  filAriane: "Combien coûte un audit IA",
  surtitre: "Prix de l’audit IA",
  h1: "Combien coûte un audit IA pour une TPE ou une PME ?",
  cta: "Réserver un Diagnostic IA",
  microTexte: "Diagnostic IA · 45 minutes · en visio ou par téléphone · sans engagement",
  tva: "Prix hors taxes : la TVA au taux en vigueur s’ajoute sur la facture.",

  compris: {
    titre: "Ce que comprend la Journée IA",
    intro: `L’audit de la Journée IA n’a pas de prix à part : il est compris dans la Journée IA. Une seule somme, pour toute l’équipe. ${PHRASE_AUDIT_APPROFONDI}`,
    elements: [
      "L’audit le matin, 2 à 4 h selon l’entreprise : l’entreprise est passée en revue service par service, avec vous.",
      "La formation l’après-midi, pour votre équipe (jusqu’à 15 personnes), sur vos propres dossiers.",
      "3 à 5 priorités écrites le soir même.",
      RAPPORT_COMPLET,
    ],
  },

  surDevis: {
    titre: "Formation et automatisation : sur devis écrit",
    formation: {
      nom: "Formation IA",
      texte:
        "Sur devis écrit, par groupe de 2 à 15 personnes, jamais par personne. Vous recevez le devis avant de vous engager.",
    },
    automatisation: {
      nom: "Automatisation IA",
      texte: "Sur devis écrit. Le forfait est fixé avant de commencer : pas d’heures qui tournent.",
    },
  },

  variation: {
    titre: "Ce qui fait varier le prix d’une formation ou d’une automatisation",
    intro:
      "Aucune grille ne vaut pour deux entreprises : c’est pourquoi ces deux prestations sont chiffrées sur devis écrit, à partir de votre situation.",
    formation: {
      titre: "Pour une formation",
      elements: [
        "la formation retenue et sa durée (de 4 heures à 2 jours) ;",
        "le format, sur site ou à distance ;",
        "la taille du groupe, de 2 à 15 personnes.",
      ],
    },
    automatisation: {
      titre: "Pour une automatisation",
      elements: [
        "les outils à relier entre eux ;",
        "le volume traité ;",
        "le périmètre : les tâches que l’on décide d’automatiser, et dans quel ordre.",
      ],
    },
  },

  liens: {
    titre: "Pour aller plus loin",
    tarifs: "Tous nos tarifs : la Journée IA, le reste sur devis écrit",
    audit: "L’audit IA d’Axion-IA",
    journee: "La Journée IA, en détail",
    diagnostic: "Réserver un Diagnostic IA de 45 minutes",
  },
  miseAJour: "Page mise à jour le",
} as const;

export interface QuestionPrix {
  readonly id: string;
  readonly question: string;
  /** Jeton autorisé : `{{PRIX}}`. */
  readonly reponse: string;
}

/** FAQ : 7 questions, rendues à l'identique dans le JSON-LD `FAQPage`. */
export const FAQ: ReadonlyArray<QuestionPrix> = [
  {
    id: "prix-audit-ia-combien",
    question: "Combien coûte un audit IA pour une TPE ou une PME ?",
    reponse: reponseReference("ref-audit-prix"),
  },
  {
    id: "prix-audit-ia-separe",
    question: "L’audit IA est-il facturé en plus de la formation ?",
    reponse: `Non. L’audit IA le matin et la formation de l’après-midi font partie de la même Journée IA, au même prix unique de {{PRIX}}. L’audit de la Journée IA n’est pas facturé à part. ${PHRASE_AUDIT_APPROFONDI}`,
  },
  {
    id: "prix-audit-ia-par-personne",
    question: "Le prix de la Journée IA est-il calculé par personne ?",
    reponse:
      "Non. Le prix de {{PRIX}} est unique : il ne change pas avec le nombre de participants à la formation, limitée à 15 personnes. L’audit du matin convient aux entreprises de 2 à 250 salariés.",
  },
  {
    id: "prix-audit-ia-tva",
    question: "Le prix de l’audit IA inclut-il la TVA ?",
    reponse:
      "Non. Le prix de {{PRIX}} est hors taxes : la TVA au taux en vigueur s’ajoute sur la facture.",
  },
  {
    id: "prix-audit-ia-formation",
    question: "Combien coûte une formation IA pour une TPE ou une PME ?",
    reponse:
      "Une formation IA pour une TPE ou une PME est facturée sur devis écrit, par groupe de 2 à 15 personnes et jamais par personne. Le prix dépend de la formation retenue, de sa durée (de 4 heures à 2 jours) et du format, sur site ou à distance.",
  },
  {
    id: "prix-audit-ia-automatisation",
    question: "Combien coûte une automatisation IA pour une TPE ou une PME ?",
    reponse:
      "Une automatisation IA pour une TPE ou une PME est facturée sur devis écrit. Le forfait est fixé avant de commencer, sans heures qui tournent, et il dépend des outils à relier et du volume traité.",
  },
  {
    id: "prix-audit-ia-premier-pas",
    question: "Comment démarrer, avant de décider ?",
    reponse:
      "Le premier pas est un Diagnostic IA : un appel gratuit de 45 minutes, en visio ou par téléphone, sans engagement. Il permet de voir si la Journée IA convient à votre entreprise.",
  },
];
