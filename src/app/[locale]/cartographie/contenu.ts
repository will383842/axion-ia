// Page « Cartographie de l'entreprise » (lot GEO V2-09). Aucune offre à part : c'est le matin de la
// Journée IA. Les phrases viennent des sources uniques (`journee-ia-commun.ts`, accueil, landing de
// la Journée IA) et sont importées, jamais recopiées. Aucun prix ici : le seul montant public est
// celui de la Journée IA, porté par sa page. Les chiffres de l'exemple sont ceux de la landing
// (calculés dans `journee-ia-commun.ts`), présentés comme un exemple, pas comme un résultat.

import {
  DATE_MISE_A_JOUR_CARTOGRAPHIE,
  DEFINITION_CARTOGRAPHIE,
} from "@/content/cartographie-date";
import {
  DEROULE_JOURNEE_IA,
  DELAI_RAPPORT_JOURS_OUVRES,
  RAPPORT_COMPLET,
  remplacerJetons,
} from "@/content/journee-ia-commun";

import { CONTENU as ACCUEIL } from "../_accueil/contenu";
import { CONTENU as JOURNEE } from "../journee-ia/contenu";

export const PATH = "/cartographie";

export { DATE_MISE_A_JOUR_CARTOGRAPHIE };

export const TITRE = "Cartographie de l’entreprise pour l’IA · Axion-IA";

/** Définition en une phrase : première ligne de la page, de la meta description et de l'extrait. */
export const DEFINITION = DEFINITION_CARTOGRAPHIE;

export const DESCRIPTION_META =
  "La cartographie de l’entreprise, c’est le matin de la Journée IA : votre entreprise passée en revue service par service, vos gains chiffrés en heures et en euros.";

export const OG_IMAGE_ALT =
  "La cartographie de l’entreprise d’Axion-IA : service par service, gains chiffrés en heures et en euros";

/** « Par vos tâches, pas par un outil », tel que la FAQ de l'accueil le dit. */
const REPONSE_COMMENCER =
  ACCUEIL.faq.questions.find((q) => q.id === "faq-commencer")?.reponse ?? "";
const MATIN = ACCUEIL.deuxFacons.blocJournee.tuiles[0].texte;
/** Jalons de la landing Journée IA (source unique) : jamais recopiés ici. */
const AVANT = JOURNEE.deroule.etapes[0].jalons[0].texte;
const PRIORITES = JOURNEE.deroule.etapes[3].jalons[0].texte;
const HEURES_MATIN = JOURNEE.deroule.etapes[1].jalons[0].moment;

export const TEXTES = {
  filAriane: "Cartographie de l’entreprise",
  surtitre: "Le matin de la Journée IA",
  h1: "La cartographie de l’entreprise",
  principe: "Par vos tâches, pas par un outil.",
  pourQui: {
    titre: "Pour qui",
    texte: `${JOURNEE.pourQui.pourVous[0]}. ${JOURNEE.pourQui.pourVous[1]}. ${JOURNEE.pourQui.pourVous[2]}.`,
  },
  deroule: {
    titre: "Le déroulé",
    intro: DEROULE_JOURNEE_IA,
    etapes: [
      { moment: JOURNEE.deroule.etapes[0].jalons[0].moment, texte: `${AVANT}.` },
      {
        moment: "9 h – 12 h",
        texte: "La cartographie, service par service. " + MATIN,
      },
      { moment: "17 h 30", texte: `${PRIORITES}.` },
      { moment: `Sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés`, texte: "Le rapport complet." },
    ],
  },
  recu: {
    titre: "Ce que vous recevez",
    elements: [`${PRIORITES}.`, RAPPORT_COMPLET],
  },
  exemple: {
    titre: "Un exemple fictif",
    intro: JOURNEE.accroche.carteDesGains.sousTitre,
    lignes: JOURNEE.accroche.carteDesGains.lignes.map(
      (l) => `${l.libelle} : ${l.heures} par semaine`,
    ),
    total: remplacerJetons(
      `Sur la première ligne, {{HEURES_EXEMPLE}} par semaine représentent ${JOURNEE.accroche.carteDesGains.total.montant} ${JOURNEE.accroche.carteDesGains.total.suite}. Chiffres d’illustration : ce n’est pas un résultat client.`,
    ),
  },
  liens: {
    titre: "Pour aller plus loin",
    journee: "La Journée IA : audit et formation IA chez vous",
    diagnostic: "Premier pas gratuit : un diagnostic IA de 45 minutes",
  },
  cta: "Réserver un appel gratuit de 45 minutes",
  miseAJour: "Mis à jour le",
} as const;

export const FAQ = [
  {
    id: "faq-quoi",
    question: "Qu’est-ce que la cartographie de l’entreprise ?",
    reponse: DEFINITION,
  },
  {
    id: "faq-quand",
    question: "Quand a-t-elle lieu ?",
    reponse: `Le matin de la Journée IA, de ${HEURES_MATIN}, dans vos locaux, partout en France. L’après-midi, nous formons vos équipes sur leurs propres dossiers.`,
  },
  {
    id: "faq-commencer",
    question: "Par où commencer avec l’IA dans une PME ?",
    reponse: REPONSE_COMMENCER,
  },
  {
    id: "faq-recu",
    question: "Que reçoit-on à la fin ?",
    reponse: `${PRIORITES}. ${RAPPORT_COMPLET}`,
  },
  {
    id: "faq-outil",
    question: "Faut-il choisir un outil avant ?",
    reponse:
      "Non. Par vos tâches, pas par un outil : la cartographie part de ce que chaque service fait au quotidien, puis chiffre en heures et en euros les tâches qui reviennent. La mise en place vient ensuite.",
  },
  {
    id: "faq-gratuit",
    question: "Y a-t-il un premier pas gratuit ?",
    reponse: "Oui : un diagnostic IA gratuit de 45 minutes, en visio ou par téléphone.",
  },
] as const;
