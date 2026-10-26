/**
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *  TEXTE À FAIRE VALIDER PAR WILL — ajout à la notice du questionnaire avant audit (2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce fichier est le SEUL endroit où vit ce texte. Il est montré aux personnes qui ouvrent le
 * questionnaire (dirigeant, collaborateurs, référent informatique), en bas de la page.
 *
 * Statut : proposé ; à valider par Will (pas de juriste : c'est Will qui valide). Tant qu'il n'est
 * pas validé, laisser les deux interrupteurs ÉTEINTS : rien de ce texte n'est affiché.
 *
 *   · le paragraphe « ouvertures » s'affiche quand `QUESTIONNAIRE_SUIVI_OUVERTURES_ENABLED=true`
 *     (les ouvertures ne sont notées que s'il est affiché : on ne note rien sans le dire) ;
 *   · le paragraphe « brouillon » s'affiche quand `QUESTIONNAIRE_SUIVI_BROUILLON_VISIBLE=true`
 *     (Will ne peut lire un brouillon que s'il est affiché).
 *
 * Pour corriger le texte : modifier les deux phrases ci-dessous, rien d'autre. Module PUR.
 */

export const TITRE_NOTICE_SUIVI = "Suivi de ce questionnaire";

export const PHRASE_OUVERTURES =
  "Quand vous ouvrez ce questionnaire, Axion IA note la date et le nombre de vos ouvertures, et " +
  "si vous avez commencé à répondre. Nous ne notons ni votre adresse IP ni votre navigateur, et " +
  "nous n'utilisons ni cookie ni outil de mesure extérieur.";

export const PHRASE_BROUILLON =
  "Si vous acceptez l'enregistrement de votre brouillon, Axion IA peut le lire avant que vous " +
  "envoyiez vos réponses, pour préparer l'audit. Vous pouvez retirer votre accord à tout moment, " +
  "ou nous écrire pour faire supprimer votre brouillon.";

export interface ChoixNotice {
  readonly ouvertures: boolean;
  readonly brouillon: boolean;
}

/** Les phrases à afficher selon les interrupteurs ; vide = rien à ajouter. */
export function phrasesNoticeSuivi(c: ChoixNotice): ReadonlyArray<string> {
  return [...(c.ouvertures ? [PHRASE_OUVERTURES] : []), ...(c.brouillon ? [PHRASE_BROUILLON] : [])];
}
