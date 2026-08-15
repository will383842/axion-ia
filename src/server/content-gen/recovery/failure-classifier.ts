/**
 * Content Generator — classification des échecs de job (module PUR).
 *
 * Ajouté 2026-08-15 (audit e2e). Contexte : au 15/08, la production porte
 * 1 532 jobs `failed`, dont l'écrasante majorité vient de trois pannes de crédit
 * OpenAI (09/07, 18/07, ~21/07) — c'est-à-dire d'une cause purement
 * administrative, sans aucun rapport avec le contenu demandé.
 *
 * Or un slot de campagne est consommé À VIE : `generatedCount` est incrémenté à
 * l'enqueue et n'est jamais décrémenté, et l'orchestrateur ne repasse jamais sur
 * un slot déjà servi. Sans relance explicite, **ces contenus ne seront donc
 * jamais produits**, même une fois le crédit rechargé — c'est le trou que ce
 * module permet de combler.
 *
 * Tout n'est pas relançable pour autant. Un échec de qualité (aucun output
 * valide après 3 itérations, contenu rejeté par un gate) se reproduira à
 * l'identique : le relancer ne fait que dépenser du crédit et gonfler le compteur
 * de tentatives. D'où cette classification, volontairement CONSERVATRICE :
 *
 *  - `transient`  → cause externe et passagère (quota, rate-limit, réseau,
 *                   circuit ouvert, timeout, 5xx). Relance justifiée.
 *  - `permanent`  → cause intrinsèque au contenu ou à la configuration.
 *                   Ne pas relancer automatiquement.
 *  - `unknown`    → message non reconnu. Traité comme `permanent` par défaut :
 *                   on préfère laisser un job de côté que de brûler du crédit en
 *                   boucle sur un échec qu'on ne comprend pas.
 *
 * Module pur (aucun I/O) → testable sans mock.
 */

export type FailureClass = "transient" | "permanent" | "unknown";

/**
 * Motifs d'échec EXTERNES et passagers. Volontairement ancrés sur les libellés
 * réellement observés en base de production (`errorMessage`) plutôt que sur des
 * catégories théoriques.
 */
const TRANSIENT_PATTERNS: ReadonlyArray<RegExp> = [
  // Crédit / quota du compte provider — la cause des 3 pannes de juillet.
  /quota/i,
  /insufficient[_\s-]?quota/i,
  /credit[_\s-]?balance/i,
  /billing/i,
  /rate[_\s-]?limit/i,
  /\b429\b/,
  // Disponibilité provider.
  /circuit breaker/i,
  /provider .*(down|unavailable)/i,
  /\b5\d{2}\b(?!\d)/,
  /service unavailable/i,
  /overloaded/i,
  // Réseau / infrastructure.
  /timeout/i,
  /timed out/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /socket hang up/i,
  /fetch failed/i,
  /network/i,
  // Libellé réel observé 94× en production : « OpenAI API error undefined:
  // Connection error. » — coupure réseau côté sortie, sans code HTTP.
  /connection error/i,
  // Base de données / Redis transitoires.
  /deadlock/i,
  /connection pool/i,
  /connection terminated/i,
  /too many connections/i,
];

/**
 * Motifs d'échec INTRINSÈQUES : relancer reproduirait le même résultat.
 * Évalués EN PREMIER — un message peut contenir les deux vocabulaires (ex.
 * « aucun output valide après 3 itérations (timeout du juge) ») et la cause
 * dominante est alors bien la qualité, pas le réseau.
 */
const PERMANENT_PATTERNS: ReadonlyArray<RegExp> = [
  /aucun output valide/i,
  /output invalide/i,
  // Libellés réels observés en production (échecs de génération, pas d'infra).
  /plan invalide/i,
  /parse failed/i,
  /quality[_\s-]?gate/i,
  /content[_\s-]?filter/i,
  /doctrine/i,
  /plagia/i,
  /duplicate|doublon/i,
  /dedup/i,
  /keyword lock/i,
  /aucun mot[- ]cl[ée]/i,
  /no keyword available/i,
  /generator .*(not registered|introuvable)/i,
  /unsupported content type/i,
  /validation/i,
  /schema/i,
  /unique constraint/i,
];

/**
 * Classe un échec à partir de son message.
 *
 * @param errorMessage `errorMessage` du ContentGenJob (peut être null/vide).
 */
export function classifyFailure(errorMessage: string | null | undefined): FailureClass {
  const msg = (errorMessage ?? "").trim();
  if (msg.length === 0) return "unknown";

  for (const re of PERMANENT_PATTERNS) {
    if (re.test(msg)) return "permanent";
  }
  for (const re of TRANSIENT_PATTERNS) {
    if (re.test(msg)) return "transient";
  }
  return "unknown";
}

/**
 * Un job est-il relançable automatiquement ?
 *
 * Deux conditions cumulatives : l'échec doit être transitoire, ET le job ne doit
 * pas avoir déjà épuisé son budget de tentatives (sans quoi un provider durablement
 * dégradé ferait tourner le drain en boucle sur les mêmes jobs).
 */
export function isAutoRetryable(
  errorMessage: string | null | undefined,
  retryCount: number,
  maxRetries: number,
): boolean {
  if (retryCount >= maxRetries) return false;
  return classifyFailure(errorMessage) === "transient";
}
