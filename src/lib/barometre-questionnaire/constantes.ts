// Questionnaire du Baromètre 2027 — constantes partagées serveur / client. Module PUR et léger :
// il est importé par le formulaire, il ne doit tirer aucune dépendance.

/**
 * Interrupteur de mise en ligne. Reste à `false` jusqu'au test par cinq personnes (décision de
 * l'éditeur). Tant qu'il est faux : la page dit « fermé », l'action d'envoi refuse, rien n'est écrit.
 */
export const QUESTIONNAIRE_OUVERT = false;

/** Premier jour de collecte (inclus), UTC. La collecte n'a PAS de date de fin (décision du 27/11/2026). */
export const DATE_DEBUT_COLLECTE = "2026-12-01";

/** Vrai si l'interrupteur est allumé ET si `now` est au plus tôt le premier jour de collecte. Aucune borne de fin. */
export function estOuvert(now: Date, ouvert: boolean = QUESTIONNAIRE_OUVERT): boolean {
  if (!ouvert) return false;
  return now.getTime() >= Date.parse(`${DATE_DEBUT_COLLECTE}T00:00:00.000Z`);
}

/** Nombre de réponses à partir duquel des résultats sont publiés (texte partagé formulaire / politique FR / EN). */
export const SEUIL_PUBLICATION_REPONSES = 100;

/** Conservation de chaque réponse brute, en mois après SON jour d'envoi. */
export const CONSERVATION_MOIS = 24;

/** Version du texte de consentement. Toute retouche, même d'une virgule, crée `barometre-q-v2`. */
export const CONSENT_VERSION = "barometre-q-v2";

/** Version des libellés du questionnaire, écrite avec chaque réponse. */
export const QUESTIONNAIRE_VERSION = "q-v5";

/** Préfixe des clés de limite de débit (l'IP n'y figure jamais en clair). */
export const RATE_LIMIT_PREFIX = "barometre-q";

/** Valeur de `campagne` pour cette enquête. */
export const CAMPAGNE = "barometre-2027";

/** Aucune statistique publiée sur un croisement de moins de réponses. */
export const N_MIN_PUBLICATION = 10;

/**
 * Limite d'effacement à l'instant `now` : toute réponse dont le jour d'envoi est antérieur ou égal
 * à cette date (minuit UTC) a atteint `CONSERVATION_MOIS` mois et s'efface. Chaque réponse a donc
 * sa propre échéance (jour d'envoi + 24 mois) ; il n'y a pas de date de fin d'enquête.
 *
 * Cas du 29 février : `setUTCMonth` déborde sur le mois suivant (le 29/02/2032 donne le
 * 01/03/2030). Une réponse du 01/03/2030 est alors effacée un jour plus tôt ; on garde moins
 * longtemps, jamais plus, donc sans conséquence.
 */
export function limiteEffacement(now: Date = new Date()): Date {
  const limite = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  limite.setUTCMonth(limite.getUTCMonth() - CONSERVATION_MOIS);
  return limite;
}
