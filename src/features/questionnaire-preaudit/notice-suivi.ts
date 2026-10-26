/**
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *  TEXTE À FAIRE VALIDER PAR WILL — ajout à la notice du questionnaire avant audit (2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce fichier est le SEUL endroit où vit ce texte. Il est montré aux personnes qui ouvrent le
 * questionnaire (dirigeant, collaborateurs, référent informatique), en bas de la page.
 *
 * Statut : proposé ; à valider par Will (pas de juriste : c'est Will qui valide). Tant qu'il n'est
 * pas validé, laisser `QUESTIONNAIRE_SUIVI_NOTICE_VISIBLE` ÉTEINT : rien de ce texte n'est affiché.
 *
 * Règle (décision de Will, 2026-10-27) : le texte est un interrupteur PROPRE,
 * `QUESTIONNAIRE_SUIVI_NOTICE_VISIBLE` (absent = éteint, seule la valeur "true" allume). Il est
 * indépendant du suivi (`QUESTIONNAIRE_SUIVI_ENABLED`) : le suivi peut être allumé alors que le
 * texte reste éteint (cas d'Oury). Réserve RGPD : suivre et lire un brouillon sans annoncer le
 * suivi heurte l'obligation d'informer (art. 13) ; c'est une décision de Will, assumée.
 * Quand le texte est allumé, les deux phrases (ouvertures et brouillon) s'affichent ensemble.
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
