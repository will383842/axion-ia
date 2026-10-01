/**
 * Les constantes du questionnaire de cadrage EN LIGNE (2026-10-01). Module PUR,
 * lu par la page publique, les gestes de la console, la requête de la vue et
 * l'étape `lire_reponses` du worker.
 */

/**
 * « Qui répond ? (nom et fonction) » — rangé SANS migration dans une ligne
 * `questionnaire_questions` d'ORDRE 0 (les questions commencent à 1 : la
 * passe P6 et le geste « Écrire mes questions » numérotent depuis 1, et
 * `@@unique([questionnaireId, ordre])` garantit qu'elle est seule).
 *
 * Pourquoi là, et pas en tête de la réponse à la première question : la
 * réponse d'une question est relue telle quelle par Will (et réenregistrée
 * par son formulaire) et par l'IA (`lire_reponses`, citations vérifiées mot
 * pour mot). Un nom glissé dans la réponse 1 y serait relu comme une réponse,
 * et deviendrait un fait. Une ligne à part est chiffrée comme les autres
 * (`chiffrerParole`), `poseeDeViveVoix = true` la sort du texte à copier et de
 * la page publique, et les deux lecteurs l'écartent par son ordre.
 */
export const ORDRE_QUI_REPOND = 0;
export const TEXTE_QUI_REPOND = "Qui répond ? (nom et fonction)";
/** Un nom et une fonction (R26) : 80 caractères. */
export const MAX_QUI_REPOND = 80;

/**
 * LE filtre des vraies questions — tout lecteur et tout écrivain de
 * `questionnaire_questions` le prend (page publique, envoi, saisie de Will,
 * lecture IA, ouverture du lien) : la ligne d'ordre 0 n'est jamais une
 * question, jamais réécrite par la saisie de Will, jamais lue par l'IA.
 */
export const QUESTIONS_REELLES = { ordre: { gt: ORDRE_QUI_REPOND } } as const;

/** Longueur maximale d'une réponse enregistrée (collée par Will ou saisie en ligne). */
export const MAX_REPONSE = 5000;

/**
 * `modele` d'un questionnaire écrit par Will (geste « Écrire mes questions »),
 * sans IA. Non nul À DESSEIN : l'étape `questionnaire` du worker ne reprend
 * que les brouillons `modele: null` — elle ne réécrira jamais ces questions.
 */
export const MODELE_QUESTIONS_DE_WILLIAMS = "questions_ecrites_par_williams";

/** Bornes du geste « Écrire mes questions ». */
export const MAX_QUESTIONS_ECRITES = 40;
export const MAX_TEXTE_QUESTION = 600;

/**
 * Nombre maximal de champs `reponse_*` lus dans un envoi public : au-delà, la
 * requête est refusée sans lecture de la base (un formulaire légitime en porte
 * au plus `MAX_QUESTIONS_ECRITES`, ou les 12 d'un questionnaire préparé).
 */
export const MAX_CHAMPS_ENVOI = 60;

/** La réponse « Je ne sais pas », telle qu'elle est enregistrée. */
export const REPONSE_JE_NE_SAIS_PAS = "Je ne sais pas.";
