/**
 * Qualiopi — Délai laissé pour saisir l'évaluation finale des acquis.
 *
 * Module PUR (aucun I/O, aucun `server-only`) : il est lu par l'évaluateur
 * d'alertes ET par le cron `attestations-auto` du worker.
 *
 * ⚠️ Ce n'est PAS un nouveau délai. C'est le littéral `daysAgo(2, now)` que la
 * règle R05 (« Évaluation finale des acquis manquante », `evaluateur.ts`) portait
 * seule, nommé pour être partagé.
 *
 * 🔴 Décision Will D1 (2026-09-14, audit initial, X-documents-pdf-04) :
 * l'attestation de fin de formation part même sans évaluation finale, mais pas
 * avant ce délai — émettre plus tôt préempterait une évaluation saisie en
 * retard. L'alerte qui réclame l'évaluation et le cron qui cesse de l'attendre
 * doivent lire la MÊME borne : deux littéraux « 2 » finiraient par diverger.
 */
export const DELAI_EVALUATION_FINALE_JOURS = 2;

/**
 * Borne de l'émission AUTOMATIQUE sans évaluation finale : DEUX jours après le
 * délai de R05.
 *
 * 🔴 2e relecture A09 (audit initial 2026-09-14). Sur la même borne que R05, R05
 * (07:00 UTC) ne laissait que deux heures avant `attestations-auto` (09:00 UTC).
 *
 * 🔴 3e relecture A09. Un seul jour de plus ne suffisait pas : pour une fin de
 * session entre 07:00 et 09:00 UTC, R05 se levait au passage de 07:00 du
 * lendemain de sa borne, et l'émission partait deux heures plus tard. Le calcul
 * qui ne dépend d'aucun horaire : R05 tourne chaque jour, donc elle se lève au
 * plus tard 24 h après `dateFin + délai R05`. Avec une borne d'émission à
 * `dateFin + délai R05 + 2 jours`, l'émission part au plus tôt 24 h après la
 * dernière levée possible de R05 — quelle que soit l'heure de fin (vérifié sur
 * les horaires réels lus dans `queues.ts`, par `attester-acte-habilite.spec.ts`).
 * Dérivée, jamais recopiée : R05 reste la référence.
 */
export const DELAI_EMISSION_SANS_EVALUATION_JOURS = DELAI_EVALUATION_FINALE_JOURS + 2;
