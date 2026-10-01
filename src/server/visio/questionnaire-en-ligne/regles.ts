/**
 * Les RÈGLES du questionnaire en ligne qui ont plus d'un lecteur (2026-10-01).
 * Module PUR : le geste de la console et la requête de la vue lisent la même
 * règle de remplacement ; l'envoi public et ses tests lisent le même nettoyage.
 */

import { MAX_QUI_REPOND, MODELE_QUESTIONS_DE_WILLIAMS } from "./constantes";

/**
 * « Écrire mes questions » REMPLACE-t-il la version courante, ou en crée-t-il
 * une nouvelle ? (avis de l'architecte, B2)
 *
 * Remplacement en place SEULEMENT si la dernière version est un `brouillon`
 * écrit par Will (`modele === MODELE_QUESTIONS_DE_WILLIAMS`) — ou un brouillon
 * vide (préparation IA sans question) —, et qu'aucune réponse ni aucun fait n'y
 * est attaché. Tout ce qui est parti chez le client (`copie`), a été répondu
 * ou clos ne se réécrit pas : une nouvelle version est créée.
 */
export function versionRemplacable(
  v: {
    readonly statut: "brouillon" | "copie" | "reponse_recue" | "clos";
    readonly modele: string | null;
    readonly questions: ReadonlyArray<{
      readonly reponseRecueLe: Date | null;
      readonly faits: number;
    }>;
  } | null,
): boolean {
  if (v === null || v.statut !== "brouillon") return false;
  if (v.modele !== MODELE_QUESTIONS_DE_WILLIAMS && v.questions.length > 0) return false;
  return v.questions.every((q) => q.reponseRecueLe === null && q.faits === 0);
}

/** Un texte saisi par le client : sans caractères de contrôle (hors retours à la ligne). */
export function sansControle(texte: string): string {
  return texte
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n");
}

/**
 * Une adresse web, une adresse e-mail ou un numéro de téléphone (G15) : « Qui
 * répond ? » est un nom et une fonction, pas un canal de contact.
 */
const CANAL_DE_CONTACT = /https?:\/\/|www\.|@|\+?\d[\d\s().-]{7,}\d/i;

/** « Qui répond ? » nettoyé : une ligne, 80 caractères, vidé s'il porte un canal de contact. */
export function nettoyerQuiRepond(brut: string): string {
  const propre = sansControle(brut).replace(/\s+/g, " ").trim().slice(0, MAX_QUI_REPOND);
  return CANAL_DE_CONTACT.test(propre) ? "" : propre;
}
