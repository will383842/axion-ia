// Questionnaire du Baromètre 2027 — constantes partagées serveur / client. Module PUR et léger :
// il est importé par le formulaire, il ne doit tirer aucune dépendance.

/**
 * Interrupteur de mise en ligne. Reste à `false` jusqu'au test par cinq personnes (décision de
 * l'éditeur). Tant qu'il est faux : la page dit « fermé », l'action d'envoi refuse, rien n'est écrit.
 */
export const QUESTIONNAIRE_OUVERT = false;

/** Premier jour de collecte (inclus), UTC. */
export const DATE_DEBUT_COLLECTE = "2026-12-01";
/** Dernier jour de collecte (inclus), UTC. */
export const DATE_FIN_COLLECTE = "2027-01-12";

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Vrai si l'interrupteur est allumé ET si `now` est dans la fenêtre de collecte (bornes incluses). */
export function estOuvert(now: Date): boolean {
  if (!QUESTIONNAIRE_OUVERT) return false;
  const debut = Date.parse(`${DATE_DEBUT_COLLECTE}T00:00:00.000Z`);
  const finExclue = Date.parse(`${DATE_FIN_COLLECTE}T00:00:00.000Z`) + JOUR_MS;
  const t = now.getTime();
  return t >= debut && t < finExclue;
}

/** Conservation des réponses brutes, en mois après la fin de l'enquête. */
export const CONSERVATION_MOIS = 24;

/** Version du texte de consentement. Toute retouche, même d'une virgule, crée `barometre-q-v2`. */
export const CONSENT_VERSION = "barometre-q-v1";

/** Version des libellés du questionnaire, écrite avec chaque réponse. */
export const QUESTIONNAIRE_VERSION = "q-v5";

/** Préfixe des clés de limite de débit (l'IP n'y figure jamais en clair). */
export const RATE_LIMIT_PREFIX = "barometre-q";

/** Valeur de `campagne` pour cette enquête. */
export const CAMPAGNE = "barometre-2027";

/** Aucune statistique publiée sur un croisement de moins de réponses. */
export const N_MIN_PUBLICATION = 10;

/**
 * Date à partir de laquelle les réponses brutes s'effacent : fin de l'enquête (jour inclus)
 * + `CONSERVATION_MOIS` mois, à minuit UTC. Avant cette date, le worker n'envoie AUCUNE requête.
 */
export function limiteEffacement(): Date {
  const fin = new Date(`${DATE_FIN_COLLECTE}T00:00:00.000Z`);
  fin.setUTCDate(fin.getUTCDate() + 1);
  fin.setUTCMonth(fin.getUTCMonth() + CONSERVATION_MOIS);
  return fin;
}
