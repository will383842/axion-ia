/**
 * Chantier QNC, L03 — le GABARIT FIXE du recueil du besoin (temps 1).
 *
 * Les questions « générées depuis les faits » du rendez-vous (passe P6) restent
 * telles quelles ; ce module y ajoute, à côté, les rubriques que Qualiopi
 * (indicateur 4) demande d'avoir recueillies AVANT le devis. Elles sont
 * identiques pour toutes les entreprises : aucune IA, aucun appel réseau.
 *
 * Module PUR. Les textes passent par la page publique (`decouperQuestion`) :
 * une aide après le DERNIER « ? », une liste entre parenthèses → des puces.
 *
 * ⛔ Rien ici ne demande un prix ou un budget (le devis vient après), et la
 * question d'adaptation ne demande AUCUNE donnée médicale : un besoin
 * d'aménagement se dit, sa cause ne se dit pas.
 */

import type { FaitType } from "../../../../prisma/generated/client";

import { PARTICIPANTS_MAX, PARTICIPANTS_MIN } from "./constantes";

export const RUBRIQUES_GABARIT = [
  "objectifs",
  "participants",
  "niveau_ia",
  "contraintes",
  "financeur",
  "logistique",
  "adaptation",
] as const;

export type RubriqueGabarit = (typeof RUBRIQUES_GABARIT)[number];

/** Mention d'information RGPD, montrée en tête du questionnaire (aide de la 1re question). */
export const MENTION_RGPD =
  "Vos réponses servent uniquement à préparer cette formation ; Axion-IA les conserve de façon sécurisée, ne les transmet à personne d'autre, et vous pouvez les consulter ou demander leur effacement à contact@axion-ia.com (RGPD).";

export interface QuestionGabarit {
  readonly ordre: number;
  readonly rubrique: RubriqueGabarit;
  readonly texte: string;
  readonly typeVise: FaitType;
  readonly cleVisee: string | null;
}

interface Brut {
  readonly rubrique: RubriqueGabarit;
  readonly texte: string;
  readonly typeVise: FaitType;
  readonly cleVisee?: string;
}

const BRUTES: ReadonlyArray<Brut> = [
  {
    rubrique: "objectifs",
    texte: `Qu'attendez-vous de cette formation ? ${MENTION_RGPD}`,
    typeVise: "objectif",
  },
  {
    rubrique: "participants",
    texte: `Combien de personnes seraient formées (de ${PARTICIPANTS_MIN} à ${PARTICIPANTS_MAX}) ? Un groupe plus grand se découpe en plusieurs sessions.`,
    typeVise: "nb_participants",
  },
  {
    rubrique: "participants",
    texte:
      "Quels sont les métiers ou profils des participants ? Par exemple : commerciaux, RH, comptabilité.",
    typeVise: "public_cible",
  },
  {
    rubrique: "niveau_ia",
    texte:
      "Où en sont les participants avec l'IA aujourd'hui ? (Jamais utilisée, Essais occasionnels, Usage régulier, Usage avancé)",
    typeVise: "niveau_ia",
  },
  {
    rubrique: "contraintes",
    texte:
      "Quelles dates souhaitez-vous, et y a-t-il des périodes à éviter ? Indiquez une période, ou des dates précises.",
    typeVise: "echeance",
  },
  {
    rubrique: "contraintes",
    texte:
      "Où et comment la formation aurait-elle lieu ? (En présentiel chez vous, En présentiel ailleurs, En distanciel, Les deux)",
    typeVise: "modalite_souhaitee",
  },
  {
    rubrique: "financeur",
    texte:
      "Comment la formation serait-elle financée ? (Par un OPCO, Paiement direct par l'entreprise, Je ne sais pas encore) Si c'est un OPCO, indiquez lequel.",
    typeVise: "financement",
  },
  {
    rubrique: "logistique",
    texte:
      "Que pouvez-vous fournir pour la formation ? Par exemple : une salle, des ordinateurs, une connexion internet, un vidéoprojecteur.",
    typeVise: "contrainte",
    cleVisee: "logistique",
  },
  {
    rubrique: "adaptation",
    texte:
      "Un participant a-t-il besoin d'une adaptation (accès, rythme, outil) ? Répondez par oui ou par non ; si oui, dites seulement l'aménagement utile. Ne donnez pas la raison : cette question se pose sans aucune information médicale.",
    typeVise: "contrainte",
    cleVisee: "adaptation",
  },
];

/** Les questions du gabarit, numérotées de 1 à n. Pure et stable. */
export function questionsDuGabarit(): ReadonlyArray<QuestionGabarit> {
  return BRUTES.map((q, i) => ({
    ordre: i + 1,
    rubrique: q.rubrique,
    texte: q.texte,
    typeVise: q.typeVise,
    cleVisee: q.cleVisee ?? null,
  }));
}
