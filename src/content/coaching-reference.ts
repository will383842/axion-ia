// Page de référence du coaching individuel (lot GEO V2-08) : `/fr/un-a-un`.
//
// UNE seule page décrit le coaching individuel ; `/interventions/individuel`,
// `/interventions/dirigeants` et `/interventions/dirigeant-vision-strategique`
// restent en ligne mais déclarent cette page comme canonique. Ce module tient les
// textes citables de la page de référence. Les faits (déroulé, livrables) viennent de
// `coaching-1to1.ts`, jamais recopiés ici. Aucun prix de coaching : le seul montant
// public du site est celui de la Journée IA, injecté par jeton (`remplacerJetons`).

import { COACHING_1TO1_FORMULES } from "@/content/coaching-1to1";
import { remplacerJetons } from "@/content/journee-ia-commun";

/** Chemin FR de la page de référence. */
export const COACHING_REFERENCE_PATH_FR = "/un-a-un";
/** Chemin EN de la page de référence. */
export const COACHING_REFERENCE_PATH_EN = "/one-to-one";

/**
 * Les pages qui décrivent aussi le coaching individuel et renvoient (canonical) vers la
 * page de référence. Ce sont des clés de `routing.pathnames`.
 */
export const COACHING_PAGES_CANONIQUES_VERS_REFERENCE = [
  "/interventions/individuel",
  "/interventions/dirigeants",
  "/interventions/dirigeant-vision-strategique",
] as const;

/** Définition citable : première phrase autonome de la page (aucun chiffre client, aucun prix). */
export const COACHING_DEFINITION_FR =
  "Le coaching IA individuel d’Axion-IA est une journée de travail en tête-à-tête avec une seule personne, dirigeant ou collaborateur, sur ses vraies tâches, qui débouche sur un livrable écrit et personnel remis sous 7 jours.";

export const COACHING_TITRES_FR = {
  deroule: "Le déroulé du coaching individuel",
  pourQui: "Pour qui est le coaching individuel",
  difference: "Coaching individuel, Journée IA, formation : la différence",
} as const;

export const COACHING_DEROULE_INTRO_FR =
  "Cinq étapes, de la préparation au point de suivi. Les délais ci-dessous sont ceux du devis.";

const dirigeant = COACHING_1TO1_FORMULES.find((f) => f.id === "dirigeant");
const membre = COACHING_1TO1_FORMULES.find((f) => f.id === "membre-equipe");

/** Les profils : dirigeant et collaborateur reprennent les livrables de `coaching-1to1.ts`. */
export const COACHING_PROFILS_FR = [
  {
    id: "dirigeant",
    ancre: "profil-dirigeant",
    titre: "Le dirigeant",
    texte:
      "Vous décidez de la place de l’IA dans l’entreprise et vous voulez un cap clair, pas une démonstration d’outils.",
    livrable: dirigeant?.deliverable ?? "",
  },
  {
    id: "collaborateur",
    ancre: "profil-collaborateur",
    titre: "Le collaborateur clé",
    texte:
      "Secrétaire, comptable, commercial, responsable de service : n’importe quel poste qui répète des tâches que l’IA peut alléger.",
    livrable: membre?.deliverable ?? "",
  },
  {
    id: "independant",
    ancre: "profil-independant",
    titre: "L’indépendant et le manager",
    texte:
      "Vous travaillez seul ou vous encadrez une petite équipe, et vous voulez des méthodes à vous, construites sur vos propres dossiers.",
    livrable:
      "Même déroulé que le coaching collaborateur, adapté à votre activité ; le format est précisé à l’appel.",
  },
] as const;

/** Les trois offres, côte à côte. Le prix n’apparaît que pour la Journée IA (jeton). */
export function comparaisonCoachingFr() {
  return [
    {
      id: "coaching",
      titre: "Le coaching individuel",
      lien: null,
      texte:
        "Une seule personne, son poste et ses tâches. Une journée en tête-à-tête, un livrable écrit et nominatif sous 7 jours. Prestation sur devis.",
    },
    {
      id: "journee-ia",
      titre: "La Journée IA",
      lien: { href: "/journee-ia", libelle: "Découvrir la Journée IA" },
      texte: remplacerJetons(
        "Toute l’entreprise, en une journée chez vous : un audit le matin (2 à 4 h selon l’entreprise), une formation de 4 h l’après-midi pour jusqu’à 15 personnes. {{PRIX}} la journée, quel que soit le nombre de personnes.",
      ),
    },
    {
      id: "formation",
      titre: "La formation",
      lien: { href: "/formations", libelle: "Voir les formations" },
      texte:
        "La montée en compétence d’un groupe, sur un thème du catalogue. On y apprend ensemble ; on n’y travaille pas sur le poste d’une seule personne.",
    },
  ] as const;
}
