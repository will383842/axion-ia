/**
 * Qualiopi — Dispositif d'assistance technique et pédagogique à distance.
 *
 * L'article D.6313-3-1 du Code du travail impose, pour une action suivie à
 * distance, un dispositif écrit d'assistance technique et pédagogique : qui
 * répond, par quel canal, dans quel délai. Décision de Will du 2026-09-19 :
 * Axion IA garde le distanciel, et le dispositif est celui écrit ci-dessous —
 * rien de plus, rien de moins.
 *
 * Un seul texte, lu par la convocation (distanciel et mixte) et par le livret
 * d'accueil (rubrique « En distanciel ») : les deux pièces remises au stagiaire
 * ne peuvent pas diverger. La garde
 * `documents/templates/__tests__/le-dispositif-d-assistance-est-imprime.spec.tsx` rougit si l'une
 * des deux perd le délai, le canal ou le secours en cas de coupure.
 *
 * ⚠️ Le canal et le référent sont écrits ici en dur, et c'est voulu : ils sont
 * l'engagement lui-même (la boîte `contact@axion-ia.com` sert de trace de la
 * demande et de la réponse). Les changer, c'est changer le dispositif — donc
 * une décision de Will, pas une valeur de configuration.
 *
 * Module sans dépendance : importable par n'importe quel gabarit PDF.
 */

/** Pendant la session : le formateur, dans la visioconférence. */
export const ASSISTANCE_PENDANT_SESSION =
  "Pendant la session : le formateur répond dans la conversation de la visioconférence, aux questions techniques comme pédagogiques.";

/** Hors session : le référent, par e-mail, sous 1 jour ouvré. */
export const ASSISTANCE_HORS_SESSION =
  "Hors session : le référent, Williams Jullin, Président, répond à contact@axion-ia.com sous 1 jour ouvré, du lundi au vendredi, de 9 h à 18 h. La demande et la réponse restent dans la boîte mail, qui en garde la trace.";

/** Si la visioconférence tombe — dans cet ordre. */
export const ASSISTANCE_COUPURE: readonly string[] = [
  "Si la visioconférence tombe, le formateur renvoie aussitôt un nouveau lien par e-mail et attend les stagiaires 15 minutes.",
  "Si la coupure dépasse 30 minutes, la séquence perdue est reprogrammée et ne compte pas dans les heures suivies.",
  "L'incident est noté au registre des incidents de l'organisme.",
];

/** Le dispositif complet, dans l'ordre où les pièces l'impriment. */
export const ASSISTANCE_DISTANCE: readonly string[] = [
  ASSISTANCE_PENDANT_SESSION,
  ASSISTANCE_HORS_SESSION,
  ...ASSISTANCE_COUPURE,
];

/** Outil de visioconférence, tel que la convocation l'exige. */
export const OUTIL_VISIO_CONVOCATION =
  "Google Meet, depuis le navigateur de l'ordinateur (rien à installer), testé avant la session : caméra, micro, son.";
