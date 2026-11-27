/**
 * Contenu du hub `/fr/equipe` (réponse de tête, sections de texte, FAQ).
 *
 * Même doctrine que `williams.ts` : un seul fichier de texte pour le HTML visible ET le
 * JSON-LD, afin que les deux ne divergent pas. Aucun prix, aucun chiffre de succès,
 * aucune ville : la cible est « TPE et PME », partout en France.
 */

import { FOUNDER } from "@/lib/brand";
import type { FicheCollaborateur } from "@/lib/equipe";

/** Date de dernière révision ÉDITORIALE du hub. À bouger à la main, seulement si le texte change. */
export const HUB_DATE_MAJ = "2026-11-27";

export const HUB_TITRE = "L'équipe d'Axion-IA";

export const HUB_META_TITRE = "L'équipe d'Axion-IA · startup française, partout en France";

export const HUB_META_DESCRIPTION =
  "Qui travaille chez Axion-IA : Williams Jullin, fondateur, et l'équipe qui aide les TPE et PME à gagner en rentabilité, partout en France.";

/** Réponse auto-portante (AEO) : première phrase = nom + nature + cible + périmètre. */
export const HUB_REPONSE = `Axion-IA est une startup française qui aide les TPE et PME, partout en France, à gagner en rentabilité avec l'équipe qu'elles ont déjà. Fondée par ${FOUNDER.fullName}, elle s'occupe de tout, de A à Z : le dirigeant n'a pas à toucher à la technique.`;

export const HUB_TRAVAIL_TITRE = "Comment l'équipe travaille avec vous";

export const HUB_TRAVAIL_INTRO =
  "Vous parlez aux personnes qui réalisent la mission, sans intermédiaire inutile. Vous parlez de votre métier et de vos clients ; nous nous occupons des outils, des réglages et de la mise en place. La méthode tient en trois temps :";

export const HUB_TRAVAIL_ETAPES: ReadonlyArray<{ titre: string; texte: string }> = [
  {
    titre: "Chiffrer",
    texte:
      "avant tout achat, nous mesurons ce que chaque tâche vous coûte et ce que l'IA peut vous rendre.",
  },
  {
    titre: "Essayer",
    texte: "nous testons sur vos vrais dossiers, avec vos équipes, à petite échelle.",
  },
  {
    titre: "Trancher",
    texte:
      "vous gardez ce qui rapporte, vous arrêtez le reste ; ce qui est gardé, nous l'installons de A à Z.",
  },
];

export const HUB_REJOINDRE_TITRE = "Rejoindre Axion-IA";

export const HUB_REJOINDRE_TEXTE =
  "Vous connaissez des dirigeants de TPE ou de PME qui gagneraient à travailler avec nous ? Vous pouvez devenir apporteur d'affaires : vous faites la mise en relation, Axion-IA établit le devis et réalise la mission.";

export const HUB_APPORTEURS_LIEN = "Devenir apporteur d'affaires";

export const HUB_TRANSPARENCE_TEXTE =
  "Transparence : une partie des contenus publiés sur ce site est rédigée par Manon, une persona éditoriale générée par IA. Manon n'est pas une collaboratrice : elle est déclarée comme telle et ne figure pas dans la liste de l'équipe.";

export const HUB_FAQ_TITRE = "Questions fréquentes sur l'équipe d'Axion-IA";

export const HUB_FAQ: ReadonlyArray<{ id: string; question: string; answer: string }> = [
  {
    id: "qui-travaille",
    question: "Qui travaille chez Axion-IA ?",
    answer: `Axion-IA est dirigée par son fondateur, ${FOUNDER.fullName}. Cette page présente les personnes de l'équipe qui ont accepté d\'y figurer, et s\'enrichit à mesure que de nouveaux collaborateurs la rejoignent.`,
  },
  {
    id: "qui-a-fonde",
    question: "Qui a fondé Axion-IA ?",
    answer: `Axion-IA a été fondée par ${FOUNDER.fullName}, qui la dirige. C'est une startup française qui aide les TPE et PME à gagner en rentabilité avec l'équipe qu'elles ont déjà.`,
  },
  {
    id: "partout-en-france",
    question: "Axion-IA intervient-elle partout en France ?",
    answer:
      "Oui. L'équipe intervient auprès des TPE et PME partout en France, sur place ou à distance selon la mission.",
  },
  {
    id: "interlocuteurs",
    question: "Vais-je échanger avec les personnes qui réalisent la mission ?",
    answer:
      "Oui. Vous gardez un interlocuteur de la première prise de contact jusqu'à la mise en place : pas de relais inutile entre vous et l'équipe.",
  },
  {
    id: "apporteur-ou-consultant",
    question:
      "Quelle est la différence entre un apporteur d'affaires et un spécialiste d'Axion-IA ?",
    answer:
      "L'apporteur d'affaires met en relation : il ne vend pas, ne négocie pas et ne signe rien au nom d'Axion-IA. Le devis est établi par Axion-IA, et la mission est réalisée par l'équipe.",
  },
  {
    id: "rejoindre",
    question: "Comment rejoindre l'équipe d'Axion-IA ?",
    answer:
      "Les offres ouvertes sont sur la page Carrières. Si vous connaissez des dirigeants de TPE ou de PME, vous pouvez aussi devenir apporteur d'affaires.",
  },
];

/**
 * Fiches affichées sur le hub tant que le régime base n'est pas branché : Williams seul.
 * Le dirigeant principal n'a ni ville ni point sur la carte (cf. `regles.ts`).
 */
export const FICHES_HUB_STATIQUES: ReadonlyArray<FicheCollaborateur> = [
  {
    slug: FOUNDER.slug,
    categorie: "direction",
    prenom: FOUNDER.displayName,
    nomComplet: FOUNDER.fullName,
    estDirigeantPrincipal: true,
    accord: "m",
    fonction: FOUNDER.jobTitleFr,
    reponseQui: HUB_REPONSE,
    afficherSurCarte: false,
    photo: {
      src: "/illustrations/home-founder-william.avif",
      largeur: 2048,
      hauteur: 2048,
      alt: `${FOUNDER.fullName}, ${FOUNDER.jobTitleFr}`,
      // Portrait déjà publié sur le site (accueil, fiche fondateur).
      consentementLe: "2026-08-19",
    },
  },
];
